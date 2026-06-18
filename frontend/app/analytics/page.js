"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { PlayCircle, PauseCircle, CheckSquare, Square, Download, X, Calendar } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Column preview: mirrors googleSheetService.js exactly ──────────────────
const CSV_COLUMNS = [
    'Time (Bangkok)', 'Station Name', 'Station ID',
    'Water Level Raw (m)', 'Water Level Calibrated (m)', 'Data Rate',
    'RSSI (dBm)', 'SNR (dB)', 'Battery (%)', 'Battery Voltage (V)',
    'Sensor Type', 'Latitude', 'Longitude', 'Location Source',
    'Temperature (°C)', 'Humidity (%)', 'Gyro X (°)', 'Gyro Y (°)'
];

function ExportModal({ onClose, stations, settings, apiUrl, t }) {
    const today = new Date().toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [stationId, setStationId] = useState('all');
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        if (!fromDate || !toDate) {
            toast.error(t('analytics.errorSelectDates'));
            return;
        }
        setLoading(true);
        toast.loading(t('analytics.exporting'), { id: 'csv-export' });
        try {
            const url = `${apiUrl}/export?start_date=${fromDate}&end_date=${toDate}&station_id=${stationId}`;
            const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${stationId}_${fromDate}_to_${toDate}.csv`;
            link.click();
            toast.success(t('analytics.exportComplete'), { id: 'csv-export' });
            onClose();
        } catch (err) {
            toast.error(t('analytics.exportFailed') + ': ' + err.message, { id: 'csv-export' });
        } finally {
            setLoading(false);
        }
    };

    const visibleStations = Object.values(stations || {}).filter(
        s => settings?.stations?.[s.stationId]?.isVisible !== false
    );

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-xl border border-green-500/20">
                            <Download className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-white text-base">{t('analytics.exportData')}</h2>
                            <p className="text-[11px] text-gray-500">18 columns · Bangkok time (UTC+7)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                <Calendar className="w-3 h-3" /> {t('analytics.startDate')}
                            </label>
                            <input
                                type="date" value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/30 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                <Calendar className="w-3 h-3" /> {t('analytics.endDate')}
                            </label>
                            <input
                                type="date" value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                min={fromDate}
                                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/30 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Station Selector */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('analytics.station')}</label>
                        <select
                            value={stationId}
                            onChange={e => setStationId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/30 outline-none transition-all"
                        >
                            <option value="all">{t('analytics.exportAllStations')}</option>
                            {visibleStations.map(s => (
                                <option key={s.stationId} value={s.stationId}>
                                    {settings?.stations?.[s.stationId]?.name || s.stationName || s.stationId}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Column Preview */}
                    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                            {t('analytics.exportColumnsCount', { count: CSV_COLUMNS.length })}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {CSV_COLUMNS.map((col, i) => (
                                <span key={i} className="text-[10px] bg-gray-700/80 text-gray-300 px-2 py-0.5 rounded-md border border-gray-600/50 font-mono">
                                    {String.fromCharCode(65 + i)}. {col}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Download Button */}
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"
                    >
                        <Download size={18} />
                        {loading ? t('analytics.exporting') : t('analytics.downloadCSV')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AnalyticsPage() {
    const { history, stations, displayMode } = useSocket();
    const { t, lang } = useLanguage();
    const locale = lang === 'th' ? 'th-TH' : 'en-US';
    const { role } = useAuth();
    const [selectedStations, setSelectedStations] = useState([]);
    const [timeRange, setTimeRange] = useState('24h'); // '24h', '7d', '30d'
    const [chartType, setChartType] = useState('line'); // Kept for future potential, currently only line makes sense for multi-comparison
    const [showExportModal, setShowExportModal] = useState(false);

    // ⏸️ Pause Feature
    const [isPaused, setIsPaused] = useState(false);
    const [frozenHistory, setFrozenHistory] = useState([]);
    const [fetchedHistory, setFetchedHistory] = useState([]); // Store backend data
    const [isLoading, setIsLoading] = useState(false);



    // Fetch data when timeRange changes
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch aggregated data from backend, removing the 10000 limit limit
                const res = await fetch(`${API_URL}/history?range=${timeRange}&aggregate=true`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (!res.ok) throw new Error('Failed to fetch from backend');
                const data = await res.json();

                // rawTimestamp from backend is now always numeric UTC ms — sort directly
                const sorted = [...data].sort((a, b) => Number(a.rawTimestamp) - Number(b.rawTimestamp));
                setFetchedHistory(sorted);
            } catch (err) {
                console.error("Failed to fetch analytics data", err);
                toast.error("Failed to fetch analytics data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [timeRange]);

    // Fetch Settings
    const [settings, setSettings] = useState(null);
    useEffect(() => {
        fetch(`${API_URL}/settings`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch from backend');
                return res.json();
            })
            .then(data => setSettings(data))
            .catch(err => {
                console.error("Failed to fetch settings", err);
                toast.error("Failed to load global settings");
                setSettings({}); // Fallback to empty settings to unblock UI
            });
    }, []);

    const getStationConfig = (stationId) => settings?.stations?.[stationId];

    // Initialize selected stations when stations are loaded
    useEffect(() => {
        if (!settings) return; // Wait for settings to load first!

        if (Object.keys(stations).length > 0 && selectedStations.length === 0) {
            // Default to selecting only visible stations
            const visibleStations = Object.keys(stations).filter(
                id => settings?.stations?.[id]?.isVisible !== false
            );
            setSelectedStations(visibleStations.length > 0 ? visibleStations : Object.keys(stations));
        }
    }, [stations, settings]);

    const isFloat = (stationId) => {
        const station = stations[stationId];
        const config = getStationConfig(stationId);
        if (config?.type === 'Float') return true;
        if (config?.type === 'Static') return false;
        return station?.sensorType === 'Float' || station?.stationName?.toLowerCase().includes('float');
    };

    const togglePause = () => {
        if (!isPaused) {
            setFrozenHistory([...fetchedHistory]);
            setIsPaused(true);
        } else {
            setIsPaused(false);
        }
    };

    const toggleStation = (stationId) => {
        setSelectedStations(prev =>
            prev.includes(stationId)
                ? prev.filter(id => id !== stationId)
                : [...prev, stationId]
        );
    };

    // Filter and Pivot Data
    const { chartData, timeDomain } = useMemo(() => {
        const dataToUse = isPaused ? frozenHistory : fetchedHistory;
        if (!dataToUse || dataToUse.length === 0) return { chartData: [], timeDomain: [0, 0] };

        const now = new Date();
        const nowTime = now.getTime();
        let duration = 60 * 60 * 1000; // Default 1h
        let gapThreshold = 15 * 60 * 1000; // 15 mins gap threshold for 1h

        if (timeRange === '6h') { duration = 6 * 60 * 60 * 1000; gapThreshold = 30 * 60 * 1000; }
        if (timeRange === '24h') { duration = 24 * 60 * 60 * 1000; gapThreshold = 60 * 60 * 1000; }
        if (timeRange === '7d') { duration = 7 * 24 * 60 * 60 * 1000; gapThreshold = 4 * 60 * 60 * 1000; }
        if (timeRange === '30d') { duration = 30 * 24 * 60 * 60 * 1000; gapThreshold = 12 * 60 * 60 * 1000; }

        const cutoff = nowTime - duration;

        // 1. Filter by time (Double check, backend should have filtered already, but just in case)
        const filteredHistory = dataToUse.filter(item => {
            if (!item.rawTimestamp && !item.serverTimestamp) return true;
            const itemTime = new Date(item.rawTimestamp || item.serverTimestamp).getTime();
            return itemTime >= cutoff;
        });

        // 2. Pivot Data: Group by Timestamp
        const pivotedData = {};

        filteredHistory.forEach(item => {
            if (!selectedStations.includes(item.stationId)) return;

            const date = new Date(item.rawTimestamp || item.serverTimestamp);
            const timeKey = date.getTime();

            if (!pivotedData[timeKey]) {
                const fmtOpts = (timeRange === '1h' || timeRange === '6h' || timeRange === '24h')
                    ? { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
                    : { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                pivotedData[timeKey] = {
                    timestamp: date.toLocaleString(locale, fmtOpts),
                    rawTimestamp: timeKey
                };
            }

            // Get current offset from settings
            const config = getStationConfig(item.stationId);
            const currentOffset = parseFloat(config?.offset) || 0;
            
            // PostgreSQL numeric returns as string, so we MUST parse it to float before math
            const rawStringOrNum = item.rawLevel !== undefined ? item.rawLevel : (item.waterLevel || 0);
            const rawValue = parseFloat(rawStringOrNum) || 0;
            
            const calibratedValue = rawValue + currentOffset;

            pivotedData[timeKey][item.stationId] = Number(
                (displayMode === 'raw' ? rawValue : calibratedValue).toFixed(3)
            );
        });

        const sortedData = Object.values(pivotedData).sort((a, b) => a.rawTimestamp - b.rawTimestamp);

        // 3. Gap Injection for missing points
        const finalData = [];
        for (let i = 0; i < sortedData.length; i++) {
            finalData.push(sortedData[i]);
            if (i < sortedData.length - 1) {
                const diff = sortedData[i + 1].rawTimestamp - sortedData[i].rawTimestamp;
                if (diff > gapThreshold) {
                    const gapTime = sortedData[i].rawTimestamp + diff / 2;
                    const gapDate = new Date(gapTime);
                    const fmtOpts = (timeRange === '1h' || timeRange === '6h' || timeRange === '24h')
                        ? { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
                        : { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                    const gapPoint = {
                        timestamp: gapDate.toLocaleString(locale, fmtOpts),
                        rawTimestamp: gapTime
                    };
                    selectedStations.forEach(id => gapPoint[id] = null);
                    finalData.push(gapPoint);
                }
            }
        }

        return { chartData: finalData, timeDomain: [cutoff, nowTime] };
    }, [fetchedHistory, frozenHistory, isPaused, timeRange, selectedStations, displayMode]);

    // Calculate Statistics for Selected Stations
    const stats = useMemo(() => {
        if (chartData.length === 0 || selectedStations.length === 0) return { avg: "0.00", max: "0.00", min: "0.00" };

        let totalSum = 0;
        let totalCount = 0;
        let overallMax = -Infinity;
        let overallMin = Infinity;

        chartData.forEach(point => {
            selectedStations.forEach(stationId => {
                if (point[stationId] !== undefined && point[stationId] !== null) {
                    const val = Number(point[stationId]);
                    if (!isNaN(val)) {
                        totalSum += val;
                        totalCount++;
                        if (val > overallMax) overallMax = val;
                        if (val < overallMin) overallMin = val;
                    }
                }
            });
        });

        return {
            avg: totalCount > 0 ? (Number(totalSum / totalCount) || 0).toFixed(2) : "0.00",
            max: overallMax !== -Infinity && overallMax !== null ? (Number(overallMax) || 0).toFixed(2) : "0.00",
            min: overallMin !== Infinity && overallMin !== null ? (Number(overallMin) || 0).toFixed(2) : "0.00"
        };
    }, [chartData, selectedStations]);

    // Helper to get color based on sensor type

    const getStationColor = (stationId) => {
        if (isFloat(stationId)) {
            return '#3B82F6'; // Blue-500
        }
        return '#A855F7'; // Purple-500
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-blue-500 pl-4">{t('analytics.title')}</h1>
                </div>

                <div className="flex flex-col gap-4 items-end">
                    <div className="flex flex-wrap gap-4 items-center">
                        {/* 📥 Export Button (Trigger) */}
                        {(role === 'admin' || role === 'local_authority') && (
                            <button
                                onClick={() => setShowExportModal(true)}
                                className="bg-gray-800 hover:bg-gray-700 text-white px-2 py-2 rounded-lg flex items-center gap-2 border border-gray-700 transition-all"
                            >
                                <Download size={18} className="text-green-500" />
                                {t('analytics.exportCSV')}
                            </button>
                        )}

                        {/* Pause / Live Button */}
                        <button
                            onClick={togglePause}
                            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-2 transition-all flex-1 sm:flex-none justify-center ${isPaused
                                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                                : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                                }`}
                        >
                            {isPaused ? <PauseCircle className="w-5 h-5 text-sm" /> : <PlayCircle className="w-5 h-5 text-sm" />}
                            <span className="text-xs">{isPaused ? t('analytics.paused') : t('analytics.live')}</span>
                        </button>

                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            {/* Chart Type Selector */}
                            <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700 flex-1 sm:flex-none overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {['line', 'area', 'bar'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setChartType(type)}
                                        className={`px-3 py-1.5 rounded-lg capitalize text-xs font-bold transition-all flex-1 sm:flex-none ${chartType === type ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            {/* Time Range Selector */}
                            <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700 flex-1 sm:flex-none overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {['24h', '7d', '30d'].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-none ${timeRange === range ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Left Column: Controls (Station Selection) */}
                <div className="lg:col-span-1 bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg overflow-y-auto">
                    <h3 className="font-bold text-gray-300 mb-4 uppercase text-xs tracking-wider">{t('analytics.selectSensors')}</h3>

                    <div className="space-y-4">
                        {/* Group: Float Sensors */}
                        <div>
                            <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                {t('overview.floatNodes')}
                            </h4>
                            <div className="space-y-2">
                                {Object.values(stations)
                                    .filter(s => isFloat(s.stationId) && settings?.stations?.[s.stationId] && settings.stations[s.stationId].isVisible !== false)
                                    .sort((a, b) => (getStationConfig(a.stationId)?.order || 0) - (getStationConfig(b.stationId)?.order || 0))
                                    .map(station => (
                                        <div
                                            key={station.stationId}
                                            onClick={() => toggleStation(station.stationId)}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedStations.includes(station.stationId) ? 'bg-blue-500/20 border border-blue-500/50' : 'hover:bg-gray-700 border border-transparent'}`}
                                        >
                                            {selectedStations.includes(station.stationId) ? <CheckSquare size={16} style={{ color: getStationColor(station.stationId) }} /> : <Square size={16} className="text-gray-500" />}
                                            <span className={`text-sm ${selectedStations.includes(station.stationId) ? 'text-white font-medium' : 'text-gray-400'}`}>
                                                {getStationConfig(station.stationId)?.name || station.stationName || station.stationId}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Group: Static Sensors */}
                        <div>
                            <h4 className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-2 mt-6">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                {t('overview.staticNodes')}
                            </h4>
                            <div className="space-y-2">
                                {Object.values(stations)
                                    .filter(s => !isFloat(s.stationId) && settings?.stations?.[s.stationId] && settings.stations[s.stationId].isVisible !== false)
                                    .sort((a, b) => (getStationConfig(a.stationId)?.order || 0) - (getStationConfig(b.stationId)?.order || 0))
                                    .map(station => (
                                        <div
                                            key={station.stationId}
                                            onClick={() => toggleStation(station.stationId)}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedStations.includes(station.stationId) ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-gray-700 border border-transparent'}`}
                                        >
                                            {selectedStations.includes(station.stationId) ? <CheckSquare size={16} style={{ color: getStationColor(station.stationId) }} /> : <Square size={16} className="text-gray-500" />}
                                            <span className={`text-sm ${selectedStations.includes(station.stationId) ? 'text-white font-medium' : 'text-gray-400'}`}>
                                                {getStationConfig(station.stationId)?.name || station.stationName || station.stationId}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Chart */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#151E32] rounded-2xl p-4 border border-gray-700 shadow-xl">
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t('analytics.minLevel')}</h3>
                            <div className="text-2xl font-bold text-white tabular-nums">{stats.min} <span className="text-sm font-normal text-gray-400 font-mono">m</span></div>
                        </div>
                        <div className="bg-[#151E32] rounded-2xl p-4 border border-gray-700 shadow-xl">
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t('analytics.peakLevel')}</h3>
                            <div className="text-2xl font-bold text-white tabular-nums">{stats.max} <span className="text-sm font-normal text-gray-400 font-mono">m</span></div>
                        </div>
                        <div className="bg-[#151E32] rounded-2xl p-4 border border-gray-700 shadow-xl">
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t('analytics.avgLevel')}</h3>
                            <div className="text-2xl font-bold text-white tabular-nums">{stats.avg} <span className="text-sm font-normal text-gray-400 font-mono">m</span></div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-2 sm:p-4 md:p-6 border border-gray-700 shadow-lg flex-1 min-h-[450px] w-full flex flex-col overflow-hidden">

                        <div className="flex-1 min-h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'area' ? (
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                        <defs>
                                            {selectedStations.map(stationId => (
                                                <linearGradient key={`grad-${stationId}`} id={`grad-${stationId}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={getStationColor(stationId)} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={getStationColor(stationId)} stopOpacity={0} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis
                                            dataKey="rawTimestamp"
                                            type="number"
                                            scale="time"
                                            domain={timeDomain}
                                            stroke="#9CA3AF"
                                            tick={{ fontSize: 12 }}
                                            minTickGap={30}
                                            tickFormatter={(unixTime) => {
                                                const date = new Date(Number(unixTime));
                                                return (timeRange === '1h' || timeRange === '6h' || timeRange === '24h')
                                                    ? date.toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
                                                    : date.toLocaleDateString(locale, { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric' });
                                            }}
                                        />
                                        <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} tickFormatter={(val) => Number(val).toFixed(2)} width={70} />
                                        <Tooltip
                                            formatter={(value, name) => [Number(value).toFixed(3), name]}
                                            labelFormatter={(label) => new Date(Number(label)).toLocaleString(locale, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}
                                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                        />
                                        {selectedStations.map(stationId => (
                                            <Area
                                                key={stationId}
                                                type="monotone"
                                                dataKey={stationId}
                                                name={getStationConfig(stationId)?.name || stations[stationId]?.stationName || stationId}
                                                stroke={getStationColor(stationId)}
                                                strokeWidth={2}
                                                fill={`url(#grad-${stationId})`}
                                                fillOpacity={0.5}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                            />
                                        ))}
                                        <Brush dataKey="rawTimestamp" height={30} stroke="#8884d8" fill="#1F2937" tickFormatter={(unixTime) => new Date(Number(unixTime)).toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} />
                                    </AreaChart>
                                ) : chartType === 'bar' ? (
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis
                                            dataKey="rawTimestamp"
                                            type="number"
                                            scale="time"
                                            domain={timeDomain}
                                            stroke="#9CA3AF"
                                            tick={{ fontSize: 12 }}
                                            minTickGap={30}
                                        tickFormatter={(unixTime) => {
                                                const date = new Date(Number(unixTime));
                                                return (timeRange === '1h' || timeRange === '6h' || timeRange === '24h')
                                                    ? date.toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
                                                    : date.toLocaleDateString(locale, { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric' });
                                            }}
                                        />
                                        <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} tickFormatter={(val) => Number(val).toFixed(2)} width={70} />
                                        <Tooltip
                                            formatter={(value, name) => [Number(value).toFixed(3), name]}
                                            labelFormatter={(label) => new Date(Number(label)).toLocaleString(locale, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}
                                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                        />
                                        {selectedStations.map(stationId => (
                                            <Bar
                                                key={stationId}
                                                dataKey={stationId}
                                                name={getStationConfig(stationId)?.name || stations[stationId]?.stationName || stationId}
                                                fill={getStationColor(stationId)}
                                            />
                                        ))}
                                        <Brush dataKey="rawTimestamp" height={30} stroke="#8884d8" fill="#1F2937" tickFormatter={(unixTime) => new Date(Number(unixTime)).toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} />
                                    </BarChart>
                                ) : (
                                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis
                                            dataKey="rawTimestamp"
                                            type="number"
                                            scale="time"
                                            domain={timeDomain}
                                            stroke="#9CA3AF"
                                            tick={{ fontSize: 12 }}
                                            minTickGap={30}
                                        tickFormatter={(unixTime) => {
                                                const date = new Date(Number(unixTime));
                                                return (timeRange === '1h' || timeRange === '6h' || timeRange === '24h')
                                                    ? date.toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
                                                    : date.toLocaleDateString(locale, { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric' });
                                            }}
                                        />
                                        <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} tickFormatter={(val) => Number(val).toFixed(2)} width={70} />
                                        <Tooltip
                                            formatter={(value, name) => [Number(value).toFixed(3), name]}
                                            labelFormatter={(label) => new Date(Number(label)).toLocaleString(locale, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}
                                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                        />
                                        {selectedStations.map(stationId => (
                                            <Line
                                                key={stationId}
                                                type="monotone"
                                                dataKey={stationId}
                                                name={getStationConfig(stationId)?.name || stations[stationId]?.stationName || stationId}
                                                stroke={getStationColor(stationId)}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                                connectNulls={true}
                                            />
                                        ))}
                                        <Brush dataKey="rawTimestamp" height={30} stroke="#8884d8" fill="#1F2937" tickFormatter={(unixTime) => new Date(Number(unixTime)).toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>

                        {/* Custom Responsive Legend (Moved to Bottom) */}
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 px-2">
                            {selectedStations.map(stationId => (
                                <div key={stationId} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer" onClick={() => toggleStation(stationId)}>
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getStationColor(stationId) }}></span>
                                    <span className="text-gray-300">{getStationConfig(stationId)?.name || stations[stationId]?.stationName || stationId}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 📥 Export Modal */}
            {showExportModal && (
                <ExportModal
                    onClose={() => setShowExportModal(false)}
                    stations={stations}
                    settings={settings}
                    apiUrl={API_URL}
                    t={t}
                />
            )}
        </div>
    );
}
