import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TON Storage Manager",
  description: "Web-based TON Storage manager for a Vultr VPS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[var(--color-page)] text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
