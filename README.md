# 🔍 ClaimGuard MCP

> **AI-powered claim verification & deep research — AI agents pay you USDC per
> call to verify claims, fact-check articles, score confidence, and conduct
> multi-step research. You deploy once and collect forever.**

---

## 💡 What This Does

ClaimGuard MCP is a pay-per-call AI tool server. Every time an AI agent uses
one of your 7 tools, it pays **USDC on Base** directly to your wallet — no
middlemen, no subscription billing. All reasoning is powered by OpenAI's LLM.

| Tool | Per-call price | 1,000 calls/day |
|------|---------------|-----------------|
| `summarize_topic` | $0.01 | $10/day |
| `get_confidence_score` | $0.03 | $30/day |
| `verify_claim` | $0.05 | $50/day |
| 🔍 `check_sources` | $0.10 | $100/day |
| 🔍 `research_entities` | $0.15 | $150/day |
| 🔍 `fact_check_url` | $0.20 | $200/day |
| 🔍 `deep_research` | $0.25 | $250/day |

---

## Project Structure

```
claimguard-mcp/
├── app/
│   ├── api/
│   │   └── mcp/
│   │       └── route.ts   ← Core MCP server (7 tools, x402 payments, LLM backend)
│   ├── layout.tsx          ← Next.js root layout
│   └── page.tsx            ← Landing page / tool directory
├── .env.example            ← All required environment variables
├── next.config.ts          ← Next.js configuration
├── package.json            ← Dependencies
├── tsconfig.json           ← TypeScript configuration
├── SKILL.md                ← Agent marketplace listing
├── server.json             ← MCP server metadata (PulseMCP, agentic.market)
└── README.md               ← This file
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RECIPIENT_ADDRESS` | ✅ | Your wallet that receives USDC |
| `NETWORK` | ✅ | `base` (mainnet) or `base-sepolia` (testnet) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for LLM reasoning |
| `OPENAI_MODEL` | — | Model to use (default: `gpt-4o-mini`) |
| `FACILITATOR_URL` | — | x402 facilitator (default: `https://x402.org/facilitator`) |
| `NEXT_PUBLIC_BASE_URL` | — | Your Vercel URL for the landing page display |

---

## 🚀 Deploy in 15 Minutes on Your Phone — Step by Step

Everything below works in **Chrome browser on Android**. No terminal, no
coding. Each step takes 1–3 minutes.

---

### Step 1 — Get a Free Wallet (2 min)

> **Skip if you already have a Base-compatible wallet.**

1. Open Chrome → go to **https://wallet.coinbase.com**
2. Tap **Get started** → **Create a new wallet**
3. Follow the on-screen steps (choose a 6-digit PIN)
4. Tap **Receive** → **Copy** your wallet address (starts with `0x`)
5. **Save this address** — you'll need it in Step 4

---

### Step 2 — Get an OpenAI API Key (2 min)

1. Open Chrome → go to **https://platform.openai.com/api-keys**
2. Sign in (or create a free account)
3. Tap **Create new secret key** → copy the key (starts with `sk-`)
4. **Save this key** — you'll need it in Step 5

---

### Step 3 — Create the GitHub Repository (2 min)

