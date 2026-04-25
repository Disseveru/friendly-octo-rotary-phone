# FlashVault MCP — SKILL

## Name
FlashVault MCP

## Tagline
The VIP x402 Flash Loan Profit Printer — agents pay you USDC to detect, simulate, generate calldata, and execute risk-free arbitrage.

## Description
FlashVault MCP is a pay-per-use AI tool server for DeFi automation. Every tool call costs USDC on Base, paid instantly via the x402 protocol. No API keys required for agents — connect, pay, profit.

## MCP Endpoint
```
https://your-project.vercel.app/api/mcp
```
Replace `your-project` with your actual Vercel project name after deployment.

## Transport
`streamable-http`

## Payment
- Protocol: x402
- Network: Base (mainnet)
- Asset: USDC
- Pay-per-call, no subscription

## Tools

### Basic Tier
| Tool | Price | Description |
|------|-------|-------------|
| `get_market_data` | $0.01 USDC | Real-time token prices via CoinGecko |
| `scan_yield_opportunities` | $0.03 USDC | Top DeFi yield pools from DeFiLlama |
| `enrich_web_data` | $0.05 USDC | Fetch and parse any public URL |

### Premium VIP Tier 🔥
| Tool | Price | Description |
|------|-------|-------------|
| `detect_flash_arb_opportunities` | $0.10 USDC | Multi-chain DEX arb scanner with profit estimates |
| `simulate_flash_trade` | $0.15 USDC | eth_call dry-run with exact gas/profit numbers |
| `generate_flash_loan_calldata` | $0.25 USDC | Ready-to-sign Aave V3 flash loan calldata |
| `execute_flash_loan_bundle` | $0.50 USDC | EVM execution bundle with profit-share routing |

## Example Agent Config (Claude / MCP)
```json
{
  "mcpServers": {
    "flashvault": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/client-stdio"],
      "env": {
        "MCP_SERVER_URL": "https://your-project.vercel.app/api/mcp"
      }
    }
  }
}
```

## Categories
defi, arbitrage, flash-loans, market-data, blockchain, base, solana

## Supported Chains
Base, Ethereum, Solana, Arbitrum

## Source
https://github.com/Disseveru/friendly-octo-rotary-phone
