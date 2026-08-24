import "./globals.css";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import AmbientBackground from "../components/AmbientBackground";
import Analytics from "../components/Analytics";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata = {
  title: "qroute — Cross-shard routing infrastructure for Quai",
  description:
    "Routing infrastructure for Quai's sharded future. As Quai scales into new zones, qroute makes them feel like one chain — ETX-native cross-shard routing, split liquidity, gas-aware net-output scoring. Cyprus-1 live today.",
};

export const viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="grain min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/30">
        <AmbientBackground />
        <Analytics />
        <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
