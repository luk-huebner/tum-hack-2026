// Creates a fresh throwaway TESTNET key for the paid AirnodeHub checks and stores it in .env (gitignored).
// The key is never printed. Only the public address is shown, to paste into the faucets.
// If .env already has a PAYER_PRIVATE_KEY, nothing is changed and its address is shown.
// Never put a key that holds real money here.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const envUrl = new URL('../.env', import.meta.url);
const text = existsSync(envUrl) ? readFileSync(envUrl, 'utf8') : '';
const existing = text.match(/^PAYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m);

if (existing) {
  console.log('.env already has a testnet key. Address:', privateKeyToAccount(existing[1]).address);
} else {
  const key = generatePrivateKey();
  const rest = text.replace(/^PAYER_PRIVATE_KEY=.*$/m, '').trim();
  writeFileSync(envUrl, `${rest ? `${rest}\n` : ''}PAYER_PRIVATE_KEY=${key}\n`);
  console.log('Created a new testnet key in .env (not shown). Address to fund:', privateKeyToAccount(key).address);
}
console.log('Network: Base Sepolia (testnet). Needs a little test ETH for gas, then aUSD from the AirnodeHub faucet.');
