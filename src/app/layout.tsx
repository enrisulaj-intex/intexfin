import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "IntexFin",
    template: "%s · IntexFin",
  },
  description: "Sistemi financiar i brendshëm i Intex Courier — moduli i shpenzimeve",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sq">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
