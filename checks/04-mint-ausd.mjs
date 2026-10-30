// Mints aUSD (API3's TEST dollar on Base Sepolia) to the address of the testnet key in .env, without a browser wallet.
// Run by a person, not automatically. Needs a little Base Sepolia test ETH for gas. The key is never printed.
//   node --env-file=.env checks/04-mint-ausd.mjs            (mints up to the remaining faucet limit)
//   node --env-file=.env checks/04-mint-ausd.mjs 5          (mints 5 aUSD)
import { createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const AUSD = '0xbeA34973e5f67F18F656A2C6070C64326C791808';
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function faucetLimit() view returns (uint256)',
  'function faucetMintedAmount(address account) view returns (uint256)',
  'function mintFromFaucet(uint256 amount)',
]);

const key = process.env.PAYER_PRIVATE_KEY;
if (!key) throw new Error('Set PAYER_PRIVATE_KEY in .env first (run: node checks/02-new-wallet.mjs)');
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() });

const [limit, minted, eth] = await Promise.all([
  publicClient.readContract({ address: AUSD, abi, functionName: 'faucetLimit' }),
  publicClient.readContract({ address: AUSD, abi, functionName: 'faucetMintedAmount', args: [account.address] }),
  publicClient.getBalance({ address: account.address }),
]);
const remaining = limit - minted;
const requested = process.argv[2] ? parseUnits(process.argv[2], 6) : remaining;
if (eth === 0n) throw new Error(`${account.address} has no Base Sepolia test ETH for gas yet`);
if (requested <= 0n || requested > remaining) throw new Error(`Faucet allows ${formatUnits(remaining, 6)} more aUSD for this account`);

console.log(`minting ${formatUnits(requested, 6)} aUSD to ${account.address} ...`);
const hash = await walletClient.writeContract({ address: AUSD, abi, functionName: 'mintFromFaucet', args: [requested] });
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`status ${receipt.status}: https://sepolia.basescan.org/tx/${hash}`);
const balance = await publicClient.readContract({ address: AUSD, abi, functionName: 'balanceOf', args: [account.address] });
console.log(`aUSD balance now ${formatUnits(balance, 6)}`);
