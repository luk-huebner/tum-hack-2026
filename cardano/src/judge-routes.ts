/**
 * The read-only part of the service: the tamper bench and the live board. Nothing here sends a transaction or spends
 * anything; the client only needs to read the validator's UTxOs and ask the node to evaluate a release, so it can be an
 * address-only client with no keys (see judge-site.ts, which runs this on a public host).
 */
import { readFileSync } from "node:fs";
import { Router, type Request, type Response } from "express";
import { type SignedResponse, hexOf, loadVector, paymentKeyHashHex, scriptAddress, scriptHash, sellerAddressBech32 } from "./engine.js";
import { allSpecs } from "./templates.js";
import { type Client, checkAgainst, evaluateRelease, evaluationWindow, findPolicyUtxo, parseRef, policyViewOf, withRetry } from "./proof.js";

const vectorDir = new URL("../vectors/tamper/", import.meta.url);

interface Standing {
  name: string;
  ref: string;
  note: string;
}
const standing: Standing[] = JSON.parse(readFileSync(new URL("../standing-policies.json", import.meta.url), "utf8"));
const standingRef = (name: string) => standing.find((s) => s.name === name)?.ref;

// ---------------------------------------------------------------------------
// Small guards: a per-client rate limit and a cap on parallel evaluations

const hits = new Map<string, number[]>();
const tooMany = (key: string, max: number, windowMs = 60_000): boolean => {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
};
let evaluating = 0;

const asSignedResponse = (value: unknown): SignedResponse => {
  const r = (value ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : typeof r[k] === "number" ? String(r[k]) : "");
  const response = { airnode: text("airnode"), requestHash: text("requestHash"), timestamp: text("timestamp"), data: text("data"), signature: text("signature") };
  if (!/^0x[0-9a-fA-F]{40}$/.test(response.airnode)) throw new Error("airnode must be a 0x address");
  if (!/^0x[0-9a-fA-F]{64}$/.test(response.requestHash)) throw new Error("requestHash must be 0x followed by 64 hex characters");
  if (!/^\d{9,12}$/.test(response.timestamp)) throw new Error("timestamp must be unix seconds");
  if (!response.data || response.data.length > 8000) throw new Error("data must be the signed text (at most 8000 characters)");
  if (!/^0x[0-9a-fA-F]{128,130}$/.test(response.signature)) throw new Error("signature must be 0x followed by 128 or 130 hex characters");
  return response;
};

const policySummary = (utxo: Parameters<typeof policyViewOf>[0]) => {
  const p = policyViewOf(utxo);
  return {
    rule: `${p.cmp === "Below" ? "below" : "at least"} ${p.threshold / 10 ** p.scale}`,
    payoutTada: Number(p.payout) / 1_000_000,
    maxAgeSeconds: p.maxAgeMs / 1000,
    deadline: new Date(p.deadlineMs).toISOString(),
    requestHash: `0x${p.requestHashHex}`,
    signerKey: `0x${p.signerHex}`,
  };
};


export { policySummary };

