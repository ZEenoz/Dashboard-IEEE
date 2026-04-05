"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { PlayCircle, PauseCircle, CheckSquare, Square, Download } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function AnalyticsPage() {
    const { history, stations, displayMode } = useSocket();
    const { role } = useAuth();
    const [selectedStations, setSelectedStations] = useState([]);
    const [timeRange, setTimeRange] = useState('1h'); // '1h', '6h', '24h'
    const [chartType, setChartType] = useState('line'); // Kept for future potential, currently only line makes sense for multi-comparison
    const [showExportModal, setShowExportModal] = useState(false);

    // ⏸️ Pause Feature
    const [isPaused, setIsPaused] = useState(false);
    const [frozenHistory, setFrozenHistory] = useState([]);
    const [fetchedHistory, setFetchedHistory] = useState([]); // Store backend data
    const [isLoading, setIsLoading] = useState(false);

    // Initialize selected stations when stations are loaded
    useEffect(() => {
        if (Object.keys(stations).length > 0 && selectedStations.length === 0) {
            // Default to selecting all stations
            setSelectedStations(Object.keys(stations));
        }
    }, [stations]);

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

                // Sort ascending for chart (backend returns descending)
                const sorted = data.sort((a, b) => new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime());
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
            });
    }, []);

    const getStationConfig = (stationId) => settings?.stations?.[stationId];

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
    const chartData = useMemo(() => {
        const dataToUse = isPaused ? frozenHistory : fetchedHistory;
        if (!dataToUse || dataToUse.length === 0) return [];

        const now = new Date();
        let duration = 60 * 60 * 1000; // Default 1h
        if (timeRange === '6h') duration = 6 * 60 * 60 * 1000;
        if (timeRange === '24h') duration = 24 * 60 * 60 * 1000;
        if (timeRange === '7d') duration = 7 * 24 * 60 * 60 * 1000;
        if (timeRange === '30d') duration = 30 * 24 * 60 * 60 * 1000;

        // 1. Filter by time (Double check, backend should have filtered already, but just in case)
        const filteredHistory = dataToUse.filter(item => {
            if (!item.rawTimestamp && !item.serverTimestamp) return true;
            const itemTime = new Date(item.rawTimestamp || item.serverTimestamp);
            return (now - itemTime) <= duration;
        });

        // 2. Pivot Data: Group by Timestamp
        // Backend now handles aggregation perfectly, so we just format the timestamp for the chart
        const pivotedData = {};

        filteredHistory.forEach(item => {
            if (!selectedStations.includes(item.stationId)) return;

            const date = new Date(item.rawTimestamp || item.serverTimestamp);
            const timeKey = date.getTime();

            if (!pivotedData[timeKey]) {
                pivotedData[timeKey] = {
                    timestamp: timeRange === '1h' || timeRange === '6h' || timeRange === '24h'
                        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    rawTimestamp: timeKey
                };
            }

            pivotedData[timeKey][item.stationId] = Number(
                displayMode === 'raw'
                    ? (item.rawLevel || item.waterLevel || 0)
                    : (item.waterLevel || 0)
            );
        });

        return Object.values(pivotedData).sort((a, b) => a.rawTimestamp - b.rawTimestamp);
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
                if (point[stationId] !== undefined) {
                    const val = point[stationId];
                    totalSum += val;
                    totalCount++;
                    if (val > overallMax) overallMax = val;
                    if (val < overallMin) overallMin = val;
                }
            });
        });

        return {
            avg: totalCount > 0 ? (totalSum / totalCount).toFixed(2) : "0.00",
            max: overallMax !== -Infinity ? overallMax.toFixed(2) : "0.00",
            min: overallMin !== Infinity ? overallMin.toFixed(2) : "0.00"
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
                    <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-blue-500 pl-4">Analytics</h1>
                    <p className="text-gray-400 text-sm mt-1 max-w-lg">Comparative performance and trend analysis.</p>
                </div>

                <div className="flex flex-col gap-4 items-end">
                    <div className="flex flex-wrap gap-4 items-center">
                        {/* 📥 Export Button (Trigger) */}
                        {(role === 'admin' || role === 'local_authority') && (
                            <button
                                onClick={() => setShowExportModal(true)}
                                className="bg-gray-800 hover:bg-gray-700 text-white px-2 py-2 rounded-lg font-bold flex items-center gap-2 border border-gray-700 transition-all"
                            >
                                <Download size={18} className="text-green-500" />
                                Export CSV
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
                            <span className="text-xs">{isPaused ? 'Paused' : 'Live'}</span>
                        </button>

                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            {/* Chart Type Selector */}
                            <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700 flex-1 sm:flex-none">
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
                            <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700 flex-1 sm:flex-none">
                                {['1h', '6h', '24h', '7d', '30d'].map(range => (
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
                    <h3 className="font-bold text-gray-300 mb-4 uppercase text-xs tracking-wider">Select Sensors</h3>

                    <div className="space-y-4">
                        {/* Group: Float Sensors */}
                        <div>
                            <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Float Nodes
                            </h4>
                            <div className="space-y-2">
                                {Object.values(stations).filter(s => isFloat(s.stationId)).map(station => (
                                    <div
                                        key={station.stationId}
                                        onClick={() => toggleStation(station.stationId)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedStations.includes(station.stationId) ? 'bg-blue-500/20 border border-blue-500/50' : 'hover:bg-gray-700 border border-transparent'}`}
                                    >
                                        {selectedStations.includes(station.stationId) ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-gray-500" />}
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
                                Static Nodes
                            </h4>
                            <div className="space-y-2">
                                {Object.values(stations).filter(s => !isFloat(s.stationId)).map(station => (
                                    <div
                                        key={station.stationId}
                                        onClick={() => toggleStation(station.stationId)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedStations.includes(station.stationId) ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-gray-700 border border-transparent'}`}
                                    >
                                        {selectedStations.includes(station.stationId) ? <CheckSquare size={16} className="text-purple-400" /> : <Square size={16} className="text-gray-500" />}
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
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Peak Level (Selected)</h3>
                            <div className="text-2xl font-bold text-white tabular-nums">{stats.max} <span className="text-sm font-normal text-gray-400 font-mono">m</span></div>
                        </div>
                        <div className="bg-[#151E32] rounded-2xl p-4 border border-gray-700 shadow-xl">
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Average Level</h3>
                            <div className="text-2xl font-bold text-white tabular-nums">{stats.avg} <span className="text-sm font-normal text-gray-400 font-mono">m</span></div>
                        </div>
                        <div className="bg-[#151E32] rounded-2xl p-4 border border-gray-700 shadow-xl">
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Minimum Level</h3>
                            <div className="text-2xl font-bold text-white tabular-nums">{stats.min} <span className="text-sm font-normal text-gray-400 font-mono">m</span></div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg flex-1 min-h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'area' ? (
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        {selectedStations.map(stationId => (
                                            <linearGradient key={`grad-${stationId}`} id={`grad-${stationId}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={getStationColor(stationId)} stopOpacity={0.8} />
                                                <stop offset="95%" stopColor={getStationColor(stationId)} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30} />
                                    <YAxis stroke="#9CA3AF" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                        labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                    />
                                    <Legend />
                                    {selectedStations.map(stationId => (
                                        <Area
                                            key={stationId}
                                            type="monotone"
                                            dataKey={stationId}
                                            name={getStationConfig(stationId)?.name || stations[stationId]?.stationName || stationId}
                                            stroke={getStationColor(stationId)}
                                            fill={`url(#grad-${stationId})`}
                                            fillOpacity={0.5}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                    <Brush dataKey="timestamp" height={30} stroke="#8884d8" fill="#1F2937" />
                                </AreaChart>
                            ) : chartType === 'bar' ? (
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30} />
                                    <YAxis stroke="#9CA3AF" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                        labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                    />
                                    <Legend />
                                    {selectedStations.map(stationId => (
                                        <Bar
                                            key={stationId}
                                            dataKey={stationId}
                                            name={getStationConfig(stationId)?.name || stations[stationId]?.stationName || stationId}
                                            fill={getStationColor(stationId)}
                                        />
                                    ))}
                                    <Brush dataKey="timestamp" height={30} stroke="#8884d8" fill="#1F2937" />
                                </BarChart>
                            ) : (
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30} />
                                    <YAxis stroke="#9CA3AF" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                        labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                    />
                                    <Legend />
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
                                        />
                                    ))}
                                    <Brush dataKey="timestamp" height={30} stroke="#8884d8" fill="#1F2937" />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 📥 Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl relative fade-in">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
                            <Download className="w-6 h-6 text-green-500" />
                            Export Data
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    id="modal-start-date"
                                    className="w-full bg-gray-800 border-gray-600 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    id="modal-end-date"
                                    className="w-full bg-gray-800 border-gray-600 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Station</label>
                                <select
                                    id="modal-station-id"
                                    className="w-full bg-gray-800 border-gray-600 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                                    defaultValue="all"
                                >
                                    <option value="all">Export All Stations</option>
                                    {Object.values(stations).map(s => (
                                        <option key={s.stationId} value={s.stationId}>
                                            {s.stationName || s.stationId}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={async () => {
                                    const start = document.getElementById('modal-start-date').value;
                                    const end = document.getElementById('modal-end-date').value;
                                    const station = document.getElementById('modal-station-id').value;

                                    if (!start || !end) {
                                        toast.error("Please select both start and end dates.");
                                        return;
                                    }

                                    const url = `${API_URL}/export?start_date=${start}&end_date=${end}&station_id=${station}`;
                                    try {
                                        toast.loading('Exporting CSV...', { id: 'csv-export' });
                                        const res = await fetch(url, {
                                            headers: { 'ngrok-skip-browser-warning': 'true' }
                                        });
                                        if (!res.ok) throw new Error('Export failed');
                                        const blob = await res.blob();
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = `${station}_${start}_to_${end}.csv`;
                                        link.click();
                                        toast.success('Export completed!', { id: 'csv-export' });
                                    } catch (err) {
                                        toast.error('Export failed: ' + err.message, { id: 'csv-export' });
                                    }
                                    setShowExportModal(false);
                                }}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4 transition-all"
                            >
                                <Download size={20} />
                                Download CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
