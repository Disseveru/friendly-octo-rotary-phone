# ClaimGuard MCP — SKILL

## Name
ClaimGuard MCP

## Tagline
AI-powered claim verification & deep research — agents pay USDC per call to verify claims, fact-check articles, score confidence, and conduct multi-step research.

## Description
ClaimGuard MCP is a pay-per-use AI tool server for claim verification and research. Every tool call costs USDC on Base, paid instantly via the x402 protocol. No API keys required for agents — connect, pay, get verified answers.

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
| `summarize_topic` | $0.01 USDC | Quick factual summary with key facts and confidence score |
| `get_confidence_score` | $0.03 USDC | Calibrated 0–100 confidence score with verdict and evidence points |
| `verify_claim` | $0.05 USDC | Structured true/false/unverified verdict with evidence summary |

### Premium Tier 🔍
| Tool | Price | Description |
|------|-------|-------------|
| `check_sources` | $0.10 USDC | Fetches URLs and determines if each supports or contradicts a claim |
| `research_entities` | $0.15 USDC | Extracts and researches named entities with verified facts |
| `fact_check_url` | $0.20 USDC | Fetches an article and fact-checks claims within it |
| `deep_research` | $0.25 USDC | Multi-step structured research with citations and confidence level |

## Example Agent Config (Claude / MCP)
```json
{
  "mcpServers": {
    "claimguard": {
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
fact-checking, research, ai, verification, misinformation, deep-research, claim-verification

## Source
https://github.com/Disseveru/friendly-octo-rotary-phone
