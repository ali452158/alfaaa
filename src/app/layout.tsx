import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ALFA PRO — بوت إشارات التداول المباشرة",
  description:
    "بوت تداول أون لاين يعرض إشارات SwitchX و PainX و GainX و BreakX بمستوياتها الحية في الوقت الفعلي.",
  keywords: [
    "ALFA PRO",
    "بوت تداول",
    "إشارات تداول",
    "SwitchX",
    "PainX",
    "GainX",
    "BreakX",
  ],
  authors: [{ name: "ALFA PRO" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
