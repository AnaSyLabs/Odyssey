import type { Metadata } from "next";
import { JetBrains_Mono, Space_Mono, Urbanist } from "next/font/google";
import ProductIntro from "@/components/ProductIntro";
import "./globals.css";

const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });

export const metadata: Metadata = {
  title: "Odyssey · Proof-of-Reality Data",
  description: "Real-world data for AI, signed at the sensor, verified by stake, owned by the people who capture it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mono.variable} ${jetbrains.variable} ${urbanist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("odyssey:intro")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="off"}catch(e){}`,
          }}
        />
        <ProductIntro />
        {children}
      </body>
    </html>
  );
}
