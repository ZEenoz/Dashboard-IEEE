'use client';

import { LayoutDashboard, Database, Activity, Map as MapIcon, Settings, Search, Menu, LogOut, User, Warehouse, SatelliteDish, LayoutGrid, History, Bell, Sliders } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export const menuItems = [
    { name: 'Overview', icon: LayoutGrid, href: '/' },
    { name: 'Stations', icon: SatelliteDish, href: '/parameters' },
    { name: 'Analytics', icon: Activity, href: '/analytics' },
    { name: 'History', icon: History, href: '/history' },
    { name: 'Alerts', icon: Bell, href: '/alerts' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();

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
                    // Role-based filtering:
                    // General User cannot see Alerts
                    if (item.href === '/alerts' && session?.user?.role === 'general_user') return null;

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

                {/* Admin Tools */}
                {session?.user?.role !== 'general_user' && (
                    <div className="mt-auto border-t border-gray-800 pt-4 space-y-1">
                        {/* Offset Presets — Admin Only */}
                        {session?.user?.role === 'admin' && (
                            <Link
                                href="/offset-presets"
                                className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 group
                            ${pathname === '/offset-presets'
                                        ? 'bg-blue-600/10 text-blue-500 border-r-2 border-blue-500'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <Sliders className={`w-5 h-5 ${pathname === '/offset-presets' ? 'text-blue-500' : 'text-gray-400 group-hover:text-white'}`} />
                                <span className="ml-3 font-medium">Offset Presets</span>
                            </Link>
                        )}

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
                )}
            </nav>

            {/* User Profile / Logout */}
            <div className="p-4 border-t border-gray-800 bg-[#0F172A]">
                {session ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${session.user?.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600/40 text-gray-400'}`}>
                                <User size={16} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold truncate text-white">{session.user?.name || 'User'}</p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${session.user?.role === 'admin' ? 'bg-blue-500/20 text-blue-300' :
                                        session.user?.role === 'local_authority' ? 'bg-yellow-500/20 text-yellow-300' :
                                            'bg-gray-600/30 text-gray-400'
                                    }`}>
                                    {session.user?.role === 'admin' ? '🔑 Admin' :
                                        session.user?.role === 'local_authority' ? '🛡️ Auth' :
                                            '👤 View'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="flex items-center justify-center gap-2 w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all text-xs font-bold"
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <Link href="/login" className="text-xs text-gray-500 hover:text-white transition-colors">
                            Admin Login
                        </Link>
                    </div>
                )}
            </div>
        </aside>
    );
}
