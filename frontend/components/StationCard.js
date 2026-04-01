import React from 'react';
import { Droplets, Gauge, Info, ArrowRight } from 'lucide-react';

import { useSocket } from '@/contexts/SocketContext';

const StationCard = ({ station, onClick }) => {
    const { displayMode } = useSocket();
    // --- Status Calculation ---
    const now = new Date();
    const rawTs = station.rawTimestamp || station.timestamp;
    const lastUpdate = rawTs ? new Date(rawTs) : null;
    const diffMinutes = lastUpdate ? (now - lastUpdate) / (1000 * 60) : Infinity;

    // Active = received data within last 60 minutes (consistent with Parameters page)
    const isActive = diffMinutes < 60;
    const isRecent = diffMinutes < 10; // within 10 mins = "Live"

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

    // --- Alert-Level Ring ---
    const alertLevel = station.alertLevel || 'normal';
    let cardAlertClasses = '';
    if (alertLevel === 'dangerous') {
        cardAlertClasses = 'ring-2 ring-red-500 shadow-[0_0_18px_rgba(239,68,68,0.55)] border-transparent';
    } else if (alertLevel === 'warning') {
        cardAlertClasses = 'ring-2 ring-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.40)] border-transparent';
    } else {
        cardAlertClasses = `border ${isActive ? borderAccent : 'border-gray-600/60'}`;
    }

    // --- Status Badge ---
    let statusLabel, statusClasses;
    if (!rawTs) {
        statusLabel = 'Unknown';
        statusClasses = 'bg-gray-600 text-gray-200';
    } else if (!isActive) {
        statusLabel = 'Offline';
        statusClasses = 'bg-gray-700 text-gray-300';
    } else {
        statusLabel = 'Online';
        statusClasses = 'bg-green-800/80 text-green-100';
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
                relative bg-gray-800 rounded-2xl overflow-hidden shadow-lg
                ${cardAlertClasses}
                hover:scale-[1.025] hover:shadow-xl transition-all duration-300 cursor-pointer
                group h-full flex flex-col justify-between outline-none
                focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
            `}
        >
            {/* === Top: Image / Gradient Header === */}
            <div
                className={`h-40 w-full bg-gradient-to-br ${gradient} relative flex items-center justify-center bg-cover bg-no-repeat transition-all duration-500`}
                style={station.imageUrl ? {
                    backgroundImage: `url(${station.imageUrl})`,
                    backgroundPosition: station.imagePosition
                        ? `${station.imagePosition.x}% ${station.imagePosition.y}%`
                        : 'center center'
                } : {}}
            >
                {/* Dark overlay for images — improves badge legibility */}
                {station.imageUrl && (
                    <div className="absolute inset-0 bg-black/20" />
                )}

                {/* Fallback: Show sensor type icon when no image */}
                {!station.imageUrl && (
                    <div className={`${bgAccentSoft} p-4 rounded-full opacity-40`}>
                        <Icon className={`w-10 h-10 ${textAccent}`} />
                    </div>
                )}

                {/* Status badge — top right */}
                <div className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-md z-10 ${statusClasses}`}>
                    {statusLabel}
                </div>

                {/* Type badge — top left */}
                <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold z-10 ${bgAccentSoft} text-white flex items-center gap-1.5 backdrop-blur-md border ${borderAccent} shadow-lg shadow-black/20 uppercase tracking-wider`}>
                    <Icon size={10} strokeWidth={3} />
                    {typeLabel}
                </div>
            </div>

            {/* === Bottom: Content Section === */}
            <div className="p-4 flex-1 flex flex-col justify-between bg-gray-800">
                <div>
                    {/* Station Name */}
                    <h3 className={`text-base font-bold text-white mb-1 leading-snug transition-colors ${isFloat ? 'group-hover:text-blue-400' : 'group-hover:text-purple-400'} truncate`}>
                        {stationName}
                    </h3>

                    {/* Description — uses Info icon (not MapPin, which implies location) */}
                    {station.description && (
                        <p className="text-gray-400 text-xs flex items-start gap-1.5 mb-2 leading-relaxed">
                            <Info size={11} className="mt-0.5 flex-shrink-0 text-gray-500" />
                            {station.description}
                        </p>
                    )}
                </div>

                {/* Stats Row */}
                <div className="flex items-end justify-between border-t border-gray-700/70 pt-3 mt-2">
                    {/* Water Level */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">
                            Water Depth
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold tabular-nums tracking-tight ${textAccent}`}>
                                {waterLevelDisplay}
                            </span>
                            <span className="text-xs text-gray-500 font-medium ml-1">m</span>
                        </div>
                        {displayMode === 'raw' ? (
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mt-0.5">
                                Raw Data
                            </span>
                        ) : (
                            station.offsetValue && station.offsetValue !== 0 ? (
                                <span className={`text-[10px] font-mono font-medium ${station.offsetValue > 0 ? 'text-emerald-400' : 'text-red-400'} mt-0.5`}>
                                    ({station.offsetValue > 0 ? '+' : ''}{station.offsetValue.toFixed(3)})
                                </span>
                            ) : null
                        )}
                    </div>

                    {/* Right: Battery + View hint */}
                    <div className="flex flex-col items-end gap-1">
                        {battery != null && (
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Battery</span>
                                <span className={`text-sm font-bold tabular-nums ${batteryColor}`}>
                                    {battery}%
                                </span>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default StationCard;
