//// Pay-on-Proof engine: pure logic, no transaction context.
////
//// A policy pins WHO may speak (the Airnode's public key), WHAT they must have been asked (the request hash) and
//// the SHAPE of the signed text (fixed fragments around numeric slots). A release carries the slot values, the
//// Airnode's signature and its timestamp. The contract rebuilds the signed text byte for byte, checks the
//// signature, the clock, and then applies one rule to the slots. Nothing is parsed out of the response that was
//// not first proven to be part of the signed bytes.

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/primitive/bytearray
use airnode

pub type Cmp {
  /// the sum of the selected slots must be strictly below the threshold
  Below
  /// the sum of the selected slots must be at least the threshold
  AtLeast
}

pub type Policy {
  /// 33-byte compressed secp256k1 key of the Airnode. Pinned, never taken from the response.
  signer: ByteArray,
  /// 32-byte hash of the exact request (operation, parameters, projection) that the Airnode must have answered.
  request_hash: ByteArray,
  /// Signed text before the first slot, for example {"d00":
  prefix: ByteArray,
  /// Signed text between slot i and slot i+1. One entry fewer than there are slots.
  separators: List<ByteArray>,
  /// Signed text after the last slot, for example }
  suffix: ByteArray,
  /// Decimal digits kept when a slot is parsed. 2 means "6.90" becomes 690.
  scale: Int,
  /// The rule sums slots slot_from (inclusive) to slot_to (exclusive).
  slot_from: Int,
  slot_to: Int,
  cmp: Cmp,
  /// Already multiplied by 10^scale.
  threshold: Int,
  /// The attestation must have been signed at or after this time (POSIX milliseconds). For windowed data this is
  /// the end of the window plus the time the upstream needs to settle.
  settle_after_ms: Int,
  /// A release must be valid before this time, a refund only after it (POSIX milliseconds).
  deadline_ms: Int,
  /// Maximum age of the attestation when the transaction is validated (milliseconds).
  max_age_ms: Int,
  beneficiary: VerificationKeyHash,
  refund_to: VerificationKeyHash,
  /// Lovelace the beneficiary must receive on release. The validator also requires at least the lovelace locked in the
  /// UTxO, so nothing locked above the payout can be taken by whoever submits the release.
  payout: Int,
  /// Index of the slot that holds the time the value was OBSERVED, in POSIX milliseconds (for example the `updatedAt`
  /// that a price feed signs), or -1 when the feed carries none. The signature timestamp says when the Airnode signed;
  /// this says how old the value itself was.
  obs_slot: Int,
  /// How old the observation may be at the moment the Airnode signed (milliseconds). Ignored when obs_slot is -1.
  obs_max_age_ms: Int,
}

// ---------------------------------------------------------------------------
// Decimal parsing: digits and at most one dot, nothing else. Anything else halts the script.

fn pow10(n: Int) -> Int {
  if n <= 0 {
    1
  } else {
    10 * pow10(n - 1)
  }
}

fn parse_from(
  bytes: ByteArray,
  i: Int,
  n: Int,
  acc: Int,
  digits: Int,
  frac: Int,
  seen_dot: Bool,
) -> (Int, Int) {
  if i == n {
    if digits == 0 {
      fail @"no digits"
    } else {
      (acc, frac)
    }
  } else {
    let b = bytearray.at(bytes, i)
    if b == 46 {
      if seen_dot {
        fail @"two dots"
      } else {
        parse_from(bytes, i + 1, n, acc, digits, frac, True)
      }
    } else if b >= 48 && b <= 57 {
      let next_frac =
        if seen_dot {
          frac + 1
        } else {
          frac
        }
      parse_from(
        bytes,
        i + 1,
        n,
        acc * 10 + b - 48,
        digits + 1,
        next_frac,
        seen_dot,
      )
    } else {
      fail @"not a decimal"
    }
  }
}

/// "6.90" with scale 2 is 690. "10" with scale 2 is 1000. More decimals than the scale halt the script.
pub fn parse_scaled(bytes: ByteArray, scale: Int) -> Int {
  let (acc, frac) = parse_from(bytes, 0, bytearray.length(bytes), 0, 0, 0, False)
  if frac > scale {
    fail @"more decimals than the scale"
  } else {
    acc * pow10(scale - frac)
  }
}

