import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HFO Order App",
  description: "A simple order app built with Next.js and Tailwind CSS.",
};

// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      
      <body className="min-h-screen bg-white">
        <nav className="flex gap-0.25 p-1 text-sm md:text-base">
        <a href="/" className="inline-block bg-blue-600 text-white px-2 py-1 xl:px-4 xl:py-2 rounded hover:bg-blue-700 focus:bg-green-600" > Home </a>
        <a href="/order" className="inline-block bg-blue-600 text-white px-2 py-1 xl:px-4 xl:py-2 rounded hover:bg-blue-700 focus:bg-green-600" > Order </a>
        <a href="/summary" className="inline-block bg-blue-600 text-white px-2 py-1 xl:px-4 xl:py-2 rounded hover:bg-blue-700 focus:bg-green-600" > Summary </a>
        <a href="/admin" className="inline-block bg-blue-600 text-white px-2 py-1 xl:px-4 xl:py-2 rounded hover:bg-blue-700 focus:bg-green-600" > Admin </a>
        <a href="/pricelist" className="inline-block bg-blue-600 text-white px-2 py-1 xl:px-4 xl:py-2 rounded hover:bg-blue-700 focus:bg-green-600" > Price List </a>
        <a href="/scheme" className="inline-block bg-blue-600 text-white px-2 py-1 xl:px-4 xl:py-2 rounded hover:bg-blue-700 focus:bg-green-600" > Scheme </a>
        </nav>
        {children}
      </body>
    </html>
  );
}

