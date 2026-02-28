import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shrinkr — Lightning-Fast URL Shortener",
  description: "Shorten URLs instantly with analytics, custom aliases, and enterprise-grade performance.",
  keywords: ["url shortener", "link shortener", "short url", "analytics"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
