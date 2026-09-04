import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoBanner } from "@/components/demo-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "TerminAI — rezervacijski sistem za salone (deluje tudi offline)",
  description:
    "Rezervacijski sistem za frizerske in kozmetične salone: stranke rezervirajo same 24/7, sistem teče na vašem računalniku tudi brez interneta, podatki ostanejo pri vas. AI recepcionarka Ana kot neobvezen dodatek.",
  keywords: ["rezervacije", "termini", "salon", "offline", "Slovenija", "koledar"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <DemoBanner />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
