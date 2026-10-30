//// Pay-on-Proof: funds locked at this script are released to the beneficiary only if an AirnodeHub response,
//// signed by the pinned Airnode and answering the pinned request, satisfies the policy's rule. Anyone may submit
//// the response (a user, a keeper bot or an agent). Spending the UTxO is what stops a second payout.
//// After the deadline the refund party can take the funds back.

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite, Interval}
use cardano/address.{VerificationKey}
use cardano/assets
use cardano/transaction.{NoDatum, Output, OutputReference, Transaction}
use engine.{Below, Policy}
use vectors/meteo

pub type Action {
  Release { timestamp: Int, slots: List<ByteArray>, signature: ByteArray }
  Refund
}

/// Both ends of the validity interval must be finite, otherwise freshness cannot be checked.
fn bounds(range: Interval) -> (Int, Int) {
  expect Finite(lower) = range.lower_bound.bound_type
  expect Finite(upper) = range.upper_bound.bound_type
  (lower, upper)
}

fn pays(outputs: List<Output>, pkh: VerificationKeyHash, amount: Int) -> Bool {
  list.any(
    outputs,
    fn(output) {
      output.address.payment_credential == VerificationKey(pkh) && assets.lovelace_of(
        output.value,
      ) >= amount
    },
  )
}

validator pay_on_proof {
  spend(
    datum: Option<Policy>,
    redeemer: Action,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(policy) = datum
    let (lower, upper) = bounds(self.validity_range)
    when redeemer is {
      Release { timestamp, slots, signature } ->
        and {
          engine.release_ok(policy, timestamp, slots, signature, lower, upper),
          pays(self.outputs, policy.beneficiary, policy.payout),
        }
      Refund ->
        and {
          lower >= policy.deadline_ms,
          list.has(self.extra_signatories, policy.refund_to),
        }
    }
  }

  else(_) {
    fail
  }
}

// ---------------------------------------------------------------------------
// Validator-level tests with the real signed Open-Meteo response (Munich, 10 to 23 Oct 2026, 14 daily rainfall
// values, sum 26.20 mm). The policy pays when the sum is below 30.00 mm.

const signed_ms: Int = 1793355726000

const beneficiary: ByteArray =
  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

const refund_to: ByteArray =
  #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

const own_ref: OutputReference =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

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
    beneficiary,
    refund_to,
    payout: 5_000_000,
  }
}

fn release_action() -> Action {
  Release {
    timestamp: meteo.timestamp,
    slots: meteo.slots,
    signature: meteo.signature,
  }
}

fn pays_to(pkh: ByteArray, lovelace: Int) -> Output {
  Output {
    address: address.from_verification_key(pkh),
    value: assets.from_lovelace(lovelace),
    datum: NoDatum,
    reference_script: None,
  }
}

fn release_tx(outputs: List<Output>) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    validity_range: interval.between(signed_ms + 1000, signed_ms + 100_000),
    outputs,
  }
}

test release_with_payment_passes() {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx([pays_to(beneficiary, 5_000_000)]),
  )
}

test release_without_payment_fails() {
  !pay_on_proof.spend(Some(policy()), release_action(), own_ref, release_tx([]))
}

test release_that_underpays_fails() {
  !pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx([pays_to(beneficiary, 4_999_999)]),
  )
}

test release_paying_someone_else_fails() {
  !pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx([pays_to(refund_to, 5_000_000)]),
  )
}

fn refund_tx(from_ms: Int, signers: List<ByteArray>) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    validity_range: interval.between(from_ms, from_ms + 100_000),
    extra_signatories: signers,
  }
}

test refund_after_deadline_with_signature_passes() {
  pay_on_proof.spend(
    Some(policy()),
    Refund,
    own_ref,
    refund_tx(signed_ms + 3_600_000, [refund_to]),
  )
}

test refund_before_deadline_fails() {
  !pay_on_proof.spend(
    Some(policy()),
    Refund,
    own_ref,
    refund_tx(signed_ms + 3_599_999, [refund_to]),
  )
}

test refund_without_the_refund_signature_fails() {
  !pay_on_proof.spend(
    Some(policy()),
    Refund,
    own_ref,
    refund_tx(signed_ms + 3_600_000, [beneficiary]),
  )
}
