'use client';

import { useState, useEffect } from 'react';
import { Menu, X, LogOut, User, Sliders, Settings, LayoutGrid, Globe } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { menuItemDefs } from './Sidebar';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';

export default function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();
    const { t } = useLanguage();

    // Close menu when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    return (
        <div className="md:hidden">
            {/* Top Navigation Bar */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-[#0F172A]/80 backdrop-blur-md border-b border-gray-800 z-40 flex items-center justify-between px-6">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-blue-500 leading-tight">Water Monitor</h1>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">IoT Dashboard</p>
                </div>
                <div className="flex items-center gap-3">
                    <LanguageToggle compact />
                    <button 
                        onClick={() => setIsOpen(true)}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </header>

            {/* Sidebar Drawer Overlay */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Side Drawer Panel */}
            <aside 
                className={`fixed top-0 left-0 bottom-0 w-80 bg-[#0F172A] z-[60] shadow-2xl border-r border-gray-800 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Drawer Header */}
                    <div className="h-20 flex items-center justify-between px-6 border-b border-gray-800">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-blue-500">Water Monitor</h2>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Navigation</span>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Mobile Navigation Links */}
                    <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
                        {menuItemDefs.map((item) => {
                            const isActive = pathname === item.href;
                            const label = t(`sidebar.${item.key}`);
                            const allowedAlertRoles = ['admin', 'local_authority'];
                            if (item.href === '/alerts' && !allowedAlertRoles.includes(session?.user?.role)) return null;

                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group
                                        ${isActive
                                            ? 'bg-blue-600/10 text-white border-l-4 border-blue-500 pl-3'
                                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-white'}`} />
                                    <span className="ml-3 font-semibold text-sm">{label}</span>
                                </Link>
                            );
                        })}

                        {/* Admin Tools for Mobile */}
                        {session?.user?.role !== 'general_user' && (
                            <div className="pt-6 mt-6 border-t border-gray-800 space-y-1.5">
                                <span className="px-4 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2 block">{t('sidebar.adminTools')}</span>
                                {session?.user?.role === 'admin' && (
                                    <Link
                                        href="/offset-presets"
                                        className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200
                                            ${pathname === '/offset-presets' ? 'bg-blue-600/10 text-white border-l-4 border-blue-500 pl-3' : 'text-gray-400 hover:bg-gray-800/50'}`}
                                    >
                                        <Sliders size={18} />
                                        <span className="ml-3 font-semibold text-sm">{t('sidebar.offsetPresets')}</span>
                                    </Link>
                                )}
                                <Link
                                    href="/settings"
                                    className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200
                                        ${pathname === '/settings' ? 'bg-blue-600/10 text-white border-l-4 border-blue-500 pl-3' : 'text-gray-400 hover:bg-gray-800/50'}`}
                                >
                                    <Settings size={18} />
                                    <span className="ml-3 font-semibold text-sm">{t('sidebar.settings')}</span>
                                </Link>
                            </div>
                        )}

                        {/* Language Toggle in Drawer */}
                        <div className="pt-6 mt-6 border-t border-gray-800">
                            <div className="flex items-center justify-between px-4 py-2">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Globe size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('sidebar.language')}</span>
                                </div>
                                <LanguageToggle />
                            </div>
                        </div>
                    </nav>

                    {/* Footer / User Profile */}
                    <div className="p-6 border-t border-gray-800 bg-[#0F172A]">
                        {session ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-2xl border border-gray-800">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${session.user?.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'}`}>
                                        <User size={20} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold truncate text-white leading-tight">{session.user?.name || 'User'}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${session.user?.role === 'admin' ? 'text-blue-400' : 'text-gray-500'}`}>
                                            {session.user?.role?.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all text-xs font-bold border border-red-500/20 shadow-lg shadow-red-500/5"
                                >
                                    <LogOut size={14} />
                                    {t('sidebar.signOut')}
                                </button>
                            </div>
                        ) : (
                            <Link 
                                href="/login" 
                                className="flex items-center justify-center w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-300 transition-colors"
                            >
                                {t('sidebar.signIn')}
                            </Link>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
