"use client";

import { useState, useEffect } from 'react';
import { useSocket } from "@/contexts/SocketContext";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ImagePositionModal from '@/components/ImagePositionModal';
import SystemHealthDashboard from '@/components/SystemHealthDashboard';
import UserManagement from '@/components/UserManagement';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
import {
    Bell,
    Map,
    Cpu,
    Save,
    MessageCircle,
    Activity,
    Settings as SettingsIcon,
    AlertTriangle,
    Navigation,
    Key,
    Smartphone,
    Image as ImageIcon,
    PlusCircle,
    Trash2,
    Move,
    Database,
    Download,
    Users
} from 'lucide-react';

export default function SettingsPage() {
    const { stations: socketStations } = useSocket();
    const { data: session, status } = useSession();
    const router = useRouter();

    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('notifications'); // notifications, stations, system, users
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingImagePosition, setEditingImagePosition] = useState(null); // Station ID being edited

    // Route Protection
    useEffect(() => {
        if (status === 'unauthenticated' || (session && session.user?.role === 'general_user')) {
            router.replace('/');
        }
    }, [session, status, router]);

    const handleDeleteStation = (id) => {
        if (!confirm(`Are you sure you want to delete station "${id}" from settings?`)) return;

        setSettings(prev => {
            const newStations = { ...prev.stations };
            delete newStations[id];
            return { ...prev, stations: newStations };
        });
    };

    const handleAddStation = (id, name, lat, lng) => {
        if (!id) return toast.error("Station ID is required");

        setSettings(prev => ({
            ...prev,
            stations: {
                ...prev.stations,
                [id]: { name, lat, lng, image: '', offset: 0, networkMode: prev.networkMode || 'TTN' }
            }
        }));
        setShowAddModal(false);
    };

    // Fetch Settings
    useEffect(() => {
        fetch(`${API_URL}/settings`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch settings", err);
                toast.error("Failed to load settings");
                setLoading(false);
            });
    }, []);

    const handleChange = (section, key, value) => {
        if (!section) {
            setSettings(prev => ({
                ...prev,
                [key]: value
            }));
            return;
        }
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleStationChange = (id, field, value) => {
        setSettings(prev => ({
            ...prev,
            stations: {
                ...prev.stations,
                [id]: {
                    ...prev.stations[id],
                    [field]: value
                }
            }
        }));
    };

    const addStationToConfig = (stationId, stationData) => {
        const isFloat = (stationData.stationName || stationId).toLowerCase().includes('float');
        setSettings(prev => ({
            ...prev,
            stations: {
                ...prev.stations,
                [stationId]: {
                    name: stationData.stationName || stationId,
                    lat: stationData.lat || 0,
                    lng: stationData.lng || 0,
                    type: isFloat ? 'Float' : 'Static',
                    image: '',
                    offset: 0
                }
            }
        }));
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': 'IEEE_SECURE_API_KEY_2025' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast.success('Settings Saved Successfully!');
            } else {
                toast.error('Failed to save settings');
            }
        } catch (e) {
            toast.error('Error saving settings: ' + e.message);
        }
        setSaving(false);
    };

    if (status === 'loading' || loading) return (
        <div className="p-8 text-white h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
    );

    if (session?.user?.role === 'general_user') return null; // Prevent flash before redirect

    if (!settings) return <div className="p-8 text-white">Error loading settings. Check backend connection.</div>;

    const role = session?.user?.role;

    // Filter tabs based on role
    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
        { id: 'stations', label: 'Stations', icon: <Map className="w-5 h-5" /> }
    ];

    if (role === 'admin') {
        tabs.push({ id: 'system', label: 'System', icon: <Cpu className="w-5 h-5" /> });
        tabs.push({ id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> });
    }

    // Calculate unconfigured stations
    const configuredStationIds = Object.keys(settings.stations || {});
    const unconfiguredStations = Object.values(socketStations || {}).filter(s => !configuredStationIds.includes(s.stationId));

    return (
        <div className="p-8 text-white max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-blue-400 flex items-center gap-3">
                <SettingsIcon className="w-8 h-8" />
                System Settings
            </h1>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-8">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-4 font-medium flex items-center gap-2 transition-all ${activeTab === tab.id
                            ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl min-h-[500px]">

                {/* 🔔 Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="space-y-8 fade-in">
                        <div>
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 pb-2 border-b border-gray-700">
                                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                                Alert Configuration
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Warning Level */}
                                <div className="bg-yellow-900/20 p-6 rounded-xl border border-yellow-500/40">
                                    <label className="block text-sm font-bold text-yellow-400 mb-1 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Warning Level (Global)
                                    </label>
                                    <div className="relative mt-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={settings.alertThresholds?.warningLevel || ''}
                                            onChange={(e) => handleChange('alertThresholds', 'warningLevel', parseFloat(e.target.value))}
                                            className="w-full bg-gray-800 border border-yellow-600/50 rounded-lg p-3 text-white focus:border-yellow-400 outline-none pr-16 text-lg font-mono"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">meters</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        Warning (⚠️) when water level exceeds this value
                                    </p>
                                </div>

                                {/* Critical Level */}
                                <div className="bg-red-900/20 p-6 rounded-xl border border-red-500/40">
                                    <label className="block text-sm font-bold text-red-400 mb-1 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Critical Level (Global)
                                    </label>
                                    <div className="relative mt-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={settings.alertThresholds?.criticalLevel || ''}
                                            onChange={(e) => handleChange('alertThresholds', 'criticalLevel', parseFloat(e.target.value))}
                                            className="w-full bg-gray-800 border border-red-600/50 rounded-lg p-3 text-white focus:border-red-400 outline-none pr-16 text-lg font-mono"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">meters</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        Critical (🚨) when water level exceeds this value
                                    </p>
                                </div>

                                {/* LINE Notify Configuration (Admin Only) */}
                                {role === 'admin' && (
                                    <>
                                        <div className="bg-green-900/20 p-6 rounded-xl border border-green-500/30">
                                            <div className="flex justify-between items-center mb-4">
                                                <label className="block text-sm font-bold text-green-400 flex items-center gap-2">
                                                    <MessageCircle className="w-4 h-4" />
                                                    LINE Notify Token
                                                </label>
                                                <div className="form-checkbox flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.lineNotify?.active || false}
                                                        onChange={(e) => handleChange('lineNotify', 'active', e.target.checked)}
                                                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500"
                                                    />
                                                    <span className="text-xs text-gray-400">Enable</span>
                                                </div>
                                            </div>

                                            <input
                                                type="password"
                                                value={settings.lineNotify?.token || ''}
                                                onChange={(e) => handleChange('lineNotify', 'token', e.target.value)}
                                                placeholder="Enter LINE Notify Token"
                                                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:border-green-500 outline-none font-mono text-sm mb-3"
                                            />

                                            <div className="flex justify-between items-center">
                                                <a href="https://developers.line.biz/console/channel/2008284216/messaging-api" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">
                                                    Get Token Here
                                                </a>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await fetch(`${API_URL}/test-notify`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json', 'x-api-key': 'IEEE_SECURE_API_KEY_2025' },
                                                                body: JSON.stringify({ token: settings.lineNotify?.token })
                                                            });
                                                            const data = await res.json();
                                                            toast.success(data.message || 'Notification Sent');
                                                        } catch (err) {
                                                            toast.error('Failed to test notification');
                                                        }
                                                    }}
                                                    className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                                                >
                                                    Test Notification
                                                </button>
                                            </div>
                                        </div>

                                        {/* LINE Official Account Bot */}
                                        <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-500/30">
                                            <div className="flex justify-between items-center mb-4">
                                                <label className="block text-sm font-bold text-blue-400 flex items-center gap-2">
                                                    <Smartphone className="w-4 h-4" />
                                                    LINE OA Bot (Push Alerts)
                                                </label>
                                                <div className="form-checkbox flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.lineBot?.active ?? true}
                                                        onChange={(e) => handleChange('lineBot', 'active', e.target.checked)}
                                                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500"
                                                    />
                                                    <span className="text-xs text-gray-400">Enable</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Toggle this off to mute automatic danger/warning push messages to subscribers. Useful for system testing or maintenance.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* 🗺️ Stations Tab */}
                {activeTab === 'stations' && (
                    <div className="space-y-8 fade-in">
                        {/* Configured Stations */}
                        <div>
                            <div className="flex justify-between items-end mb-6 border-b border-gray-700 pb-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Map className="w-6 h-6 text-blue-500" />
                                    Configured Stations
                                </h2>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                                >
                                    <PlusCircle size={14} />
                                    Manual Add
                                </button>
                            </div>

                            <div className="space-y-4">
                                {Object.entries(settings.stations || {}).map(([id, config]) => (
                                    <div key={id} className="bg-gray-900/80 p-6 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors relative group">
                                        {/* Delete Button */}
                                        <button
                                            onClick={() => handleDeleteStation(id)}
                                            className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                                            title="Delete Station"
                                        >
                                            <Trash2 size={18} />
                                        </button>

                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-blue-900/30 rounded-lg">
                                                <Smartphone className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <h3 className="font-mono text-blue-300 text-lg font-bold">{id}</h3>
                                            <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-500">ID</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Left Column: Basic Info */}
                                            <div className="space-y-4">
                                                <div className="flex gap-4 mb-4">
                                                    <div className="flex-1">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Display Name</label>
                                                        <input
                                                            type="text"
                                                            value={config.name}
                                                            onChange={(e) => handleStationChange(id, 'name', e.target.value)}
                                                            className="w-full bg-gray-800 border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="w-1/4">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Type</label>
                                                        <select
                                                            value={config.type || 'Static'}
                                                            onChange={(e) => handleStationChange(id, 'type', e.target.value)}
                                                            className="w-full bg-gray-800 border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                                        >
                                                            <option value="Static">Static</option>
                                                            <option value="Float">Float</option>
                                                        </select>
                                                    </div>
                                                    <div className="w-1/4">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block" title="Value added to Raw Data">Offset (m)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={config.offset ?? ''}
                                                            onChange={(e) => handleStationChange(id, 'offset', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                            placeholder="0.00"
                                                            className="w-full bg-gray-800 border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                                                    <textarea
                                                        value={config.description || ''}
                                                        onChange={(e) => handleStationChange(id, 'description', e.target.value)}
                                                        className="w-full bg-gray-800 border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none resize-none h-20 font-mono"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Latitude</label>
                                                        <div className="relative">
                                                            <Navigation className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                                            <input
                                                                type="number"
                                                                value={config.lat}
                                                                onChange={(e) => handleStationChange(id, 'lat', parseFloat(e.target.value))}
                                                                className="w-full bg-gray-800 border-gray-600 rounded pl-7 pr-2 py-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Longitude</label>
                                                        <div className="relative">
                                                            <Navigation className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                                            <input
                                                                type="number"
                                                                value={config.lng}
                                                                onChange={(e) => handleStationChange(id, 'lng', parseFloat(e.target.value))}
                                                                className="w-full bg-gray-800 border-gray-600 rounded pl-7 pr-2 py-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column: Image URL */}
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                                        <ImageIcon className="w-3 h-3" />
                                                        Station Image URL
                                                    </label>
                                                    {config.image && (
                                                        <button
                                                            onClick={() => setEditingImagePosition(id)}
                                                            className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1 bg-blue-500/10 hover:bg-blue-600/50 px-2 py-0.5 rounded transition-all"
                                                        >
                                                            <Move size={10} /> Position
                                                        </button>
                                                    )}
                                                </div>

                                                <input
                                                    type="text"
                                                    placeholder="https://example.com/image.jpg"
                                                    value={config.image || ''}
                                                    onChange={(e) => handleStationChange(id, 'image', e.target.value)}
                                                    className="w-full bg-gray-800 border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none mb-2"
                                                />
                                                {config.image && (
                                                    <div className="relative h-24 w-full rounded-lg overflow-hidden border border-gray-700 bg-black/50 group/image">
                                                        <div
                                                            className="w-full h-full bg-cover bg-no-repeat transition-all"
                                                            style={{
                                                                backgroundImage: `url(${config.image})`,
                                                                backgroundPosition: config.imagePosition ? `${config.imagePosition.x}% ${config.imagePosition.y}%` : 'center center'
                                                            }}
                                                        />
                                                        <div className="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1 rounded text-white z-10">Preview</div>

                                                        {/* Quick Adjust Button Overlay */}
                                                        <button
                                                            onClick={() => setEditingImagePosition(id)}
                                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity"
                                                        >
                                                            <div className="bg-black/80 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
                                                                <Move size={12} /> Adjust Position
                                                            </div>
                                                        </button>
                                                    </div>
                                                )}
                                                {!config.image && (
                                                    <div className="h-24 w-full rounded-lg border border-gray-700 border-dashed flex items-center justify-center text-gray-600 text-xs">
                                                        No Image Set
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detected Stations */}
                        {unconfiguredStations.length > 0 && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 pb-2 border-b border-gray-700 text-green-400">
                                    <Activity className="w-6 h-6" />
                                    Detected New Stations
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {unconfiguredStations.map(station => (
                                        <div key={station.stationId} className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-green-300">{station.stationId}</div>
                                                <div className="text-xs text-gray-400">Detected from live feed</div>
                                            </div>
                                            <button
                                                onClick={() => addStationToConfig(station.stationId, station)}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                                            >
                                                <PlusCircle size={16} />
                                                Add to Config
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Manual Add Modal */}
                        {showAddModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                                <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <PlusCircle className="text-blue-500" />
                                        Manually Add Station
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Station ID (Unique)</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. station-001"
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                id="new-station-id"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Display Name</label>
                                            <input
                                                type="text"
                                                placeholder="My Station"
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                id="new-station-name"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Latitude</label>
                                                <input
                                                    type="number"
                                                    placeholder="13.75"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                    id="new-station-lat"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Longitude</label>
                                                <input
                                                    type="number"
                                                    placeholder="100.50"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                                                    id="new-station-lng"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-6">
                                        <button
                                            onClick={() => setShowAddModal(false)}
                                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                const id = document.getElementById('new-station-id').value;
                                                const name = document.getElementById('new-station-name').value;
                                                const type = document.getElementById('new-station-type').value;
                                                const lat = parseFloat(document.getElementById('new-station-lat').value) || 0;
                                                const lng = parseFloat(document.getElementById('new-station-lng').value) || 0;
                                                if (id) {
                                                    handleAddStation(id, name, lat, lng, type);
                                                }
                                            }}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                                        >
                                            Add Station
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Image Position Modal */}
                        {editingImagePosition && (
                            <ImagePositionModal
                                isOpen={!!editingImagePosition}
                                onClose={() => setEditingImagePosition(null)}
                                imageUrl={settings.stations[editingImagePosition]?.image}
                                initialPosition={settings.stations[editingImagePosition]?.imagePosition}
                                onSave={(pos) => {
                                    handleStationChange(editingImagePosition, 'imagePosition', pos);
                                    setEditingImagePosition(null);
                                }}
                            />
                        )}




                    </div>
                )}

                {/* ⚙️ System Tab */}
                {activeTab === 'system' && (
                    <div className="space-y-6 fade-in">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Cpu className="w-6 h-6 text-gray-400" />
                            System Status & Health
                        </h2>

                        <SystemHealthDashboard />

                        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50 space-y-4 mt-8">
                            <h3 className="text-lg font-bold text-gray-300">Application Info</h3>
                            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                <span className="text-gray-400">Database</span>
                                <span className="font-mono text-white">PostgreSQL</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                <span className="text-gray-400">Network Protocol Mode</span>
                                <select
                                    value={settings.networkMode || 'TTN'}
                                    onChange={(e) => handleChange(null, 'networkMode', e.target.value)}
                                    className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="TTN">The Things Network (TTN)</option>
                                    <option value="CHIRPSTACK">ChirpStack v4</option>
                                </select>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Operational Mode</span>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${settings.useSimulator ? 'bg-yellow-900/50 text-yellow-500' : 'bg-green-900/50 text-green-500'
                                    }`}>
                                    {settings.useSimulator ? 'Simulator Mode' : `Production (${settings.networkMode || 'TTN'})`}
                                </span>
                            </div>
                        </div>

                        {/* 🟣 ChirpStack Configuration (shown when CHIRPSTACK mode is active) */}
                        {settings.networkMode === 'CHIRPSTACK' && (
                            <div className="bg-purple-900/20 p-6 rounded-xl border border-purple-500/30 space-y-4 mt-4">
                                <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2">
                                    <Activity className="w-5 h-5" />
                                    ChirpStack v4 Connection
                                </h3>
                                <p className="text-xs text-gray-400 mb-2">
                                    Configure MQTT connection to your ChirpStack Network Server.
                                    These can also be set via environment variables (CHIRPSTACK_MQTT_URL, CHIRPSTACK_APP_ID, etc.)
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* MQTT URL */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">MQTT Broker URL</label>
                                        <input
                                            type="text"
                                            placeholder="mqtt://chirpstack.example.com:1883"
                                            value={settings.chirpstack?.mqttUrl || ''}
                                            onChange={(e) => handleChange('chirpstack', 'mqttUrl', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
                                        />
                                    </div>

                                    {/* Application ID */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Application ID</label>
                                        <input
                                            type="text"
                                            placeholder="UUID from ChirpStack (or leave empty for wildcard)"
                                            value={settings.chirpstack?.applicationId || ''}
                                            onChange={(e) => handleChange('chirpstack', 'applicationId', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
                                        />
                                    </div>

                                    {/* MQTT Username */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">MQTT Username</label>
                                        <input
                                            type="text"
                                            placeholder="(optional)"
                                            value={settings.chirpstack?.mqttUser || ''}
                                            onChange={(e) => handleChange('chirpstack', 'mqttUser', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                        />
                                    </div>

                                    {/* MQTT Password */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">MQTT Password</label>
                                        <input
                                            type="password"
                                            placeholder="(optional)"
                                            value={settings.chirpstack?.mqttPass || ''}
                                            onChange={(e) => handleChange('chirpstack', 'mqttPass', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* TLS Toggle */}
                                <div className="flex items-center gap-3 mt-2">
                                    <input
                                        type="checkbox"
                                        checked={settings.chirpstack?.useTls || false}
                                        onChange={(e) => handleChange('chirpstack', 'useTls', e.target.checked)}
                                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500"
                                    />
                                    <span className="text-sm text-gray-300">Use TLS (mqtts://)</span>
                                </div>

                                {/* Info Box */}
                                <div className="bg-gray-800/60 rounded-lg p-4 mt-3 text-xs text-gray-400 space-y-1">
                                    <p><strong className="text-purple-300">MQTT Topic:</strong> <code className="text-purple-200">application/{'{app_id}'}/device/+/event/up</code></p>
                                    <p><strong className="text-purple-300">Device ID:</strong> Uses <code className="text-purple-200">devEui</code> from deviceInfo</p>
                                    <p><strong className="text-purple-300">Decoded Data:</strong> Requires a Codec (JavaScript/CayenneLPP) in ChirpStack Device Profile</p>
                                    <p className="mt-2 text-yellow-400/80">⚠️ After saving, the backend will automatically reconnect to the ChirpStack MQTT broker.</p>
                                </div>
                            </div>
                        )}
                    </div>

                )}

                {/* 👥 Users Tab */}
                {activeTab === 'users' && role === 'admin' && (
                    <UserManagement />
                )}

                {/* Global Save Button */}
                <div className="mt-8 flex justify-end pt-6 border-t border-gray-700">
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className={`px-8 py-3 rounded-lg font-bold text-lg shadow-lg flex items-center gap-2 transition-all ${saving ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'
                            }`}
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

            </div>
        </div>
    );
}

