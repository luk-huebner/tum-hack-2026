//// Pay-on-Proof: funds locked at this script are released to the beneficiary only if an AirnodeHub response,
//// signed by the pinned Airnode and answering the pinned request, satisfies the policy's rule. Anyone may submit
//// the response (a user, a keeper bot or an agent). Spending the UTxO is what stops a second payout.
//// After the deadline the refund party can take the funds back.

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite, Interval}
use cardano/address.{VerificationKey}
use cardano/assets
use cardano/transaction.{Input, NoDatum, Output, OutputReference, Transaction}
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

/// A release may spend only ONE UTxO of this validator. `pays` accepts any output, so with two policies of the same
/// beneficiary in one transaction a single payment would satisfy both and the submitter could keep the other
/// (found and confirmed by script evaluation on 30 Oct 2026, see TRUST.md).
fn only_input_here(inputs: List<Input>, own: Input) -> Bool {
  let here =
    list.filter(
      inputs,
      fn(input) {
        input.output.address.payment_credential == own.output.address.payment_credential
      },
    )
  list.length(here) == 1
}

fn at_least(a: Int, b: Int) -> Int {
  if a >= b {
    a
  } else {
    b
  }
}

validator pay_on_proof {
  spend(
    datum: Option<Policy>,
    redeemer: Action,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(policy) = datum
    let (lower, upper) = bounds(self.validity_range)
    when redeemer is {
      Release { timestamp, slots, signature } -> {
        expect Some(own_input) = transaction.find_input(self.inputs, own_ref)
        // The beneficiary receives the payout, and at least everything that was locked: nothing above the payout can
        // be left for the submitter.
        let owed =
          at_least(policy.payout, assets.lovelace_of(own_input.output.value))
        and {
          only_input_here(self.inputs, own_input),
          engine.release_ok(policy, timestamp, slots, signature, lower, upper),
          pays(self.outputs, policy.beneficiary, owed),
        }
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
    obs_slot: -1,
    obs_max_age_ms: 0,
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

const validator_hash: ByteArray =
  #"cccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

const wallet_key: ByteArray =
  #"dddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

fn other_ref() -> OutputReference {
  OutputReference {
    transaction_id: #"2222222222222222222222222222222222222222222222222222222222222222",
    output_index: 0,
  }
}

fn script_input(ref: OutputReference, lovelace: Int) -> Input {
  Input {
    output_reference: ref,
    output: Output {
      address: address.from_script(validator_hash),
      value: assets.from_lovelace(lovelace),
      datum: NoDatum,
      reference_script: None,
    },
  }
}

fn wallet_input() -> Input {
  Input {
    output_reference: OutputReference {
      transaction_id: #"1111111111111111111111111111111111111111111111111111111111111111",
      output_index: 0,
    },
    output: Output {
      address: address.from_verification_key(wallet_key),
      value: assets.from_lovelace(20_000_000),
      datum: NoDatum,
      reference_script: None,
    },
  }
}

fn release_tx_with(inputs: List<Input>, outputs: List<Output>) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    validity_range: interval.between(signed_ms + 1000, signed_ms + 100_000),
    inputs,
    outputs,
  }
}

/// The normal shape: the policy's own UTxO (5 tADA) plus a wallet input that pays the fee.
fn release_tx(outputs: List<Output>) -> Transaction {
  release_tx_with([script_input(own_ref, 5_000_000), wallet_input()], outputs)
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

// The double-satisfaction attack found on 30 Oct 2026: two policies of the same beneficiary, one payment.

test two_policies_in_one_transaction_with_one_payment_fails() {
  !pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [
        script_input(own_ref, 5_000_000),
        script_input(other_ref(), 5_000_000),
        wallet_input(),
      ],
      [pays_to(beneficiary, 5_000_000)],
    ),
  )
}

test two_policies_in_one_transaction_fail_even_when_both_are_paid() {
  !pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [
        script_input(own_ref, 5_000_000),
        script_input(other_ref(), 5_000_000),
        wallet_input(),
      ],
      [pays_to(beneficiary, 5_000_000), pays_to(beneficiary, 5_000_000)],
    ),
  )
}

test a_release_with_only_wallet_inputs_besides_its_own_passes() {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [script_input(own_ref, 5_000_000), wallet_input(), wallet_input()],
      [pays_to(beneficiary, 5_000_000)],
    ),
  )
}

test value_locked_above_the_payout_cannot_be_kept_by_the_submitter() {
  !pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [script_input(own_ref, 6_000_000), wallet_input()],
      [pays_to(beneficiary, 5_000_000)],
    ),
  )
}

test paying_the_whole_locked_amount_passes() {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [script_input(own_ref, 6_000_000), wallet_input()],
      [pays_to(beneficiary, 6_000_000)],
    ),
  )
}

