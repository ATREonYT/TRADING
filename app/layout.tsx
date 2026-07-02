import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { AccountProvider } from "@/components/AccountContext";

const title = "Helix — Trade the news before it moves the tape";
const description =
  "Real-time market intelligence: world & financial news from 65+ sources, catalyst analysis that pinpoints what actually moves prices, and a full-market scanner for traders.";

export const metadata: Metadata = {
  metadataBase: new URL("https://helix.example.com"),
  title: {
    default: title,
    template: "%s · Helix",
  },
  description,
  applicationName: "Helix",
  keywords: [
    "trading news",
    "market intelligence",
    "stock catalysts",
    "financial news",
    "market scanner",
    "real-time markets",
  ],
  openGraph: {
    type: "website",
    title,
    description,
    siteName: "Helix",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-base text-ink antialiased">
        <AccountProvider>
          {children}
          <CommandPalette />
        </AccountProvider>
      </body>
    </html>
  );
}
