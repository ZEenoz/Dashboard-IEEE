"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import {
    Sliders,
    Plus,
    X,
    Save,
    Trash2,
    GripVertical,
    Droplets,
    ArrowUp,
    ArrowDown,
    RotateCcw,
    ChevronRight,
    AlertTriangle,
    Check,
    Tag
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function OffsetPresetsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();
    const { stations: liveStations } = useSocket();

    const [settings, setSettings] = useState(null);
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draggedStation, setDraggedStation] = useState(null);
    const [dragOverPreset, setDragOverPreset] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetOffset, setNewPresetOffset] = useState('0.00');
    const [hasChanges, setHasChanges] = useState(false);

    // Route Protection — admin only
    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
        if (session && session.user?.role !== 'admin') router.replace('/');
    }, [session, status, router]);

    // Fetch settings & presets
    useEffect(() => {
        const fetchOpts = {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'ngrok-skip-browser-warning': 'true'
            }
        };

        const fetchData = async () => {
            try {
                const [settingsRes, presetsRes] = await Promise.all([
                    fetch(`${API_URL}/settings`, fetchOpts),
                    fetch(`${API_URL}/offset-presets`, fetchOpts)
                ]);

                const settingsData = await settingsRes.json();
                let presetsData = [];

                try {
                    presetsData = await presetsRes.json();
                    // Ensure presetsData is an array
                    if (!Array.isArray(presetsData)) {
                        console.warn('Presets data is not an array, defaulting to []', presetsData);
                        presetsData = [];
                    }
                } catch (e) {
                    console.warn('Failed to parse presets JSON', e);
                    presetsData = [];
                }

                setSettings(settingsData);
                setPresets(presetsData);
            } catch (err) {
                console.error('Failed to load data', err);
                toast.error(t('settings.failedToLoad'));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // All configured stations
    const allStations = settings?.stations || {};

    // Stations already assigned to a preset
    const assignedStationIds = new Set(
        Array.isArray(presets) ? presets.flatMap(p => p?.stations || []) : []
    );

    // Available stations (not assigned to any preset)
    const availableStations = Object.entries(allStations).filter(
        ([id]) => !assignedStationIds.has(id)
    );

    // Drag handlers
    const handleDragStart = (e, stationId) => {
        setDraggedStation(stationId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', stationId);
    };

    const handleDragOver = (e, presetIdx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverPreset(presetIdx);
    };

    const handleDragLeave = () => {
        setDragOverPreset(null);
    };

    const handleDrop = (e, presetIdx) => {
        e.preventDefault();
        const stationId = e.dataTransfer.getData('text/plain') || draggedStation;
        if (!stationId) return;

        setPresets(prev => {
            const updated = prev.map((p, i) => {
                // Remove from other presets first
                const filtered = (p.stations || []).filter(s => s !== stationId);
                if (i === presetIdx) {
                    return { ...p, stations: [...filtered, stationId] };
                }
                return { ...p, stations: filtered };
            });
            return updated;
        });

        setDraggedStation(null);
        setDragOverPreset(null);
        setHasChanges(true);
    };

    const removeStationFromPreset = (presetIdx, stationId) => {
        setPresets(prev => prev.map((p, i) => {
            if (i !== presetIdx) return p;
            return { ...p, stations: (p.stations || []).filter(s => s !== stationId) };
        }));
        setHasChanges(true);
    };

    const deletePreset = (presetIdx) => {
        setPresets(prev => prev.filter((_, i) => i !== presetIdx));
        setHasChanges(true);
    };

    const createPreset = () => {
        if (!newPresetName.trim()) {
            toast.error(t('offsetPresets.presetName') + ' ' + t('common.error'));
            return;
        }
        const offset = parseFloat(newPresetOffset) || 0;
        setPresets(prev => [...prev, {
            name: newPresetName.trim(),
            offset: offset,
            stations: []
        }]);
        setNewPresetName('');
        setNewPresetOffset('0.00');
        setShowCreateForm(false);
        setHasChanges(true);
    };

    const updatePresetOffset = (idx, value) => {
        setPresets(prev => prev.map((p, i) =>
            i === idx ? { ...p, offset: parseFloat(value) || 0 } : p
        ));
        setHasChanges(true);
    };

    const updatePresetName = (idx, value) => {
        setPresets(prev => prev.map((p, i) =>
            i === idx ? { ...p, name: value } : p
        ));
        setHasChanges(true);
    };

    // Apply presets → save offset values to each station in settings
    const savePresets = async () => {
        setSaving(true);
        try {
            // 1. Save presets config
            const resPresets = await fetch(`${API_URL}/offset-presets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(presets)
            });
            if (!resPresets.ok) throw new Error(`Failed to save presets: ${resPresets.statusText}`);

            // 2. Apply offset values to station settings
            const updatedSettings = { ...settings };
            presets.forEach(preset => {
                (preset.stations || []).forEach(stationId => {
                    if (updatedSettings.stations?.[stationId]) {
                        updatedSettings.stations[stationId].offset = parseFloat(preset.offset) || 0;
                    }
                });
            });

            const resSettings = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(updatedSettings)
            });
            if (!resSettings.ok) throw new Error(`Failed to save settings: ${resSettings.statusText}`);

            setSettings(updatedSettings);
            setHasChanges(false);
            toast.success(t('settings.settingsSaved'));
        } catch (err) {
            toast.error(t('settings.failedToSave') + ': ' + err.message);
        }
        setSaving(false);
    };

    const clearAll = () => {
        if (!confirm(t('offsetPresets.clearAllConfirm'))) return;
        setPresets([]);
        setHasChanges(true);
    };

    // Loading / auth guard
    if (status === 'loading' || loading) return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (session?.user?.role !== 'admin') return null;

    return (
        <div className="p-4 md:p-8 text-white min-h-screen lg:h-[calc(100vh-64px)] lg:overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 px-1">
                <div className="flex flex-col">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-blue-500 pl-4">
                            {t('offsetPresets.title')}
                        </h1>
                    </div>
                    <p className="text-gray-400 text-sm mt-1 max-w-lg">
                        {t('offsetPresets.subtitle')}
                    </p>
                </div>
                {hasChanges && (
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold animate-pulse bg-amber-400/10 px-4 py-2 rounded-lg border border-amber-400/20">
                        <AlertTriangle size={16} />
                        {t('offsetPresets.unsavedChanges')}
                    </div>
                )}
            </div>

            {/* Main 2-column layout */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start flex-1 min-h-0">

                {/* ─── Left: Available Stations ─── */}
                <div className="w-full lg:w-72 flex-shrink-0 lg:h-full flex flex-col">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex-shrink-0">
                        {t('offsetPresets.availableStations')}
                    </div>

                    <div className="space-y-2 overflow-y-auto pr-1 pb-4 flex-1">
                        {availableStations.length === 0 && (
                            <div className="text-center py-12 text-gray-600 text-xs">
                                {t('offsetPresets.allAssigned')}
                            </div>
                        )}
                        {availableStations.map(([id, config]) => {
                            const live = liveStations[id];
                            return (
                                <div
                                    key={id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, id)}
                                    className={`
                                        group relative cursor-grab active:cursor-grabbing
                                        rounded-lg overflow-hidden
                                        border border-gray-700/60 hover:border-gray-500
                                        transition-all duration-150
                                        ${draggedStation === id ? 'opacity-40 scale-95' : ''}
                                    `}
                                >
                                    {/* Station image background */}
                                    {config.image && (
                                        <div
                                            className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity"
                                            style={{
                                                backgroundImage: `url(${config.image})`,
                                                backgroundPosition: config.imagePosition
                                                    ? `${config.imagePosition.x}% ${config.imagePosition.y}%`
                                                    : 'center'
                                            }}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/95 via-gray-900/70 to-gray-900/40" />

                                    <div className="relative px-3 py-3">
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] font-mono text-gray-400 truncate">{id}</div>
                                                <div className="text-sm font-medium text-gray-200 truncate mt-0.5">
                                                    {config.name || id}
                                                </div>
                                            </div>
                                            <div className="text-right ml-2 flex-shrink-0">
                                                <div className="text-[9px] text-gray-500">{t('offsetPresets.level')}</div>
                                                <div className="text-sm font-mono font-semibold text-blue-300">
                                                    {(Number(live?.waterLevel) || 0).toFixed(2)} {t('common.m')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Current offset indicator */}
                                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500">
                                            <Sliders size={9} />
                                            <span>{t('settings.offset')}: {config.offset ?? 0}{t('common.m')}</span>
                                            <span className="ml-auto">
                                                {config.type === 'Float'
                                                    ? <span className="text-blue-400">Float</span>
                                                    : <span className="text-purple-400">Static</span>
                                                }
                                            </span>
                                        </div>

                                        {/* 📱 Mobile Transfer Controls */}
                                        <div className="mt-3 pt-3 border-t border-gray-700/50 flex lg:hidden gap-2">
                                            <select 
                                                className="flex-1 bg-gray-800 text-[10px] px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                                                onChange={(e) => {
                                                    const pIdx = parseInt(e.target.value);
                                                    if (!isNaN(pIdx)) handleDrop({ preventDefault: () => {}, dataTransfer: { getData: () => id } }, pIdx);
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="">{t('offsetPresets.moveToPreset') || 'Assign to Preset...'}</option>
                                                {presets.map((p, idx) => (
                                                    <option key={idx} value={idx}>{p.name} ({p.offset}m)</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Drag grip indicator */}
                                    <div className="absolute top-1/2 -translate-y-1/2 -left-0 w-1 h-8 bg-gray-600 rounded-r opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── Right: Preset Buckets ─── */}
                <div className="flex-1 min-w-0 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                            {t('offsetPresets.offsetPresets')}
                        </div>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-md border border-dashed border-gray-600 hover:border-gray-400 transition-colors"
                        >
                            <Plus size={13} />
                            {t('offsetPresets.createPreset')}
                        </button>
                    </div>

                    <div className="overflow-y-auto pr-2 pb-4 flex-1">

                        {/* Create form (inline, not modal) */}
                        {showCreateForm && (
                            <div className="mb-6 p-5 rounded-lg bg-gray-800/60 border border-gray-700/80">
                                <div className="text-sm font-medium text-gray-300 mb-3">{t('offsetPresets.newPreset')}</div>
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">{t('offsetPresets.presetName')}</label>
                                        <input
                                            type="text"
                                            value={newPresetName}
                                            onChange={e => setNewPresetName(e.target.value)}
                                            placeholder="e.g. High Adjust, Decrease..."
                                            autoFocus
                                            className="w-full bg-gray-900/80 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500/60 focus:outline-none"
                                        />
                                    </div>
                                    <div className="w-36">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">{t('offsetPresets.presetOffset')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newPresetOffset}
                                            onChange={e => setNewPresetOffset(e.target.value)}
                                            className="w-full bg-gray-900/80 border border-gray-700 rounded-md px-3 py-2 text-sm text-white font-mono focus:border-blue-500/60 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={createPreset}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                        {t('common.add')}
                                    </button>
                                    <button
                                        onClick={() => setShowCreateForm(false)}
                                        className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Preset grid */}
                        {presets.length === 0 && !showCreateForm && (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                                    <Sliders size={24} className="text-gray-600" />
                                </div>
                                <p className="text-gray-500 text-sm mb-1">{t('offsetPresets.noPresets')}</p>
                                <p className="text-gray-600 text-xs mb-6 max-w-xs">
                                    {t('offsetPresets.noPresetsDesc')}
                                </p>
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 px-4 py-2 rounded-md border border-blue-500/30 hover:border-blue-400/50 transition-colors"
                                >
                                    <Plus size={13} />
                                    {t('offsetPresets.createFirst')}
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                            {presets.map((preset, idx) => {
                                const isPositive = preset.offset > 0;
                                const isNegative = preset.offset < 0;
                                const isZero = preset.offset === 0;
                                const isDragOver = dragOverPreset === idx;

                                const accentColor = isPositive
                                    ? 'text-emerald-400'
                                    : isNegative
                                        ? 'text-red-400'
                                        : 'text-gray-400';

                                const borderAccent = isDragOver
                                    ? 'border-blue-500/60 bg-blue-500/5'
                                    : 'border-gray-700/50 hover:border-gray-600';

                                return (
                                    <div
                                        key={idx}
                                        className={`
                                        rounded-lg border p-5 transition-all duration-150
                                        ${borderAccent}
                                    `}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, idx)}
                                    >
                                        {/* Preset header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-baseline gap-3">
                                                <span className={`text-2xl font-mono font-bold tracking-tight ${accentColor}`}>
                                                    {isPositive ? '+' : ''}{(Number(preset?.offset) || 0).toFixed(2)}{t('common.m')}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={preset?.name || ''}
                                                    onChange={e => updatePresetName(idx, e.target.value)}
                                                    className="text-[13px] uppercase tracking-widest bg-transparent border-none text-blue-500 focus:text-gray-300"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={preset?.offset ?? 0}
                                                    onChange={e => updatePresetOffset(idx, e.target.value)}
                                                    className="w-20 text-right text-xs font-mono bg-gray-800/60 border border-gray-700/50 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-gray-500"
                                                />
                                                <button
                                                    onClick={() => deletePreset(idx)}
                                                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded hover:bg-red-400/10"
                                                    title="Delete preset"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Assigned stations */}
                                        <div className="space-y-1.5 min-h-[60px]">
                                            {(preset.stations || []).map(stationId => {
                                                const cfg = allStations[stationId];
                                                return (
                                                    <div
                                                        key={stationId}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, stationId)}
                                                        className="group flex items-center gap-2.5 rounded-md bg-gray-800/50 hover:bg-gray-800/80 px-3 py-2 cursor-grab active:cursor-grabbing transition-colors"
                                                    >
                                                        {cfg?.image && (
                                                            <div
                                                                className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0 border border-gray-700/60"
                                                                style={{
                                                                    backgroundImage: `url(${cfg.image})`,
                                                                    backgroundPosition: cfg?.imagePosition
                                                                        ? `${cfg.imagePosition.x}% ${cfg.imagePosition.y}%`
                                                                        : 'center'
                                                                }}
                                                            />
                                                        )}
                                                        {!cfg?.image && (
                                                            <div className="w-8 h-8 rounded bg-gray-700/40 flex items-center justify-center flex-shrink-0">
                                                                <Droplets size={12} className="text-gray-500" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs font-mono text-gray-400 truncate">{stationId}</div>
                                                            <div className="text-[11px] text-gray-500 truncate">{cfg?.name || stationId}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeStationFromPreset(idx, stationId)}
                                                            className="p-1 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })}

                                            {/* Drop zone */}
                                            <div className={`
                                            flex items-center justify-center gap-2 rounded-md border border-dashed py-3 text-xs transition-all
                                            ${isDragOver
                                                    ? 'border-blue-500/50 text-blue-400 bg-blue-500/5'
                                                    : 'border-gray-700/40 text-gray-600 hover:border-gray-600 hover:text-gray-500'
                                                }
                                        `}>
                                                <Plus size={14} />
                                                {t('offsetPresets.dropHere')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bottom action bar */}
                    {presets.length > 0 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800 flex-shrink-0">
                            <button
                                onClick={clearAll}
                                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-800/60 transition-colors"
                            >
                                <RotateCcw size={13} />
                                {t('offsetPresets.clearAll')}
                            </button>

                            <button
                                onClick={savePresets}
                                disabled={saving || !hasChanges}
                                className={`
                                    flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all
                                    ${saving || !hasChanges
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]'
                                    }
                                `}
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        {t('offsetPresets.saveApply')}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
