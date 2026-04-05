import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: { default: "eParivahan", template: "%s | eParivahan" },
  description: "India's freight exchange and fleet tracking platform",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: "10px", fontSize: "14px" },
          }}
        />
      </body>
    </html>
  );
}