/** Everything locked at the validator that follows the Pay-on-Proof policy layout, decoded (newest deadline first, at most 40). */
export const boardRows = async (client: Client) => {
  const utxos = await withRetry(() => client.getUtxos(scriptAddress), 3);
  const known = new Map(allSpecs().map((spec) => [loadVector(spec.vectorName).requestHashHex, spec]));
  const sellerPkh = paymentKeyHashHex(sellerAddressBech32());
  const now = Date.now();
  return utxos
    .map((u) => {
      let p;
      try {
        p = policyViewOf(u);
      } catch {
        return undefined;
      }
      const spec = known.get(p.requestHashHex);
      const left = Math.round((p.deadlineMs - now) / 60_000);
      return {
        ref: `${hexOf(u.transactionId.hash)}#${Number(u.index)}`,
        lockedTada: Number(u.assets.lovelace) / 1_000_000,
        rule: spec ? spec.describe(p.threshold / 10 ** p.scale) : `a request this service does not know (${p.requestHashHex.slice(0, 8)}...)`,
        template: spec?.template ?? "unknown",
        deadline: new Date(p.deadlineMs).toISOString(),
        minutesLeft: left,
        state: left < 0 ? "deadline passed: refundable" : "open",
        paysThisService: p.beneficiaryHex === sellerPkh,
        observationCheck: p.obsSlot >= 0 ? `observation at most ${p.obsMaxAgeMs / 1000} s old` : "none",
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse((b as { deadline: string }).deadline) - Date.parse((a as { deadline: string }).deadline))
    .slice(0, 40);
};

export const judgeRoutes = (getClient: () => Client): Router => {
  const router = Router();

  // ---------------------------------------------------------------------------
  // The judge bench

  router.get("/api/policies", async (_req, res) => {
    const client = getClient();
    const rows = [];
    for (const s of standing) {
      try {
        const utxo = await findPolicyUtxo(client, s.ref);
        rows.push(utxo ? { ...s, status: "open", ...policySummary(utxo) } : { ...s, status: "spent" });
      } catch (error) {
        rows.push({ ...s, status: "unavailable", error: String((error as Error).message).slice(0, 80) });
      }
    }
    res.json({ validator: { hash: scriptHash, network: "Cardano preprod" }, policies: rows });
  });

  /** The five tamper cases of the API3 track plus a control before and after, in the order the page runs them. */
  const CASES = [
    { id: "control-first", label: "Real response (control)", file: "valid.json", policy: "bench-48h", expect: "ACCEPTED" },
    { id: "edited", label: "One value edited after signing", file: "edited.json", policy: "bench-48h", expect: "REJECTED" },
    { id: "stale", label: "Real response, but the policy allows only 5 minutes", file: "valid.json", policy: "bench-5min", expect: "REJECTED" },
    { id: "other-request", label: "A real response to a different request", file: "other-request.json", policy: "bench-48h", expect: "REJECTED" },
    { id: "foreign-signer", label: "Same data, signed by a key that is not the Airnode", file: "foreign-signer.json", policy: "bench-48h", expect: "REJECTED" },
    { id: "control-last", label: "Real response (control again)", file: "valid.json", policy: "bench-48h", expect: "ACCEPTED" },
  ];

  router.get("/api/cases", (_req, res) => {
    res.json(
      CASES.map((c) => ({
        ...c,
        ref: standingRef(c.policy),
        response: JSON.parse(readFileSync(new URL(c.file, vectorDir), "utf8")),
      })),
    );
  });

  router.post("/api/judge", async (req: Request, res: Response) => {
    if (tooMany(`judge:${req.ip}`, 30)) return void res.status(429).json({ error: "Slow down: at most 30 evaluations a minute." });
    if (evaluating >= 3) return void res.status(429).json({ error: "The bench is busy; try again in a few seconds." });
    evaluating += 1;
    const started = Date.now();
    try {
      const { ref, response: raw } = (req.body ?? {}) as { ref?: unknown; response?: unknown };
      let parsed: SignedResponse;
      try {
        parseRef(String(ref ?? ""));
        parsed = asSignedResponse(typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch (error) {
        return void res.status(400).json({ error: (error as Error).message });
      }
      const client = getClient();
      const utxo = await findPolicyUtxo(client, String(ref));
      if (!utxo) return void res.status(404).json({ error: "No such policy at the validator (spent, or a typo)." });
      const policy = policyViewOf(utxo);
      const now = Date.now();
      const check = checkAgainst(policy, parsed);
      const window = evaluationWindow(policy, check.signedMs, now);
      const verdict = await evaluateRelease(client, utxo, policy, parsed, now);
      // Hints are computed here, not by the contract. They only help read a rejection.
      const ageSeconds = Math.round((now - check.signedMs) / 1000);
      res.json({
        ...verdict,
        sentToChain: false,
        policy: policySummary(utxo),
        hints: {
          sameRequest: check.sameRequest,
          ageSeconds,
          maxAgeSeconds: policy.maxAgeMs / 1000,
          tooOld: ageSeconds * 1000 > policy.maxAgeMs,
          sum: check.value,
          threshold: check.threshold,
          ruleHolds: check.met,
          observationFresh: check.observationOk,
        },
        validity: { from: new Date(window.from).toISOString(), to: new Date(window.to).toISOString() },
        tookMs: Date.now() - started,
      });
    } catch (error) {
      res.status(502).json({ verdict: "ERROR", detail: `Could not get a verdict: ${String((error as Error).message).replace(/\s+/g, " ").slice(0, 160)}` });
    } finally {
      evaluating -= 1;
    }
  });


  /** Everything locked at the validator that follows the Pay-on-Proof policy layout, decoded, for the console's live board. */
  let boardCache: { at: number; rows: unknown[] } | undefined;
  router.get("/api/board", async (_req, res) => {
    try {
      if (!boardCache || Date.now() - boardCache.at > 10_000) {
        const rows = await boardRows(getClient());
        const now = Date.now();
        boardCache = { at: now, rows };
      }
      res.json({ validatorHash: scriptHash, count: boardCache.rows.length, rows: boardCache.rows });
    } catch (error) {
      res.status(502).json({ error: `Could not read the validator: ${String((error as Error).message).slice(0, 120)}` });
    }
  });

  return router;
};
