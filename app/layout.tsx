import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FlashVault MCP",
  description:
    "x402-powered Flash Loan Profit Printer — AI agents pay USDC to detect, simulate, and execute risk-free arbitrage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
