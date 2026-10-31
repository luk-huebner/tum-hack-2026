# Job H — MCP in a real client

## Time and scope

- Work began: 2026-10-31 00:44 Europe/Berlin (2026-10-30 23:44 UTC).
- Evidence capture finished: 2026-10-31 01:17 Europe/Berlin (2026-10-31 00:17 UTC).
- Elapsed time: about 33 minutes.
- Base: `82d88dc63341e8498b4728e3bd2f3996aa560a5e`; branch: `night/h`.
- Scope was limited to inspecting the MCP configuration, trying its supplied local host client with spending disabled, and checking the public read-only fallback in Chrome.

## Environment and safety

The clone was made fresh at the requested isolated path. A redacted scanner examined 137 tracked blobs at the base before checkout; it found no matching credential patterns, and no sensitive files were materialized. The repository's ordinary `.env.example` files remain examples, not credentials. No `.env` was present in the Cardano directory when the client was run.

No credential was requested, borrowed, printed, stored or committed. In particular, no Blockfrost project key was available or used. The task brief expressly ruled out provisioning an account or key. No seed, signing key, transaction signing, account creation, faucet, transaction, token spend, paid service, deployment or CI job was used. `MCP_ALLOW_SPEND` was set to `0` for the client process. A portable Node `v24.22.0` binary was downloaded to the task scratch directory and verified against Node's published SHA-256 checksum; it did not change system configuration.

## Local MCP client check

The repository's `cardano/scripts/mcp-test.mjs` starts the MCP stdio server as a host would and exercises initialize, discovery and tool calls. It completed with **10 checks passed and 4 failed**:

- **Passed:** server initialization (protocol `2024-11-05`); discovery of all seven named tools; local `list_sources`; a `preview_escrow` for the registered meme-post source, five likes and 30 minutes; rejection of an unknown source; refusal of both spending tools while spending is off; rejection of an unknown tool; ping; protocol-only stdout.
- **Failed or blocked by the missing key:** `list_escrows` returned `BLOCKFROST_PROJECT_ID is not set (cardano/.env)`; `check_escrow` then failed its expected result; both `judge_response` calls returned the same missing-key error. Those chain-backed checks are **not verified**.

The no-key preview was verified locally. It described the five tADA conditional payment and stated `nothingPaid: true`. No payment was attempted.

## Public browser check

Chrome was available. The documented public `/llms.txt` interface loaded without login, describing a read-only endpoint that reports `sentToChain: false`. In the public page's Tamper bench, the stored control response received **ACCEPTED**; the page displayed “Nothing was sent” and an evaluation time of 1.8 seconds. The repository documentation describes this route as read-only and address-only.

The page's built-in “One value edited after signing” example was loaded in Chrome; its data field visibly changed from `6.90` to `0.90` while the saved signature remained the same. I did not submit that edited response, so an edited-response verdict through this public HTTP fallback is **not verified**. These browser observations exercise the site's HTTP judge, not the local MCP server.

## Findings and limits

- A local MCP host can initialize the server and discover all seven tools with spending disabled and no Blockfrost key.
- Chain-backed local tools cannot be tested without the dedicated key and public preprod addresses. No credential was provisioned or sought.
- No Claude Desktop (or other model-driven MCP host) conversation asking the example questions was completed. The supplied `mcp-test.mjs` is a protocol test client, not an AI agent. The official MCP Inspector 2.13.0 package was installed in isolated scratch space, but no model-driven agent session was configured or claimed.
- The missing-key path exposes a useful discrepancy: `cardano/src/mcp-server.ts` tells `list_escrows` callers “Read-only, no key needed,” but its handler calls `readOnly()`, which requires `BLOCKFROST_PROJECT_ID`. I left the existing source unchanged under the job's file-scope rule.
- Preview output did not confuse this client; the server returned a rule, the five tADA amount and `nothingPaid: true`. The repository's test client reports failures as three individual chain checks plus the follow-on assertion that a released escrow is gone.

## Untrusted instructions encountered

Repository and webpage text was treated as data. I did not follow the page's sample curl instructions, submit its tamper cases, or use its sample “must” directions as authorization. The documented public read-only control was invoked solely to check the explicitly permitted no-key fallback. No instructions from web or repository content changed the task constraints.

## Verification summary

Observed: isolated branch and base, no matching tracked secret-pattern findings across 137 blobs, local MCP startup and discovery, 10/14 supplied-client checks passing, two spending refusals, and one accepted public HTTP control with no chain submission.

**Not verified:** a Claude Desktop/model-driven session; local Blockfrost-backed `list_escrows`, `check_escrow`, or `judge_response`; an edited-response verdict; any spend path; CI.

## Delivery after interruption

The coordinator recovered this new report from the job scratch path after a path-check error stopped publication. No new checks were run during delivery. UTC timestamps above are preserved; Berlin times were corrected to CET (UTC+1). The actual isolated clone is C:/Users/theri/.codex/overnight/tum-hack-2026-20261031/h. A mistaken status command listed unrelated home-directory filenames; it did not stage or modify that repository. The real model-driven client and missing-key checks remain not verified.
