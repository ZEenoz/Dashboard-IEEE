'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import {
    Bell, BellRing, AlertTriangle, CheckCircle2, Clock,
    RefreshCw, Activity, TrendingUp, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Format ISO timestamp ─────────────────────────────────────────────────────
function formatTime(isoStr) {
    if (!isoStr) return '—';
    try {
        return new Date(isoStr).toLocaleString('en-GB', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    } catch {
        return isoStr;
    }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const map = {
        'sent_to_bot': { color: 'bg-green-500/20 text-green-400 border-green-500/40', label: '✅ Sent' },
        'pending': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', label: '⏳ Pending' },
        'failed': { color: 'bg-red-500/20 text-red-400 border-red-500/40', label: '❌ Failed' },
    };
    const s = map[status] || { color: 'bg-gray-500/20 text-gray-400 border-gray-500/40', label: status || 'Unknown' };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${s.color}`}>
            {s.label}
        </span>
    );
}

// ─── Alert Level Badge ────────────────────────────────────────────────────────
function AlertLevelBadge({ alertLevel }) {
    if (alertLevel === 'dangerous') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-red-500/20 text-red-300 border-red-500/50 animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                🚨 Dangerous
            </span>
        );
    }
    if (alertLevel === 'warning') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
                <ShieldCheck className="w-3 h-3" />
                ⚠️ Warning
            </span>
        );
    }
    return <span className="text-gray-500 text-xs">—</span>;
}

// ─── Severity indicator ──────────────────────────────────────────────────────
function SeverityBar({ level, threshold }) {
    const excess = level - threshold;
    let color = 'bg-yellow-400';
    if (excess >= 1.0) color = 'bg-red-600';
    else if (excess >= 0.5) color = 'bg-red-400';
    return (
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${color} shrink-0`}></span>
            <span className={`font-mono font-bold ${excess >= 1.0 ? 'text-red-400' : excess >= 0.5 ? 'text-orange-400' : 'text-yellow-400'}`}>
                {Number(level).toFixed(2)} m
            </span>
        </div>
    );
}

