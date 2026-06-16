"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import {
    Save, Calculator, Activity, Droplets, ChevronRight, X, RotateCcw, AlertTriangle, Plus, Minus, X as XIcon, Divide, Baseline, Play, Trash2
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function OffsetPresetsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();
    const { stations: liveStations } = useSocket();

    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Selected station for calibration
    const [selectedStationId, setSelectedStationId] = useState(null);

    // Formula Builder State
    // e.g., [{ type: 'number', value: '1.6', label: 'Bank' }, { type: 'operator', value: '-' }, { type: 'variable', value: 'RAW', label: 'Raw Level' }]
    const [formula, setFormula] = useState([]);
    const [draggedIndex, setDraggedIndex] = useState(null);

    // Custom Variable Modal State
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customValue, setCustomValue] = useState('');
    const [editingCustomVarId, setEditingCustomVarId] = useState(null);

    // Route Protection
    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
        if (session && session.user?.role !== 'admin') router.replace('/');
    }, [session, status, router]);

    // Fetch settings
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
                const res = await fetch(`${API_URL}/settings`, fetchOpts);
                const data = await res.json();
                setSettings(data);
            } catch (err) {
                console.error('Failed to load settings', err);
                toast.error(t('settings.failedToLoad'));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Get all visible stations
    const allStations = Object.fromEntries(
        Object.entries(settings?.stations || {}).filter(([, cfg]) => cfg.isVisible !== false)
    );

    // Live data for selected station
    const selectedLive = selectedStationId ? liveStations[selectedStationId] : null;
    const selectedConfig = selectedStationId ? allStations[selectedStationId] : null;
    const rawLevel = selectedLive
        ? (selectedLive.rawLevel !== undefined ? Number(selectedLive.rawLevel) : Number(selectedLive.waterLevel) || 0)
        : 0;
    const currentOffset = selectedConfig?.offset || 0;

    // Evaluate formula
    const evaluation = useMemo(() => {
        if (formula.length === 0) return { result: null, error: null };

        let expression = '';
        let visualExpression = [];

        for (const block of formula) {
            if (block.type === 'number') {
                expression += block.value + ' ';
                visualExpression.push({ text: block.value, subtext: block.label, color: 'text-teal-400' });
            } else if (block.type === 'customVar') {
                const cv = (settings?.customVariables || []).find(v => v.id === block.id);
                const val = cv ? cv.value : 0;
                expression += val + ' ';
                visualExpression.push({ text: val, subtext: block.label || (cv ? cv.name : ''), color: 'text-emerald-400' });
            } else if (block.type === 'variable' && block.value === 'RAW') {
                expression += rawLevel + ' ';
                visualExpression.push({ text: rawLevel.toFixed(3), subtext: block.label, color: 'text-blue-400' });
            } else if (block.type === 'operator') {
                expression += block.value + ' ';
                visualExpression.push({ text: block.value, subtext: '', color: 'text-amber-500' });
            }
        }

        try {
            // Replace visual operators with JS operators
            const evalExpr = expression.replace(/×/g, '*').replace(/÷/g, '/');
            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + evalExpr)();
            if (!isFinite(result) || isNaN(result)) {
                return { result: null, error: 'Invalid calculation', visual: visualExpression };
            }
            return { result: Number(result), error: null, visual: visualExpression };
        } catch (e) {
            return { result: null, error: 'Incomplete formula', visual: visualExpression };
        }
    }, [formula, rawLevel]);

    const targetLevel = evaluation.result;
    const requiredOffset = targetLevel !== null ? (targetLevel - rawLevel) : null;
    const hasChanges = requiredOffset !== null && Math.abs(requiredOffset - currentOffset) > 0.001;

    // --- Actions ---

    const addBlock = (block) => {
        setFormula(prev => [...prev, block]);
    };

    const handleSaveCustomVar = async () => {
        const num = parseFloat(customValue);
        if (isNaN(num) || !customName.trim()) {
            toast.error('Please enter a valid name and number');
            return;
        }

        const newVar = { id: editingCustomVarId || 'var_' + Date.now(), name: customName.trim(), value: num };

        let newVars = [...(settings?.customVariables || [])];
        if (editingCustomVarId) {
            newVars = newVars.map(v => v.id === editingCustomVarId ? newVar : v);
        } else {
            newVars.push(newVar);
        }

        const updatedSettings = { ...settings, customVariables: newVars };

        try {
            const res = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(updatedSettings)
            });
            if (!res.ok) throw new Error('Failed to save custom variable');
            setSettings(updatedSettings);
            toast.success(editingCustomVarId ? 'Updated custom variable' : 'Added custom variable');
        } catch (e) {
            toast.error('Failed to save custom variable');
        }

        setCustomValue('');
        setCustomName('');
        setEditingCustomVarId(null);
        setShowCustomModal(false);
    };

    const handleDeleteCustomVar = async (id) => {
        if (!confirm('Delete this custom variable?')) return;
        const newVars = (settings?.customVariables || []).filter(v => v.id !== id);
        const updatedSettings = { ...settings, customVariables: newVars };
        try {
            await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': 'IEEE_SECURE_API_KEY_2025' },
                body: JSON.stringify(updatedSettings)
            });
            setSettings(updatedSettings);
            toast.success('Deleted custom variable');
            setShowCustomModal(false);
            setEditingCustomVarId(null);
        } catch (e) {
            toast.error('Failed to delete custom variable');
        }
    };

    const openEditCustomModal = (cv) => {
        setEditingCustomVarId(cv.id);
        setCustomName(cv.name);
        setCustomValue(cv.value.toString());
        setShowCustomModal(true);
    };

    const openAddCustomModal = () => {
        setEditingCustomVarId(null);
        setCustomName('');
        setCustomValue('');
        setShowCustomModal(true);
    };

    const removeBlock = (index) => {
        setFormula(prev => prev.filter((_, i) => i !== index));
    };

    const clearFormula = () => {
        setFormula([]);
    };

    const loadPresetBankMinusRaw = () => {
        setFormula([
            { type: 'number', value: '0', label: 'Bank Level' },
            { type: 'operator', value: '-' },
            { type: 'variable', value: 'RAW', label: 'Raw Level' }
        ]);
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/html', e.target.parentNode);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault(); // Necessary to allow drop
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        setFormula(prev => {
            const newFormula = [...prev];
            const [movedItem] = newFormula.splice(draggedIndex, 1);
            newFormula.splice(targetIndex, 0, movedItem);
            return newFormula;
        });
        setDraggedIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const saveCalibration = async () => {
        if (requiredOffset === null) return;
        setSaving(true);
        try {
            const updatedSettings = { ...settings };
            if (!updatedSettings.stations) updatedSettings.stations = {};
            if (!updatedSettings.stations[selectedStationId]) updatedSettings.stations[selectedStationId] = {};

            // Round to 3 decimal places for neatness
            updatedSettings.stations[selectedStationId].offset = Number(requiredOffset.toFixed(3));
            updatedSettings.stations[selectedStationId].formula = formula;

            const res = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(updatedSettings)
            });

            if (!res.ok) throw new Error('Failed to save');

            setSettings(updatedSettings);
            toast.success('Calibration offset applied successfully!');
        } catch (err) {
            toast.error(t('settings.failedToSave') + ': ' + err.message);
        }
        setSaving(false);
    };

    const resetCalibration = async () => {
        if (!selectedStationId) return;
        if (!confirm('Are you sure you want to completely remove the calibration offset and formula for this station?')) return;
        setResetting(true);
        try {
            const updatedSettings = { ...settings };
            if (updatedSettings.stations && updatedSettings.stations[selectedStationId]) {
                delete updatedSettings.stations[selectedStationId].offset;
                delete updatedSettings.stations[selectedStationId].formula;
            }

            const res = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(updatedSettings)
            });

            if (!res.ok) throw new Error('Failed to reset');

            setSettings(updatedSettings);
            clearFormula();
            toast.success('Calibration offset removed successfully!');
        } catch (err) {
            toast.error('Failed to reset: ' + err.message);
        }
        setResetting(false);
    };

    if (status === 'loading' || loading) return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (session?.user?.role !== 'admin') return null;

    return (
        <div className="p-4 md:p-8 text-white min-h-screen lg:h-[calc(100vh-64px)] lg:overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 px-1">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-emerald-500 pl-4">
                        Offset Calibration
                    </h1>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

                {/* Left: Station List */}
                <div className="w-full lg:w-80 flex-shrink-0 lg:h-full flex flex-col bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-gray-800 bg-gray-900">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={14} className="text-blue-500" />
                            Select Station
                        </h2>
                    </div>
                    <div className="overflow-y-auto flex-1 p-3 space-y-2">
                        {Object.entries(allStations).map(([id, config]) => {
                            const isSelected = selectedStationId === id;
                            const live = liveStations[id];
                            return (
                                <button
                                    key={id}
                                    onClick={() => {
                                        setSelectedStationId(id);
                                        const savedFormula = settings?.stations?.[id]?.formula;
                                        if (savedFormula && Array.isArray(savedFormula)) {
                                            setFormula(savedFormula);
                                        } else {
                                            clearFormula();
                                        }
                                    }}
                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${isSelected
                                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                        : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                                        <Droplets size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] font-mono text-gray-500 truncate">{id}</div>
                                        <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                            {config.name || id}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className={isSelected ? 'text-emerald-500' : 'text-gray-600'} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Formula Builder Workspace */}
                <div className="flex-1 min-w-0 h-full flex flex-col gap-6">
                    {!selectedStationId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-900/30 border border-gray-800/50 rounded-2xl border-dashed">
                            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
                                <Calculator size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-400 mb-2">Formula Builder</h3>
                            <p className="text-sm text-gray-600 max-w-sm">
                                Select a station from the list to start building a custom calibration offset using visual math blocks.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Top Stats Strip */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 relative overflow-hidden">
                                    <div className="absolute -right-4 -bottom-4 opacity-5"><Droplets size={80} /></div>
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Raw Level</div>
                                    <div className="text-3xl font-bold font-mono text-blue-400">{rawLevel.toFixed(3)}<span className="text-sm text-gray-500 ml-1">m</span></div>
                                </div>
                                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Current Offset</div>
                                    <div className="text-3xl font-bold font-mono text-purple-400">{currentOffset > 0 ? '+' : ''}{currentOffset.toFixed(3)}<span className="text-sm text-gray-500 ml-1">m</span></div>
                                </div>
                                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Current Display</div>
                                    <div className="text-3xl font-bold font-mono text-white">{(rawLevel + currentOffset).toFixed(3)}<span className="text-sm text-gray-500 ml-1">m</span></div>
                                </div>
                            </div>

                            {/* Canvas Area */}
                            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden min-h-[400px]">
                                {/* Toolbar / Toolbox */}
                                <div className="p-4 border-b border-gray-800 bg-[#111827] flex flex-wrap gap-6 shrink-0">

                                    {/* Variables */}
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Variables</div>
                                        <div className="flex gap-2">
                                            <button onClick={() => addBlock({ type: 'variable', value: 'RAW', label: 'Raw Level' })} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border border-blue-500/30 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors">
                                                <Baseline size={14} /> Raw Level
                                            </button>
                                        </div>
                                    </div>

                                    {/* Operators */}
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Operators</div>
                                        <div className="flex gap-2">
                                            {['+', '-', '×', '÷', '(', ')'].map(op => (
                                                <button key={op} onClick={() => addBlock({ type: 'operator', value: op })} className="w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-lg font-bold transition-colors">
                                                    {op}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Numbers */}
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Global Custom Variables</div>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {(settings?.customVariables || []).map(cv => (
                                                <div key={cv.id} className="flex items-center bg-teal-900/30 border border-teal-500/30 rounded-lg overflow-hidden">
                                                    <button onClick={() => addBlock({ type: 'customVar', id: cv.id, label: cv.name })} className="px-3 py-1.5 text-sm font-bold text-teal-400 hover:bg-teal-500/20 transition-colors">
                                                        {cv.name}: {cv.value}
                                                    </button>
                                                    <button onClick={() => openEditCustomModal(cv)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border-l border-teal-500/30">
                                                        <Activity size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={openAddCustomModal} className="bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors">
                                                <Plus size={14} /> Add New
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Formula Display Canvas */}
                                <div className="flex-1 p-6 flex flex-col bg-[#0B1121] overflow-y-auto">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Formula Canvas</h3>
                                        <button onClick={clearFormula} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                                            <RotateCcw size={12} /> Clear Canvas
                                        </button>
                                    </div>

                                    {formula.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl">
                                            <span className="text-gray-600 text-sm font-medium">Click buttons above to add blocks here</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center content-start gap-2 flex-1 p-4 bg-gray-900/50 rounded-xl border border-gray-800/80 shadow-inner">
                                            {formula.map((block, i) => (
                                                <div
                                                    key={i}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, i)}
                                                    onDragOver={(e) => handleDragOver(e, i)}
                                                    onDrop={(e) => handleDrop(e, i)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`group relative flex items-stretch shadow-md rounded-lg overflow-hidden animate-in zoom-in-95 duration-200 cursor-grab active:cursor-grabbing hover:ring-2 ring-emerald-500/50 ${draggedIndex === i ? 'opacity-40 scale-95 ring-2 ring-emerald-500' : ''}`}
                                                >
                                                    <div className={`px-4 py-2.5 flex items-center justify-center font-bold font-mono text-lg
                                                        ${block.type === 'variable' ? 'bg-blue-600 text-white' :
                                                            block.type === 'operator' ? 'bg-amber-500 text-gray-900 px-3' :
                                                                'bg-teal-600 text-white'}
                                                    `}>
                                                        {block.type !== 'operator' && (
                                                            <span className="mr-2 text-[10px] uppercase tracking-wider opacity-70 font-sans pointer-events-none">{block.label}</span>
                                                        )}
                                                        <span className="pointer-events-none">{block.value}</span>
                                                    </div>
                                                    <button onClick={() => removeBlock(i)} className="bg-red-500 hover:bg-red-600 text-white px-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity w-0 group-hover:w-8 shrink-0">
                                                        <XIcon size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Result & Save Footer */}
                                <div className="p-5 border-t border-gray-800 bg-[#111827] shrink-0">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                        {/* Result Engine */}
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center shadow-inner shrink-0">
                                                <Play size={20} className={targetLevel !== null ? 'text-emerald-400' : 'text-gray-600'} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Formula Result</div>
                                                {evaluation.error ? (
                                                    <div className="text-red-400 text-sm font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> {evaluation.error}</div>
                                                ) : (
                                                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                                                        {evaluation.visual?.map((item, idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                {item.subtext && <span className="text-[9px] text-gray-500 uppercase tracking-wider">{item.subtext}</span>}
                                                                <span className={`text-xl font-bold font-mono ${item.color}`}>{item.text}</span>
                                                            </div>
                                                        ))}
                                                        {targetLevel !== null && (
                                                            <>
                                                                <span className="text-xl font-bold font-mono text-gray-500 mx-1">=</span>
                                                                <span className="text-2xl font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2 rounded-md">{targetLevel.toFixed(3)}<span className="text-sm text-emerald-500/60 ml-1">m</span></span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Implied Offset (Quietly shown) */}
                                            {requiredOffset !== null && (
                                                <>
                                                    <div className="hidden lg:block h-10 w-px bg-gray-700 mx-4"></div>
                                                    <div className="hidden lg:block">
                                                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">System Offset</div>
                                                        <div className="text-sm text-gray-400 font-mono bg-gray-800/50 px-2 py-1 rounded">
                                                            {requiredOffset > 0 ? '+' : ''}{requiredOffset.toFixed(3)}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Save & Reset Buttons */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            {settings?.stations?.[selectedStationId]?.offset !== undefined && (
                                                <button
                                                    onClick={resetCalibration}
                                                    disabled={resetting || saving}
                                                    className={`
                                                        flex items-center justify-center p-3.5 rounded-xl transition-all shadow-md
                                                        ${resetting || saving
                                                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                            : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40'
                                                        }
                                                    `}
                                                    title="Remove Calibration entirely"
                                                >
                                                    {resetting ? <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <Trash2 size={20} />}
                                                </button>
                                            )}
                                            <button
                                                onClick={saveCalibration}
                                                disabled={saving || resetting || !hasChanges || requiredOffset === null}
                                                className={`
                                                    flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg
                                                    ${saving || resetting || !hasChanges || requiredOffset === null
                                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none'
                                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 hover:-translate-y-0.5'
                                                    }
                                                `}
                                            >
                                                {saving ? (
                                                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                                                ) : (
                                                    <><Save size={18} /> Apply Calibration</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Custom Variable Modal */}
            {showCustomModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-teal-400">
                            <Activity size={20} />
                            {editingCustomVarId ? 'Edit Global Variable' : 'Add Global Variable'}
                        </h3>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Variable Name</label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="e.g. Bank Level"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Value (m)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={customValue}
                                    onChange={(e) => setCustomValue(e.target.value)}
                                    placeholder="e.g. 1.50"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-teal-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between gap-2">
                            {editingCustomVarId ? (
                                <button onClick={() => handleDeleteCustomVar(editingCustomVarId)} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors font-bold text-sm">Delete</button>
                            ) : <div></div>}
                            <div className="flex gap-2">
                                <button onClick={() => setShowCustomModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-bold">Cancel</button>
                                <button onClick={handleSaveCustomVar} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm font-bold">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
