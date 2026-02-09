"use client";

import { useState, useRef, useEffect } from 'react';
import { useSocket } from "@/contexts/SocketContext";
import StatCard from "@/components/StatCard";
// import MainChart from "@/components/MainChart";
import { Activity, Droplets, Gauge, Wifi, Search } from "lucide-react";
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export default function Home() {
  const { stations, history } = useSocket();
  const mapRef = useRef(null);

  // Map State
  const [viewState, setViewState] = useState({
    longitude: 100.5018,
    latitude: 13.7563,
    zoom: 12
  });

  const flyToStation = (station) => {
    if (!station.lat || !station.lng) return;
    setViewState({
      longitude: Number(station.lng),
      latitude: Number(station.lat),
      zoom: 15,
      transitionDuration: 1000
    });
  };

  // Calculate Stats
  const stationList = Object.values(stations);

  // State for Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'float', 'static'

  // Base lists
  const allFloatNodes = stationList.filter(s => s.sensorType === 'Float' || s.stationName?.toLowerCase().includes('float'));
  const allStaticNodes = stationList.filter(s => s.sensorType === 'Static' || (s.sensorType !== 'Float' && !s.stationName?.toLowerCase().includes('float')));

  // Filter logic
  const filterNodes = (nodes) => nodes.filter(n =>
    (n.stationName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (n.stationId?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const floatNodes = (filterType === 'all' || filterType === 'float') ? filterNodes(allFloatNodes) : [];
  const staticNodes = (filterType === 'all' || filterType === 'static') ? filterNodes(allStaticNodes) : [];

  const mapStations = [...floatNodes, ...staticNodes];

  // Avg Water Level (From Float Nodes Only)
  const floatLevels = floatNodes.map(s => {
    const val = parseFloat(s.waterLevel);
    // Heuristic: if val > 10, assume cm and convert to m
    return val > 10 ? val / 100 : val;
  }).filter(v => !isNaN(v));

  const avgFloatLevel = floatLevels.length > 0
    ? (floatLevels.reduce((a, b) => a + b, 0) / floatLevels.length).toFixed(2)
    : "0.00";

  // Avg Water Level (From Static Nodes Only)
  const staticLevels = staticNodes.map(s => {
    // Static nodes now also rely on 'waterLevel' from the backend
    const val = parseFloat(s.waterLevel);
    return val > 10 ? val / 100 : val;
  }).filter(v => !isNaN(v));

  const avgStaticLevel = staticLevels.length > 0
    ? (staticLevels.reduce((a, b) => a + b, 0) / staticLevels.length).toFixed(2)
    : "0.00";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-20">
      <div className="lg:col-span-4 flex justify-between items-center mb-5">
        <h1 className="ml-2 mt-10 text-3xl font-bold text-blue-400">System Overview</h1>
      </div>
      {/* Top Stat Cards */}
      <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Stations"
          value={Object.keys(stations).length}
          icon={Wifi}
          color="blue"
        />
        <StatCard
          title="Water Level (Float)"
          value={avgFloatLevel}
          unit="m"
          icon={Droplets}
          color="blue"
          trend={5.2}
        />
        <StatCard
          title="Water Level (Static)"
          value={avgStaticLevel}
          unit="m"
          icon={Gauge}
          color="purple"
          trend={-1.2}
        />
        <StatCard
          title="System Status"
          value="Normal"
          icon={Activity}
          color="green"
        />
      </div>

      {/* Main Content Area (MAP TOP, CHART BOTTOM) */}
      <div className="lg:col-span-3 space-y-6">

        {/* Map Section - Expanded */}
        <div className="bg-[#1F2937] rounded-2xl border border-gray-800 overflow-hidden h-[600px] relative">
          <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur px-3 py-1 rounded-full text-sm font-bold border border-gray-700 text-white">
            Live Map
          </div>
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            style={{ width: '100%', height: '100%' }}
            mapLib={maplibregl}
            mapStyle={`https://api.maptiler.com/maps/base-v4-dark/style.json?key=${MAPTILER_KEY}`}
          >
            <NavigationControl position="bottom-right" />
            {mapStations.map((st, i) => (
              <Marker
                key={i}
                longitude={Number(st.lng) || 100.5}
                latitude={Number(st.lat) || 13.75}
                color="#3B82F6"
                onClick={e => {
                  e.originalEvent.stopPropagation();
                  flyToStation(st);
                }}
              >
                <div className="relative group cursor-pointer group">
                  {/* Simple Pulse Effect */}
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {st.stationName || st.id}
                  </div>
                </div>
              </Marker>
            ))}
          </Map>
        </div>

      </div>

      {/* Right Side Panel */}
      <div className="lg:col-span-1 space-y-6">

        {/* Search & Filter Widget */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 text-white rounded-lg pl-10 pr-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm placeholder-gray-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
            >
              All Nodes
            </button>
            <button
              onClick={() => setFilterType('float')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterType === 'float' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
            >
              Float Sensors
            </button>
            <button
              onClick={() => setFilterType('static')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterType === 'static' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
            >
              Static Sensors
            </button>
          </div>
        </div>

        {/* Float Nodes Section (Blue) */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Float Nodes (Water Level)</h4>
          <div className="space-y-2">
            {floatNodes.map((st, i) => (
              <div
                key={st.stationId || i}
                onClick={() => flyToStation(st)}
                className="flex items-center justify-between p-3 bg-blue-900/20 rounded-xl hover:bg-blue-900/40 transition-colors cursor-pointer border border-blue-500/30 hover:border-blue-500 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <Droplets size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-sm w-24 truncate" title={st.stationName}>{st.stationName || st.id || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{st.lat?.toFixed(4)}, {st.lng?.toFixed(4)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    <span className="font-mono font-bold text-blue-400 text-lg">{st.waterLevel?.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 ml-1">m</span>
                  </div>
                  {st.battery && (
                    <div className="text-[10px] text-gray-500">Bat: {st.battery}%</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Static Nodes Section (Purple) */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 mt-4 tracking-wider">Static Nodes (Water Level)</h4>
          <div className="space-y-2">
            {staticNodes.map((st, i) => (
              <div
                key={st.stationId || i}
                onClick={() => flyToStation(st)}
                className="flex items-center justify-between p-3 bg-purple-900/20 rounded-xl hover:bg-purple-900/40 transition-colors cursor-pointer border border-purple-500/30 hover:border-purple-500 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                    <Gauge size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-sm w-24 truncate" title={st.stationName}>{st.stationName || st.id || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{st.lat?.toFixed(4)}, {st.lng?.toFixed(4)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    <span className="font-mono font-bold text-purple-400 text-lg">{st.waterLevel?.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 ml-1">m</span>
                  </div>
                  {st.battery && (
                    <div className="text-[10px] text-gray-500">Bat: {st.battery}%</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}