"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import {
    Save,
    Eye,
    EyeOff,
    ArrowRight,
    ArrowLeft,
    GripVertical
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function DisplayStationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();

    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // UI State
    const [displayedStations, setDisplayedStations] = useState([]);
    const [hiddenStations, setHiddenStations] = useState([]);
    const [draggedStation, setDraggedStation] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Route Protection — admin only
    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
        if (session && session.user?.role !== 'admin') router.replace('/');
    }, [session, status, router]);

    // Fetch settings
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_URL}/settings?_=${Date.now()}`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                const data = await res.json();
                setSettings(data);
                
                // Initialize lists based on isVisible
                const stations = data.stations || {};
                const displayed = [];
                const hidden = [];
                
                Object.entries(stations).forEach(([id, config]) => {
                    const item = { id, ...config };
                    if (config.isVisible === false) {
                        hidden.push(item);
                    } else {
                        displayed.push(item);
                    }
                });
                
                // Sort by order if available
                displayed.sort((a, b) => (a.order || 0) - (b.order || 0));
                hidden.sort((a, b) => (a.order || 0) - (b.order || 0));
                
                setDisplayedStations(displayed);
                setHiddenStations(hidden);
            } catch (err) {
                console.error('Failed to load settings', err);
                toast.error(t('settings.failedToLoad') || "Failed to load settings");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    // Drag handlers
    const handleDragStart = (e, station, sourceList) => {
        setDraggedStation({ ...station, sourceList });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', station.id);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetList) => {
        e.preventDefault();
        if (!draggedStation) return;
        if (draggedStation.sourceList === targetList) return; // Same list drop not handled for reordering yet
        
        moveStation(draggedStation.id, targetList);
        setDraggedStation(null);
    };

    // Click handlers for Mobile
    const moveStation = (stationId, targetList) => {
        let stationToMove = null;
        
        if (targetList === 'displayed') {
            stationToMove = hiddenStations.find(s => s.id === stationId);
            if (stationToMove) {
                setHiddenStations(prev => prev.filter(s => s.id !== stationId));
                setDisplayedStations(prev => [...prev, stationToMove]);
                setHasChanges(true);
            }
        } else {
            stationToMove = displayedStations.find(s => s.id === stationId);
            if (stationToMove) {
                setDisplayedStations(prev => prev.filter(s => s.id !== stationId));
                setHiddenStations(prev => [...prev, stationToMove]);
                setHasChanges(true);
            }
        }
    };

    // Save changes to backend
    const saveChanges = async () => {
        setSaving(true);
        try {
            const updatedSettings = { ...settings };
            
            displayedStations.forEach((s, index) => {
                if (updatedSettings.stations[s.id]) {
                    updatedSettings.stations[s.id].isVisible = true;
                    updatedSettings.stations[s.id].order = index;
                }
            });
            
            hiddenStations.forEach((s, index) => {
                if (updatedSettings.stations[s.id]) {
                    updatedSettings.stations[s.id].isVisible = false;
                    updatedSettings.stations[s.id].order = index + displayedStations.length;
                }
            });

            const res = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(updatedSettings)
            });
            
            if (!res.ok) throw new Error(`Failed to save: ${res.statusText}`);
            
            setSettings(updatedSettings);
            setHasChanges(false);
            toast.success(t('settings.settingsSaved') || "Saved successfully");
        } catch (err) {
            toast.error(t('settings.failedToSave') || "Failed to save");
            console.error(err);
        }
        setSaving(false);
    };

    if (status === 'loading' || loading) return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="mb-20 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-blue-500 pl-4">
                        {t('displayStations.title')}
                    </h1>
                </div>
                
                <button
                    onClick={saveChanges}
                    disabled={!hasChanges || saving}
                    className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${
                        hasChanges && !saving
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    }`}
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    {saving ? t('common.saving') : t('common.save')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Displayed Stations Column */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white bg-blue-500/20 border border-blue-500/30 p-3 rounded-xl">
                        <Eye className="text-blue-400" />
                        {t('displayStations.displayed')} ({displayedStations.length})
                    </h2>
                    
                    <div 
                        className="bg-gray-900 border border-gray-700 rounded-xl p-4 min-h-[300px] flex flex-col gap-3"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'displayed')}
                    >
                        {displayedStations.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono border-2 border-dashed border-gray-800 rounded-lg p-6 text-center whitespace-pre-line">
                                {t('displayStations.noDisplayed')}
                            </div>
                        ) : (
                            displayedStations.map(station => (
                                <div 
                                    key={station.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, station, 'displayed')}
                                    className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-center justify-between cursor-move hover:border-blue-500 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="text-gray-500 group-hover:text-gray-300" size={18} />
                                        <div>
                                            <h3 className="font-bold text-white text-sm">{station.name || station.id}</h3>
                                            <p className="text-xs text-gray-400 font-mono">{station.id}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => moveStation(station.id, 'hidden')}
                                        className="p-2 bg-gray-900 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 md:hidden"
                                    >
                                        <EyeOff size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Hidden Stations Column */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white bg-gray-800 border border-gray-700 p-3 rounded-xl">
                        <EyeOff className="text-gray-400" />
                        {t('displayStations.hidden')} ({hiddenStations.length})
                    </h2>
                    
                    <div 
                        className="bg-gray-900 border border-gray-700 rounded-xl p-4 min-h-[300px] flex flex-col gap-3"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'hidden')}
                    >
                        {hiddenStations.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono border-2 border-dashed border-gray-800 rounded-lg p-6 text-center whitespace-pre-line">
                                {t('displayStations.noHidden')}
                            </div>
                        ) : (
                            hiddenStations.map(station => (
                                <div 
                                    key={station.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, station, 'hidden')}
                                    className="bg-gray-800/50 border border-gray-700/50 p-4 rounded-lg flex items-center justify-between cursor-move hover:border-gray-500 transition-colors group opacity-75 hover:opacity-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="text-gray-600 group-hover:text-gray-400" size={18} />
                                        <div>
                                            <h3 className="font-bold text-gray-300 text-sm">{station.name || station.id}</h3>
                                            <p className="text-xs text-gray-500 font-mono">{station.id}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => moveStation(station.id, 'displayed')}
                                        className="p-2 bg-gray-900 rounded hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 md:hidden"
                                    >
                                        <Eye size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
