# How this becomes a service

**The short version.** The contract is open and free. The **keeper** is the service: it watches an escrow, pays for the data, and releases the money when the signed data proves the rule. It is priced so that we are paid only when it releases, which means we earn when the customer's outcome happens.

## What is free, what is a service, what could be premium

| Layer | What | Who pays | Status |
|---|---|---|---|
| **Open** | the contract, the verifier of API3 data, the public judge bench | nobody. This is how others can trust it and build on it | built |
| **The service** | the keeper: watches, buys data, releases; the buyer's refund after the deadline needs nobody's permission | the buyer of the job, **only when it releases**. A hired keeper job is 2 tADA by x402 today; through Masumi it would be paid in tUSDM | built with x402; the Masumi version is tested only against a stand-in |
| **Premium (not built as a product)** | campaign tools for brands and agencies: the creator intake with disclosure checks, plan files for tranches, evidence packs made of the signed responses, long watching windows with an uptime promise, two data sources that must agree | brands or agencies, per campaign or per month | the tools exist (`cardano/CREATOR_PAY.md`); no billing |

## What drives the cost of a job (no numbers on purpose)

- **Data.** Every check of a paid source costs money. A long window costs more than a short one, and a finished period (rainfall) is checked once. Escrows on the same post **share one look**, so a second escrow on a post costs almost nothing extra: cost follows the number of posts and windows, not the number of escrows.
- **The chain.** A fee for each release, paid by the keeper.
- **Today** we pay both ourselves on testnet and charge nothing real. We lose money on every job, and we know it.

## Which kind of company this is

- **Growth first, and we say so.** We would run at a loss until there is volume. The way to get volume is distribution: be an agent that Masumi buyers already find, where agents are hired and paid.
- **We are not harvesting a hype cycle.** Paying for a verified outcome is not tied to one trend, and agents buying outcomes is early. One use case, creator campaigns, can be fashionable, and we would not build the company on it alone.
- **Getting to break-even:** pass the data cost through; charge for long windows and tranche plans; keep the success-based price. A percentage fee would need a new version of the contract with a fee output; today the fee is the job price.

## What could hurt us

- The contract is open, so anyone can copy it. Our edge has to be reliability, trust (an external audit), data relationships and distribution, not secrecy.
- Masumi or API3 could build this themselves.
- The data fee is paid on an EVM chain today; paying for it on Cardano needs API3 to support it.
- We have not talked to a customer yet (`ITERATIONS.md`).
