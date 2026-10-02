import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { themeScript } from "@/components/brand/theme-toggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Display face — heavy, slightly condensed, matching the logo's wordmark. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  /* Resolves the relative image paths in per-page Open Graph tags. Set
     NEXT_PUBLIC_SITE_URL per environment; the live domain is the fallback. */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.ayyanmotorsltd.com",
  ),
  title: {
    default: "Ayyan Motors Ltd — Car Import & Export",
    template: "%s · Ayyan Motors Ltd",
  },
  description:
    "Premium vehicle import, export, sales and auctions in Kampala, Uganda.",
  icons: { icon: "/brand/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${archivo.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
