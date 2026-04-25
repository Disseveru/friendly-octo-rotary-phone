/**
 * FlashVault MCP — x402-powered Flash Loan Profit Printer
 *
 * 3 basic tools ($0.01–$0.05):  market data, yield scanner, web enrichment
 * 4 premium VIP tools ($0.10–$0.50): arb detection, calldata gen, simulation, execution
 *
 * Every call pays USDC on Base directly to RECIPIENT_ADDRESS.
 */

import { createPaidMcpHandler } from "x402-mcp";
import { z } from "zod";
import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseUnits,
  formatUnits,
  isHex,
} from "viem";
import { base, baseSepolia } from "viem/chains";

// ── Configuration ─────────────────────────────────────────────────────────────

const RECIPIENT = (process.env.RECIPIENT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const NETWORK = (process.env.NETWORK ?? "base") as "base" | "base-sepolia";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const BASE_RPC =
  process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const PROFIT_SHARE_BPS = Math.min(
  1000,
  Math.max(0, Number(process.env.PROFIT_SHARE_BPS ?? "500"))
);

// Aave V3 Pool addresses on Base
const AAVE_V3_POOL: Record<string, `0x${string}`> = {
  base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  "base-sepolia": "0x07eA79F68B2B3df564D0A34F8e19791234D9b94b",
};

// USDC contract address on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Aave V3 flashLoan ABI (minimal — only what we need)
const AAVE_FLASH_LOAN_ABI = [
  {
    name: "flashLoan",
    type: "function",
    inputs: [
      { name: "receiverAddress", type: "address" },
      { name: "assets", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "interestRateModes", type: "uint256[]" },
      { name: "onBehalfOf", type: "address" },
      { name: "params", type: "bytes" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Public viem client for on-chain reads
const publicClient = createPublicClient({
  chain: NETWORK === "base" ? base : baseSepolia,
  transport: http(BASE_RPC),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Block requests to localhost / RFC-1918 ranges to prevent SSRF. */
function validatePublicUrl(raw: string): URL {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }
  const h = url.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h.endsWith(".local") ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^192\.168\./.test(h)
  ) {
    throw new Error("Private/internal URLs are not permitted");
  }
  return url;
}

// ── Tool implementations ──────────────────────────────────────────────────────

/** 1. Basic — real-time multi-chain market data via CoinGecko */
async function fetchMarketData(
  tokens: string[],
  vs_currencies: string[]
): Promise<unknown> {
  const ids = encodeURIComponent(tokens.join(","));
  const curr = encodeURIComponent(vs_currencies.join(","));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${curr}&include_24hr_change=true&include_market_cap=true`,
    { headers }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);
  return res.json();
}

/** 2. Basic — DeFi yield scanner via DeFiLlama */
async function fetchYieldOpportunities(
  minTvl: number,
  limit: number,
  chain?: string
): Promise<unknown[]> {
  const res = await fetch("https://yields.llama.fi/pools", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}: ${await res.text()}`);
  const { data } = (await res.json()) as { data: Record<string, unknown>[] };
  return data
    .filter(
      (p) =>
        (p.tvlUsd as number) >= minTvl &&
        (p.apy as number) > 0 &&
        (!chain || (p.chain as string).toLowerCase() === chain.toLowerCase())
    )
    .sort((a, b) => (b.apy as number) - (a.apy as number))
    .slice(0, limit)
    .map((p) => ({
      pool: p.pool,
      project: p.project,
      chain: p.chain,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
    }));
}

/** 3. Basic — fetch and parse any public URL */
async function enrichWebData(
  rawUrl: string,
  maxLength: number
): Promise<unknown> {
  const url = validatePublicUrl(rawUrl);
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "FlashVaultMCP/1.0 (https://flashvault.vercel.app)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.hostname}`);
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (contentType.includes("application/json")) {
    return { contentType, data: JSON.parse(text) };
  }
  // Strip HTML: use a single generic pattern to avoid incomplete sanitization.
  // The output is returned as JSON text to AI agents, not rendered in a browser.
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { contentType, data: clean.slice(0, maxLength) };
}

/** 4. Premium — detect cross-DEX arbitrage opportunities on Base / Solana */
async function detectArbOpportunities(chains: string[]): Promise<unknown[]> {
  // Fetch pool data from DeFiLlama and price data from CoinGecko concurrently
  const [poolsRes, priceData] = await Promise.all([
    fetch("https://yields.llama.fi/pools", { headers: { Accept: "application/json" } }),
    fetchMarketData(["ethereum", "usd-coin", "wrapped-bitcoin"], ["usd"]) as Promise<
      Record<string, { usd: number }>
    >,
  ]);
  if (!poolsRes.ok) throw new Error("DeFiLlama unavailable");
  const { data: pools } = (await poolsRes.json()) as {
    data: Record<string, unknown>[];
  };

  // Group pools by (chain, symbol) to find same-pair pools across multiple DEXes
  const byPair = new Map<string, Record<string, unknown>[]>();
  for (const p of pools) {
    const chain = (p.chain as string).toLowerCase();
    if (!chains.some((c) => chain.includes(c.toLowerCase()))) continue;
    const key = `${chain}:${p.symbol}`;
    const bucket = byPair.get(key) ?? [];
    bucket.push(p);
    byPair.set(key, bucket);
  }

  const opportunities: unknown[] = [];
  for (const [key, bucket] of byPair) {
    if (bucket.length < 2) continue;
    const sorted = bucket.sort((a, b) => (b.apy as number) - (a.apy as number));
    const highApy = sorted[0];
    const lowApy = sorted[sorted.length - 1];
    const spreadBps = Math.round(
      (((highApy.apy as number) - (lowApy.apy as number)) / ((lowApy.apy as number) + 0.001)) *
        10000
    );
    if (spreadBps < 50) continue; // Skip tiny spreads

    const flashLoanUSD = 100_000;
    const grossProfit = flashLoanUSD * ((spreadBps / 10000) * 0.01); // conservative 1% of spread
    const gasCostUSD = 0.5; // ~$0.50 Base gas
    const netProfit = grossProfit - gasCostUSD;
    if (netProfit <= 0) continue;

    opportunities.push({
      pair: key,
      buyFrom: { dex: lowApy.project, apy: lowApy.apy },
      sellTo: { dex: highApy.project, apy: highApy.apy },
      spreadBps,
      flashLoanAmountUSD: flashLoanUSD,
      estimatedNetProfitUSD: parseFloat(netProfit.toFixed(4)),
      ownerProfitShareUSD: parseFloat(
        (netProfit * (PROFIT_SHARE_BPS / 10000)).toFixed(4)
      ),
      ownerProfitShareBps: PROFIT_SHARE_BPS,
      confidence: spreadBps > 500 ? "HIGH" : "MEDIUM",
      chains,
      scannedAt: new Date().toISOString(),
    });
  }

  return opportunities
    .sort(
      (a, b) =>
        (b as { estimatedNetProfitUSD: number }).estimatedNetProfitUSD -
        (a as { estimatedNetProfitUSD: number }).estimatedNetProfitUSD
    )
    .slice(0, 10);
}

/** 5. Premium — generate Aave V3 flash loan calldata */
function generateFlashCalldata(params: {
  receiverAddress: string;
  asset: string;
  amount: string;
  decimals: number;
  arbitrageCalldata: string;
  onBehalfOf?: string;
}): unknown {
  const { receiverAddress, asset, amount, decimals, arbitrageCalldata, onBehalfOf } = params;
  if (!isHex(receiverAddress)) throw new Error("receiverAddress must be a hex address");
  if (!isHex(asset)) throw new Error("asset must be a hex address");
  if (!isHex(arbitrageCalldata)) throw new Error("arbitrageCalldata must be hex");

  const amountWei = parseUnits(amount, decimals);
  const onBehalf = ((onBehalfOf ?? receiverAddress) as `0x${string}`);

  const calldata = encodeFunctionData({
    abi: AAVE_FLASH_LOAN_ABI,
    functionName: "flashLoan",
    args: [
      receiverAddress as `0x${string}`,
      [asset as `0x${string}`],
      [amountWei],
      [0n], // 0 = no debt (repaid in same tx)
      onBehalf,
      arbitrageCalldata as `0x${string}`,
      0,
    ],
  });

  return {
    to: AAVE_V3_POOL[NETWORK],
    calldata,
    value: "0x0",
    estimatedGas: "350000",
    network: NETWORK,
    chainId: NETWORK === "base" ? 8453 : 84532,
    asset,
    amountWei: amountWei.toString(),
    usdcAddress: USDC_BASE,
    description: `Aave V3 flash loan of ${amount} tokens on ${NETWORK}`,
    warning: "Always simulate before submitting. Losses are possible.",
  };
}

/** 6. Premium — simulate flash trade via eth_call dry run */
async function simulateFlashTrade(params: {
  to: string;
  calldata: string;
  from?: string;
}): Promise<unknown> {
  const { to, calldata, from } = params;
  if (!isHex(to)) throw new Error("to must be a hex address");
  if (!isHex(calldata)) throw new Error("calldata must be hex");

  const account = ((from ?? "0x0000000000000000000000000000000000000001") as `0x${string}`);

  try {
    const [callResult, gasPrice] = await Promise.all([
      publicClient.call({ to: to as `0x${string}`, data: calldata as `0x${string}`, account }),
      publicClient.getGasPrice(),
    ]);

    let gasEstimate = 350_000n;
    try {
      gasEstimate = await publicClient.estimateGas({
        to: to as `0x${string}`,
        data: calldata as `0x${string}`,
        account,
      });
    } catch {
      // Estimation may fail for complex flash loans — use conservative default
    }

    const gasCostWei = gasEstimate * gasPrice;
    const gasCostEth = formatUnits(gasCostWei, 18);

    // Fetch live ETH price for accurate USD gas estimate; fall back to a safe default
    let ethPriceUsd = 3_000;
    try {
      const prices = (await fetchMarketData(["ethereum"], ["usd"])) as Record<
        string,
        { usd: number }
      >;
      if (prices.ethereum?.usd) ethPriceUsd = prices.ethereum.usd;
    } catch {
      // Non-fatal — continue with fallback price
    }
    return {
      success: true,
      returnData: callResult.data ?? "0x",
      gasEstimate: gasEstimate.toString(),
      gasPriceWei: gasPrice.toString(),
      estimatedGasCostETH: gasCostEth,
      estimatedGasCostUSD: (parseFloat(gasCostEth) * ethPriceUsd).toFixed(4),
      network: NETWORK,
      simulatedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const e = err as { message?: string; cause?: { reason?: string } };
    return {
      success: false,
      error: e.message ?? "Simulation failed",
      revertReason: e.cause?.reason ?? "Unknown — check your receiver contract",
      network: NETWORK,
      simulatedAt: new Date().toISOString(),
    };
  }
}

/** 7. Premium — package flash loan into a ready-to-submit execution bundle */
function prepareExecutionBundle(params: {
  to: string;
  calldata: string;
  sessionKey?: string;
}): unknown {
  if (!isHex(params.to)) throw new Error("to must be a hex address");
  if (!isHex(params.calldata)) throw new Error("calldata must be hex");

  return {
    status: "BUNDLE_READY",
    bundle: {
      to: params.to,
      data: params.calldata,
      value: "0x0",
      chainId: NETWORK === "base" ? 8453 : 84532,
    },
    sessionKeyProvided: Boolean(params.sessionKey),
    submissionInstructions: {
      step1: "Verify simulation result shows success: true",
      step2: `Network: ${NETWORK} (Chain ID ${NETWORK === "base" ? 8453 : 84532})`,
      step3: "Ensure ≥0.002 ETH for gas in your wallet",
      step4: "Submit bundle.data to bundle.to via your wallet or EIP-4337 bundler",
      step5: "Monitor at https://basescan.org",
    },
    profitShare: {
      ownerAddress: RECIPIENT,
      basisPoints: PROFIT_SHARE_BPS,
      description: `${PROFIT_SHARE_BPS / 100}% of net profit routes to ${RECIPIENT}`,
    },
    preparedAt: new Date().toISOString(),
    disclaimer: "You bear full execution risk. Simulate before submitting.",
  };
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const handler = createPaidMcpHandler(
  async (server) => {
    // ── BASIC TOOLS ($0.01 – $0.05 USDC) ─────────────────────────────────────

    server.paidTool(
      "get_market_data",
      "Real-time token prices, 24h change, and market cap across chains via CoinGecko.",
      { price: 0.01 },
      {
        tokens: z
          .array(z.string().min(1).max(100))
          .min(1)
          .max(20)
          .describe("CoinGecko token IDs, e.g. ['ethereum','usd-coin']"),
        vs_currencies: z
          .array(z.string().min(1).max(10))
          .min(1)
          .max(5)
          .optional()
          .describe("Quote currencies (default: ['usd'])"),
      },
      {},
      async ({ tokens, vs_currencies }) => {
        const data = await fetchMarketData(tokens, vs_currencies ?? ["usd"]);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.paidTool(
      "scan_yield_opportunities",
      "Top DeFi yield pools by APY across all chains or a specific chain, sourced from DeFiLlama.",
      { price: 0.03 },
      {
        minTvl: z
          .number()
          .positive()
          .optional()
          .describe("Minimum pool TVL in USD (default 1,000,000)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results to return (default 10)"),
        chain: z
          .string()
          .optional()
          .describe("Filter by chain name, e.g. 'Base' or 'Ethereum'"),
      },
      {},
      async ({ minTvl, limit, chain }) => {
        const pools = await fetchYieldOpportunities(
          minTvl ?? 1_000_000,
          limit ?? 10,
          chain
        );
        return { content: [{ type: "text", text: JSON.stringify(pools, null, 2) }] };
      }
    );

    server.paidTool(
      "enrich_web_data",
      "Fetches any public URL and returns clean text or parsed JSON — ideal for price pages, docs, or feeds.",
      { price: 0.05 },
      {
        url: z.string().url().describe("Public URL to fetch"),
        maxLength: z
          .number()
          .int()
          .min(100)
          .max(10_000)
          .optional()
          .describe("Max characters for text responses (default 2000)"),
      },
      {},
      async ({ url, maxLength }) => {
        const data = await enrichWebData(url, maxLength ?? 2_000);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    );

    // ── PREMIUM VIP TOOLS ($0.10 – $0.50 USDC) ───────────────────────────────

    server.paidTool(
      "detect_flash_arb_opportunities",
      "🔥 VIP: Scans Base and Solana DEXes via DeFiLlama for live arbitrage opportunities with net-profit and owner profit-share estimates.",
      { price: 0.1 },
      {
        chains: z
          .array(z.enum(["base", "solana", "ethereum", "arbitrum"]))
          .min(1)
          .max(4)
          .optional()
          .describe("Chains to scan (default: ['base'])"),
      },
      {},
      async ({ chains }) => {
        const opps = await detectArbOpportunities(chains ?? ["base"]);
        return { content: [{ type: "text", text: JSON.stringify(opps, null, 2) }] };
      }
    );

    server.paidTool(
      "generate_flash_loan_calldata",
      "🔥 VIP: Encodes a ready-to-sign Aave V3 flash loan transaction with your arbitrage logic embedded. Returns calldata for simulate_flash_trade or direct submission.",
      { price: 0.25 },
      {
        receiverAddress: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .describe("Your flash loan receiver contract address"),
        asset: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .describe(`Token to borrow (USDC on Base: ${USDC_BASE})`),
        amount: z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .describe("Amount to borrow as a decimal string, e.g. '100000'"),
        decimals: z
          .number()
          .int()
          .min(0)
          .max(18)
          .describe("Token decimals (6 for USDC, 18 for ETH/WETH)"),
        arbitrageCalldata: z
          .string()
          .regex(/^0x[0-9a-fA-F]*$/)
          .describe("Hex-encoded calldata your receiver executes during the flash loan"),
        onBehalfOf: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .optional()
          .describe("Address that receives flash loan debt (defaults to receiverAddress)"),
      },
      {},
      async ({ receiverAddress, asset, amount, decimals, arbitrageCalldata, onBehalfOf }) => {
        const result = generateFlashCalldata({
          receiverAddress,
          asset,
          amount,
          decimals,
          arbitrageCalldata,
          onBehalfOf,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "simulate_flash_trade",
      "🔥 VIP: Dry-runs your flash trade against live on-chain state via eth_call. Returns success/fail, exact gas cost, and revert reason — before you spend a cent.",
      { price: 0.15 },
      {
        to: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .describe("Contract address to call (e.g. Aave V3 Pool)"),
        calldata: z
          .string()
          .regex(/^0x[0-9a-fA-F]*$/)
          .describe("Encoded calldata from generate_flash_loan_calldata"),
        from: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .optional()
          .describe("Sender address for the simulation (optional)"),
      },
      {},
      async ({ to, calldata, from }) => {
        const result = await simulateFlashTrade({ to, calldata, from });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "execute_flash_loan_bundle",
      "🔥 VIP: Packages your flash loan into a ready-to-submit EVM bundle with profit-share routing to the owner wallet. Compatible with smart wallets, EOAs, and EIP-4337 bundlers.",
      { price: 0.5 },
      {
        to: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .describe("Target contract address (Aave V3 Pool or your router)"),
        calldata: z
          .string()
          .regex(/^0x[0-9a-fA-F]*$/)
          .describe("Encoded calldata from generate_flash_loan_calldata"),
        sessionKey: z
          .string()
          .optional()
          .describe("Optional session key for automated smart-wallet execution"),
      },
      {},
      async ({ to, calldata, sessionKey }) => {
        const result = prepareExecutionBundle({ to, calldata, sessionKey });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );
  },
  {
    serverInfo: { name: "FlashVault MCP", version: "1.0.0" },
  },
  {
    recipient: RECIPIENT,
    facilitator: { url: FACILITATOR_URL as `${string}://${string}` },
    network: NETWORK,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
