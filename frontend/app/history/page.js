"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { History, Filter, Calendar, Smartphone, Droplets, Gauge, AlertCircle, Info, Activity, RefreshCw, Download } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function HistoryPage() {
    const { stations, socket, displayMode } = useSocket();
    const { data: session } = useSession();
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const LIMIT = 50;

    const [selectedDevice, setSelectedDevice] = useState('all');
    const [selectedSensorType, setSelectedSensorType] = useState('all');
    const [selectedDate, setSelectedDate] = useState('');

    const fetchHistory = async (showSpinner = false, isLoadMore = false) => {
        if (showSpinner && !isLoadMore) setIsRefreshing(true);
        if (isLoadMore) setIsLoadingMore(true);

        try {
            const currentOffset = isLoadMore ? offset : 0;

            let url = selectedDevice !== 'all'
                ? `${API_URL}/history?stationId=${selectedDevice}&limit=${LIMIT}&offset=${currentOffset}`
                : `${API_URL}/history?limit=${LIMIT}&offset=${currentOffset}`;

            if (selectedDate) {
                url += `&date=${selectedDate}`;
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            const fetchedData = Array.isArray(data) ? data : [];

            if (isLoadMore) {
                setHistoryData(prev => [...prev, ...fetchedData]);
            } else {
                setHistoryData(fetchedData);
            }

            setOffset(currentOffset + fetchedData.length);
            setHasMore(fetchedData.length === LIMIT);

        } catch (err) {
            console.error('Failed to fetch history:', err);
            toast.error("Failed to load event history");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    };

    // Fetch initial data or when filters change
    useEffect(() => {
        setOffset(0);
        setHasMore(true);
        fetchHistory(true, false);
    }, [selectedDevice, selectedDate]);

    // Listen for real-time history updates via socket
    useEffect(() => {
        if (!socket) return;

        const handleNewUpdate = (newData) => {
            setHistoryData(prevData => {
                // Check local duplicate by timestamp
                if (prevData.some(a => a.rawTimestamp === newData.rawTimestamp)) return prevData;

                let updated = [newData, ...prevData];
                // Limit the array to keep memory usage safe, 
                // Since pagination is active, we just ensure it doesn't grow infinitely forever without reset
                if (updated.length > 500) updated = updated.slice(0, 500);
                return updated;
            });
        };

        socket.on('sensor-update', handleNewUpdate);
        return () => {
            socket.off('sensor-update', handleNewUpdate);
        };
    }, [socket]);

    const filteredHistory = useMemo(() => {
        return historyData.filter(item => {
            const tsToUse = item.rawTimestamp || item.serverTimestamp || item.timestamp;
            if (!tsToUse) return false;

            const matchDevice = selectedDevice === 'all' || item.stationId === selectedDevice;

            let itemDate = '';
            const d = new Date(tsToUse);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                itemDate = `${year}-${month}-${day}`;
            }

            const matchDate = selectedDate === '' || itemDate === selectedDate;
            const matchType = selectedSensorType === 'all' || (item.sensorType && item.sensorType === selectedSensorType);

            return matchDevice && matchDate && matchType;
        });
    }, [historyData, selectedDevice, selectedDate, selectedSensorType]);

    return (
        <div className="mb-20 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 px-1">
                <div className="flex flex-col">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-blue-500 pl-4">
                            Event History
                        </h1>
                        <button
                            onClick={() => fetchHistory(true)}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        Viewing historical records for all connected stations.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    {/* Sensor Type Selector */}
                    <div className="relative flex-1 md:flex-none min-w-[140px]">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                            value={selectedSensorType}
                            onChange={(e) => setSelectedSensorType(e.target.value)}
                            className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 appearance-none shadow-sm w-full"
                        >
                            <option value="all">All Types</option>
                            <option value="Float">Float Sensor</option>
                            <option value="Static">Static Sensor</option>
                        </select>
                    </div>

                    {/* Date Selector */}
                    <div className="relative flex-1 md:flex-none min-w-[140px]">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 shadow-sm w-full"
                        />
                    </div>

                    {/* Device Selector */}
                    <div className="relative flex-1 md:flex-none min-w-[140px]">
                        <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 appearance-none shadow-sm w-full"
                        >
                            <option value="all">All Devices</option>
                            {Object.keys(stations).map(id => (
                                <option key={id} value={id}>{stations[id].stationName || id}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-2xl flex-1 flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 text-gray-400 uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 font-bold flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Date & Time
                                </th>
                                <th className="px-6 py-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Smartphone className="w-4 h-4" /> Device
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold hidden md:table-cell">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4" /> Type
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Droplets className="w-4 h-4" /> Level
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold hidden lg:table-cell">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-4 h-4" /> Status
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-16 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                                            <span>Loading history from database...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-16 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <History className="w-8 h-8 opacity-20" />
                                            <span>No history data available for this selection.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map((item, index) => {
                                    let displayDateTime = item.timestamp;

                                    try {
                                        // Use rawTimestamp or serverTimestamp if available to ensure correct Date parsing
                                        const ts = item.rawTimestamp || item.serverTimestamp || item.timestamp;
                                        if (ts) {
                                            const d = new Date(ts);
                                            if (!isNaN(d.getTime())) {
                                                displayDateTime = d.toLocaleString('en-GB', {
                                                    year: 'numeric', month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                    hour12: false
                                                });
                                            }
                                        }
                                    } catch (e) {
                                        // Fallback to original
                                    }

                                    return (
                                        <tr key={index} className="hover:bg-gray-700/30 transition-colors group text-sm">
                                            <td className="px-4 md:px-6 py-4 text-gray-400 font-mono text-xs border-r border-gray-800/50 whitespace-nowrap">
                                                {displayDateTime}
                                            </td>
                                            <td className="px-4 md:px-6 py-4 font-medium text-white border-r border-gray-800/50 max-w-[120px] truncate">
                                                {stations[item.stationId]?.stationName || item.stationId}
                                            </td>
                                            <td className="px-6 py-4 text-sm border-r border-gray-800/50 hidden md:table-cell">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase ${!item.sensorType ? 'bg-gray-700 text-gray-400' :
                                                    item.sensorType === 'Float' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800' : 'bg-indigo-900/50 text-indigo-400 border border-indigo-800'
                                                    }`}>
                                                    {item.sensorType || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 border-r border-gray-800/50">
                                                <div className="flex items-center gap-2">
                                                    <span className={`${item.sensorType === 'Float' ? 'text-blue-400' : 'text-purple-400'} font-bold tabular-nums`}>
                                                        {Number(displayMode === 'raw' ? (item.rawLevel ?? item.waterLevel) : (item.waterLevel ?? 0)).toFixed(3)}m
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden lg:table-cell">
                                                <div className="flex items-center gap-1.5 bg-green-900/20 text-green-400 px-3 py-1 rounded-full w-fit text-xs font-medium border border-green-900/50">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Active
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }))}
                        </tbody>
                    </table>

                    {/* Load More Button */}
                    {!loading && historyData.length > 0 && hasMore && (
                        <div className="p-4 flex justify-center border-t border-gray-800">
                            <button
                                onClick={() => fetchHistory(false, true)}
                                disabled={isLoadingMore}
                                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoadingMore && <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />}
                                {isLoadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
