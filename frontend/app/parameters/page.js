"use client";

import { useSocket } from '@/contexts/SocketContext';
import { LayoutGrid, List, Droplets, Gauge, Battery, Signal, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ParametersPage() {
    const { stations, getTrend } = useSocket();
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [now, setNow] = useState(new Date());

    // Update 'now' every minute to refresh offline status
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const filteredStations = Object.values(stations).filter(st =>
        selectedDevice === 'all' || st.stationId === selectedDevice
    );

    const getStatus = (station) => {
        if (!station.rawTimestamp) return { text: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-500/20', icon: <span className="text-[10px]">●</span> };

        const diff = now.getTime() - station.rawTimestamp;
        const isOffline = diff > 60 * 60 * 1000; // 1 hour

        if (isOffline) return { text: 'OFFLINE', color: 'text-red-500', bg: 'bg-red-500/20', icon: <WifiOff size={14} /> };
        return { text: 'Online', color: 'text-green-400', bg: 'bg-green-500/20', icon: <span className="text-[10px]">●</span> };
    };

    // Helper to render battery icon
    const renderBattery = (level) => {
        const color = level > 20 ? 'text-green-400' : 'text-red-500';
        return (
            <div className="flex items-center space-x-1" title={`Battery: ${level}%`}>
                <Battery size={16} className={color} />
                <span className={`text-xs ${color}`}>{level}%</span>
            </div>
        );
    };

    // Helper to render signal icon
    const renderSignal = (rssi) => {
        let status = { text: 'Good', color: 'text-green-400', bg: 'bg-green-500' };
        let bars = 5;

        if (rssi >= -85) {
            status = { text: 'Good', color: 'text-green-400', bg: 'bg-green-500' };
            bars = 5;
        } else if (rssi >= -90) {
            status = { text: 'Fair', color: 'text-blue-400', bg: 'bg-blue-500' };
            bars = 3;
        } else if (rssi >= -100) {
            status = { text: 'Poor', color: 'text-orange-400', bg: 'bg-orange-500' };
            bars = 2;
        } else {
            status = { text: 'Very Poor', color: 'text-red-500', bg: 'bg-red-500' };
            bars = 1;
        }

        // 5-bar visualization
        const renderBars = () => (
            <div className="flex items-end gap-[1px] h-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`w-1 rounded-sm ${i <= bars ? status.bg : 'bg-gray-700'}`}
                        style={{ height: `${i * 20}%` }}
                    />
                ))}
            </div>
        );

        return (
            <div className="flex items-center space-x-2" title={`Signal: ${rssi} dBm`}>
                {renderBars()}
                <span className={`text-xs ${status.color} font-mono`}>
                    {rssi}dBm ({status.text})
                </span>
            </div>
        );
    };

    const renderTrend = (stationId, param, value) => {
        const trend = getTrend(stationId, param, value);
        return (
            <span className={`ml-2 text-sm ${trend.color} flex items-center`} title={trend.direction}>
                {trend.icon}
            </span>
        );
    };

    return (
        <div className="p-8 text-white">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-blue-400">Sensor Parameters</h1>

                <div className="flex items-center space-x-4">
                    {/* Device Selector */}
                    <select
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">All Devices</option>
                        {Object.keys(stations).map(id => (
                            <option key={id} value={id}>{id}</option>
                        ))}
                    </select>

                    {/* View Toggle */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStations.map((station) => (
                        <div className={`bg-gray-800 rounded-xl p-6 border ${getStatus(station).text === 'OFFLINE' ? 'border-red-500' : 'border-gray-700'} shadow-lg hover:border-${station.sensorType === 'Float' ? 'blue' : 'purple'}-500 transition-all`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-gray-400 text-sm font-medium">
                                        {station.stationId} - Water Level
                                    </h3>
                                    <div className="mt-2 flex items-baseline">
                                        <span className="text-3xl font-bold text-white">
                                            {typeof station.waterLevel === 'number' ? station.waterLevel.toFixed(2) : station.waterLevel}
                                        </span>
                                        <span className="ml-2 text-gray-500">m</span>
                                        {renderTrend(station.stationId, 'waterLevel', station.waterLevel)}
                                    </div>
                                </div>
                                <div className={`bg-${station.sensorType === 'Float' ? 'blue' : 'purple'}-500/10 p-2 rounded-lg`}>
                                    {station.sensorType === 'Float' ? (
                                        <Droplets className="w-6 h-6 text-blue-500" />
                                    ) : (
                                        <Gauge className="w-6 h-6 text-purple-500" />
                                    )}
                                </div>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div
                                    className={`bg-${station.sensorType === 'Float' ? 'blue' : 'purple'}-500 h-full rounded-full transition-all duration-500`}
                                    style={{ width: `${Math.min((station.waterLevel / 5) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <div className="mt-4 flex justify-between items-center text-xs">
                                <div className="flex space-x-3">
                                    {renderBattery(station.battery || 0)}
                                    {renderSignal(station.rssi || -100)}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-gray-500">Updated: {station.timestamp}</span>
                                    <span className={`${getStatus(station).bg} ${getStatus(station).color} px-2 py-1 rounded-full font-medium flex items-center gap-1`}>
                                        {getStatus(station).icon} {getStatus(station).text}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Device ID</th>
                                <th className="px-6 py-4">Value</th>
                                <th className="px-6 py-4">Health</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Last Update</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredStations.map((station) => (
                                <tr key={station.stationId} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 font-medium">{station.stationId}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            {station.sensorType === 'Float' ? (
                                                <Droplets size={16} className="text-blue-500" />
                                            ) : (
                                                <Gauge size={16} className="text-purple-500" />
                                            )}
                                            <span className={`font-mono ${station.sensorType === 'Float' ? 'text-blue-300' : 'text-purple-300'}`}>
                                                {typeof station.waterLevel === 'number' ? station.waterLevel.toFixed(2) : station.waterLevel} m
                                            </span>
                                            {renderTrend(station.stationId, 'waterLevel', station.waterLevel)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col space-y-1">
                                            {renderBattery(station.battery || 0)}
                                            {renderSignal(station.rssi || -100)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`${getStatus(station).bg} ${getStatus(station).color} px-2 py-1 rounded-full text-xs font-medium flex w-fit items-center gap-1`}>
                                            {getStatus(station).icon} {getStatus(station).text}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-sm">
                                        {station.timestamp}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filteredStations.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    Waiting for sensor data...
                </div>
            )}
        </div>
    );
}
