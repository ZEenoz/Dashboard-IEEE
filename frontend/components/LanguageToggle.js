'use client';

import { useLanguage } from '@/contexts/LanguageContext';

/**
 * LanguageToggle — Premium pill-shaped EN/TH language switcher
 * 
 * Designed to fit in Sidebar (desktop) and MobileNav (mobile).
 * Compact, animated, and matches the dark dashboard aesthetic.
 */
export default function LanguageToggle({ compact = false }) {
    const { lang, setLang } = useLanguage();

    return (
        <div
            className={`
                relative flex items-center rounded-full
                bg-gray-800/80 border border-gray-700/60
                ${compact ? 'p-0.5' : 'p-1'}
                transition-all duration-200
                hover:border-gray-600
            `}
            role="radiogroup"
            aria-label="Language selection"
        >
            {/* Sliding highlight */}
            <div
                className={`
                    absolute top-0.5 bottom-0.5 rounded-full
                    bg-gradient-to-r from-blue-600 to-blue-500
                    shadow-[0_0_12px_rgba(59,130,246,0.3)]
                    transition-all duration-300 ease-out
                    ${compact ? 'w-[calc(50%-2px)]' : 'w-[calc(50%-4px)]'}
                    ${lang === 'en'
                        ? (compact ? 'left-0.5' : 'left-1')
                        : (compact ? 'left-[calc(50%+2px)]' : 'left-[calc(50%+3px)]')
                    }
                `}
            />

            {/* EN Button */}
            <button
                onClick={() => setLang('en')}
                role="radio"
                aria-checked={lang === 'en'}
                aria-label="English"
                className={`
                    relative z-10 font-bold tracking-wide rounded-full transition-all duration-200
                    ${compact ? 'px-3 py-1 text-[10px]' : 'px-4 py-1.5 text-xs'}
                    ${lang === 'en'
                        ? 'text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }
                `}
            >
                EN
            </button>

            {/* TH Button */}
            <button
                onClick={() => setLang('th')}
                role="radio"
                aria-checked={lang === 'th'}
                aria-label="ภาษาไทย"
                className={`
                    relative z-10 font-bold tracking-wide rounded-full transition-all duration-200
                    ${compact ? 'px-3 py-1 text-[10px]' : 'px-4 py-1.5 text-xs'}
                    ${lang === 'th'
                        ? 'text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }
                `}
            >
                TH
            </button>
        </div>
    );
}
