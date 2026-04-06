"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSocket } from "@/contexts/SocketContext";
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import StationCard from "@/components/StationCard";
// import MainChart from "@/components/MainChart";
import { Activity, Droplets, Gauge, Wifi, Search, ArrowRight, Layers, Globe, MapPin, Database, ShieldCheck } from "lucide-react";
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Utility: Get Station Card Colors Based on Status ───────────────────────
const getStatusTheme = (st, defaultType) => {
  if (st.alertLevel === 'dangerous') {
    return {
      bg: 'bg-red-500/10 hover:bg-red-500/20', border: 'border-red-500/30',
      text: 'text-red-400', iconBg: 'bg-red-500/15', accent: 'text-red-300'
    };
  }
  if (st.alertLevel === 'warning') {
    return {
      bg: 'bg-orange-500/10 hover:bg-orange-500/20', border: 'border-orange-500/30',
      text: 'text-orange-400', iconBg: 'bg-orange-500/15', accent: 'text-orange-300'
    };
  }
  if (defaultType === 'float') {
    return {
      bg: 'bg-blue-900/10 hover:bg-blue-900/20', border: 'border-blue-500/20',
      text: 'text-blue-400', iconBg: 'bg-blue-500/15', accent: 'text-blue-300'
    };
  }
  return {
    bg: 'bg-purple-900/10 hover:bg-purple-900/20', border: 'border-purple-500/20',
    text: 'text-purple-400', iconBg: 'bg-purple-500/15', accent: 'text-purple-300'
  };
};

