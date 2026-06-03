import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import "@/lib/disableInspect";
import ThemeProvider from "@/components/theme-provider";



const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pazimo Ticketing Platform",
  description: "organizer home page",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light">
      <div className={`${spaceGrotesk.variable} ${inter.variable} flex flex-col min-h-screen`}>
        <Toaster />
        {children}
      </div>
    </ThemeProvider>
  );
}
