"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useState, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { PlayCircle, PauseCircle } from 'lucide-react';

export default function AnalyticsPage() {
    const { history } = useSocket();
    const [selectedType, setSelectedType] = useState('waterLevel'); // 'waterLevel' or 'pressure'
    const [selectedSensorType, setSelectedSensorType] = useState('all'); // 'all', 'Float', 'Static'
    const [chartType, setChartType] = useState('line'); // 'line', 'area', 'bar'
    const [timeRange, setTimeRange] = useState('1h'); // '1h', '6h', '24h'

    // ⏸️ Pause Feature to fix scrolling reset
    const [isPaused, setIsPaused] = useState(false);
    const [frozenHistory, setFrozenHistory] = useState([]);

    // Toggle Pause/Live
    const togglePause = () => {
        if (!isPaused) {
            // Freeze data
            setFrozenHistory([...history]);
            setIsPaused(true);
        } else {
            // Resume live
            setIsPaused(false);
        }
    };

    // Use current history or frozen history
    const dataDisplay = isPaused ? frozenHistory : history;

    // Filter and downsample data for the chart
    // Filter and downsample data for the chart
    const chartData = useMemo(() => {
        // Use current history or frozen history
        const dataToUse = isPaused ? frozenHistory : history;
        if (!dataToUse || dataToUse.length === 0) return [];

        const now = new Date();
        const nowTime = now.getTime();

        let duration = 60 * 60 * 1000; // Default 1h
        // let samplingInterval = 0; // Downsampling logic removed for simplicity as per new logic

        if (timeRange === '6h') {
            duration = 6 * 60 * 60 * 1000;
        }
        if (timeRange === '24h') {
            duration = 24 * 60 * 60 * 1000;
        }

        return dataToUse.filter(item => {
            // Filter invalid items
            if (!item.timestamp || item.timestamp === 'undefined') return false;

            // Filter by sensor type
            if (selectedSensorType !== 'all') {
                if (selectedSensorType === 'Float' && item.sensorType !== 'Float') return false;
                if (selectedSensorType === 'Static' && item.sensorType !== 'Static') return false;
            }

            // Time range filtering
            if (!item.rawTimestamp && !item.serverTimestamp) return true; // Keep if no raw timestamp (legacy)

            const itemTime = new Date(item.rawTimestamp || item.serverTimestamp);
            const diffHours = (now - itemTime) / (1000 * 60 * 60);

            if (timeRange === '1h') return diffHours <= 1;
            if (timeRange === '6h') return diffHours <= 6;
            if (timeRange === '24h') return diffHours <= 24;

            return true;
        });
    }, [history, frozenHistory, isPaused, selectedSensorType, timeRange]);

    // Calculate statistics
    const stats = useMemo(() => {
        if (chartData.length === 0) return { current: 0, average: 0, max: 0, min: 0 };

        if (selectedType === 'all') {
            const wlValues = chartData.map(d => Number(d.waterLevel || 0));
            const pValues = chartData.map(d => Number(d.pressure || 0));

            const calc = (vals) => {
                if (vals.length === 0) return { current: "0.00", avg: "0.00", max: "0.00", min: "0.00" };
                const current = vals[vals.length - 1].toFixed(2);
                const sum = vals.reduce((a, b) => a + b, 0);
                const avg = (sum / vals.length).toFixed(2);
                const max = Math.max(...vals).toFixed(2);
                const min = Math.min(...vals).toFixed(2);
                return { current, avg, max, min };
            };

            const wl = calc(wlValues);
            const p = calc(pValues);

            return {
                current: `${wl.current} / ${p.current}`,
                average: `${wl.avg} / ${p.avg}`,
                max: `${wl.max} / ${p.max}`,
                min: `${wl.min} / ${p.min}`,
                unit: 'm / bar'
            };
        }

        const values = chartData.map(d => Number(d[selectedType] || 0));
        const current = values[values.length - 1].toFixed(2);
        const sum = values.reduce((a, b) => a + b, 0);
        const average = (sum / values.length).toFixed(2);
        const max = Math.max(...values).toFixed(2);
        const min = Math.min(...values).toFixed(2);
        const unit = selectedType === 'waterLevel' ? 'm' : 'bar';

        return { current, average, max, min, unit };
    }, [chartData, selectedType]);

    const renderChart = () => {
        const commonProps = {
            data: chartData,
            margin: { top: 10, right: 30, left: 0, bottom: 0 }
        };

        const color = selectedType === 'waterLevel' ? '#10B981' : '#8B5CF6';
        const showDots = timeRange === '1h';

        // Dual Axis Configuration for 'All Data'
        const isAll = selectedType === 'all';
        const wlColor = '#10B981'; // Green
        const pColor = '#8B5CF6';  // Purple

        if (chartType === 'area') {
            return (
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id="colorWL" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={wlColor} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={wlColor} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={pColor} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={pColor} stopOpacity={0} />
                        </linearGradient>
                        {!isAll && (
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        )}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30} />

                    {isAll ? (
                        <>
                            <YAxis yAxisId="left" stroke={wlColor} label={{ value: 'Water Level (m)', angle: -90, position: 'insideLeft', fill: wlColor }} />
                            <YAxis yAxisId="right" orientation="right" stroke={pColor} label={{ value: 'Pressure (bar)', angle: 90, position: 'insideRight', fill: pColor }} />
                            <Area yAxisId="left" type="monotone" dataKey="waterLevel" stroke={wlColor} fillOpacity={0.5} fill="url(#colorWL)" name="Water Level" />
                            <Area yAxisId="right" type="monotone" dataKey="pressure" stroke={pColor} fillOpacity={0.5} fill="url(#colorP)" name="Pressure" />
                        </>
                    ) : (
                        <>
                            <YAxis stroke="#9CA3AF" />
                            <Area type="monotone" dataKey={selectedType} stroke={color} fillOpacity={1} fill="url(#colorValue)" />
                        </>
                    )}

                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }} />
                    <Legend />
                    <Brush dataKey="timestamp" height={30} stroke="#8884d8" fill="#1F2937" />
                </AreaChart>
            );
        }

        if (chartType === 'bar') {
            return (
                <BarChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30} />

                    {isAll ? (
                        <>
                            <YAxis yAxisId="left" stroke={wlColor} />
                            <YAxis yAxisId="right" orientation="right" stroke={pColor} />
                            <Bar yAxisId="left" dataKey="waterLevel" fill={wlColor} name="Water Level" />
                            <Bar yAxisId="right" dataKey="pressure" fill={pColor} name="Pressure" />
                        </>
                    ) : (
                        <>
                            <YAxis stroke="#9CA3AF" />
                            <Bar dataKey={selectedType} fill={color} />
                        </>
                    )}

                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }} />
                    <Legend />
                    <Brush dataKey="timestamp" height={30} stroke="#8884d8" fill="#1F2937" />
                </BarChart>
            );
        }

        return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={{ fontSize: 12 }} minTickGap={30} />

                {isAll ? (
                    <>
                        <YAxis yAxisId="left" stroke={wlColor} />
                        <YAxis yAxisId="right" orientation="right" stroke={pColor} />
                        <Line yAxisId="left" type="monotone" dataKey="waterLevel" stroke={wlColor} dot={false} strokeWidth={2} name="Water Level" />
                        <Line yAxisId="right" type="monotone" dataKey="pressure" stroke={pColor} dot={false} strokeWidth={2} name="Pressure" />
                    </>
                ) : (
                    <>
                        <YAxis stroke="#9CA3AF" />
                        <Line type="monotone" dataKey={selectedType} stroke={color} strokeWidth={2}
                            dot={showDots ? { r: 3, fill: '#1F2937', strokeWidth: 1 } : false}
                            activeDot={{ r: 6 }} isAnimationActive={false}
                        />
                    </>
                )}

                <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }} />
                <Legend />
                <Brush dataKey="timestamp" height={30} stroke="#8884d8" fill="#1F2937" />
            </LineChart>
        );
    };

    return (
        <div className="p-8 text-white h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-blue-400">Analytics</h1>

                <div className="flex flex-wrap gap-4">
                    {/* Pause / Live Button */}
                    <button
                        onClick={togglePause}
                        className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isPaused
                            ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                            }`}
                    >
                        {isPaused ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                        {isPaused ? 'Paused' : 'Live'}
                    </button>

                    {/* Sensor Type Selector */}
                    <select
                        value={selectedSensorType}
                        onChange={(e) => setSelectedSensorType(e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">All Sensors</option>
                        <option value="Float">Float Sensor</option>
                        <option value="Static">Static Sensor</option>
                    </select>

                    {/* Data Type Selector */}
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">All Data</option>
                        <option value="waterLevel">Water Level</option>
                        <option value="pressure">Pressure</option>
                    </select>

                    {/* Chart Type Selector */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        {['line', 'area', 'bar'].map(type => (
                            <button
                                key={type}
                                onClick={() => setChartType(type)}
                                className={`px-3 py-1 rounded capitalize ${chartType === type ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        {['1h', '6h', '24h'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1 rounded ${timeRange === range ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg mb-8 flex-1 min-h-[400px]">
                <h3 className="text-gray-400 mb-4">Sensor Trends</h3>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-green-600 rounded-xl p-6 shadow-lg">
                    <h3 className="text-green-100 text-sm font-medium mb-1">Current</h3>
                    <div className="text-3xl font-bold">{stats.current} <span className="text-lg font-normal opacity-80">{stats.unit}</span></div>
                </div>
                <div className="bg-blue-600 rounded-xl p-6 shadow-lg">
                    <h3 className="text-blue-100 text-sm font-medium mb-1">Average</h3>
                    <div className="text-3xl font-bold">{stats.average} <span className="text-lg font-normal opacity-80">{stats.unit}</span></div>
                </div>
                <div className="bg-purple-600 rounded-xl p-6 shadow-lg">
                    <h3 className="text-purple-100 text-sm font-medium mb-1">Maximum</h3>
                    <div className="text-3xl font-bold">{stats.max} <span className="text-lg font-normal opacity-80">{stats.unit}</span></div>
                </div>
                <div className="bg-red-600 rounded-xl p-6 shadow-lg">
                    <h3 className="text-red-100 text-sm font-medium mb-1">Minimum</h3>
                    <div className="text-3xl font-bold">{stats.min} <span className="text-lg font-normal opacity-80">{stats.unit}</span></div>
                </div>
            </div>
        </div>
    );
}
