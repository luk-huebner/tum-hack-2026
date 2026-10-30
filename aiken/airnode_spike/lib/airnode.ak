//// Spike: can a Plutus V3 script verify an AirnodeHub (Airnode v2) attestation?
////
//// An attestation is signed (EIP-191, secp256k1) over
////   keccak256(requestHash ++ uint256(timestamp) ++ dataBytes)
//// Plutus ECDSA takes a 33-byte compressed key, a 32-byte message hash and a 64-byte r||s signature.
//// The key is pinned by the contract (never taken from the response), as the API3 docs require.

use aiken/crypto.{keccak_256, verify_ecdsa_signature, verify_ed25519_signature}
use aiken/primitive/bytearray

// 0x19 followed by "Ethereum Signed Message:\n32"
const eip191_prefix: ByteArray = #"19457468657265756d205369676e6564204d6573736167653a0a3332"

/// The 32-byte hash that the Airnode signed (after the EIP-191 prefix).
pub fn message_hash(
  request_hash: ByteArray,
  timestamp: Int,
  data: ByteArray,
) -> ByteArray {
  let digest =
    keccak_256(
      bytearray.concat(
        bytearray.concat(request_hash, bytearray.from_int_big_endian(timestamp, 32)),
        data,
      ),
    )
  keccak_256(bytearray.concat(eip191_prefix, digest))
}

/// True only if `pubkey` signed exactly this request hash, timestamp and data.
pub fn verify_attestation(
  pubkey: ByteArray,
  request_hash: ByteArray,
  timestamp: Int,
  data: ByteArray,
  signature: ByteArray,
) -> Bool {
  verify_ecdsa_signature(
    pubkey,
    message_hash(request_hash, timestamp, data),
    signature,
  )
}

// ---------------------------------------------------------------------------
// Test vector from the AirnodeHub docs ("From API to contract"), derived by checks/01-vector.mjs

const doc_pubkey: ByteArray =
  #"024e993579608baf1d542741675d347867f3d2c558d2e9bc3b74bac3583b569322"

const doc_request_hash: ByteArray =
  #"180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66"

const doc_timestamp: Int = 1792403240

const doc_data: ByteArray = "{\"price\":2443.95,\"updatedAt\":1792403240691}"

const doc_signature: ByteArray =
  #"b034c17a11679ff06e50445c84419c34ba0aee5669bbda3a0dd563d2437928a17e5b34826fd505b0d1cace3712570df07de0d0a7eb2e1610c84cd4a0d71827e2"

test message_hash_matches_node() {
  message_hash(doc_request_hash, doc_timestamp, doc_data) == #"e50e1399fbfedafbfe210d5213bc770922f7a7132215ed55e60216384dd1607c"
}

test document_vector_verifies() {
  verify_attestation(
    doc_pubkey,
    doc_request_hash,
    doc_timestamp,
    doc_data,
    doc_signature,
  )
}

// The four required tamper cases, at the signature level (freshness is a separate clock check).

test tamper_edited_value_is_rejected() {
  !verify_attestation(
    doc_pubkey,
    doc_request_hash,
    doc_timestamp,
    "{\"price\":9443.95,\"updatedAt\":1792403240691}",
    doc_signature,
  )
}

test tamper_other_request_is_rejected() {
  !verify_attestation(
    doc_pubkey,
    #"0000000000000000000000000000000000000000000000000000000000000001",
    doc_timestamp,
    doc_data,
    doc_signature,
  )
}

test tamper_wrong_signer_is_rejected() {
  // The secp256k1 generator point: a valid key that did not sign this response.
  !verify_attestation(
    #"0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    doc_request_hash,
    doc_timestamp,
    doc_data,
    doc_signature,
  )
}

test tamper_moved_timestamp_is_rejected() {
  !verify_attestation(
    doc_pubkey,
    doc_request_hash,
    doc_timestamp + 1,
    doc_data,
    doc_signature,
  )
}

// ---------------------------------------------------------------------------
// Ed25519 device vector (warm-up for "devices as sellers"), from checks/01-vector.mjs

const device_pubkey: ByteArray =
  #"82d5b161b77159604bf379644b6ac60fdef0bafc9deac16fbe2326371bb22c13"

const device_message: ByteArray = "temp=7.2C@1793305331"

const device_signature: ByteArray =
  #"698e87e20becf70684328cdd842b0056a08cd20dde99978b4a1d0da37c648d6ed2d85aa70650a3c6b7ac6a2698a1c1e15952b3e32541f3a56b6a4c1bb411cf0a"

test device_signature_verifies() {
  verify_ed25519_signature(device_pubkey, device_message, device_signature)
}

test device_tampered_reading_is_rejected() {
  !verify_ed25519_signature(
    device_pubkey,
    "temp=9.9C@1793305331",
    device_signature,
  )
}
