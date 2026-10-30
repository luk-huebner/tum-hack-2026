# Creator Pay: paying a creator for a specific post

A brand agrees with a creator on one post and a result. The money waits in the contract; the post's data decides.

## The flow

1. **Agree the terms off-chain:** which post (it must be new), the number to reach, the campaign length, the creator's Cardano address and that the post says it is paid (`#ad` or similar).
2. **The creator posts**, taps Share, then Copy link. The link is `https://x.com/<handle>/status/<ID>`; the number after `/status/` is the id. The id cannot exist before the post, so the escrow is locked after it.
3. **Intake** (the brand's side, 0.01 aUSD):
   ```bash
   cd cardano
   npx tsx src/creator-intake.ts --tweet <link> --creator <handle> --target 500 --register
   ```
   It shows who posted, when, what it says and how many likes it has now. It refuses unless the author is the agreed creator, the post is new, not a reply, not a repost, and carries a disclosure tag. It writes a spec whose signed text includes the author's numeric id, the creation time, the id and `isReply: false`, so the policy accepts only responses about exactly that post by exactly that author. `--target 500` means 500 more likes than today (baseline plus target); `--register` buys two more looks (0.02 aUSD) to prove the fixed text does not change.
4. **Lock the escrow** (5 tADA by x402; the command is printed by the intake):
   ```bash
   npx tsx src/escrow-client.ts --template source --source <id> --at-least <baseline + target> \
       --minutes 1440 --measure-after-minutes 1380 --payee <the creator's addr_test1...>
   ```
   `--payee` is who is paid (the creator), the buyer's wallet is the refund party, and `--measure-after-minutes` makes only a measurement signed in the last hour count.
5. **The keeper** watches, then releases to the creator when the signed count proves the rule; it must be allowed to serve that payee (`AUTO_RELEASE_PAYEES=<creator address>`). Anyone can run it: the contract pays the payee whoever submits.
6. **No result in time:** the buyer takes the money back after the deadline.

## What each party can check

| Who | Sees on chain |
|---|---|
| The creator, before posting more or accepting | the escrow exists, its amount, the rule in words, the payee (their own key), the measurement time and the deadline |
| The brand | the same, plus that the post, author and creation time are pinned: another post or another author's post cannot satisfy it |
| A judge | the transaction hashes in `PROOFS.md`, and the board on the public site |

## Bought likes and views

The contract proves what the data said, not that the likes are real. What the design does about it:

- **Measure at the end** (`measureAfterMs`, enforced by the validator as `signed >= settle_after`): a boost in the middle of the campaign does not count.
- **Pay on the increase** (baseline plus target) so an already popular post does not qualify by itself.
- **Hold back with a second escrow:** half pays at the number, half only if a measurement a week later still shows it (the contract is used twice, with different measurement times).
- **Make faking not worth it:** keep the payout small against the cost of buying engagement; likes, replies and reposts can be summed (adjacent fields).
- **Do not pay on views alone:** bot views are cheap.

Needs a new validator (not built): two sources that must agree, two measurements a set time apart, a buyer veto window, ratio rules, payment proportional to the count.

## What we learnt from PolyTrack

PolyTrack is Polymarket's own creator-payment dashboard. It has no public documentation that we could find; what is known comes from press reports of a program that pays hundreds of X accounts to quote-post its esports accounts (an investigation by ReaderGrev, reported by Aftermath on 15 Oct 2026, and echoed elsewhere). Whether access is invite-only is not stated. Per those reports:

- Creators enter tax data, a crypto wallet address and the posts they are to be paid for, and see monthly and lifetime earnings.
- Guidelines say what kind of post qualifies (an own take, not "wow"), staff review captions, and a post counts for **24 hours** only.
- **Pay is a flat rate agreed at joining, based on the creator's average views before, not on how the paid post performs.** That sidesteps bought engagement, at the price of paying for audience and not for result.
- Payment is in crypto since PayPal accounts kept getting blocked.
- The same reporting says a reminder to use the paid-partnership tag stopped appearing in the program's prompts. We take the opposite line: the intake **requires a disclosure tag**.

What we took from it, and from other public creator-payment documentation (per-view payouts with a cap, a baseline and increments, top-N splits):

| Practice | Ours |
|---|---|
| The creator submits the posts to be paid and a wallet | link plus address in the intake |
| A time window per post | the measurement time and the deadline, enforced by the contract |
| Pay on audience, not on a spike | baseline plus target; measure at the end; flat pay is possible with a threshold of 1 |
| Review before paying | the brand reviews the post in the intake before locking; the contract pays by data afterwards |
| Disclosure | required by the intake |
| Tiers, caps | one escrow per tier (a ladder); a cap is the payout itself; payment proportional to the count needs a new validator |
| A dashboard | the console's board and the public site |

## Limits

- Not run end to end on chain with a payee other than the seller and a measurement time yet; the offer, datum and keeper rules were tested offline (`PROOFS.md`), and the contract refuses an early measurement in CI.
- The disclosure check reads the text. X's own paid-partnership label is not part of the data we receive.
- One tweet source is one post; a creator posting a thread needs a source per post.
- Edited posts: how the data provider treats an edited post and its id was not tested.
- No dispute process and no external audit.