fn sum_range(
  slots: List<ByteArray>,
  from: Int,
  to: Int,
  scale: Int,
  index: Int,
  acc: Int,
) -> Int {
  when slots is {
    [] -> acc
    [slot, ..rest] ->
      if index >= to {
        acc
      } else if index >= from {
        sum_range(rest, from, to, scale, index + 1, acc + parse_scaled(slot, scale))
      } else {
        sum_range(rest, from, to, scale, index + 1, acc)
      }
  }
}

// ---------------------------------------------------------------------------
// Rebuilding the signed text from the template and the slot values.

fn rebuild(
  acc: ByteArray,
  slots: List<ByteArray>,
  separators: List<ByteArray>,
  suffix: ByteArray,
) -> ByteArray {
  when slots is {
    [] -> bytearray.concat(acc, suffix)
    [slot, ..rest] ->
      when separators is {
        [] -> bytearray.concat(bytearray.concat(acc, slot), suffix)
        [separator, ..more] ->
          rebuild(
            bytearray.concat(bytearray.concat(acc, slot), separator),
            rest,
            more,
            suffix,
          )
      }
  }
}

pub fn signed_text(policy: Policy, slots: List<ByteArray>) -> ByteArray {
  rebuild(policy.prefix, slots, policy.separators, policy.suffix)
}

// ---------------------------------------------------------------------------
// Observation freshness: the signed text may carry the time the value was observed.

fn nth(slots: List<ByteArray>, index: Int) -> ByteArray {
  when slots is {
    [] -> fail @"observation slot missing"
    [slot, ..rest] ->
      if index == 0 {
        slot
      } else {
        nth(rest, index - 1)
      }
  }
}

/// The observation may not be later than the signature (one second of slack: the signed timestamp is whole seconds)
/// and may not be older than max_age_ms at the moment of signing.
pub fn observation_fresh(obs_ms: Int, signed_ms: Int, max_age_ms: Int) -> Bool {
  and {
    obs_ms <= signed_ms + 1000,
    signed_ms - obs_ms <= max_age_ms,
  }
}

fn observation_ok(policy: Policy, slots: List<ByteArray>, signed_ms: Int) -> Bool {
  if policy.obs_slot < 0 {
    True
  } else {
    observation_fresh(
      parse_scaled(nth(slots, policy.obs_slot), 0),
      signed_ms,
      policy.obs_max_age_ms,
    )
  }
}

// ---------------------------------------------------------------------------
// The release check. lower_ms and upper_ms are the transaction's validity interval, in POSIX milliseconds.
// The ledger only promises that the transaction runs somewhere inside that interval, so:
//   signed_ms <= lower_ms            the attestation cannot be from the future at any moment in the interval
//   upper_ms <= signed_ms + max_age  it is still fresh at every moment in the interval
// Inclusive and exclusive interval bounds are treated alike, which is the stricter reading.

pub fn release_ok(
  policy: Policy,
  timestamp: Int,
  slots: List<ByteArray>,
  signature: ByteArray,
  lower_ms: Int,
  upper_ms: Int,
) -> Bool {
  let count = list.length(slots)
  let signed_ms = timestamp * 1000
  and {
    count >= 1,
    count == list.length(policy.separators) + 1,
    policy.slot_from >= 0,
    policy.slot_from < policy.slot_to,
    policy.slot_to <= count,
    policy.obs_slot < count,
    signed_ms >= policy.settle_after_ms,
    signed_ms <= lower_ms,
    upper_ms <= signed_ms + policy.max_age_ms,
    upper_ms <= policy.deadline_ms,
    airnode.verify_attestation(
      policy.signer,
      policy.request_hash,
      timestamp,
      signed_text(policy, slots),
      signature,
    ),
    observation_ok(policy, slots, signed_ms),
    rule_holds(policy, slots),
  }
}

fn rule_holds(policy: Policy, slots: List<ByteArray>) -> Bool {
  let total =
    sum_range(slots, policy.slot_from, policy.slot_to, policy.scale, 0, 0)
  when policy.cmp is {
    Below -> total < policy.threshold
    AtLeast -> total >= policy.threshold
  }
}
