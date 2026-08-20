import { Oswald, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { AuthProvider } from "@/contexts/AuthContext";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "FUMINTUS | Official Website",
  description:
    "フットサルチーム FUMINTUS の公式サイト。試合結果、選手、ランキング、出欠、ニュース。",
  keywords: "FUMINTUS, フットサル, futsal, チーム, 成績, ランキング",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ja"
      className={`${oswald.variable} ${inter.variable}`}
    >
      <body>
        <AuthProvider>
          <Header />
          <main className="pageContent">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