test a_release_that_does_not_spend_its_own_input_halts() fail {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with([wallet_input()], [pays_to(beneficiary, 5_000_000)]),
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

// ---------------------------------------------------------------------------
// Edge behaviour an auditor will ask about. Each test pins down what the validator does today, including the places where
// the behaviour is a decision (documented in AUDIT.md) and not a guarantee.

fn pays_to_with_stake(pkh: ByteArray, stake: ByteArray, lovelace: Int) -> Output {
  Output {
    address: address.from_verification_key(pkh) |> address.with_delegation_key(stake),
    value: assets.from_lovelace(lovelace),
    datum: NoDatum,
    reference_script: None,
  }
}

/// Only a payment credential that is a verification key counts: paying the beneficiary's hash AS A SCRIPT does not.
test a_payment_to_a_script_credential_with_the_beneficiarys_hash_does_not_count() {
  !pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx(
      [
        Output {
          address: address.from_script(beneficiary),
          value: assets.from_lovelace(5_000_000),
          datum: NoDatum,
          reference_script: None,
        },
      ],
    ),
  )
}

/// The stake part of the payout address is not checked: the beneficiary's KEY must receive the money, but whoever builds the
/// release chooses the staking credential. The beneficiary keeps spending control; staking rewards and wallet visibility are
/// not guaranteed. A known limitation (AUDIT.md), not a loss of funds.
test a_payment_with_another_stake_credential_still_counts() {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx([pays_to_with_stake(beneficiary, wallet_key, 5_000_000)]),
  )
}

/// A release does not need to be the first input, or the only input: wallet inputs for fees may come before or after it.
test the_policys_own_input_may_come_after_wallet_inputs() {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [wallet_input(), script_input(own_ref, 5_000_000)],
      [pays_to(beneficiary, 5_000_000)],
    ),
  )
}

/// The one-policy rule counts inputs of THIS validator only. An input at another script is not ours to forbid.
test a_release_may_spend_an_input_of_another_script_too() {
  pay_on_proof.spend(
    Some(policy()),
    release_action(),
    own_ref,
    release_tx_with(
      [
        script_input(own_ref, 5_000_000),
        Input {
          output_reference: other_ref(),
          output: Output {
            address: address.from_script(
              #"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            ),
            value: assets.from_lovelace(2_000_000),
            datum: NoDatum,
            reference_script: None,
          },
        },
        wallet_input(),
      ],
      [pays_to(beneficiary, 5_000_000)],
    ),
  )
}

/// A refund puts no condition on where the money goes: the refund party signs and may send it anywhere.
test a_refund_may_send_the_money_anywhere() {
  pay_on_proof.spend(
    Some(policy()),
    Refund,
    own_ref,
    Transaction {
      ..refund_tx(signed_ms + 3_600_000, [refund_to]),
      outputs: [pays_to(wallet_key, 5_000_000)],
    },
  )
}

/// At the exact deadline instant (lower = upper = deadline) BOTH exits are open: a release (upper <= deadline) and a refund
/// (lower >= deadline). They are different transactions and the UTxO can be spent once, so whoever lands first wins; the
/// window is a single instant. Documented in AUDIT.md.
test at_exactly_the_deadline_instant_a_release_is_still_valid() {
  let early = Policy { ..policy(), deadline_ms: signed_ms + 100_000 }
  pay_on_proof.spend(
    Some(early),
    release_action(),
    own_ref,
    Transaction {
      ..release_tx([pays_to(beneficiary, 5_000_000)]),
      validity_range: interval.between(signed_ms + 100_000, signed_ms + 100_000),
    },
  )
}

test at_exactly_the_deadline_instant_a_refund_is_also_valid() {
  let early = Policy { ..policy(), deadline_ms: signed_ms + 100_000 }
  pay_on_proof.spend(
    Some(early),
    Refund,
    own_ref,
    Transaction {
      ..refund_tx(signed_ms + 100_000, [refund_to]),
      validity_range: interval.between(signed_ms + 100_000, signed_ms + 100_000),
    },
  )
}

test one_millisecond_after_the_deadline_only_the_refund_is_valid() {
  let early = Policy { ..policy(), deadline_ms: signed_ms + 100_000 }
  and {
    !pay_on_proof.spend(
      Some(early),
      release_action(),
      own_ref,
      Transaction {
        ..release_tx([pays_to(beneficiary, 5_000_000)]),
        validity_range: interval.between(signed_ms + 100_001, signed_ms + 100_001),
      },
    ),
    pay_on_proof.spend(
      Some(early),
      Refund,
      own_ref,
      Transaction {
        ..refund_tx(signed_ms + 100_001, [refund_to]),
        validity_range: interval.between(signed_ms + 100_001, signed_ms + 100_001),
      },
    ),
  }
}

/// A datum that is not a policy halts the script for every redeemer: such funds can never be spent. Nothing on chain can
/// stop anyone from sending funds to the validator with a bad datum (the buyer's client checks the datum before paying).
test a_missing_datum_makes_a_release_halt() fail {
  pay_on_proof.spend(
    None,
    release_action(),
    own_ref,
    release_tx([pays_to(beneficiary, 5_000_000)]),
  )
}

test a_missing_datum_makes_a_refund_halt() fail {
  pay_on_proof.spend(
    None,
    Refund,
    own_ref,
    refund_tx(signed_ms + 3_600_000, [refund_to]),
  )
}
