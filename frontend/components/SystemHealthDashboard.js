"use client";

import { useEffect, useState } from 'react';
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

export default function SystemHealthDashboard() {
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
                        cup: data.cpu?.currentLoad || 0,
                        mem: data.memory?.percent || 0
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

    if (loading) return <div className="p-4 text-center text-gray-500">Loading System Health...</div>;
    if (!health) return <div className="p-4 text-center text-red-500">System Offline</div>;

    // Helpers for status colors
    const getStatusColor = (status) => status === 'connected' || status === true ? 'text-green-500' : 'text-red-500';
    const getLoadColor = (value) => value > 80 ? 'bg-red-500' : value > 50 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="space-y-6 fade-in">
            {/* Top Status Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-blue-500/10 text-blue-400`}>
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Uptime</div>
                        <div className="text-lg font-mono font-bold text-white">
                            {(health.server?.uptime / 3600).toFixed(1)}h
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${health.database?.status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Database</div>
                        <div className="text-lg font-bold text-white uppercase">{health.database?.status}</div>
                        <div className="text-xs text-gray-500">
                            {health.database?.size ? (
                                <span>{health.database.size} • {new Intl.NumberFormat().format(health.database.rows)} rows</span>
                            ) : (
                                <span>{health.database?.latency}ms</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${health.network?.mqtt?.connected ? 'bg-purple-500/10 text-purple-500' : 'bg-red-500/10 text-red-500'}`}>
                        <Wifi className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">MQTT Broker</div>
                        <div className="text-lg font-bold text-white">{health.network?.mqtt?.connected ? 'Online' : 'Offline'}</div>
                        <div className="text-xs text-gray-500">{health.network?.mqtt?.broker}</div>
                    </div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-500/10 text-orange-500">
                        <Radio className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Active Nodes</div>
                        <div className="text-lg font-bold text-white">{health.nodes?.count ?? 0}</div>
                        <div className="text-xs text-gray-500">Total</div>
                    </div>
                </div>
            </div>

            {/* Server Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* CPU */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="flex items-center gap-2 font-bold text-gray-300">
                            <Cpu className="w-5 h-5 text-blue-400" /> CPU Load
                        </h3>
                        <span className="font-mono text-xl font-bold">{health.cpu?.currentLoad.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${getLoadColor(health.cpu?.currentLoad)}`}
                            style={{ width: `${health.cpu?.currentLoad}%` }}
                        ></div>
                    </div>
                    <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <Line type="monotone" dataKey="cup" stroke="#60A5FA" strokeWidth={2} dot={false} />
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
                        <span className="font-mono text-xl font-bold">{health.memory?.percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${getLoadColor(health.memory?.percent)}`}
                            style={{ width: `${health.memory?.percent}%` }}
                        ></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-800/50 p-2 rounded">
                            <div className="text-gray-500 text-xs">Used</div>
                            <div className="font-mono">{(health.memory?.used / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                        </div>
                        <div className="bg-gray-800/50 p-2 rounded">
                            <div className="text-gray-500 text-xs">Total</div>
                            <div className="font-mono">{(health.memory?.total / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                        </div>
                    </div>
                </div>

                {/* Disk */}
                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="flex items-center gap-2 font-bold text-gray-300">
                            <HardDrive className="w-5 h-5 text-purple-400" /> Disk Storage
                        </h3>
                        <span className="font-mono text-xl font-bold">{health.disk?.percent?.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 bg-purple-500`}
                            style={{ width: `${health.disk?.percent}%` }}
                        ></div>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">Platform</div>
                    <div className="font-mono text-sm bg-gray-800 p-2 rounded truncate">
                        {health.server?.distro} ({health.server?.platform})
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
                                                <div className="font-bold text-white">{node.name}</div>
                                                <div className="text-xs font-mono text-gray-500">{node.stationId}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono text-blue-300">{node.waterLevel?.toFixed(2)} m</span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-2 rounded-full overflow-hidden bg-gray-700`}>
                                                        <div
                                                            className={`h-full ${node.battery > 3.7 ? 'bg-green-500' : 'bg-red-500'}`}
                                                            style={{ width: `${Math.min(100, (node.battery - 3.0) / 1.2 * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-mono">{node.battery?.toFixed(2)}%</span>
                                                </div>
                                            </td>
                                            <td className="p-3 font-mono text-xs">
                                                <div className={node.rssi > -100 ? 'text-green-500' : 'text-red-500'}>
                                                    {node.rssi} dBm
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs text-gray-300">
                                                {new Date(node.lastSeen).toLocaleTimeString()}
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
}
