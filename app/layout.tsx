import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helix — Trading Analytics",
  description:
    "Real-time trading analytics dashboard: candlestick price action, P&L, positions, and portfolio allocation.",
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
      <body className="min-h-dvh bg-base text-ink antialiased">{children}</body>
    </html>
  );
}
