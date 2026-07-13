import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verytis",
  description: "Real-time road verification layer for declared and observed road state."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
