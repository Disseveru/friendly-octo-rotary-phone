export default function Home() {
  const mcpEndpoint =
    process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/mcp`
      : "/api/mcp";

  return (
    <main
      style={{
        fontFamily: "monospace",
        maxWidth: 700,
        margin: "60px auto",
        padding: "0 20px",
        lineHeight: 1.7,
      }}
    >
      <h1>⚡ FlashVault MCP</h1>
      <p>
        <strong>The VIP x402 Flash Loan Profit Printer.</strong>
        <br />
        AI agents pay USDC on Base to detect, simulate, generate calldata, and
        execute risk-free arbitrage — while every call prints USDC for you.
      </p>

      <h2>MCP Endpoint</h2>
      <code
        style={{
          display: "block",
          background: "#111",
          color: "#0f0",
          padding: "12px 16px",
          borderRadius: 6,
          wordBreak: "break-all",
        }}
      >
        {mcpEndpoint}
      </code>

      <h2>Tools &amp; Pricing</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>
              Tool
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", paddingBottom: 6 }}>
              Price (USDC)
            </th>
          </tr>
        </thead>
        <tbody>
          {[
            ["get_market_data", "$0.01"],
            ["scan_yield_opportunities", "$0.03"],
            ["enrich_web_data", "$0.05"],
            ["🔥 detect_flash_arb_opportunities", "$0.10"],
            ["🔥 simulate_flash_trade", "$0.15"],
            ["🔥 generate_flash_loan_calldata", "$0.25"],
            ["🔥 execute_flash_loan_bundle", "$0.50"],
          ].map(([tool, price]) => (
            <tr key={tool}>
              <td style={{ padding: "4px 0" }}>{tool}</td>
              <td style={{ textAlign: "right", padding: "4px 0" }}>{price}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Payment</h2>
      <p>
        All tools require{" "}
        <a
          href="https://x402.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          x402 USDC payments on Base
        </a>
        . Payments go directly to the owner wallet. No subscription needed —
        agents pay per call.
      </p>

      <h2>Integrate</h2>
      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: "12px 16px",
          borderRadius: 6,
          overflowX: "auto",
          fontSize: 13,
        }}
      >{`// Claude / MCP config
{
  "mcpServers": {
    "flashvault": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/client-stdio"],
      "env": {
        "MCP_SERVER_URL": "${mcpEndpoint}"
      }
    }
  }
}`}</pre>

      <p style={{ color: "#888", fontSize: 13, marginTop: 40 }}>
        Powered by{" "}
        <a href="https://x402.org" target="_blank" rel="noopener noreferrer">
          x402
        </a>{" "}
        ·{" "}
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
          Vercel
        </a>{" "}
        · Base
      </p>
    </main>
  );
}
