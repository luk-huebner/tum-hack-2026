# Pay-on-Proof as tools for an AI agent (MCP)

An agent can use the contract directly: read what is locked, preview a conditional payment, ask the validator for a verdict on a signed response, and, only if the operator allows it, lock a real testnet escrow and take it back. The server is `src/mcp-server.ts`; it speaks the Model Context Protocol over stdio, with no extra dependency.

## Tools

| Tool | What it does | Needs |
|---|---|---|
| `list_sources` | What a payment can wait for: templates and every registered AirnodeHub source, the kind of data and what a check costs | nothing |
| `list_escrows` | Everything locked at the contract now, each with its rule in words, deadline and whether it can be refunded | Blockfrost key |
| `check_escrow` | One escrow by reference: still locked, paid out or refunded; its rule; time left | Blockfrost key |
| `preview_escrow` | The buyer's exact terms (rule, 5 tADA, deadline, refund party) without paying anything | `BUYER_ADDRESS` or a `refund` argument |
| `judge_response` | The validator's own verdict (ACCEPTED or REJECTED) on a pasted signed response; nothing is sent to the chain | Blockfrost key |
| `lock_escrow` | **Spends 5 tADA** by x402 into the contract | `MCP_ALLOW_SPEND=1`, `confirm: true`, the service running |
| `refund_escrow` | **Spends a small fee** to take an escrow back after its deadline | `MCP_ALLOW_SPEND=1`, `confirm: true` |

## Safety

- **Spending is off by default.** Reading, previewing and judging need no wallet key at all (an address-only client). The two spending tools refuse unless the process starts with `MCP_ALLOW_SPEND=1`, and then every call needs `confirm: true`, an escrow is always 5 tADA, and one session locks at most 3.
- Testnet only (Cardano preprod). The wallet in `.env` is a test wallet.
- The agent cannot choose where the money goes: the beneficiary is the seller key from the environment, and the refund party is the buyer's address, which `preview_escrow` shows before anything is paid.
- A refund before the deadline is refused by the contract, whatever the agent asks.

## Claude Desktop

Add this to `claude_desktop_config.json` (use your own path; the server reads `cardano/.env` itself):

```json
{
  "mcpServers": {
    "pay-on-proof": {
      "command": "node",
      "args": [
        "C:\\path\\to\\hack-repo\\cardano\\node_modules\\tsx\\dist\\cli.mjs",
        "C:\\path\\to\\hack-repo\\cardano\\src\\mcp-server.ts"
      ],
      "env": { "MCP_ALLOW_SPEND": "0" }
    }
  }
}
```

Needed in `cardano/.env` for the read-only tools: `BLOCKFROST_PROJECT_ID`, `SELLER_ADDRESS`, `BUYER_ADDRESS` (a public preprod address). For spending also `MNEMONIC` and the running service (`npm run service`).

Things to ask an agent: "What can I put a conditional payment on?", "Show me what is locked at the contract", "Preview paying the seller if the meme post gets 5 likes within 30 minutes", "Here is a signed response; would the contract accept it? Now change one value and ask again."

## Test

`node scripts/mcp-test.mjs` starts the server and drives it like a host would: 14 checks (the protocol, the seven tools, the real response accepted and an edited one rejected by the validator, both spending tools refusing while spending is off, nothing but protocol messages on stdout). All passed on 30 Oct. It pays nothing.

## For a judge's agent without our keys

Our keys are not shared. A judge's agent can use the public site instead: https://pay-on-proof-judge.vercel.app/llms.txt describes the HTTP interface (`GET /api/cases`, `POST /api/judge`, `GET /api/board`), which gives the same verdicts with no key.

## Not done

- Not tried in a real Claude Desktop session yet (the test client speaks the same protocol, which is not the same thing).
- The spending tools call the existing scripts as child processes, so an x402 payment that settles slowly can come back as a failure; the message says to check `list_escrows` before trying again.
- No authentication on the tools: whoever can start the process is the operator.
