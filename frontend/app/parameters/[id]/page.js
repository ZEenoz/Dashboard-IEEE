"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, MapPin, Battery, Signal, Clock, X, Calendar, ShieldAlert, ShieldCheck, Save, CheckCircle2, Lock, Layers, Globe, Wifi, Activity } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

if (typeof window !== 'undefined') {
    console.log("MapTiler Key Check:", MAPTILER_KEY ? "Present" : "MISSING");
}

// ─── Export CSV Modal ────────────────────────────────────────────────────────
function ExportModal({ stationId, stationName, onClose }) {
    const today = new Date().toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        toast.loading('Exporting CSV...', { id: 'csv-export' });
        try {
            const url = `${API}/export?start_date=${fromDate}&end_date=${toDate}&station_id=${stationId}`;
            const res = await fetch(url, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${stationId}_${fromDate}_to_${toDate}.csv`;
            link.click();
            toast.success('Export completed!', { id: 'csv-export' });
        } catch (e) {
            toast.error('Export failed: ' + e.message, { id: 'csv-export' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#151E32] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <Download className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold">Export CSV</h2>
                            <p className="text-xs text-gray-500 font-mono">{stationName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                                <Calendar className="w-3 h-3" /> From
                            </label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                                <Calendar className="w-3 h-3" /> To
                            </label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50 text-xs text-gray-500">
                        📋 Columns: Timestamp, Station ID, Station Name, Water Level (m), Battery (V), RSSI, SNR
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-bold transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Exporting...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Download CSV</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Per-Station Threshold Panel ─────────────────────────────────────────────
function ThresholdPanel({ stationId }) {
    const [warningLevel, setWarningLevel] = useState('');
    const [criticalLevel, setCriticalLevel] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load existing config
    useEffect(() => {
        fetch(`${API}/station-config/${stationId}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(r => r.json())
            .then(data => {
                if (data.warning_level != null) setWarningLevel(String(data.warning_level));
                if (data.critical_level != null) setCriticalLevel(String(data.critical_level));
            })
            .catch(() => { });
    }, [stationId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/station-config/${stationId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                    // Authorized via session cookie or internal API key from env
                },
                body: JSON.stringify({
                    warning_level: warningLevel !== '' ? parseFloat(warningLevel) : null,
                    critical_level: criticalLevel !== '' ? parseFloat(criticalLevel) : null,
                })
            });
            if (!res.ok) throw new Error('Save failed');
            setSaved(true);
            toast.success('Thresholds saved successfully!');
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            toast.error('Failed to save: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-[#151E32] rounded-2xl border border-gray-800 p-6 mb-6 shadow-xl">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                Station-Specific Thresholds
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Warning */}
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                    <label className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                        <ShieldCheck className="w-3 h-3" /> Warning Level
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="e.g. 1.8"
                            value={warningLevel}
                            onChange={e => setWarningLevel(e.target.value)}
                            className="w-full bg-gray-900 border border-yellow-600/40 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-yellow-400 pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">m</span>
                    </div>
                </div>
                {/* Critical */}
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <label className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                        <ShieldAlert className="w-3 h-3" /> Critical Level
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="e.g. 2.7"
                            value={criticalLevel}
                            onChange={e => setCriticalLevel(e.target.value)}
                            className="w-full bg-gray-900 border border-red-600/40 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-red-400 pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">m</span>
                    </div>
                </div>
            </div>
            <p className="text-xs text-gray-600 mb-4">
                Per-station settings override global thresholds from Settings page.
            </p>
            <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${saved
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                    }`}
            >
                {saved ? (
                    <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : (
                    <><Save className="w-4 h-4" /> Save Thresholds</>
                )}
            </button>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SensorDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { stations, history, displayMode } = useSocket();
    const { isAdmin, role } = useAuth();
    const stationId = params.id;

    const [settings, setSettings] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [mapStyle, setMapStyle] = useState('dark'); // 'dark' | 'satellite'
    const [viewState, setViewState] = useState({
        longitude: 100.5018,
        latitude: 13.7563,
        zoom: 14
    });

    useEffect(() => {
        fetch(`${API}/settings`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => setSettings(data))
            .catch(err => {
                console.error("Failed to fetch settings:", err.message);
                toast.error("Failed to load global settings");
            });
    }, []);

    const rawStation = useMemo(() => {
        if (!stations || !stationId) return null;
        const target = String(stationId).toLowerCase();
        const found = Object.entries(stations).find(([id]) => id.toLowerCase() === target);
        return found ? found[1] : null;
    }, [stations, stationId]);

    const station = useMemo(() => {
        if (!rawStation) return null;
        const config = settings?.stations?.[stationId];
        return {
            ...rawStation,
            stationName: config?.name || rawStation.stationName || stationId,
            imageUrl: config?.image || null,
            imagePosition: config?.imagePosition || null,
            type: config?.type || rawStation.type,
            description: config?.description || null,
            lat: rawStation.lat,
            lng: rawStation.lng
        };
    }, [rawStation, settings, stationId]);

    // Update map view when station coords load
    useEffect(() => {
        if (station?.lat && station?.lng) {
            console.log("Updating Map ViewState to:", station.lat, station.lng);
            setViewState(prev => ({
                ...prev,
                longitude: Number(station.lng),
                latitude: Number(station.lat),
            }));
        }
    }, [station?.lat, station?.lng]);

    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (Object.keys(stations).length > 0) {
            setIsLoading(false);
        } else {
            const timer = setTimeout(() => setIsLoading(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [stations]);

    const chartData = useMemo(() => {
        if (!history || !stationId) return [];
        const now = new Date().getTime();
        const hourWindow = 24;
        const cutoff = now - (hourWindow * 60 * 60 * 1000);

        // Normalize comparison for robust filtering
        const targetId = String(stationId).toLowerCase();

        return history
            .filter(h => {
                const hId = String(h.stationId || '').toLowerCase();
                return hId === targetId && h.rawTimestamp > cutoff;
            })
            .map(h => ({
                time: new Date(h.rawTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: Number(
                    displayMode === 'raw'
                        ? (h.rawLevel || h.waterLevel || 0)
                        : (h.waterLevel || 0)
                ),
                rawTimestamp: h.rawTimestamp
            }))
            .sort((a, b) => a.rawTimestamp - b.rawTimestamp);
    }, [history, stationId, displayMode]);

    const stats = useMemo(() => {
        if (chartData.length === 0) return { min: 0, max: 0, avg: 0 };
        const values = chartData.map(d => d.value);
        return {
            min: values.length > 0 ? Math.min(...values).toFixed(2) : "0.00",
            max: values.length > 0 ? Math.max(...values).toFixed(2) : "0.00",
            avg: values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : "0.00"
        };
    }, [chartData]);

    if (!mounted) return null;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <h2 className="text-xl font-bold animate-pulse">Loading Station Data...</h2>
            </div>
        );
    }

    if (!station) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white">
                <h1 className="text-2xl font-bold mb-4">Station Not Found</h1>
                <p className="text-gray-400 mb-6">Could not find data for ID: <span className="text-blue-400 font-mono">{stationId}</span></p>
                <div className="flex gap-4">
                    <button onClick={() => router.back()} className="px-6 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">Go Back</button>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Retry</button>
                </div>
            </div>
        );
    }

    const isOffline = (new Date().getTime() - (station.rawTimestamp || 0)) > 60 * 60 * 1000;

    return (
        <div className="flex flex-col h-screen bg-gray-950 text-white font-sans overflow-hidden">
            {/* Export Modal */}
            {showExportModal && (
                <ExportModal
                    stationId={stationId}
                    stationName={station.stationName}
                    onClose={() => setShowExportModal(false)}
                />
            )}

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-5 bg-gray-900/50 border-b border-gray-800 shadow-md backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        aria-label="กลับไปหน้าหลัก"
                        className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all text-gray-400 hover:text-white border border-gray-700"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-white border-l-4 border-blue-500 pl-4 flex items-center gap-3">
                                {station.stationName || stationId}
                                <span className="relative flex h-3 w-3">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOffline ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                </span>
                            </h1>
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full w-fit ${isOffline ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                {isOffline ? 'Offline' : 'Active'}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 pl-4 uppercase tracking-widest font-semibold opacity-70">Network Node Station Detail</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {(role === 'admin' || role === 'local_authority') && (
                        <button
                            onClick={() => setShowExportModal(true)}
                            aria-label="Export history to CSV"
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-gray-700 transition-all text-sm"
                        >
                            <Download size={16} className="text-green-500" />
                            <span>Export CSV</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Top Stats Row */}
            {/* Top Stats Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800/50 border-b border-gray-800">
                <div className="p-5 flex items-center gap-4 bg-gray-950/20 hover:bg-gray-800/20 transition-all group">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 border border-blue-500/20 transition-transform group-hover:scale-110"><MapPin size={20} /></div>
                    <div className="overflow-hidden">
                        <p className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.25em] mb-1">Location</p>
                        <p className="text-sm font-bold text-gray-200 tabular-nums truncate">{(Number(station.lat) || 0).toFixed(4)}°{station.lat >= 0 ? 'N' : 'S'} {(Number(station.lng) || 0).toFixed(4)}°{station.lng >= 0 ? 'E' : 'W'}</p>
                    </div>
                </div>
                <div className="p-5 flex items-center gap-4 bg-gray-950/20 hover:bg-gray-800/20 transition-all group">
                    <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20 transition-transform group-hover:scale-110"><Battery size={20} /></div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.25em] mb-1">Power</p>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-200 tabular-nums">{station.battery ?? '--'}%</span>
                            <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${Number(station.battery || 0) > 50 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : Number(station.battery || 0) > 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                                    style={{ width: `${Number(station.battery || 0)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-5 flex items-center gap-4 bg-gray-950/20 hover:bg-gray-800/20 transition-all group">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 border border-indigo-500/20 transition-transform group-hover:scale-110"><Signal size={20} /></div>
                    <div className="overflow-hidden">
                        <p className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.25em] mb-1">Signal</p>
                        <p className="text-sm font-bold text-gray-200 tabular-nums truncate">{station.rssi ?? '--'} dBm</p>
                    </div>
                </div>
                <div className="p-5 flex items-center gap-4 bg-gray-950/20 hover:bg-gray-800/20 transition-all group">
                    <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-500 border border-cyan-500/20 transition-transform group-hover:scale-110"><Clock size={20} /></div>
                    <div className="overflow-hidden">
                        <p className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.25em] mb-1">Last Update</p>
                        <p className="text-sm font-bold text-gray-200 tabular-nums truncate">{station.timestamp || station.rawTimestamp ? new Date(station.rawTimestamp || station.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Waiting...'}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            {/* Main Content */}
            <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Column: Map */}
                <div className="w-full lg:w-[55%] h-[400px] lg:h-full relative border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-col">
                    {/* Map Controls Overlay */}
                    <div className="absolute top-4 right-4 z-10 flex gap-2 bg-gray-900/60 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-2xl" style={{ WebkitBackdropFilter: 'blur(12px)' }}>
                        <button
                            onClick={() => setMapStyle('dark')}
                            aria-label="Switch to Normal Map view"
                            className={`p-1.5 rounded-lg transition-all ${mapStyle === 'dark' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            title="Normal Map"
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => setMapStyle('satellite')}
                            aria-label="Switch to Satellite Map view"
                            className={`p-1.5 rounded-lg transition-all ${mapStyle === 'satellite' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            title="Satellite Map"
                        >
                            <Globe size={16} />
                        </button>
                    </div>

                    <div className="flex-1 relative min-h-0">
                        <Map
                            {...viewState}
                            onMove={evt => setViewState(evt.viewState)}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            mapLib={maplibregl}
                            mapStyle={mapStyle === 'dark'
                                ? `https://api.maptiler.com/maps/base-v4-dark/style.json?key=${MAPTILER_KEY}`
                                : `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
                            }
                        >
                            <NavigationControl position="bottom-right" showCompass={false} />
                            <Marker longitude={station.lng || 100.5} latitude={station.lat || 13.75}>
                                <div className="relative group cursor-pointer flex items-center justify-center">
                                    <span className="flex h-6 w-6 relative items-center justify-center">

                                        {/* Outer Ping Animation / Glow (Status Based) */}
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 
                                          ${station.alertLevel === 'dangerous' ? 'bg-red-500 scale-150' :
                                                station.alertLevel === 'warning' ? 'bg-orange-500 scale-125' :
                                                    (station.sensorType === 'Float' || station.type === 'Float' ? 'bg-blue-400' : 'bg-purple-400')}
                                        `}></span>

                                        {/* Outer Glow Shadow for Warnings/Danger */}
                                        {(station.alertLevel === 'warning' || station.alertLevel === 'dangerous') && (
                                            <span className={`absolute inline-flex rounded-full h-8 w-8 blur-md opacity-60
                                              ${station.alertLevel === 'dangerous' ? 'bg-red-500' : 'bg-orange-500'}  
                                            `}></span>
                                        )}

                                        {/* Inner Dot (Big Version for Detail Page) */}
                                        <div className={`relative p-2 rounded-full shadow-lg border-2 border-white/20 z-10
                                          ${station.sensorType === 'Float' || station.type === 'Float' ? 'bg-blue-600 shadow-blue-500/50' : 'bg-purple-600 shadow-purple-500/50'}
                                        `}>
                                            <Wifi size={12} className="text-white" />
                                        </div>

                                    </span>

                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-2 py-1 bg-[#151E32]/90 backdrop-blur border border-blue-500/30 rounded text-xs font-bold whitespace-nowrap z-10">
                                        {stationId.toUpperCase()}
                                        {station.alertLevel && station.alertLevel !== 'normal' && (
                                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase
                                              ${station.alertLevel === 'dangerous' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`
                                            }>
                                                {station.alertLevel}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Marker>
                        </Map>
                    </div>
                </div>

                {/* Right Column: Charts & Data */}
                <div className="w-full lg:w-[45%] flex flex-col overflow-y-auto bg-slate-950/50 custom-scrollbar p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            <h2 className="text-xl font-bold tracking-tight text-white">Station Insights</h2>
                        </div>
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]">Live Node</span>
                    </div>

                    <div className="flex flex-col gap-6 mb-8">
                        {/* Station Image Card */}
                        <div
                            className={`h-80 rounded-[2rem] bg-gradient-to-br ${(station.type === 'Float' || station.sensorType === 'Float')
                                ? 'from-blue-600/20 via-blue-900/40 to-slate-950'
                                : 'from-purple-600/20 via-purple-900/40 to-slate-950'
                                } relative flex items-center justify-center bg-cover bg-no-repeat transition-all duration-700 shadow-2xl border border-white/5 overflow-hidden group`}
                            style={station.imageUrl ? {
                                backgroundImage: `url(${station.imageUrl})`,
                                backgroundPosition: station.imagePosition ? `${station.imagePosition.x}% ${station.imagePosition.y}%` : 'center center'
                            } : {}}
                        >
                            {station.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 group-hover:from-slate-950/60 transition-all duration-500"></div>}
                            <div className="absolute bottom-4 left-4 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black text-white uppercase tracking-widest" style={{ WebkitBackdropFilter: 'blur(8px)' }}>
                                {station.type || 'Standard Node'}
                            </div>
                        </div>

                        {/* Current Level Hero Card */}
                        <div className="bg-gray-900 rounded-[2rem] py-12 px-8 relative overflow-hidden flex flex-col justify-center items-center text-center">
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                            <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl"></div>

                            <p className="text-[13px] font-black text-indigo-100/60 uppercase tracking-[0.3em] mb-2 relative z-10">Current Water Level</p>
                            <div className="flex items-baseline justify-center relative z-10">
                                <span className="text-5xl font-black tracking-tighter text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]">
                                    {(Number(displayMode === 'raw' ? (station.rawLevel ?? station.waterLevel) : (station.waterLevel ?? 0)) || 0).toFixed(3)}
                                </span>
                                <span className="text-xl font-bold text-indigo-100/50 ml-1">m</span>
                            </div>
                        </div>
                    </div>

                    {/* ─── Threshold Configuration ─── */}
                    <div className="mb-8">
                        {(isAdmin || role === 'local_authority') ? (
                            <div className="bg-gray-900/40 backdrop-blur-md rounded-3xl border border-white/5 p-1 contain-content" style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                                <ThresholdPanel stationId={stationId} />
                            </div>
                        ) : (
                            <div className="bg-gray-900/30 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 flex items-center gap-4 text-gray-500 group hover:bg-gray-900/40 transition-all contain-content">
                                <div className="p-4 bg-gray-800/50 rounded-2xl group-hover:scale-110 transition-transform">
                                    <Lock className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-300">Alert Thresholds</p>
                                    <p className="text-xs opacity-60">Admin authorization required for threshold adjustments.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chart Section */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">24-Hour Trend</h3>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-gray-800/80 border border-gray-700/50 rounded-lg text-[10px] text-gray-400 font-mono shadow-inner">
                                    Range: <span className="text-blue-400 font-bold">{stats.min}m</span> - <span className="text-blue-400 font-bold">{stats.max}m</span>
                                </span>
                            </div>
                        </div>
                        <div style={{ width: '100%', height: 260 }} className="bg-gray-900/50 rounded-2xl border border-white/5 p-4 shadow-2xl relative">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} strokeOpacity={0.15} />
                                        <XAxis dataKey="time" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis 
                                            domain={[
                                                (dataMin) => Math.floor((dataMin - 0.5) * 10) / 10,
                                                (dataMax) => Math.ceil((dataMax + 0.5) * 10) / 10
                                            ]}
                                            tick={{ fill: '#6B7280', fontSize: 10 }} 
                                            axisLine={false} 
                                            tickLine={false}
                                            width={40}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                                color: '#fff',
                                                borderRadius: '12px',
                                                backdropFilter: 'blur(12px)',
                                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                padding: '10px 14px',
                                                fontSize: '12px'
                                            }}
                                            itemStyle={{ color: '#60A5FA', fontWeight: 'bold' }}
                                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                            cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#3B82F6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorValue)"
                                            animationDuration={1500}
                                            dot={false}
                                            activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loading History...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl transition-all hover:border-blue-500/20 group">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-[0.2em]">Peak Level</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-white tabular-nums group-hover:text-blue-400 transition-colors">{stats.max}</p>
                                <span className="text-xs font-medium text-gray-500 font-mono">m</span>
                            </div>
                        </div>
                        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl transition-all hover:border-purple-500/20 group">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-[0.2em]">Median Level</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-white tabular-nums group-hover:text-purple-400 transition-colors">{stats.avg}</p>
                                <span className="text-xs font-medium text-gray-500 font-mono">m</span>
                            </div>
                        </div>
                        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl transition-all hover:border-cyan-500/20 group">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-[0.2em]">Minimum Level</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-white tabular-nums group-hover:text-cyan-400 transition-colors">{stats.min}</p>
                                <span className="text-xs font-medium text-gray-500 font-mono">m</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
