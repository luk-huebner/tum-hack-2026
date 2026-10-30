//// Engine tests with a REAL response for a creator's post: the TwitterAPI.io `tweetsByIds` request projected to
//// {authorId, createdAt, id, isReply, likes, replies, retweets, text, views} and signed by the Airnode on 30 Oct 2026.
//// The signed text carries the author's id, the creation time, the post id and the exact post text, so a policy built from it
//// accepts only responses about exactly that post by exactly that author, with exactly that text.

use aiken/primitive/bytearray
use engine.{AtLeast, Policy, release_ok}
use vectors/creator_post as cp

const signed_ms: Int = 1793386329000

fn policy() -> Policy {
  Policy {
    signer: cp.pubkey,
    request_hash: cp.request_hash,
    prefix: cp.prefix,
    separators: cp.separators,
    suffix: cp.suffix,
    scale: 0,
    slot_from: 0,
    slot_to: 1,
    cmp: AtLeast,
    threshold: 0,
    settle_after_ms: signed_ms - 600_000,
    deadline_ms: signed_ms + 3_600_000,
    max_age_ms: 300_000,
    beneficiary: #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refund_to: #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    payout: 5_000_000,
    obs_slot: -1,
    obs_max_age_ms: 0,
  }
}

fn release(p: Policy, lower: Int, upper: Int) -> Bool {
  release_ok(p, cp.timestamp, cp.slots, cp.signature, lower, upper)
}

test real_post_with_pinned_author_and_text_releases() {
  release(policy(), signed_ms + 1000, signed_ms + 100_000)
}

test one_like_required_but_the_post_has_none_is_refused() {
  !release(
    Policy { ..policy(), threshold: 1 },
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

// The text of an edited post, or another author's post, changes the signed text, so the policy's fixed text no longer
// rebuilds what the Airnode signed.
test a_changed_author_or_text_is_rejected() {
  !release(
    Policy { ..policy(), prefix: bytearray.concat(#"20", cp.prefix) },
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test a_response_signed_before_the_measurement_time_does_not_count() {
  !release(
    Policy { ..policy(), settle_after_ms: signed_ms + 600_000 },
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test a_response_signed_after_the_measurement_time_counts() {
  release(
    Policy { ..policy(), settle_after_ms: signed_ms - 1000 },
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}
