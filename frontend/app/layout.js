import { Inter } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/contexts/SocketContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { Providers } from "@/components/Providers";
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Water Monitoring Dashboard",
  description: "Real-time water level and pressure monitoring",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#111827] text-white flex`}>
        <Providers>
          <AuthProvider>
            <SocketProvider>
              <div className="flex w-full min-h-screen relative">
                <Sidebar />
                <div className="flex-1 flex flex-col min-h-screen w-full">
                  <MobileNav />
                  <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen">
                    {children}
                  </main>
                </div>
              </div>
              <Toaster position="top-right" />
            </SocketProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}