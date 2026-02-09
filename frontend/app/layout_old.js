import { Inter } from "next/font/google";
import "./globals.css"; // 👈 บรรทัดนี้สำคัญที่สุด! ถ้าไม่มี หน้าเว็บจะพัง

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Water Monitor Dashboard",
  description: "Real-time 3D",
};

import Sidebar from "@/components/Sidebar";
import { SocketProvider } from "@/contexts/SocketContext";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex h-screen overflow-hidden bg-gray-900`}>
        <SocketProvider>
          <Sidebar />
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </SocketProvider>
      </body>
    </html>
  );
}