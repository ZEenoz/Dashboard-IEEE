import { Inter } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/contexts/SocketContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
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
              <div className="flex w-full min-h-screen">
                <Sidebar />
                <main className="flex-1 md:ml-64 min-h-screen relative p-6">
                  {children}
                </main>
              </div>
              <Toaster position="top-right" />
            </SocketProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}