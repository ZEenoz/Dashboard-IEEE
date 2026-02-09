import { Inter } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/contexts/SocketContext";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Water Monitoring Dashboard",
  description: "Real-time water level and pressure monitoring",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#111827] text-white flex`}>
        <SocketProvider>
          <Sidebar />
          <main className="flex-1 md:ml-64 min-h-screen relative p-6">

            {/* Header Removed */}

            {children}
          </main>
        </SocketProvider>
      </body>
    </html>
  );
}