import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import { AuthProvider } from "@/contexts/AuthContext";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "FUTSALISTA | フットサルチーム公式サイト",
  description:
    "フットサルチームの成績データ、選手情報、試合結果、ランキング、最新ニュースをお届けする公式Webサイト",
  keywords: "フットサル, futsal, チーム, 成績, ランキング",
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
      className={`${montserrat.variable} ${inter.variable}`}
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