1. Open Chrome → go to **https://github.com/new**
2. Sign in (or create a free account at https://github.com/join)
3. **Repository name:** type `claimguard-mcp`
4. Keep it **Public**
5. Tap **Create repository** (green button)
6. You now have an empty repo at `github.com/YOUR_USERNAME/claimguard-mcp`

---

### Step 4 — Add the Code Files (5 min)

For each file below, follow this pattern in the GitHub web editor:

> Tap **Add file → Create new file**, type the file path in the name box
> (e.g. `app/api/mcp/route.ts`), paste the content, tap **Commit new file**.

#### Files to create (in order):

1. **`package.json`**
2. **`tsconfig.json`**
3. **`next.config.ts`**
4. **`app/api/mcp/route.ts`** ← *This is the core server*
5. **`app/layout.tsx`**
6. **`app/page.tsx`**
7. **`SKILL.md`**
8. **`server.json`**

> **Tip:** On mobile, navigate to each file in this repository, tap the **Raw**
> button, select all text, copy, then paste into the GitHub editor for your repo.

---

### Step 5 — Import to Vercel (2 min)

1. Open Chrome → go to **https://vercel.com**
2. Sign in with GitHub (tap **Continue with GitHub**)
3. Tap **Add New → Project**
4. Find `claimguard-mcp` in the list → tap **Import**
5. Vercel auto-detects **Next.js** ✅
6. **Do not deploy yet** — scroll down to **Environment Variables** first

---

### Step 6 — Set Environment Variables in Vercel (2 min)

On the Vercel import screen, scroll to **Environment Variables** and add these:

| Name | Value |
|------|-------|
| `RECIPIENT_ADDRESS` | Your `0x...` wallet address from Step 1 |
| `NETWORK` | `base` |
| `OPENAI_API_KEY` | Your OpenAI key from Step 2 |
| `FACILITATOR_URL` | `https://x402.org/facilitator` |

After adding all 4 variables, tap **Deploy** (blue button).

---

### Step 7 — One-Click Deploy (1 min)

1. Vercel builds and deploys automatically (~60 seconds)
2. When done → **Congratulations! 🎉**
3. Tap **Visit** → you see the ClaimGuard MCP landing page
4. Your MCP endpoint is: `https://your-project.vercel.app/api/mcp`

**Save this URL** — it's what AI agents call to pay you.

---

## 🧪 Testing on Your Phone

### Option A — Claude.ai Web (easiest)

1. Go to **https://claude.ai** in Chrome
2. Start a new conversation and type:
   ```
   Connect to MCP at https://your-project.vercel.app/api/mcp
   and call verify_claim with "The Earth is flat"
   ```
3. Claude will handle the x402 payment ($0.05 USDC) and return a verdict
4. Check your wallet — $0.05 USDC has arrived ✅

### Option B — Direct API test (no payment required)

```bash
curl https://your-project.vercel.app/api/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

Returns all 7 tools without triggering payment (listing is free).

---

## 📣 Discovery & Launch

### List on PulseMCP

1. Go to **https://pulsemcp.com/submit** in Chrome
2. Fill in:
   - **Server URL**: `https://your-project.vercel.app/api/mcp`
   - **Name**: ClaimGuard MCP
   - **Description**: paste tagline from `SKILL.md`
3. Tap **Submit**

### List on Agentic.market

1. Go to **https://agentic.market** in Chrome
2. Sign in → **Submit Tool**
3. Upload `server.json` or fill in details manually

### X / Twitter Launch Thread

Post this from your phone (replace the URL):

```
🔍 Just launched ClaimGuard MCP — AI claim verification via x402

AI agents pay USDC on Base to:
✅ Verify any claim ($0.05/call)
📊 Score confidence 0–100 ($0.03/call)
🔗 Check if sources support a claim ($0.10/call)
🗞️ Fact-check any article URL ($0.20/call)
🔬 Deep research any topic ($0.25/call)

No subscription. Pure x402 micropayments.

MCP → https://your-project.vercel.app/api/mcp

#FactCheck #AI #Base #x402 #MCP #AIAgents
```

---

## 📊 Track Revenue on Your Phone

1. Open Chrome → **https://basescan.org/address/YOUR_WALLET_ADDRESS**
2. Tap **Token Transfers** → filter by **USDC**
3. Every agent call appears as a separate incoming USDC transfer

Or use Coinbase Wallet app → tap your wallet → filter USDC on Base.

---

## Production Checklist

- [ ] `RECIPIENT_ADDRESS` set to your real wallet in Vercel env vars
- [ ] `OPENAI_API_KEY` set in Vercel env vars
- [ ] `NETWORK=base` (not `base-sepolia`) for real USDC
- [ ] Deployment is green ✅ on Vercel dashboard
- [ ] Landing page loads at `https://your-project.vercel.app`
- [ ] `/api/mcp` returns tool list (curl test)
- [ ] Listed on PulseMCP at https://pulsemcp.com
- [ ] X thread posted
- [ ] Revenue visible at basescan.org

---

## Security

- **No private keys** in code or environment variables — the server never signs transactions
- **SSRF protection**: `check_sources`, `fact_check_url`, and `deep_research` block requests to localhost and private IP ranges
- **Input validation**: all tool inputs validated with Zod schemas before processing
- **OpenAI key**: stored server-side only, never exposed to agents or browsers

---

## License

MIT — see [LICENSE](LICENSE)
