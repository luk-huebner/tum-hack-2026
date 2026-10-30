//// Engine tests with a REAL AirnodeHub response: LunarCrush `post` for a YouTube video, projected by the request to
//// {"comments":6376,"id":"-CP1gxzpGhY","likes":25750,"views":1090232} and signed by the LunarCrush Airnode on 30 Oct 2026.
//// The point: a view count from a platform other than X fits the same validator with no change to it. The id is part of
//// the signed text (and of the request hash), so a policy about this video cannot be satisfied by another one.

use engine.{AtLeast, Policy, release_ok}
use vectors/lunar_youtube as yt

const signed_ms: Int = 1793381284000

fn policy() -> Policy {
  Policy {
    signer: yt.pubkey,
    request_hash: yt.request_hash,
    prefix: yt.prefix,
    separators: yt.separators,
    suffix: yt.suffix,
    scale: 0,
    slot_from: 2,
    slot_to: 3,
    cmp: AtLeast,
    threshold: 1_000_000,
    settle_after_ms: signed_ms - 86_400_000,
    deadline_ms: signed_ms + 3_600_000,
    max_age_ms: 300_000,
    beneficiary: #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refund_to: #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    payout: 5_000_000,
    obs_slot: -1,
    obs_max_age_ms: 0,
  }
}

fn release(p: Policy, slots: List<ByteArray>, lower: Int, upper: Int) -> Bool {
  release_ok(p, yt.timestamp, slots, yt.signature, lower, upper)
}

test real_youtube_views_at_least_one_million_releases() {
  release(policy(), yt.slots, signed_ms + 1000, signed_ms + 100_000)
}

test views_exactly_at_the_threshold_release() {
  release(
    Policy { ..policy(), threshold: 1_090_232 },
    yt.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test one_view_short_of_the_threshold_is_refused() {
  !release(
    Policy { ..policy(), threshold: 1_090_233 },
    yt.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test the_likes_slot_alone_can_be_the_rule() {
  release(
    Policy { ..policy(), slot_from: 1, slot_to: 2, threshold: 25_000 },
    yt.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test edited_view_count_is_rejected() {
  !release(
    policy(),
    [#"36333736", #"3235373530", #"39393939393939"],
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test a_response_for_another_video_is_rejected() {
  !release(
    Policy {
      ..policy(),
      request_hash: #"0000000000000000000000000000000000000000000000000000000000000001",
    },
    yt.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test wrong_signer_is_rejected() {
  !release(
    Policy {
      ..policy(),
      signer: #"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    },
    yt.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test stale_response_is_rejected() {
  !release(policy(), yt.slots, signed_ms + 1000, signed_ms + 300_001)
}
