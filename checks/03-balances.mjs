// Read-only. Shows the Base Sepolia test ETH and aUSD of the address in .env (or of an address you pass).
// Run: node --env-file=.env checks/03-balances.mjs            or   node checks/03-balances.mjs 0xYourAddress
import { createPublicClient, formatEther, formatUnits, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const AUSD = '0xbeA34973e5f67F18F656A2C6070C64326C791808';
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function faucetLimit() view returns (uint256)',
  'function faucetMintedAmount(address account) view returns (uint256)',
]);

const key = process.env.PAYER_PRIVATE_KEY;
const address = process.argv[2] ?? (key ? privateKeyToAccount(key).address : undefined);
if (!address) throw new Error('Pass an address, or set PAYER_PRIVATE_KEY in .env');

const client = createPublicClient({ chain: baseSepolia, transport: http() });
const [eth, ausd, limit, minted] = await Promise.all([
  client.getBalance({ address }),
  client.readContract({ address: AUSD, abi, functionName: 'balanceOf', args: [address] }),
  client.readContract({ address: AUSD, abi, functionName: 'faucetLimit' }),
  client.readContract({ address: AUSD, abi, functionName: 'faucetMintedAmount', args: [address] }),
]);
console.log(`address            ${address}`);
console.log(`Base Sepolia ETH   ${formatEther(eth)}`);
console.log(`aUSD balance       ${formatUnits(ausd, 6)}`);
console.log(`faucet minted      ${formatUnits(minted, 6)} of ${formatUnits(limit, 6)} aUSD (total, per account)`);
