# What we changed because someone challenged us

Pay-on-Proof was built on 30 Oct 2026 at the TUM Blockchain & AI Hackathon (44 commits so far). This is the list of challenges we met, what we changed, and where the evidence is. Every row came from a person or from our own testing; none was planned in advance. The point of keeping it: the first version of the idea was not the best one, and we want to show how it moved.

| # | The challenge | What we changed | Evidence |
|---|---|---|---|
| 1 | A teammate's six-point critique: what does it prove, why not Stripe and a backend, what if the oracle is wrong, replay, disputes | A trust sheet that says what the contract proves and what it does not; an attack matrix run against the real contract | `TRUST.md`, `cardano/src/attacks.ts` |
| 2 | **Our own attack matrix found a flaw**: two policies with the same beneficiary could be spent with one payment | A new validator (one input of ours per transaction, and the beneficiary must receive at least what is locked). The first version is kept as evidence and the same attack is now refused | `PROOFS.md`, "Validator revision" |
| 3 | "Is the data fresh?" The signature only says when the Airnode signed | An optional observation-time check for feeds that sign it | `AUDIT.md`, the engine tests |
| 4 | A teammate: a price threshold looks like a prediction-market bet and says nothing new | The price feed became a free test fixture; the real use cases are likes of a post and measured rainfall | `README.md`, the console |
| 5 | "How often should the keeper look? Every look costs money" | A schedule derived from cost, data kind and trend; simulated against fixed paces; checked live on two escrows (0.13 aUSD in all) | `POLLING.md` |
| 6 | "Can it do YouTube, Instagram?" | Tested through LunarCrush: a YouTube view count fits (8 tests) but the numbers are snapshots, so it cannot back a live counter; a generic tool turns any AirnodeHub request into a source | `PROOFS.md`, `cardano/SOURCES.md` |
| 7 | "Is it fast enough to show live?" | Measured: a like reaches the signed count in about 2 s; a live like became an on-chain payout in 53 s; a booth mode for the keeper | `PROOFS.md` |
| 8 | "How do we get the post's ID, and how do we know it is the creator's?" | An intake that pins the author's id, the creation time and the post id into what the Airnode signs, and requires a disclosure tag | `cardano/CREATOR_PAY.md` |
| 9 | "What if the creator buys likes or views?" | Count only a measurement taken at the end; pay on the increase over today's number; hold part back | `cardano/CREATOR_PAY.md` |
| 10 | "What if the creator deletes the post after being paid? Some posts live only 24 hours" | Payouts in tranches from a plan file per creator type; pinned text so an edit stops the payout. **Run on chain:** the campaign part paid to a named payee, the retention part was refunded | `PROOFS.md`, "Tranches on chain"; `cardano/plans/` |
| 11 | Compared with PolyTrack, Polymarket's creator-payment tool (press reports only) | Took the per-post time window and the review before paying; refused the flat fee detached from results; made disclosure a requirement | `cardano/CREATOR_PAY.md` |
| 12 | API3's rule: "a way for judges to send responses" | A public judge site with no key on the host, 6 of 6 on the bench | `cardano/HOSTING.md` |
| 13 | "Where is the agent in agentic commerce?" | An autonomous keeper (a budget, backoff, a log) and seven tools for an AI agent, with spending off by default | `cardano/MCP.md` |
| 14 | **The Cardano team: API3 is not integrated with Cardano, and a rival to Masumi would have to be much better** | Not a rival, a bridge: the hired keeper is a Masumi agent that sells outcome-based jobs, with our contract settling the outcome. Built to Masumi's interface, tested against a stand-in, **not yet run against a real payment service** | `cardano/MASUMI.md` |

**And our own mistakes, each fixed after it showed up:** the keeper released our public test bench (once early on, and a second time it was stopped just before it did; it now skips the bench whatever it is set to serve); a payment that had settled was reported to the buyer as failed (HTTP 402 after about 61 seconds; the clients now look for the escrow by its datum, and so does the tranche planner); the keeper once labelled a confirmed release as rejected after a network error (submit and confirm are now separate); it once bought data and then threw it away because of a cooldown (now checked first). Details in `PROOFS.md`.

## What we do not know

- **The market.** We have not talked to a customer. We have three guesses, each testable in two weeks:
  1. *Brands and creator agencies* that want to pay for a result and not for a promise. Test: five conversations and one pilot with one creator on preprod.
  2. *Agent sellers on Masumi* who want to sell outcome-based jobs. Test: ask Masumi which jobs agents are asked for that depend on a fact outside the agent.
  3. *Communities paying out on public data* (weather, events, scores). Test: one small pilot with a real organiser.
- **Whether the contract is safe enough for real money.** It is not audited. Two low findings are left documented on purpose (`AUDIT.md`).

## If we continue

1. An external audit of the validator (a new validator would also close the two documented findings and could add a second data source that must agree, and a buyer veto window).
2. Run the Masumi layer against a real payment service and register the agent.
3. One real pilot, on preprod first, mainnet only after the audit.
4. Data payments on Cardano, which needs API3 to support them; today the keeper pays for data in aUSD on Base Sepolia.
5. Whatever the first customer asks for that we have not thought of.
