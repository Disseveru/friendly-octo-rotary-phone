import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClaimGuard MCP",
  description:
    "x402-powered AI claim verification & deep research — agents pay USDC to verify claims, fact-check articles, score confidence, and conduct deep research.",
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
