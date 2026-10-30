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

## If the creator deletes the post, or edits it

- **Deleted before the final measurement:** nothing is paid. A deleted post comes back as an empty record, which cannot match the pinned author, creation time and id, so the buyer is refunded after the deadline.
- **Deleted after a payout:** money that has been released cannot be taken back. So pay in tranches:

  ```bash
  npx tsx src/creator-campaign.ts --source <id> --payee <creator addr_test1...> --at-least 5000 \
      --campaign-minutes 1440 --hold-minutes 10080            # prints the plan, pays nothing
  npx tsx src/creator-campaign.ts ... --lock                  # pays the escrows, one x402 payment after the other
  ```

  One third (one 5 tADA escrow) counts a measurement taken after the campaign ends; two thirds (two escrows) count only a measurement taken after the retention period, so a post deleted in between costs the creator that part, and the buyer gets it back after the deadline. Every tranche is an ordinary escrow on the same post and rule, and the shares are set by how many escrows go into each (`--after`, `--hold`). Offers may now run up to 8 days.
- **A creator bond (not scripted, the contract allows it):** the creator pays the deposit, the payee is the creator and the refund party is the brand, so the deposit returns to the creator only if the post is still there at the end and goes to the brand otherwise.
- **Edited post:** `--pin-text` in the intake puts the exact text into the signed text, so an edit (a removed `#ad`, a changed claim) means the policy no longer matches and nothing is paid. Tested on a real post: the registration fetched twice and the fixed text was identical (431 bytes); five contract tests with the real signed response pass in CI (`lib/creator_post.test.ak`). Risks: a larger datum and a policy that breaks if the provider ever encodes emoji or accents differently; a post whose text contains something like `:12,` cannot be pinned (the intake refuses).
- **Proof stays on chain:** the release transaction carries the signed response, which shows that the post existed with its likes at that time, even if it is deleted later.

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

- Run on chain once (30 Oct, `PROOFS.md`, "Tranches on chain"): a campaign tranche paid to a payee that is not the seller after its window opened, and a retention tranche that did not pay when the post no longer met the rule and was refunded. The deletion was simulated by unliking; a post deleted for real, a retention period of days and a payee that is someone else's wallet are untested.
- A tranche is a whole 5 tADA escrow, so shares are multiples of one escrow, and each escrow is a separate x402 payment (about a minute each).
- A retention period of up to about 8 days fits (the keeper must run all that time, and the money is locked all that time).
- The disclosure check reads the text. X's own paid-partnership label is not part of the data we receive.
- One tweet source is one post; a creator posting a thread needs a source per post.
- Edited posts: without `--pin-text` an edit is not noticed. How the data provider treats an edited post's id (X gives edited posts a new id, we believe) was not tested.
- No dispute process and no external audit.
