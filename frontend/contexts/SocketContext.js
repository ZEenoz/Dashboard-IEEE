"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : 'http://localhost:4000';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [rawStations, setRawStations] = useState({});
    const [systemMode, setSystemMode] = useState('TTN');
    const [history, setHistory] = useState([]); // Store history for charts
    const [sessionHistory, setSessionHistory] = useState([]); // 🟢 Store "Fresh Start" history (clears on refresh)
    const [lineNotifications, setLineNotifications] = useState([]);
    const [displayMode, setDisplayMode] = useState('calibrated'); // 'raw' | 'calibrated'
    const socketRef = React.useRef(null);

    // 🆕 Persistence: Load/Save Display Mode
    useEffect(() => {
        const saved = localStorage.getItem('waterLevelDisplayMode');
        if (saved === 'raw' || saved === 'calibrated') {
            setDisplayMode(saved);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('waterLevelDisplayMode', displayMode);
    }, [displayMode]);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            extraHeaders: {
                "ngrok-skip-browser-warning": "true"
            }
        });
        socketRef.current = socket;

        socket.on("sensor-update", (newData) => {
            const now = new Date();
            // Convert Water Level from cm to m (Backend already handles this logic now)
            const waterLevelMeters = newData.waterLevel ? newData.waterLevel : 0;

            const enrichedData = {
                ...newData,
                waterLevel: waterLevelMeters, // Override with meters
                timestamp: now.toLocaleTimeString(),
                fullDate: now.toISOString(),
                rawTimestamp: now.getTime()
            };

            setRawStations((prev) => ({
                ...prev,
                [newData.stationId]: enrichedData
            }));

            // 🟢 Add to Session History (Persists until refresh)
            setSessionHistory((prev) => {
                // Prevent duplicates
                if (prev.length > 0 && prev[prev.length - 1].rawTimestamp === enrichedData.rawTimestamp) return prev;
                const newHistory = [...prev, enrichedData];
                return newHistory.slice(-100); // Keep last 100 points
            });

            // Add to history (keep last 24 hours) - GLOBAL HISTORY (Still used for trends/analytics)
            setHistory((prev) => {
                const newEntry = enrichedData;

                // Filter out data older than 24 hours (24 * 60 * 60 * 1000 ms)
                const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
                const newHistory = [...prev, newEntry].filter(item => item.rawTimestamp > twentyFourHoursAgo);

                return newHistory;
            });
        });

        // 🆕 Handle Initial Data (Load History on Refresh)
        socket.on("init-data", (fullHistory) => {
            console.log("📥 Received Initial History:", fullHistory);
            
            // Flatten history into a single array for the charts
            let combinedHistory = [];
            Object.entries(fullHistory || {}).forEach(([deviceId, deviceHistory]) => {
                const normalizedId = String(deviceId).toLowerCase();
                if (Array.isArray(deviceHistory)) {
                    deviceHistory.forEach(entry => {
                        const now = new Date();
                        const rawTime = new Date(entry.rawTimestamp || entry.time || entry.timestamp).getTime();
                        const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);

                        if (rawTime > twentyFourHoursAgo) {
                            combinedHistory.push({
                                ...entry,
                                stationId: normalizedId, // Ensure ID is present and normalized
                                timestamp: entry.timestamp || entry.time,
                                rawTimestamp: rawTime
                            });
                        }
                    });
                }
            });

            // Sort by time
            combinedHistory.sort((a, b) => a.rawTimestamp - b.rawTimestamp);
            setHistory(combinedHistory);
        });

        // 🆕 New: Receiving the latest known state for each station (Instant Cards)
        socket.on("latest-readings", (data) => {
            console.log("📥 Received Latest Readings (Instant Cards):", data);
            if (data && Object.keys(data).length > 0) {
                setRawStations(prev => ({ ...prev, ...data }));
                console.log("✅ rawStations hydrated with latest data");
            } else {
                console.warn("⚠️ Received empty latest-readings data");
            }
        });

        socket.on("system-mode", (mode) => {
            console.log(`🔌 System Mode Changed: ${mode}`);
            setSystemMode(mode);
        });

        socket.on("line-notification", (notification) => {
            console.log("🔔 Line Notification:", notification);
            setLineNotifications(prev => [notification, ...prev]);
        });

        return () => socket.disconnect();
    }, []);

    // 🆕 Optimized: Memoize getTrend function
    const getTrend = React.useCallback((stationId, parameter, currentValue) => {
        if (!history || history.length === 0) return { direction: 'stable', color: 'text-gray-500', icon: '➡️' };

        const now = new Date().getTime();
        const fifteenMinutesAgo = now - (15 * 60 * 1000);

        // Find the data point closest to 15 minutes ago for this station
        const pastData = history.find(item =>
            item.stationId === stationId &&
            item.rawTimestamp >= fifteenMinutesAgo
        );

        if (!pastData) return { direction: 'stable', color: 'text-gray-500', icon: '➡️' };

        const pastValue = Number(pastData[parameter]);
        const diff = currentValue - pastValue;
        const percentChange = (diff / pastValue) * 100;

        if (diff > 0) {
            if (percentChange > 5) return { direction: 'rising-fast', color: 'text-red-500', icon: '⬆️' }; // Rising Fast
            return { direction: 'rising', color: 'text-orange-500', icon: '↗️' }; // Rising
        } else if (diff < 0) {
            return { direction: 'falling', color: 'text-green-500', icon: '⬇️' }; // Falling
        }

        return { direction: 'stable', color: 'text-gray-500', icon: '➡️' };
    }, [history]);

    const stations = React.useMemo(() => {
        return Object.fromEntries(
            Object.entries(rawStations).filter(([id, data]) => {
                // If it's the new format with networkMode, filter strictly
                // Otherwise, if missing networkMode, show it as a fallback
                const nodeMode = data.networkMode;
                if (!nodeMode) return true; // Allow stations with no mode defined
                return nodeMode === systemMode;
            })
        );
    }, [rawStations, systemMode]);

    // 🆕 Optimized: Memoize context provider value to prevent re-rendering the whole tree
    const contextValue = React.useMemo(() => ({
        stations, 
        history, 
        sessionHistory, 
        setSessionHistory, 
        getTrend, 
        lineNotifications, 
        socket: socketRef.current, 
        systemMode,
        displayMode,
        setDisplayMode
    }), [stations, history, sessionHistory, getTrend, lineNotifications, systemMode, displayMode]);

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};
