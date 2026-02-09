"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from "socket.io-client";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [stations, setStations] = useState({});
    const [history, setHistory] = useState([]); // Store history for charts
    const [sessionHistory, setSessionHistory] = useState([]); // 🟢 Store "Fresh Start" history (clears on refresh)
    const [lineNotifications, setLineNotifications] = useState([]);
    const socketRef = React.useRef(null);

    useEffect(() => {
        const socket = io("http://localhost:4000");
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

            setStations((prev) => ({
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
            Object.values(fullHistory).forEach(deviceHistory => {
                deviceHistory.forEach(entry => {
                    // Ensure timestamp logic matches
                    const now = new Date();
                    // If entry.rawTimestamp is string from JSON, parse it
                    const rawTime = new Date(entry.rawTimestamp || entry.time).getTime(); // Fallback
                    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);

                    if (rawTime > twentyFourHoursAgo) {
                        combinedHistory.push({
                            ...entry,
                            rawTimestamp: rawTime
                        });
                    }
                });
            });

            // Sort by time
            combinedHistory.sort((a, b) => a.rawTimestamp - b.rawTimestamp);
            setHistory(combinedHistory);
        });

        socket.on("line-notification", (notification) => {
            console.log("🔔 Line Notification:", notification);
            setLineNotifications(prev => [notification, ...prev]);
        });

        return () => socket.disconnect();
    }, []);

    // Function to calculate trend
    const getTrend = (stationId, parameter, currentValue) => {
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
            // For falling, we might want green if it's "good" (like pressure dropping to safe levels) or red if "bad".
            // Based on user request: Falling = Green.
            return { direction: 'falling', color: 'text-green-500', icon: '⬇️' }; // Falling
        }

        return { direction: 'stable', color: 'text-gray-500', icon: '➡️' };
    };

    return (
        <SocketContext.Provider value={{ stations, history, sessionHistory, setSessionHistory, getTrend, lineNotifications, socket: socketRef.current }}>
            {children}
        </SocketContext.Provider>
    );
};
