# The outcome keeper as a Masumi agent

Masumi settles whether an agent **delivered** a job (a result hash, a refund window, disputes). Pay-on-Proof settles against an **external fact** signed by a data provider (no dispute, a refund on the deadline that needs nobody's consent). The two fit together: a Masumi buyer hires the keeper through Masumi, and the keeper's job is to prove and release a conditional payment that sits in our contract. That makes outcome-based jobs possible for Masumi agents, for example "pay the creator when the post has 5,000 likes".

```
buyer ──hire & pay (tUSDM)──▶ Masumi escrow ──job──▶ our keeper (this agent)
                                                         │ watches the escrow, buys signed data, proves the rule
creator ◀── 5 tADA released by OUR contract ◀────────────┘ (the release carries the signed response)
                                                         │ result = "released, <tx hash>" ──hash──▶ Masumi, which pays the keeper
```

## The agent interface (MIP-003)

`src/masumi-agent.ts`, mounted at `/masumi` when the service starts with `MASUMI_ENABLED=1`:

| Route | What it does |
|---|---|
| `GET /availability` | `{status: "available", type: "masumi-agent"}` (unavailable until a payment service is configured) |
| `GET /input_schema` | one field, `policy`: the escrow to watch (`<tx hash>#<index>`) |
| `POST /start_job` | `{identifier_from_purchaser, input_data: {policy}}`. Checks that the escrow is open, that its data request is known, that its payee is one the keeper serves (`AUTO_RELEASE_PAYEES`), that it is not the public test fixture and that its deadline leaves at least about 30 minutes. Then asks the Masumi payment service (MPS) for a payment request (`POST /api/v1/payment`, tUSDM, 1 unit by default) and answers with `id, blockchainIdentifier, payByTime, submitResultTime, unlockTime, externalDisputeUnlockTime, agentIdentifier, sellerVKey, identifierFromPurchaser, input_hash` |
| `GET /status?job_id=` | `awaiting_payment`, `running`, `completed` (with the result) or `failed` |

The job: once the buyer's payment is locked (`resolve-blockchain-identifier` reports `FundsLocked`, confirmed), the keeper watches the escrow (it already does, see `autorelease.ts`). When the escrow has been released, or the deadline is near, the agent writes a short JSON result (released with the transaction hash, or not released by the deadline), submits `sha256(nonce;result)` to the MPS (`POST /api/v1/payment/submit-result`) and marks the job completed once the MPS shows `ResultSubmitted` with that hash. The result is checkable by anyone: the release transaction carries the signed response.

Safety: a job is saved before the payment service is called and an identifier is never used twice (a different input with the same identifier is refused); an unpaid job fails after its pay-by time; a payment that arrives too late fails the job.

## Run it

```bash
cd cardano
MASUMI_ENABLED=1 AUTO_RELEASE=1 AUTO_RELEASE_PAID=1 AUTO_RELEASE_PAYEES=<the creators' addr_test1...> \
MPS_URL=http://127.0.0.1:3001 MPS_RUNTIME_TOKEN=... MASUMI_REGISTRATION_FILE=path/to/registration-state.json \
npx tsx src/service.ts
```

The registration file (or `MASUMI_AGENT_IDENTIFIER`, `MASUMI_SELLER_VKEY`, `MASUMI_PAYMENT_SOURCE_INDEX`) comes from registering the agent with the MPS. Masumi's own TUM hackathon quickstart (`github.com/masumi-network/tum-hackathon-quickstart`) shows how: run the MPS yourself (it needs Docker, a database, a selling wallet funded with test ADA), create a runtime key and register with `apiBaseUrl` = `http://127.0.0.1:4022/masumi`.

## What is tested, and what is not

- **Tested (23 checks, `npx tsx scripts/masumi-test.ts`, no network, no money):** the four routes; the refusals (a short identifier, a wrong input, an escrow the keeper does not serve, one too close to its deadline, the same identifier with another input); the payment request the agent sends (tUSDM, the input hash, the payment source type); the whole life cycle against a stand-in for the payment service up to `completed`, including that the submitted hash is `sha256(nonce;result)`; an unpaid job failing; 503 without a payment service.
- **Not tested:** a real Masumi payment service, a real registration, a real tUSDM payment, a Sokosumi buyer. This machine has no Docker, so the payment service cannot run here. The request and answer shapes were written from Masumi's quickstart code and the MIP-003 text and may differ in details.
- **Not claimed:** anything about Masumi's escrow contract (we could not read it) or about points in the judging.

## Limits

- The data the keeper buys is still paid in aUSD on Base Sepolia, because API3's payment rails are EVM; Cardano-native payment for the data would need API3 to support it.
- A job covers one escrow, and only escrows whose payee the keeper is allowed to serve.
- The job lasts until the escrow's deadline minus 5 minutes at most (8 days at most).
