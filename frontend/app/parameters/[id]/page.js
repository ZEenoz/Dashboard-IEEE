"use client";

import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, MapPin, Battery, Signal, Clock, X, Calendar, ShieldAlert, ShieldCheck, Save, CheckCircle2, Lock, Layers, Globe, Wifi } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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
            const res = await fetch(url);
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
        fetch(`${API}/station-config/${stationId}`)
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
                    'Content-Type': 'application/json'
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

    useEffect(() => {
        fetch(`${API}/settings`)
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

    const rawStation = stations[stationId];

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
        if (!history) return [];
        const now = new Date().getTime();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        return history
            .filter(h => h.stationId === stationId && h.rawTimestamp > twentyFourHoursAgo)
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
            min: Math.min(...values).toFixed(2),
            max: Math.max(...values).toFixed(2),
            avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
        };
    }, [chartData]);

    if (!mounted) return null;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#0B1121] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <h2 className="text-xl font-bold animate-pulse">Loading Station Data...</h2>
            </div>
        );
    }

    if (!station) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#0B1121] text-white">
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
        <div className="flex flex-col min-h-screen bg-gray-950 text-white font-sans pb-20">
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
                            <h1 className="text-2xl font-bold tracking-tight text-white border-l-4 border-blue-500 pl-4">
                                {station.stationName || stationId}
                            </h1>
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full w-fit ${isOffline ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                {isOffline ? 'Offline' : 'Active'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 pl-4">Network Node Station Detail</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {(role === 'admin' || role === 'local_authority') && (
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-gray-700 transition-all text-sm"
                        >
                            <Download size={16} className="text-green-500" />
                            <span>Export CSV</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Top Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-800 bg-gray-900/30 border-b border-gray-800">
                <div className="p-4 flex items-center gap-4 border-b border-gray-800 lg:border-b-0">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20"><MapPin size={18} /></div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-0.5">Location (GPS)</p>
                        <p className="text-sm font-bold text-gray-200 tabular-nums truncate">{Math.abs(station.lat || 0).toFixed(4)}° {station.lat >= 0 ? 'N' : 'S'}, {Math.abs(station.lng || 0).toFixed(4)}° {station.lng >= 0 ? 'E' : 'W'}</p>
                    </div>
                </div>
                <div className="p-4 flex items-center gap-4 border-b border-gray-800 lg:border-b-0">
                    <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-500 border border-orange-500/20"><Battery size={18} /></div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-0.5">Power Status</p>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-200 tabular-nums">{station.battery}%</span>
                            <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${station.battery > 50 ? 'bg-green-500' : station.battery > 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                                    style={{ width: `${station.battery}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 flex items-center gap-4 border-r border-gray-800 lg:border-r-0">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/20"><Signal size={18} /></div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-0.5">Signal (RSSI)</p>
                        <p className="text-sm font-bold text-gray-200 tabular-nums truncate">{station.rssi} dBm</p>
                    </div>
                </div>
                <div className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-500 border border-cyan-500/20"><Clock size={18} /></div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-0.5">Transmission</p>
                        <p className="text-sm font-bold text-gray-200 tabular-nums truncate">{station.timestamp || 'Wait for link...'}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                {/* Left Column: Map */}
                <div className="w-full lg:w-[55%] h-[400px] lg:h-full relative border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-col">
                    {/* Map Controls Overlay */}
                    <div className="absolute top-4 right-4 z-10 flex gap-2 bg-[#151E32]/80 backdrop-blur rounded-xl p-1.5 border border-gray-700 shadow-lg">
                        <button
                            onClick={() => setMapStyle('dark')}
                            className={`p-1.5 rounded-lg transition-all ${mapStyle === 'dark' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            title="Normal Map"
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => setMapStyle('satellite')}
                            className={`p-1.5 rounded-lg transition-all ${mapStyle === 'satellite' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            title="Satellite Map"
                        >
                            <Globe size={16} />
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        <Map
                            initialViewState={{
                                longitude: station.lng || 100.5,
                                latitude: station.lat || 13.75,
                                zoom: 14
                            }}
                            style={{ width: '100%', height: '100%' }}
                            mapLib={maplibregl}
                            mapStyle={mapStyle === 'dark'
                                ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
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

                {/* Right Column: Data */}
                <div className="w-full lg:w-[45%] p-6 lg:overflow-y-auto bg-[#0B1121] custom-scrollbar">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold">Water Level Data</h2>
                        <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] font-bold uppercase rounded border border-blue-500/30">Real-Time</span>
                    </div>

                    {/* Station Image Card */}
                    <div
                        className={`h-60 w-full rounded-3xl bg-gradient-to-br ${(station.type === 'Float' || station.sensorType === 'Float')
                            ? 'from-blue-900 via-blue-800 to-gray-900'
                            : 'from-purple-900 via-purple-800 to-gray-900'
                            } relative flex items-center justify-center bg-cover bg-no-repeat transition-all duration-500 mb-4 shadow-xl border border-gray-800 overflow-hidden group hover:border-blue-500/30`}
                        style={station.imageUrl ? {
                            backgroundImage: `url(${station.imageUrl})`,
                            backgroundPosition: station.imagePosition ? `${station.imagePosition.x}% ${station.imagePosition.y}%` : 'center center'
                        } : {}}
                    >
                        {station.imageUrl && <div className="absolute inset-0 bg-black/20"></div>}
                        <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur rounded-full border border-white/10 text-xs font-bold text-white uppercase tracking-wider">
                            {station.type || 'Station'}
                        </div>
                    </div>

                    {/* Current Depth Card */}
                    <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 mb-6">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover:bg-blue-500/15 transition-all duration-700"></div>
                        <div className="text-center relative z-10">
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.3em] mb-4">Current Water Level</p>
                            <div className="flex items-baseline justify-center gap-2">
                                <span className="text-8xl font-bold tracking-tighter text-white drop-shadow-2xl">
                                    {Number(displayMode === 'raw' ? (station.rawLevel ?? station.waterLevel) : (station.waterLevel ?? 0)).toFixed(3)}
                                </span>
                                <span className="text-2xl font-normal text-gray-500">m</span>
                            </div>
                        </div>
                    </div>

                    {/* ─── Phase 2: Per-Station Threshold Panel (Admin Only) ─── */}
                    {(isAdmin || role === 'local_authority') ? (
                        <ThresholdPanel stationId={stationId} />
                    ) : (
                        <div className="bg-[#151E32] rounded-2xl border border-gray-800 p-6 mb-6 flex items-center gap-4 text-gray-500">
                            <div className="p-3 bg-gray-700/50 rounded-xl">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-400">Alert Thresholds</p>
                                <p className="text-xs">Admin access required to configure thresholds.</p>
                            </div>
                        </div>
                    )}

                    {/* Chart Section */}
                    <div className="mb-8 overflow-hidden">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">24-Hour Trend</h3>
                            <span className="text-[10px] text-gray-500 font-mono bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">Range: {stats.min}m - {stats.max}m</span>
                        </div>
                        <div className="h-56 w-full bg-gray-900 rounded-2xl border border-gray-800 p-4 shadow-2xl relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} strokeOpacity={0.2} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis domain={['auto', 'auto']} hide />
                                    <Tooltip
                                        contentStyle={{ 
                                            backgroundColor: 'rgba(17, 24, 39, 0.8)', 
                                            borderColor: 'rgba(55, 65, 81, 0.5)', 
                                            color: '#fff', 
                                            borderRadius: '12px',
                                            backdropFilter: 'blur(8px)',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            fontSize: '12px',
                                            padding: '12px'
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
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
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
