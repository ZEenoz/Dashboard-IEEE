'use client';

import { LayoutDashboard, Database, Activity, Map as MapIcon, Settings, Search, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
    { name: 'Overview', icon: LayoutDashboard, href: '/' },
    { name: 'Parameters', icon: Database, href: '/parameters' },
    { name: 'Analytics', icon: Activity, href: '/analytics' },
    { name: 'History', icon: MapIcon, href: '/history' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden md:flex flex-col w-64 h-screen bg-[#0F172A] border-r border-gray-800 fixed left-0 top-0 z-50">
            {/* Brand Area */}
            <div className="h-20 flex flex-col justify-center px-6 border-b border-gray-800">
                <h1 className="text-xl font-bold text-blue-500">Water Monitor</h1>
                <p className="text-xs text-gray-500">IoT Dashboard v1.0</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 flex flex-col gap-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 group
                ${isActive
                                    ? 'bg-blue-600/10 text-blue-500 border-r-2 border-blue-500'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-white'}`} />
                            <span className="ml-3 font-medium">{item.name}</span>
                        </Link>
                    );
                })}

                <div className="mt-auto border-t border-gray-800 pt-4">
                    <Link
                        href="/settings"
                        className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 group
                    ${pathname === '/settings'
                                ? 'bg-blue-600/10 text-blue-500 border-r-2 border-blue-500'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                    >
                        <Settings className={`w-5 h-5 ${pathname === '/settings' ? 'text-blue-500' : 'text-gray-400 group-hover:text-white'}`} />
                        <span className="ml-3 font-medium">Settings</span>
                    </Link>
                </div>
            </nav>

            {/* Footer Info */}
            <div className="p-4 border-t border-gray-800">
                <div className="text-xs text-gray-600 text-center">Running in development</div>
            </div>
        </aside>
    );
}
