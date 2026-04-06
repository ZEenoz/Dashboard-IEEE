import React from 'react';
import { Droplets, Gauge, Info, ArrowRight } from 'lucide-react';

import { useSocket } from '@/contexts/SocketContext';

const StationCard = React.memo(({ station, onClick }) => {
    const { displayMode } = useSocket();
    // --- Status Calculation ---
    const now = new Date();
    const rawTs = station.rawTimestamp || station.timestamp;
    const lastUpdate = rawTs ? new Date(rawTs) : null;
    const diffMinutes = lastUpdate ? (now - lastUpdate) / (1000 * 60) : Infinity;

    // Active = received data within last 60 minutes (consistent with Parameters page)
    const isActive = diffMinutes < 60;

    // --- Sensor Type & Theme ---
    const isFloat = station.type
        ? station.type === 'Float'
        : (station.sensorType === 'Float' || (station.stationName && station.stationName.toLowerCase().includes('float')));

    const typeLabel = isFloat ? 'Float' : 'Static';
    const Icon = isFloat ? Droplets : Gauge;

    // Static classes to avoid Tailwind JIT purge issues with dynamic class names
    const textAccent = isFloat ? 'text-blue-400' : 'text-purple-400';
    const bgAccentSoft = isFloat ? 'bg-blue-900/40' : 'bg-purple-900/40';
    const borderAccent = isFloat ? 'border-blue-400/40' : 'border-purple-400/40';
    const gradient = isFloat
        ? 'from-blue-900 via-blue-800 to-gray-900'
        : 'from-purple-900 via-purple-800 to-gray-900';

    // --- Alert-Level Styling ---
    const alertLevel = station.alertLevel || 'normal';
    let cardAlertClasses = '';
    let alertGlow = '';
    
    if (alertLevel === 'dangerous') {
        cardAlertClasses = 'border-red-500/50 shadow-lg';
        alertGlow = 'shadow-[0_0_20px_rgba(239,68,68,0.25)]';
    } else if (alertLevel === 'warning') {
        cardAlertClasses = 'border-amber-500/50 shadow-md';
        alertGlow = 'shadow-[0_0_15px_rgba(245,158,11,0.2)]';
    } else {
        cardAlertClasses = `border ${isActive ? borderAccent : 'border-gray-600/40'}`;
    }

    // --- Status Badge ---
    let statusLabel, statusClasses;
    if (!rawTs) {
        statusLabel = 'Unknown';
        statusClasses = 'bg-gray-700 text-gray-400 border-gray-600';
    } else if (!isActive) {
        statusLabel = 'Offline';
        statusClasses = 'bg-gray-800/80 text-gray-400 border-gray-700 backdrop-blur-md';
    } else {
        statusLabel = 'Online';
        statusClasses = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 backdrop-blur-md';
    }

    // --- Safe display values ---
    const waterLevelValue = displayMode === 'raw'
        ? (station.rawLevel || station.waterLevel)
        : station.waterLevel;

    const waterLevelDisplay = waterLevelValue != null
        ? Number(waterLevelValue).toFixed(3)
        : '--';

    const battery = station.battery;
    const batteryColor = battery == null
        ? 'text-gray-500'
        : battery > 50 ? 'text-green-400' : battery > 25 ? 'text-orange-400' : 'text-red-400';

    const stationName = station.stationName || station.stationId || 'Station';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
            aria-label={`สถานี ${stationName} — ระดับน้ำ ${waterLevelDisplay} ม. — กดเพื่อดูรายละเอียด`}
            title={`${stationName}: กดเพื่อดูข้อมูลเชิงลึก`}
            className={`
                relative bg-gray-900/40 rounded-2xl overflow-hidden border transition-all duration-500 cursor-pointer
                ${cardAlertClasses} ${alertGlow}
                hover:scale-[1.02] hover:bg-gray-800/60
                group h-full flex flex-col justify-between outline-none
                focus-visible:ring-2 focus-visible:ring-blue-500
            `}
        >
            {/* === Top: Image / Gradient Header === */}
            <div
                className={`h-44 w-full bg-gradient-to-br ${gradient} relative flex items-center justify-center overflow-hidden transition-all duration-500 border-b border-white/5`}
            >
                {/* Use real img for lazy loading and performance */}
                {station.imageUrl ? (
                    <img 
                        src={station.imageUrl}
                        alt={stationName}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                        style={{ 
                            objectPosition: station.imagePosition
                                ? `${station.imagePosition.x}% ${station.imagePosition.y}%`
                                : 'center center'
                        }}
                    />
                ) : null}

                {/* Dark overlay for images — improves badge legibility */}
                {station.imageUrl && (
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-black/20 group-hover:from-gray-900/60 transition-all" />
                )}

                {/* Fallback: Show sensor type icon when no image */}
                {!station.imageUrl && (
                    <div className={`${bgAccentSoft} p-5 rounded-full opacity-30 group-hover:opacity-50 transition-all group-hover:scale-110`}>
                        <Icon className={`w-12 h-12 ${textAccent}`} />
                    </div>
                )}

                {/* Status badge — top right */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest z-10 border ${statusClasses} shadow-lg transition-transform group-hover:scale-105`}>
                    {statusLabel}
                </div>

                {/* Type badge — top left */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black z-10 ${bgAccentSoft} text-white flex items-center gap-2 backdrop-blur-md border ${borderAccent} shadow-lg shadow-black/20 uppercase tracking-widest`}>
                    <Icon size={12} strokeWidth={3} />
                    {typeLabel}
                </div>
            </div>

            {/* === Bottom: Content Section === */}
            <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className={`text-lg font-bold text-white mb-1.5 leading-snug transition-colors ${isFloat ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400'} truncate`}>
                        {stationName}
                    </h3>

                    {station.description && (
                        <p className="text-gray-400 text-[11px] font-medium flex items-start gap-2 mb-3 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                            <Info size={12} className="mt-0.5 flex-shrink-0 text-gray-500" />
                            {station.description}
                        </p>
                    )}
                </div>

                <div className="flex items-end justify-between border-t border-white/5 pt-4 mt-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.25em] mb-1.5">
                            Water Depth
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-3xl font-bold tabular-nums tracking-tighter ${textAccent}`}>
                                {waterLevelDisplay}
                            </span>
                            <span className="text-xs text-gray-500 font-bold ml-1 opacity-60">m</span>
                        </div>
                        {displayMode === 'raw' ? (
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                    Raw Data
                                </span>
                            </div>
                        ) : (
                            station.offsetValue && station.offsetValue !== 0 ? (
                                <span className={`text-[10px] font-mono font-bold ${station.offsetValue > 0 ? 'text-emerald-400' : 'text-red-400'} mt-1`}>
                                    ({station.offsetValue > 0 ? '+' : ''}{station.offsetValue.toFixed(3)})
                                </span>
                            ) : null
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        {battery != null && (
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1.5 text-right">Energy</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${battery > 70 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : battery > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${battery}%` }}
                                        />
                                    </div>
                                    <span className={`text-xs font-black tabular-nums ${batteryColor}`}>
                                        {battery}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default StationCard;
