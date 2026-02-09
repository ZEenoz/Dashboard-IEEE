"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useState } from 'react';
import { History, Filter, Calendar, Smartphone, Droplets, Gauge, AlertCircle, Info, Activity } from 'lucide-react';

export default function HistoryPage() {
    const { history, stations } = useSocket();
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [selectedSensorType, setSelectedSensorType] = useState('all');
    const [selectedDate, setSelectedDate] = useState('');

    const filteredHistory = history.filter(item => {
        // Filter out empty timestamps
        if (!item.timestamp) return false;

        const matchDevice = selectedDevice === 'all' || item.stationId === selectedDevice;

        // Fix: Compare Date using rawTimestamp
        let itemDate = '';
        if (item.rawTimestamp) {
            itemDate = new Date(item.rawTimestamp).toISOString().split('T')[0];
        } else if (item.serverTimestamp) {
            itemDate = new Date(item.serverTimestamp).toISOString().split('T')[0];
        }

        const matchDate = selectedDate === '' || itemDate === selectedDate;
        const matchType = selectedSensorType === 'all' || (item.sensorType && item.sensorType === selectedSensorType);
        return matchDevice && matchDate && matchType;
    }).reverse(); // Show newest first

    return (
        <div className="p-8 text-white h-[calc(100vh-64px)] overflow-hidden flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-blue-400 flex items-center gap-3">
                    <History className="w-8 h-8" />
                    Event History
                </h1>

                <div className="flex flex-wrap gap-4">
                    {/* Sensor Type Selector */}
                    <div className="relative">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                            value={selectedSensorType}
                            onChange={(e) => setSelectedSensorType(e.target.value)}
                            className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 appearance-none shadow-sm"
                        >
                            <option value="all">All Types</option>
                            <option value="Float">Float Sensor</option>
                            <option value="Static">Static Sensor</option>
                        </select>
                    </div>

                    {/* Date Selector */}
                    <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 shadow-sm"
                        />
                    </div>

                    {/* Device Selector */}
                    <div className="relative">
                        <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 appearance-none shadow-sm"
                        >
                            <option value="all">All Devices</option>
                            {Object.keys(stations).map(id => (
                                <option key={id} value={id}>{id}</option>
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
                                    <Calendar className="w-4 h-4" /> Timestamp
                                </th>
                                <th className="px-6 py-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Smartphone className="w-4 h-4" /> Device ID
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4" /> Type
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Droplets className="w-4 h-4" /> Values
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-bold">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-4 h-4" /> Status
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {filteredHistory.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-700/30 transition-colors group">
                                    <td className="px-6 py-4 text-gray-400 font-mono text-sm border-r border-gray-800/50">
                                        {item.timestamp}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white border-r border-gray-800/50">
                                        {item.stationId}
                                    </td>
                                    <td className="px-6 py-4 text-sm border-r border-gray-800/50">
                                        <span className={`px-2 py-1 rounded text-xs font-bold tracking-wide uppercase ${!item.sensorType ? 'bg-gray-700 text-gray-400' :
                                            item.sensorType === 'Float' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800' : 'bg-indigo-900/50 text-indigo-400 border border-indigo-800'
                                            }`}>
                                            {item.sensorType || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 border-r border-gray-800/50">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    {item.sensorType === 'Float' ? (
                                                        <Droplets className="w-3 h-3 text-blue-500" />
                                                    ) : (
                                                        <Gauge className="w-3 h-3 text-purple-500" />
                                                    )}
                                                    <span className={`${item.sensorType === 'Float' ? 'text-blue-400' : 'text-purple-400'} font-bold text-sm`}>
                                                        {typeof item.waterLevel === 'number' ? item.waterLevel.toFixed(2) : item.waterLevel} m
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 bg-green-900/20 text-green-400 px-3 py-1 rounded-full w-fit text-xs font-medium border border-green-900/50">
                                            <AlertCircle className="w-3 h-3" />
                                            Active
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-16 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <History className="w-8 h-8 opacity-20" />
                                            <span>No history data available for this selection.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
