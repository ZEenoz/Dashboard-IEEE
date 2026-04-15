'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '@/lib/translations';

const LanguageContext = createContext(undefined);

const STORAGE_KEY = 'ieee-dashboard-lang';

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState('en');
    const [mounted, setMounted] = useState(false);

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'th' || stored === 'en') {
                setLangState(stored);
            }
        } catch (e) {
            // localStorage not available (SSR or private mode)
        }
        setMounted(true);
    }, []);

    // Persist to localStorage and update <html lang>
    const setLang = useCallback((newLang) => {
        const validLang = newLang === 'th' ? 'th' : 'en';
        setLangState(validLang);
        try {
            localStorage.setItem(STORAGE_KEY, validLang);
        } catch (e) {
            // Silently fail
        }
        // Update HTML lang attribute for SEO and accessibility
        if (typeof document !== 'undefined') {
            document.documentElement.lang = validLang;
        }
    }, []);

    // Toggle between en and th
    const toggleLanguage = useCallback(() => {
        setLang(lang === 'en' ? 'th' : 'en');
    }, [lang, setLang]);

    // Translation helper: t('sidebar.overview') → 'ภาพรวม'
    const t = useCallback((path) => {
        const keys = path.split('.');
        let result = translations[lang];
        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                // Fallback: try English
                let fallback = translations['en'];
                for (const fbKey of keys) {
                    if (fallback && typeof fallback === 'object' && fbKey in fallback) {
                        fallback = fallback[fbKey];
                    } else {
                        return path; // Return the key path as final fallback
                    }
                }
                return typeof fallback === 'string' ? fallback : path;
            }
        }
        return typeof result === 'string' ? result : path;
    }, [lang]);

    // Sync <html lang> on mount
    useEffect(() => {
        if (mounted && typeof document !== 'undefined') {
            document.documentElement.lang = lang;
        }
    }, [lang, mounted]);

    return (
        <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t, mounted }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
