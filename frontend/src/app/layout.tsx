import "./globals.css";

export const metadata = {
  title: "qroute - Quai Multi-Shard Liquidity Aggregator",
  description: "Aggregating liquidity across 9 Zone shards for optimal swap execution on Quai Network.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col justify-between">
        {children}
      </body>
    </html>
  );
}
