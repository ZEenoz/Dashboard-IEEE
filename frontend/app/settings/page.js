"use client";

import { useState, useEffect } from 'react';
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
    Smartphone
} from 'lucide-react';

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('notifications'); // notifications, stations, system

    // Fetch Settings
    useEffect(() => {
        fetch('http://localhost:4000/api/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch settings", err);
                setLoading(false);
            });
    }, []);

    const handleChange = (section, key, value) => {
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

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch('http://localhost:4000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                alert('Settings Saved Successfully!');
            } else {
                alert('Failed to save settings');
            }
        } catch (e) {
            alert('Error saving settings: ' + e.message);
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="p-8 text-white h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
    );

    if (!settings) return <div className="p-8 text-white">Error loading settings. Check backend connection.</div>;

    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
        { id: 'stations', label: 'Stations', icon: <Map className="w-5 h-5" /> },
        { id: 'system', label: 'System', icon: <Cpu className="w-5 h-5" /> }
    ];

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
                                Alert Thresholds
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50">
                                    <label className="block text-sm font-bold text-blue-300 mb-2">Critical Water Level</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={settings.alertThresholds?.waterLevel || ''}
                                            onChange={(e) => handleChange('alertThresholds', 'waterLevel', parseFloat(e.target.value))}
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none pr-12 text-lg font-mono"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">meters</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        Alert triggers when level exceeds this value.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                                        <label className="block text-sm font-bold text-purple-300 mb-2">Low Pressure Alert (bar)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={settings.alertThresholds?.pressureLow || ''}
                                            onChange={(e) => handleChange('alertThresholds', 'pressureLow', parseFloat(e.target.value))}
                                            className="w-full bg-gray-800 border-gray-600 rounded-lg p-2 text-white focus:border-blue-500 outline-none font-mono"
                                        />
                                    </div>

                                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                                        <label className="block text-sm font-bold text-red-300 mb-2">High Pressure Alert (bar)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={settings.alertThresholds?.pressureHigh || ''}
                                            onChange={(e) => handleChange('alertThresholds', 'pressureHigh', parseFloat(e.target.value))}
                                            className="w-full bg-gray-800 border-gray-600 rounded-lg p-2 text-white focus:border-blue-500 outline-none font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 🗺️ Stations Tab */}
                {activeTab === 'stations' && (
                    <div className="space-y-6 fade-in">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 pb-2 border-b border-gray-700">
                            <Map className="w-6 h-6 text-blue-500" />
                            Station Configuration
                        </h2>
                        <div className="space-y-4">
                            {Object.entries(settings.stations || {}).map(([id, config]) => (
                                <div key={id} className="bg-gray-900/80 p-6 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-blue-900/30 rounded-lg">
                                            <Smartphone className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <h3 className="font-mono text-blue-300 text-lg font-bold">{id}</h3>
                                        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-500 ml-auto">ID</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Display Name</label>
                                            <input
                                                type="text"
                                                value={config.name}
                                                onChange={(e) => handleStationChange(id, 'name', e.target.value)}
                                                className="w-full bg-gray-800 border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                            />
                                        </div>
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
                            ))}
                        </div>
                    </div>
                )}

                {/* ⚙️ System Tab */}
                {activeTab === 'system' && (
                    <div className="space-y-6 fade-in">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Cpu className="w-6 h-6 text-gray-400" />
                            System Info
                        </h2>
                        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700/50 space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                <span className="text-gray-400">Backend Version</span>
                                <span className="font-mono text-white">1.0.0</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                <span className="text-gray-400">Database</span>
                                <span className="font-mono text-white">PostgreSQL</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Operational Mode</span>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${settings.useSimulator ? 'bg-yellow-900/50 text-yellow-500' : 'bg-green-900/50 text-green-500'
                                    }`}>
                                    {settings.useSimulator ? 'Simulator Mode' : 'Production (TTN)'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="mt-8 flex justify-end">
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