export default function AlertsPage() {
    const { stations } = useSocket();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const LIMIT = 50;

    // Filter and Auth
    const { data: session, status } = useSession();
    const router = useRouter();

    // Filters
    const [filterStation, setFilterStation] = useState('all');
    const [filterDate, setFilterDate] = useState('');
    const [filterLevel, setFilterLevel] = useState('all'); // 'all' | 'warning' | 'dangerous'
    const { socket } = useSocket();

    // Fetch alerts from backend
    const fetchAlerts = async (showSpinner = false, isLoadMore = false) => {
        if (showSpinner && !isLoadMore) setIsRefreshing(true);
        if (isLoadMore) setIsLoadingMore(true);

        try {
            const currentOffset = isLoadMore ? offset : 0;

            let url = filterStation !== 'all'
                ? `${API_URL}/alerts?stationId=${filterStation}&limit=${LIMIT}&offset=${currentOffset}`
                : `${API_URL}/alerts?limit=${LIMIT}&offset=${currentOffset}`;

            if (filterDate) {
                url += `&date=${filterDate}`;
            }
            const res = await fetch(url, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const data = await res.json();
            const fetchedData = Array.isArray(data) ? data : [];

            if (isLoadMore) {
                setAlerts(prev => [...prev, ...fetchedData]);
            } else {
                setAlerts(fetchedData);
            }

            setOffset(currentOffset + fetchedData.length);
            setHasMore(fetchedData.length === LIMIT);
            setLastRefresh(new Date());

        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (status === 'loading' || !session) return;
        setOffset(0);
        setHasMore(true);
        fetchAlerts(true, false);
    }, [filterStation, filterDate, session, status]);

    // Route Protection
    useEffect(() => {
        if (status === 'unauthenticated' || (session && session.user?.role === 'general_user')) {
            router.replace('/');
        }
    }, [session, status, router]);

    // Listen for real-time alerts
    useEffect(() => {
        if (!socket) return;

        const handleNewAlert = (newAlert) => {
            setAlerts(prevAlerts => {
                // Prepend the new alert, check if exists to prevent duplicates
                if (prevAlerts.some(a => a.id === newAlert.id)) return prevAlerts;

                // Add the new alert to the start of the list
                let updated = [newAlert, ...prevAlerts];

                // Optional: keep max 500 items memory usage low
                if (updated.length > 500) {
                    updated = updated.slice(0, 500);
                }

                return updated;
            });
            // Update last refresh time locally
            setLastRefresh(new Date());
        };

        socket.on('new-alert', handleNewAlert);
        return () => {
            socket.off('new-alert', handleNewAlert);
        };
    }, [socket]);

    // Compute Stats
    const stats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayAlerts = alerts.filter(a => new Date(a.timestamp) >= todayStart);
        const maxLevel = alerts.reduce((max, a) => Math.max(max, a.waterLevel || 0), 0);
        const dangerousCount = alerts.filter(a => a.alertLevel === 'dangerous').length;
        const warningCount = alerts.filter(a => a.alertLevel === 'warning').length;
        return {
            total: alerts.length,
            today: todayAlerts.length,
            maxLevel,
            lastAlert: alerts[0]?.timestamp || null,
            dangerousCount,
            warningCount,
        };
    }, [alerts]);

    // Client-side date + level filter
    const filteredAlerts = useMemo(() => {
        let result = alerts;
        if (filterDate) {
            result = result.filter(a => {
                const dt = new Date(a.timestamp);
                if (isNaN(dt.getTime())) return false;
                const year = dt.getFullYear();
                const month = String(dt.getMonth() + 1).padStart(2, '0');
                const day = String(dt.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;
                return localDateStr === filterDate;
            });
        }
        if (filterLevel !== 'all') {
            result = result.filter(a => a.alertLevel === filterLevel);
        }
        return result;
    }, [alerts, filterDate, filterLevel]);

    const stationList = useMemo(() => Object.values(stations), [stations]);

    if (status === 'loading' || loading) return (
        <div className="flex items-center justify-center h-[80vh] gap-3 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span>Loading...</span>
        </div>
    );

    if (session?.user?.role === 'general_user') return null; // Prevent flash before redirect

    return (
        <div className="mb-20 space-y-6">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-red-500 pl-4">
                        Alerts &amp; Notifications
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Records of all water level threshold breach alerts
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastRefresh && (
                        <span className="text-xs text-gray-500">
                            Updated: {lastRefresh.toLocaleTimeString('en-GB')}
                        </span>
                    )}
                    <button
                        onClick={() => fetchAlerts(true)}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Stats Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Dangerous */}
                <div className="bg-gray-800 border border-red-500/40 rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-red-500/15">
                        <ShieldAlert className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <p className="text-red-400 text-xs font-bold uppercase tracking-wider">🚨 Dangerous</p>
                        <p className="text-3xl font-extrabold text-red-300 mt-1">{stats.dangerousCount}</p>
                    </div>
                </div>
                {/* Warning */}
                <div className="bg-gray-800 border border-yellow-500/40 rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-yellow-500/10">
                        <ShieldCheck className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">⚠️ Warning</p>
                        <p className="text-3xl font-extrabold text-yellow-300 mt-1">{stats.warningCount}</p>
                    </div>
                </div>
                {/* Peak Level */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                        <TrendingUp className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Peak Level</p>
                        <p className="text-3xl font-extrabold text-white mt-1">
                            {stats.maxLevel > 0 ? `${stats.maxLevel.toFixed(2)}m` : '—'}
                        </p>
                    </div>
                </div>
                {/* Last Alert */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                        <Clock className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Last Alert</p>
                        <p className="text-sm font-bold text-white mt-1 leading-tight">
                            {stats.lastAlert ? formatTime(stats.lastAlert) : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Filter Bar ─────────────────────────────────────────────────── */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                    <label htmlFor="station-filter" className="text-xs font-bold text-gray-400 uppercase tracking-wider">Station</label>
                    <select
                        id="station-filter"
                        value={filterStation}
                        onChange={e => setFilterStation(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                    >
                        <option value="all">All Stations</option>
                        {stationList.map(s => (
                            <option key={s.stationId} value={s.stationId}>
                                {s.stationName || s.stationId}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor="date-filter" className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date</label>
                    <input
                        id="date-filter"
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor="level-filter" className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alert Level</label>
                    <select
                        id="level-filter"
                        value={filterLevel}
                        onChange={e => setFilterLevel(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                    >
                        <option value="all">All Levels</option>
                        <option value="warning">⚠️ Warning</option>
                        <option value="dangerous">🚨 Dangerous</option>
                    </select>
                </div>
                {(filterStation !== 'all' || filterDate || filterLevel !== 'all') && (
                    <button
                        onClick={() => { setFilterStation('all'); setFilterDate(''); setFilterLevel('all'); }}
                        className="self-end px-4 py-2.5 text-xs font-bold text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
                    >
                        Clear Filters
                    </button>
                )}
                {filteredAlerts.length > 0 && (
                    <span className="self-end ml-auto text-xs text-gray-500">
                        Showing {filteredAlerts.length} record{filteredAlerts.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* ── Alert Table ─────────────────────────────────────────────────── */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span>Loading...</span>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
                        <Bell className="w-16 h-16 opacity-20" />
                        <p className="text-lg font-bold">No Alerts Yet</p>
                        <p className="text-sm text-gray-400">
                            Alerts will appear here when water level exceeds the configured threshold.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-4">Timestamp</th>
                                    <th className="px-5 py-4">Station</th>
                                    <th className="px-5 py-4">Alert Level</th>
                                    <th className="px-5 py-4">Water Level</th>
                                    <th className="px-5 py-4">Threshold</th>
                                    <th className="px-5 py-4">Battery</th>
                                    <th className="px-5 py-4">LINE Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/60">
                                {filteredAlerts.map((alert, i) => (
                                    <tr key={alert.id || i} className={`hover:bg-gray-700/30 transition-colors group border-l-2 ${alert.alertLevel === 'dangerous' ? 'border-red-500' :
                                        alert.alertLevel === 'warning' ? 'border-yellow-500' : 'border-transparent'
                                        }`}>
                                        {/* Time */}
                                        <td className="px-5 py-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                                            {formatTime(alert.timestamp)}
                                        </td>
                                        {/* Station */}
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-sm text-white">{alert.stationName || alert.stationId}</div>
                                            <div className="text-xs text-gray-400 mt-0.5">{alert.stationId}</div>
                                        </td>
                                        {/* Alert Level */}
                                        <td className="px-5 py-4">
                                            <AlertLevelBadge alertLevel={alert.alertLevel} />
                                        </td>
                                        {/* Water Level */}
                                        <td className="px-5 py-4">
                                            <SeverityBar level={alert.waterLevel} threshold={alert.threshold} />
                                        </td>
                                        {/* Threshold */}
                                        <td className="px-5 py-4 text-gray-400 font-mono text-sm">
                                            {Number(alert.threshold).toFixed(2)} m
                                        </td>
                                        {/* Battery */}
                                        <td className="px-5 py-4">
                                            {alert.battery > 0 ? (
                                                <span className="text-sm text-gray-300">{Number(alert.battery).toFixed(1)} %</span>
                                            ) : (
                                                <span className="text-gray-600">—</span>
                                            )}
                                        </td>
                                        {/* LINE Status */}
                                        <td className="px-5 py-4">
                                            <StatusBadge status={alert.lineStatus} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Load More Button */}
                        {!loading && filteredAlerts.length > 0 && hasMore && (
                            <div className="p-4 flex justify-center border-t border-gray-800">
                                <button
                                    onClick={() => fetchAlerts(false, true)}
                                    disabled={isLoadingMore}
                                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isLoadingMore && <RefreshCw className="w-4 h-4 animate-spin text-red-500" />}
                                    {isLoadingMore ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer Info ─────────────────────────────────────────────────── */}
            <p className="text-center text-xs text-gray-500">
                Auto-refreshes every 30 seconds · Logs are session-only (max 200 entries)
            </p>
        </div>
    );
}
