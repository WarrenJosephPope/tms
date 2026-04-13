import "./globals.css";
import { Inter } from "next/font/google";
import ToasterClient from "@/components/ToasterClient";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: { default: "Tracking Management System", template: "%s | Tracking Management System" },
  description: "India's freight exchange and fleet tracking platform",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <ToasterClient />
      </body>
    </html>
  );
}
