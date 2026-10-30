/**
 * Creates two fresh Cardano PREPROD wallets (buyer and seller) and writes their seed phrases into .env.
 * Seeds are never printed; only the public addresses are. If .env already holds a seed, it is kept.
 * Testnet only. Never put a seed that controls real money here.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Address, PrivateKey } from "@evolution-sdk/evolution";
import { addressFromSeed } from "@evolution-sdk/evolution/sdk/wallet/Derivation";

const envPath = ".env";
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const read = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
const write = (key: string, value: string) => {
  env = `${env.replace(new RegExp(`^${key}=.*\\r?\\n?`, "m"), "").trimEnd()}\n${key}=${value}\n`.trimStart();
};
const addressOf = (mnemonic: string) => Address.toBech32(addressFromSeed(mnemonic, { networkId: 0 }).address);

const buyerSeed = read("MNEMONIC") || PrivateKey.generateMnemonic();
const sellerSeed = read("SELLER_MNEMONIC") || PrivateKey.generateMnemonic();
const sellerAddress = addressOf(sellerSeed);

write("MNEMONIC", buyerSeed);
write("SELLER_MNEMONIC", sellerSeed);
write("SELLER_ADDRESS", sellerAddress);
if (!read("FACILITATOR_URL")) write("FACILITATOR_URL", "https://x402.preprod.dev.ecosyseng.cf-deployments.org");
if (read("BLOCKFROST_PROJECT_ID") === undefined) write("BLOCKFROST_PROJECT_ID", "");
writeFileSync(envPath, env);

console.log("Cardano preprod wallets are in .env (seeds not shown).");
console.log(`Buyer address (fund this):  ${addressOf(buyerSeed)}`);
console.log(`Seller address (receives):  ${sellerAddress}`);
console.log("Fund the buyer with test ADA: https://docs.cardano.org/cardano-testnets/tools/faucet");
console.log("Optional test USDM:           https://tusdm.moneta.global/#manual");
console.log(read("BLOCKFROST_PROJECT_ID") ? "Blockfrost key: set." : "Blockfrost key: still empty. Put a free preprod key in BLOCKFROST_PROJECT_ID.");
