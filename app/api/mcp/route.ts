/**
 * ClaimGuard MCP — x402-powered AI Claim Verification & Deep Research
 *
 * 3 basic tools ($0.01–$0.05):  topic summary, confidence scoring, claim verification
 * 4 premium tools ($0.10–$0.25): source checking, entity research, URL fact-check, deep research
 *
 * Every call pays USDC on Base directly to RECIPIENT_ADDRESS.
 * LLM reasoning powered by OpenAI (set OPENAI_API_KEY).
 */

import { createPaidMcpHandler } from "x402-mcp";
import { z } from "zod";

// ── Configuration ─────────────────────────────────────────────────────────────

const RECIPIENT = (process.env.RECIPIENT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const NETWORK = (process.env.NETWORK ?? "base") as "base" | "base-sepolia";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

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

/** Fetch a public URL and return cleaned text (max maxLength chars). */
async function fetchUrlText(rawUrl: string, maxLength = 4_000): Promise<string> {
  const url = validatePublicUrl(rawUrl);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "ClaimGuardMCP/1.0 (https://claimguard.vercel.app)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.hostname}`);
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (contentType.includes("application/json")) {
    return JSON.stringify(JSON.parse(text)).slice(0, maxLength);
  }
  // Strip HTML tags — output is returned as JSON text to AI agents, not rendered in a browser
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Call OpenAI Chat Completions and return the assistant message as a string. */
async function llmCall(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
  maxTokens = 2_000
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your Vercel environment variables to enable AI reasoning."
    );
  }

  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

// ── Tool implementations ──────────────────────────────────────────────────────

/** 1. Basic — quick factual topic summary */
async function summarizeTopic(topic: string, maxWords: number): Promise<unknown> {
  const systemPrompt =
    "You are a factual research assistant. Provide accurate, concise, neutral summaries " +
    "with verified facts only. Be honest about uncertainty. Always respond with valid JSON.";
  const userPrompt =
    `Summarize the following topic in at most ${maxWords} words. ` +
    `Return JSON with keys: topic (string), summary (string), keyFacts (string[]), ` +
    `confidence (number 0-100), caveats (string or null).\n\nTopic: ${topic}`;

  const raw = await llmCall(systemPrompt, userPrompt, true);
  return JSON.parse(raw);
}

/** 2. Basic — calibrated confidence scoring for a claim */
async function scoreConfidence(claim: string, context?: string): Promise<unknown> {
  const systemPrompt =
    "You are a critical reasoning assistant. Assess the factual accuracy of claims based on " +
    "scientific consensus, historical record, and available evidence. " +
    "Be calibrated and honest about uncertainty. Always respond with valid JSON.";
  const contextBlock = context ? `\n\nAdditional context: ${context}` : "";
  const userPrompt =
    `Evaluate the following claim and return JSON with keys: ` +
    `claim (string), confidence (number 0-100), verdict (one of: "likely_true", "likely_false", ` +
    `"unverified", "disputed", "context_dependent"), reasoning (string), ` +
    `supportingPoints (string[]), contradictingPoints (string[]), caveats (string or null).` +
    `\n\nClaim: ${claim}${contextBlock}`;

  const raw = await llmCall(systemPrompt, userPrompt, true);
  return JSON.parse(raw);
}

/** 3. Basic — structured claim verification with evidence */
async function verifyClaim(claim: string, searchContext?: string): Promise<unknown> {
  const systemPrompt =
    "You are a professional fact-checker. Analyze claims rigorously for accuracy, " +
    "identify supporting and contradicting evidence, cite specific sources where possible, " +
    "and assess overall confidence. Always respond with valid JSON.";
  const contextBlock = searchContext ? `\n\nContext / background: ${searchContext}` : "";
  const userPrompt =
    `Verify the following claim. Return JSON with keys: ` +
    `claim (string), verdict (one of: "true", "false", "partially_true", "unverified", "disputed"), ` +
    `confidence (number 0-100), summary (string), reasoning (string), ` +
    `supportingEvidence (string[]), contradictingEvidence (string[]), ` +
    `suggestedSources (string[]), recommendation (string), verifiedAt (ISO timestamp).` +
    `\n\nClaim: ${claim}${contextBlock}`;

  const raw = await llmCall(systemPrompt, userPrompt, true);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  parsed.verifiedAt = new Date().toISOString();
  return parsed;
}

/** 4. Premium — fetch URLs and analyze whether they support/contradict a claim */
async function checkSources(claim: string, urls: string[]): Promise<unknown> {
  // Fetch all URLs concurrently
  const fetched = await Promise.all(
    urls.map(async (u) => {
      try {
        const text = await fetchUrlText(u, 3_000);
        return { url: u, status: "ok", content: text };
      } catch (err) {
        return { url: u, status: "error", content: String((err as Error).message) };
      }
    })
  );

  const sourcesBlock = fetched
    .map((f, i) => `SOURCE ${i + 1} (${f.url}):\n${f.content}`)
    .join("\n\n---\n\n");

  const systemPrompt =
    "You are a source analysis expert. Evaluate whether provided source content supports " +
    "or contradicts a given claim. Assess source quality and relevance. Always respond with valid JSON.";
  const userPrompt =
    `Analyze these sources in relation to the claim below. Return JSON with keys: ` +
    `claim (string), sources (array of objects with url, stance (one of: "supports", "contradicts", ` +
    `"neutral", "irrelevant", "unavailable"), relevanceScore (number 0-100), summary (string)), ` +
    `overallSupport (one of: "strong_support", "weak_support", "mixed", "weak_contradiction", ` +
    `"strong_contradiction", "insufficient_data"), confidence (number 0-100), ` +
    `analysis (string), checkedAt (ISO timestamp).` +
    `\n\nClaim: ${claim}\n\n${sourcesBlock}`;

  const raw = await llmCall(systemPrompt, userPrompt, true);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  parsed.checkedAt = new Date().toISOString();
  return parsed;
}

/** 5. Premium — extract and research named entities in text */
async function researchEntities(
  text: string,
  entityTypes: string[]
): Promise<unknown> {
  const systemPrompt =
    "You are an entity research specialist. Extract named entities from text and provide " +
    "accurate, verified information about each one. Always respond with valid JSON.";
  const typesBlock =
    entityTypes.length > 0
      ? `Focus on these entity types: ${entityTypes.join(", ")}.`
      : "Extract all entity types (people, organizations, places, products, events).";
  const userPrompt =
    `${typesBlock} Return JSON with keys: ` +
    `entities (array of objects with name, type, description, credibilityNotes (string), ` +
    `keyFacts (string[]), verificationStatus (one of: "verified", "likely_accurate", ` +
    `"uncertain", "disputed")), summary (string), researchedAt (ISO timestamp).` +
    `\n\nText: ${text}`;

  const raw = await llmCall(systemPrompt, userPrompt, true);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  parsed.researchedAt = new Date().toISOString();
  return parsed;
}

/** 6. Premium — fetch an article URL and fact-check the claims within it */
async function factCheckUrl(rawUrl: string, focusClaims?: string[]): Promise<unknown> {
  const articleText = await fetchUrlText(rawUrl, 5_000);

  const focusBlock =
    focusClaims && focusClaims.length > 0
      ? `\n\nPay special attention to these claims: ${focusClaims.join("; ")}`
      : "";

  const systemPrompt =
    "You are a fact-checking journalist. Analyze article content, identify factual claims, " +
    "verify them against established knowledge, and assess overall source credibility. " +
    "Always respond with valid JSON.";
  const userPrompt =
    `Fact-check the article content below. Return JSON with keys: ` +
    `url (string), articleSummary (string), ` +
    `claimsFound (array of strings with the main factual claims identified), ` +
    `factCheckResults (array of objects with claim, verdict (one of: "true", "false", ` +
    `"partially_true", "unverified", "misleading"), confidence (number 0-100), reasoning (string)), ` +
    `overallCredibility (one of: "high", "medium", "low", "very_low"), ` +
    `credibilityScore (number 0-100), summary (string), checkedAt (ISO timestamp).` +
    `${focusBlock}\n\nArticle content:\n${articleText}`;

  const raw = await llmCall(systemPrompt, userPrompt, true, 3_000);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  parsed.url = rawUrl;
  parsed.checkedAt = new Date().toISOString();
  return parsed;
}

/** 7. Premium — multi-step deep research on a topic, with optional source URLs */
async function deepResearch(
  query: string,
  depth: "quick" | "thorough",
  searchUrls?: string[]
): Promise<unknown> {
  // Optionally fetch provided source URLs for grounding
  let sourceContext = "";
  if (searchUrls && searchUrls.length > 0) {
    const fetched = await Promise.all(
      searchUrls.map(async (u) => {
        try {
          const text = await fetchUrlText(u, 3_000);
          return `SOURCE (${u}):\n${text}`;
        } catch {
          return `SOURCE (${u}): [fetch failed]`;
        }
      })
    );
    sourceContext = `\n\nProvided sources:\n${fetched.join("\n\n---\n\n")}`;
  }

  const depthInstruction =
    depth === "thorough"
      ? "Conduct thorough, multi-angle research. Explore historical context, current evidence, " +
        "counterarguments, expert consensus, and open questions."
      : "Conduct a focused, efficient research pass. Cover the main facts and key uncertainties.";

  const systemPrompt =
    "You are a thorough research analyst. Conduct comprehensive, evidence-based research. " +
    "Synthesize information from multiple angles, distinguish facts from speculation, " +
    "and clearly identify areas of uncertainty. Always respond with valid JSON.";
  const userPrompt =
    `${depthInstruction} Return JSON with keys: ` +
    `query (string), researchPlan (string[]), findings (string), ` +
    `keyTakeaways (string[]), openQuestions (string[]), ` +
    `citations (array of objects with source (string), claim (string)), ` +
    `confidenceLevel (one of: "high", "medium", "low"), ` +
    `confidenceScore (number 0-100), limitations (string), researchedAt (ISO timestamp).` +
    `\n\nResearch query: ${query}${sourceContext}`;

  const raw = await llmCall(systemPrompt, userPrompt, true, 4_000);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  parsed.researchedAt = new Date().toISOString();
  return parsed;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const handler = createPaidMcpHandler(
  async (server) => {
    // ── BASIC TOOLS ($0.01 – $0.05 USDC) ─────────────────────────────────────

    server.paidTool(
      "summarize_topic",
      "Quick AI-powered factual summary of any topic — returns key facts, confidence score, and caveats.",
      { price: 0.01 },
      {
        topic: z
          .string()
          .min(3)
          .max(500)
          .describe("Topic or question to summarize, e.g. 'mRNA vaccine mechanism'"),
        maxWords: z
          .number()
          .int()
          .min(50)
          .max(500)
          .optional()
          .describe("Maximum words in the summary (default: 150)"),
      },
      {},
      async ({ topic, maxWords }) => {
        const result = await summarizeTopic(topic, maxWords ?? 150);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "get_confidence_score",
      "Calibrated 0–100 confidence score for any claim — includes verdict, supporting points, and contradicting points.",
      { price: 0.03 },
      {
        claim: z
          .string()
          .min(5)
          .max(1_000)
          .describe("The claim to evaluate, e.g. 'The moon landing was faked'"),
        context: z
          .string()
          .max(2_000)
          .optional()
          .describe("Optional additional context or background for the claim"),
      },
      {},
      async ({ claim, context }) => {
        const result = await scoreConfidence(claim, context);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "verify_claim",
      "Structured claim verification — returns a true/false/unverified verdict, confidence score, evidence summary, and recommended sources.",
      { price: 0.05 },
      {
        claim: z
          .string()
          .min(5)
          .max(1_000)
          .describe("The claim to verify"),
        searchContext: z
          .string()
          .max(2_000)
          .optional()
          .describe("Optional context, background, or known facts about the claim"),
      },
      {},
      async ({ claim, searchContext }) => {
        const result = await verifyClaim(claim, searchContext);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    // ── PREMIUM TOOLS ($0.10 – $0.25 USDC) ───────────────────────────────────

    server.paidTool(
      "check_sources",
      "🔍 Premium: Fetches up to 3 URLs and uses AI to determine whether each source supports or contradicts your claim — with relevance scores and an overall support verdict.",
      { price: 0.1 },
      {
        claim: z
          .string()
          .min(5)
          .max(1_000)
          .describe("The claim to check sources against"),
        urls: z
          .array(z.string().url())
          .min(1)
          .max(3)
          .describe("Public URLs to analyze as evidence sources"),
      },
      {},
      async ({ claim, urls }) => {
        const result = await checkSources(claim, urls);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "research_entities",
      "🔍 Premium: Extracts named entities (people, organizations, places, events) from text and returns verified descriptions, key facts, and credibility notes for each.",
      { price: 0.15 },
      {
        text: z
          .string()
          .min(10)
          .max(3_000)
          .describe("Text containing entities to research"),
        entityTypes: z
          .array(
            z.enum(["person", "organization", "place", "product", "event", "concept"])
          )
          .max(6)
          .optional()
          .describe("Entity types to focus on (default: all types)"),
      },
      {},
      async ({ text, entityTypes }) => {
        const result = await researchEntities(text, entityTypes ?? []);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "fact_check_url",
      "🔍 Premium: Fetches an article or web page and AI fact-checks the claims within it — returns per-claim verdicts, confidence scores, and an overall credibility rating.",
      { price: 0.2 },
      {
        url: z
          .string()
          .url()
          .describe("Public URL of the article or page to fact-check"),
        focusClaims: z
          .array(z.string().min(3).max(300))
          .max(5)
          .optional()
          .describe("Specific claims to prioritize during fact-checking (optional)"),
      },
      {},
      async ({ url, focusClaims }) => {
        const result = await factCheckUrl(url, focusClaims);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.paidTool(
      "deep_research",
      "🔍 Premium: Multi-step AI deep research on any topic or question — returns a structured research plan, findings, key takeaways, citations, and confidence level. Optionally grounds research in provided source URLs.",
      { price: 0.25 },
      {
        query: z
          .string()
          .min(5)
          .max(1_000)
          .describe("Research question or topic to investigate"),
        depth: z
          .enum(["quick", "thorough"])
          .optional()
          .describe("Research depth: 'quick' (focused) or 'thorough' (multi-angle, default: 'thorough')"),
        searchUrls: z
          .array(z.string().url())
          .max(3)
          .optional()
          .describe("Optional public URLs to use as primary sources for grounding"),
      },
      {},
      async ({ query, depth, searchUrls }) => {
        const result = await deepResearch(query, depth ?? "thorough", searchUrls);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );
  },
  {
    serverInfo: { name: "ClaimGuard MCP", version: "1.0.0" },
  },
  {
    recipient: RECIPIENT,
    facilitator: { url: FACILITATOR_URL as `${string}://${string}` },
    network: NETWORK,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