// ─── Optimized Sidebar Item Component ──────────────────────────────────────
const SidebarStationItem = React.memo(({ st, type, onFly, onDetails }) => {
  const theme = getStatusTheme(st, type);
  const Icon = type === 'float' ? Droplets : Gauge;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl border transition-colors group ${theme.bg} ${theme.border}`}
    >
      <button
        onClick={() => onFly(st)}
        className="flex items-center gap-3 flex-1 text-left"
        aria-label={`Locate ${st.stationName || 'station'} on map`}
      >
        <div className={`w-10 h-10 rounded-full ${theme.iconBg} flex items-center justify-center ${theme.text} shrink-0`}>
          <Icon size={18} />
        </div>
        <div className="flex flex-col min-w-0 pr-2">
          <div className="font-bold text-sm text-gray-100 break-words leading-tight" title={st.stationName}>
            {st.stationName || st.id || 'Unknown'}
          </div>
          <div className={`text-[11px] ${theme.accent} font-medium mt-1`}>
            {st.lat?.toFixed(3)}, {st.lng?.toFixed(3)}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-gray-700/50">
        <div className="text-right flex flex-col items-end">
          <span className={`font-mono font-bold text-base ${theme.text}`}>
            {Number(st.waterLevel ?? 0).toFixed(3)}m
          </span>
          {st.isRaw && (
            <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter animate-pulse">
              Raw
            </span>
          )}
          {st.alertLevel && st.alertLevel !== 'normal' && (
            <span className={`text-[10px] uppercase font-bold tracking-wider ${theme.text} mt-0.5`}>
              {st.alertLevel}
            </span>
          )}
        </div>
        <button
          onClick={() => onDetails(st.stationId)}
          aria-label={`View details for ${st.stationName || 'station'}`}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors flex items-center justify-center border border-gray-700 shadow-sm"
          title="View Details"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
});

export default function Home() {
  const { stations, history, displayMode, setDisplayMode } = useSocket();
  const router = useRouter();
  const mapRef = useRef(null);
  const [mapStyle, setMapStyle] = useState('dark'); // 'dark' | 'satellite'
  const [settings, setSettings] = useState(null); // Settings state

  const handleToggleMode = (mode) => {
    setDisplayMode(mode);
    toast.success(`Switched to ${mode.toUpperCase()} view`);
  };

  // Fetch Settings (to get images/names)
  useEffect(() => {
    fetch(`${API_URL}/settings`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json'
      }
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

  // Map State
  const [viewState, setViewState] = useState({
    longitude: 100.5018,
    latitude: 13.7563,
    zoom: 12
  });

  const flyToStation = React.useCallback((station) => {
    if (!station.lat || !station.lng) return;
    setViewState({
      longitude: Number(station.lng),
      latitude: Number(station.lat),
      zoom: 15,
      transitionDuration: 1000
    });
  }, []);

  const handleGoToDetails = React.useCallback((id) => {
    router.push(`/parameters/${id}`);
  }, [router]);

  // State for Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'float', 'static'

  // Memoize data calculations to prevent re-renders during map pan (viewState changes)
  const mapData = useMemo(() => {
    const stationList = Object.values(stations);

    // Apply Settings Overrides (Name, Image, Offset)
    const enrichedStations = stationList.map(s => {
      const config = settings?.stations?.[s.stationId];
      const offset = parseFloat(config?.offset) || 0;

      // 1. Identify Raw Value: Prefer s.rawLevel from backend (true raw).
      // If missing, calculate by subtracting offset from calibrated waterLevel.
      const calibratedValue = parseFloat(s.waterLevel) || 0;
      const rawValue = s.rawLevel !== undefined
        ? parseFloat(s.rawLevel)
        : (calibratedValue - offset);

      // 2. Determine what to display
      const displayWaterLevel = displayMode === 'raw'
        ? rawValue
        : calibratedValue;

      return {
        ...s,
        stationName: config?.name || s.stationName || s.stationId,
        imageUrl: config?.image || null,
        imagePosition: config?.imagePosition || null,
        description: config?.description || null,
        type: config?.type || null,
        offsetValue: offset,
        waterLevel: displayWaterLevel,
        originalRawLevel: rawValue,
        isRaw: displayMode === 'raw'
      };
    });

    const isFloat = (s) => {
      if (s.type?.toLowerCase() === 'float') return true;
      if (s.type?.toLowerCase() === 'static') return false;
      return s.sensorType?.toLowerCase() === 'float' || (s.stationName && s.stationName.toLowerCase().includes('float'));
    };

    const allFloatNodes = enrichedStations.filter(s => isFloat(s));
    const allStaticNodes = enrichedStations.filter(s => !isFloat(s));

    const filterNodes = (nodes) => nodes.filter(n =>
      (n.stationName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (n.stationId?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const fNodes = (filterType === 'all' || filterType === 'float') ? filterNodes(allFloatNodes) : [];
    const sNodes = (filterType === 'all' || filterType === 'static') ? filterNodes(allStaticNodes) : [];

    return { floatNodes: fNodes, staticNodes: sNodes, mapStations: [...sNodes, ...fNodes] };
  }, [stations, settings, searchQuery, filterType]);

  const { floatNodes, staticNodes, mapStations } = mapData;

  return (
    <div className="mb-20 space-y-6">

      {/* SECTION 1: Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 px-1">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-white tracking-tight border-l-4 border-blue-500 pl-4">System Overview</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-lg">Monitoring all real-time water level stations and sensor.</p>
        </div>

        {/* Display Mode Toggle */}
        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 md:mr-2">
            Data Mode
          </span>
          <div className="mode-toggle-container w-full sm:w-auto" data-mode={displayMode}>
            <div className="mode-toggle-active-bg" />
            <button
              onClick={() => handleToggleMode('calibrated')}
              className={`mode-toggle-btn flex-1 sm:flex-none ${displayMode === 'calibrated' ? 'active' : ''}`}
            >
              <ShieldCheck size={14} className="shrink-0" />
              <span>Calibrated</span>
            </button>
            <button
              onClick={() => handleToggleMode('raw')}
              className={`mode-toggle-btn flex-1 sm:flex-none ${displayMode === 'raw' ? 'active' : ''}`}
            >
              <Database size={14} className="shrink-0" />
              <span>Raw Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Station Cards (Full Width) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mapStations.map((station) => (
          <div key={station.stationId} className="h-full">
            <StationCard
              station={station}
              onClick={() => router.push(`/parameters/${station.stationId}`)}
            />
          </div>
        ))}
      </div>

      {/* SECTION 3: Map & Sidebar (Split View) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Map Section (Left - 3 Cols) */}
        <div className="lg:col-span-3">
          <div className="bg-[#1F2937] rounded-3xl border-2 border-gray-700 overflow-hidden shadow-2xl h-full">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe size={20} className="text-blue-400" />
                Geographic View
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setMapStyle('dark')}
                  className={`p-1.5 rounded-lg transition-all ${mapStyle === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'}`}
                  title="Dark Mode"
                  aria-label="Set map style to Dark Mode"
                >
                  <Layers size={18} />
                </button>
                <button
                  onClick={() => setMapStyle('satellite')}
                  className={`p-1.5 rounded-lg transition-all ${mapStyle === 'satellite' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'}`}
                  title="Satellite Mode"
                  aria-label="Set map style to Satellite Mode"
                >
                  <Globe size={18} />
                </button>
              </div>
            </div>

            <div className="h-[500px] w-full relative">
              <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapLib={maplibregl}
                mapStyle={mapStyle === 'dark'
                  ? `https://api.maptiler.com/maps/base-v4-dark/style.json?key=${MAPTILER_KEY}`
                  : `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
                }
              >
                <NavigationControl position="bottom-right" />

                {mapStations.map((st, i) => (
                  <Marker
                    key={i}
                    longitude={Number(st.lng) || 100.5}
                    latitude={Number(st.lat) || 13.75}
                    onClick={e => {
                      e.originalEvent.stopPropagation();
                      flyToStation(st);
                      router.push(`/parameters/${st.stationId}`);
                    }}
                  >
                    <div className="relative group cursor-pointer flex items-center justify-center">
                      <span className="flex h-5 w-5 relative items-center justify-center">

                        {/* Outer Ping Animation / Glow (Status Based) */}
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 
                          ${st.alertLevel === 'dangerous' ? 'bg-red-500 scale-150' :
                            st.alertLevel === 'warning' ? 'bg-orange-500 scale-125' :
                              (st.sensorType === 'Float' ? 'bg-blue-400' : 'bg-purple-400')}
                        `}></span>

                        {/* Outer Glow Shadow for Warnings/Danger */}
                        {(st.alertLevel === 'warning' || st.alertLevel === 'dangerous') && (
                          <span className={`absolute inline-flex rounded-full h-6 w-6 blur-md opacity-60
                            ${st.alertLevel === 'dangerous' ? 'bg-red-500' : 'bg-orange-500'}  
                          `}></span>
                        )}

                        {/* Inner Dot (Type Based - Always Keeps Identity) */}
                        <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white shadow-sm z-10
                          ${st.sensorType === 'Float' ? 'bg-blue-500' : 'bg-purple-500'}
                        `}></span>

                      </span>

                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-xl whitespace-nowrap z-50 pointer-events-none">
                        <div className="flex flex-col gap-0.5">
                          <div>{st.stationName}</div>
                          <div className="text-blue-400 font-mono text-[10px]">
                            {Number(st.waterLevel ?? 0).toFixed(3)}m
                            {st.isRaw && <span className="ml-1 text-[8px] text-indigo-400 opacity-80 uppercase tracking-tighter">Raw</span>}
                          </div>
                        </div>
                        {st.alertLevel && st.alertLevel !== 'normal' && (
                          <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] uppercase
                            ${st.alertLevel === 'dangerous' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`
                          }>
                            {st.alertLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </Marker>
                ))}
              </Map>
            </div>
          </div>
        </div>

        {/* Sidebar Section (Right - 1 Col) */}
        <div className="lg:col-span-1 space-y-6">

          {/* Search & Filter Widget */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} aria-hidden="true" />
              <label htmlFor="station-search" className="sr-only">Search nodes</label>
              <input
                id="station-search"
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm placeholder-gray-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('float')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterType === 'float' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >
                Float
              </button>
              <button
                onClick={() => setFilterType('static')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterType === 'static' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
              >
                Static
              </button>
            </div>
          </div>

          {/* Float Nodes List */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Float Nodes</h4>
            <div className="space-y-3">
              {floatNodes.map((st, i) => (
                <SidebarStationItem 
                  key={st.stationId || i}
                  st={st}
                  type="float"
                  onFly={flyToStation}
                  onDetails={handleGoToDetails}
                />
              ))}
            </div>
          </div>

          {/* Static Nodes List */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 mt-4 tracking-wider">Static Nodes</h4>
            <div className="space-y-3">
              {staticNodes.map((st, i) => (
                <SidebarStationItem 
                  key={st.stationId || i}
                  st={st}
                  type="static"
                  onFly={flyToStation}
                  onDetails={handleGoToDetails}
                />
              ))}
            </div>
          </div>

        </div>

      </div>
    </div >
  );
}