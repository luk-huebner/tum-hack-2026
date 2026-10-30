//// Engine tests with a REAL AirnodeHub response: Open-Meteo `historicalWeather`, Munich, 10 to 23 Oct 2026,
//// 14 projected daily rainfall values (sum 26.20 mm), signed by the Open-Meteo Airnode on 30 Oct 2026.

use aiken/collection/list
use engine.{AtLeast, Below, Policy, parse_scaled, release_ok}
use vectors/meteo

const signed_ms: Int = 1793355726000

fn policy() -> Policy {
  Policy {
    signer: meteo.pubkey,
    request_hash: meteo.request_hash,
    prefix: meteo.prefix,
    separators: meteo.separators,
    suffix: meteo.suffix,
    scale: 2,
    slot_from: 0,
    slot_to: 14,
    cmp: Below,
    threshold: 3000,
    settle_after_ms: signed_ms - 86_400_000,
    deadline_ms: signed_ms + 3_600_000,
    max_age_ms: 300_000,
    beneficiary: #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refund_to: #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    payout: 5_000_000,
  }
}

fn release(p: Policy, slots: List<ByteArray>, lower: Int, upper: Int) -> Bool {
  release_ok(p, meteo.timestamp, slots, meteo.signature, lower, upper)
}

// The valid case and the rule

test real_rain_window_below_30mm_releases() {
  release(policy(), meteo.slots, signed_ms + 1000, signed_ms + 100_000)
}

test rule_not_met_when_threshold_is_20mm() {
  !release(
    Policy { ..policy(), threshold: 2000 },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test at_least_rule_holds_for_20mm() {
  release(
    Policy { ..policy(), cmp: AtLeast, threshold: 2000 },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test one_day_sum_d11_is_10mm() {
  release(
    Policy { ..policy(), cmp: AtLeast, threshold: 1000, slot_from: 11, slot_to: 12 },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test one_day_sum_d00_is_below_10mm() {
  !release(
    Policy { ..policy(), cmp: AtLeast, threshold: 1000, slot_from: 0, slot_to: 1 },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

// The four required tamper cases, plus replay-style and shape cases

test tamper_edited_value_is_rejected() {
  !release(
    policy(),
    [#"302e3930", ..list.drop(meteo.slots, 1)],
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test tamper_stale_response_is_rejected() {
  !release(policy(), meteo.slots, signed_ms + 1000, signed_ms + 300_001)
}

test tamper_different_request_is_rejected() {
  !release(
    Policy {
      ..policy(),
      request_hash: #"0000000000000000000000000000000000000000000000000000000000000001",
    },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test tamper_wrong_signer_is_rejected() {
  !release(
    Policy {
      ..policy(),
      signer: #"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test attestation_from_the_future_is_rejected() {
  !release(policy(), meteo.slots, signed_ms - 1000, signed_ms + 100_000)
}

test window_not_yet_settled_is_rejected() {
  !release(
    Policy { ..policy(), settle_after_ms: signed_ms + 1 },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test release_after_deadline_is_rejected() {
  !release(
    Policy { ..policy(), deadline_ms: signed_ms + 50_000 },
    meteo.slots,
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

test missing_slot_is_rejected() {
  !release(
    policy(),
    list.take(meteo.slots, 13),
    signed_ms + 1000,
    signed_ms + 100_000,
  )
}

// Decimal parsing

test parse_two_decimals() {
  parse_scaled("6.90", 2) == 690
}

test parse_pads_missing_decimals() {
  parse_scaled("0.1", 2) == 10
}

test parse_integer() {
  parse_scaled("10", 2) == 1000
}

test parse_zero() {
  parse_scaled("0.00", 2) == 0
}

test parse_too_many_decimals_halts() fail {
  parse_scaled("1.234", 2) == 123
}

test parse_two_dots_halts() fail {
  parse_scaled("1.2.3", 2) == 0
}

test parse_letters_halts() fail {
  parse_scaled("abc", 2) == 0
}

test parse_empty_halts() fail {
  parse_scaled("", 2) == 0
}

test parse_lone_dot_halts() fail {
  parse_scaled(".", 2) == 0
}

test parse_negative_halts() fail {
  parse_scaled("-1", 2) == 0
}
