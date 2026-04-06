import React, { useEffect, useState } from 'react';
import {
    Activity,
    Server,
    Database,
    Wifi,
    Cpu,
    HardDrive,
    Clock,
    Zap,
    Radio
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const SystemHealthDashboard = React.memo(() => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);

    const fetchHealth = () => {
        fetch(`${API_URL}/system-health`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(res => res.json())
            .then(data => {
                setHealth(data);
                setLoading(false);
                setHistory(prev => {
                    const stats = {
                        time: new Date().toLocaleTimeString(),
                        cup: Number(data.cpu?.currentLoad) || 0,
                        mem: Number(data.memory?.percent) || 0
                    };
                    const newHistory = [...prev, stats];
                    if (newHistory.length > 20) newHistory.shift();
                    return newHistory;
                });
            })
            .catch(err => {
                console.error("Health Check Failed:", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    // Helper for safe number formatting
    const safeFixed = (val, digits = 1) => (Number(val) || 0).toFixed(digits);

    if (loading) return <div className="p-4 text-center text-gray-500">Loading System Health...</div>;
    if (!health) return <div className="p-4 text-center text-red-500">System Offline</div>;

    // Helpers for status colors
    const getLoadColor = (value) => value > 80 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : value > 50 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]';

    return (
        <div className="space-y-6 fade-in px-1">
            {/* Top Status Bar - Refined Glassmorphism */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm flex items-center gap-4 hover:bg-gray-800/40 transition-all">
                    <div className={`p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5">Uptime</div>
                        <div className="text-lg font-mono font-bold text-white tracking-tighter">
                            {safeFixed(health.server?.uptime / 3600, 1)}<span className="text-xs ml-0.5 opacity-50">h</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm flex items-center gap-4 hover:bg-gray-800/40 transition-all">
                    <div className={`p-3 rounded-lg ${health.database?.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5">Database</div>
                        <div className={`text-lg font-black uppercase tracking-tight ${health.database?.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {health.database?.status || 'Unknown'}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm flex items-center gap-4 hover:bg-gray-800/40 transition-all">
                    <div className={`p-3 rounded-lg ${health.network?.mqtt?.connected ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        <Wifi className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5">MQTT Broker</div>
                        <div className={`text-lg font-black tracking-tight ${health.network?.mqtt?.connected ? 'text-indigo-400' : 'text-red-400'}`}>
                            {health.network?.mqtt?.connected ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/40 p-4 rounded-xl border border-white/5 backdrop-blur-sm flex items-center gap-4 hover:bg-gray-800/40 transition-all">
                    <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Radio className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5">Active Nodes</div>
                        <div className="text-lg font-black text-white tracking-tight">{health.nodes?.count ?? 0}</div>
                    </div>
                </div>
            </div>

            {/* Server Resources - Refined Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* CPU */}
                <div className="bg-gray-900/40 p-6 rounded-xl border border-white/5 group hover:bg-gray-800/40 transition-all">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="flex items-center gap-2 font-black text-[11px] text-gray-400 uppercase tracking-widest">
                            <Cpu className="w-4 h-4 text-blue-400" /> CPU Load
                        </h3>
                        <span className="font-mono text-xl font-bold text-blue-400">{safeFixed(health.cpu?.currentLoad, 1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden border border-white/5">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${getLoadColor(health.cpu?.currentLoad)}`}
                            style={{ width: `${Math.min(100, Number(health.cpu?.currentLoad) || 0)}%` }}
                        ></div>
                    </div>
                    <div className="h-32 opacity-60 group-hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <Line type="monotone" dataKey="cup" stroke="#60A5FA" strokeWidth={3} dot={false} isAnimationActive={false} />
                                <YAxis hide domain={[0, 100]} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Memory */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="flex items-center gap-2 font-bold text-gray-300">
                            <Activity className="w-5 h-5 text-green-400" /> Memory
                        </h3>
                        <span className="font-mono text-xl font-bold">{safeFixed(health.memory?.percent, 1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${getLoadColor(health.memory?.percent)}`}
                            style={{ width: `${Math.min(100, Number(health.memory?.percent) || 0)}%` }}
                        ></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-800/50 p-2 rounded">
                            <div className="text-gray-500 text-xs">Used</div>
                            <div className="font-mono">{safeFixed(health.memory?.used / 1024 / 1024 / 1024, 2)} GB</div>
                        </div>
                        <div className="bg-gray-800/50 p-2 rounded">
                            <div className="text-gray-500 text-xs">Total</div>
                            <div className="font-mono">{safeFixed(health.memory?.total / 1024 / 1024 / 1024, 2)} GB</div>
                        </div>
                    </div>
                </div>

                {/* Disk */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="flex items-center gap-2 font-bold text-gray-300">
                            <HardDrive className="w-5 h-5 text-purple-400" /> Disk Storage
                        </h3>
                        <span className="font-mono text-xl font-bold">{safeFixed(health.disk?.percent, 1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 bg-purple-500`}
                            style={{ width: `${Math.min(100, Number(health.disk?.percent) || 0)}%` }}
                        ></div>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-tighter">System Info</div>
                    <div className="font-mono text-[10px] bg-gray-800 p-2 rounded truncate text-gray-300">
                        {health.server?.distro} | {health.server?.platform}
                    </div>
                </div>
            </div>

            {/* Gateways & Nodes Detailed */}
            <div className="grid grid-cols-1 gap-6">
                {/* Gateways Table */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="flex items-center gap-2 font-bold text-gray-300 mb-4">
                        <Radio className="w-5 h-5 text-yellow-400" />
                        Gateways ({health.network?.gateways?.gateways?.length || 0})
                    </h3>

                    {(!health.network?.gateways?.gateways || health.network?.gateways?.gateways.length === 0) ? (
                        <div className="text-gray-500 text-sm italic py-4 text-center border border-dashed border-gray-700 rounded-lg">
                            No Gateways detected in active metadata.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-800/50 text-gray-300 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">Gateway ID</th>
                                        <th className="p-3">Signal (RSSI / SNR)</th>
                                        <th className="p-3">Last Seen</th>
                                        <th className="p-3 rounded-tr-lg text-right">Packets</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {health.network?.gateways?.gateways.map((gw, idx) => (
                                        <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="p-3 font-mono text-white">{gw.id}</td>
                                            <td className="p-3 flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${gw.rssi > -100 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                <span className={gw.rssi > -100 ? 'text-green-400' : 'text-red-400'}>
                                                    {gw.rssi} dBm
                                                </span>
                                                <span className="text-gray-600">/</span>
                                                <span className={gw.snr > 0 ? 'text-blue-400' : 'text-gray-500'}>
                                                    {gw.snr} SNR
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-xs">
                                                {new Date(gw.lastSeen).toLocaleTimeString()}
                                            </td>
                                            <td className="p-3 text-right font-mono">{gw.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Active Nodes Table */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="flex items-center gap-2 font-bold text-gray-300 mb-4">
                        <Activity className="w-5 h-5 text-blue-400" />
                        Active Nodes ({health.nodes?.count || 0})
                    </h3>

                    {(!Array.isArray(health.nodes?.active) || health.nodes.active.length === 0) ? (
                        <div className="text-gray-500 text-sm italic py-4 text-center border border-dashed border-gray-700 rounded-lg">
                            No active nodes reporting.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-800/50 text-gray-300 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">Station</th>
                                        <th className="p-3">Level</th>
                                        <th className="p-3">Battery</th>
                                        <th className="p-3">Signal</th>
                                        <th className="p-3 rounded-tr-lg text-right">Last Update</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {Array.isArray(health.nodes?.active) && health.nodes.active.map((node, idx) => (
                                        <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-bold text-white">{node.name || 'Unknown'}</div>
                                                <div className="text-xs font-mono text-gray-500 truncate max-w-[150px]">{node.stationId}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono text-blue-300">{safeFixed(node.waterLevel, 2)} m</span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-2 rounded-full overflow-hidden bg-gray-700`}>
                                                        <div
                                                            className={`h-full ${Number(node.battery) > 3.7 ? 'bg-green-500' : 'bg-red-500'}`}
                                                            style={{ width: `${Math.min(100, Math.max(0, (Number(node.battery) - 3.0) / 1.2 * 100))}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-mono">{safeFixed(node.battery, 2)}%</span>
                                                </div>
                                            </td>
                                            <td className="p-3 font-mono text-xs">
                                                <div className={Number(node.rssi) > -100 ? 'text-green-500' : 'text-red-500'}>
                                                    {node.rssi || 0} dBm
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs text-gray-300">
                                                {node.lastSeen ? new Date(node.lastSeen).toLocaleTimeString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default SystemHealthDashboard;
