"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Move } from 'lucide-react';

const ImagePositionModal = ({ isOpen, onClose, imageUrl, initialPosition, onSave }) => {
    // Position state: { x: number (%), y: number (%) }
    const [position, setPosition] = useState(initialPosition || { x: 50, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen && initialPosition) {
            setPosition(initialPosition);
        } else {
            setPosition({ x: 50, y: 50 });
        }
    }, [isOpen, initialPosition]);

    if (!isOpen) return null;

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        // Convert delta pixels to percentage of container
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            // Sensitivity factor (adjust as needed)
            const sensitivity = 0.2;

            setPosition(prev => ({
                x: Math.min(100, Math.max(0, prev.x - (deltaX / width * 100 * sensitivity))),
                y: Math.min(100, Math.max(0, prev.y - (deltaY / height * 100 * sensitivity)))
            }));

            // Re-center drag start to prevent acceleration
            // dragStartRef.current = { x: e.clientX, y: e.clientY }; 
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Simplified click-to-position approach (easier than full drag sometimes)
    const handleContainerClick = (e) => {
        // Only if not dragging (simple check)
        if (isDragging) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPosition({ x, y });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Move size={18} className="text-blue-400" />
                        Adjust Image Position
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-sm text-gray-400 mb-4">Click on the point you want to center.</p>

                    {/* Preview Container - Matches Card Aspect Ratio approx */}
                    <div
                        ref={containerRef}
                        className="w-full h-48 bg-gray-900 rounded-xl overflow-hidden relative cursor-crosshair border-2 border-dashed border-gray-600 group"
                        onClick={handleContainerClick}
                    >
                        {/* The Image */}
                        <div
                            className="w-full h-full bg-cover bg-no-repeat transition-all duration-200 ease-out"
                            style={{
                                backgroundImage: `url(${imageUrl})`,
                                backgroundPosition: `${position.x}% ${position.y}%`
                            }}
                        />

                        {/* Crosshair indicator */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                            <div className="w-full h-px bg-white/30"></div>
                            <div className="h-full w-px bg-white/30 absolute"></div>
                        </div>
                    </div>

                    <div className="flex justify-between text-xs font-mono text-gray-500 mt-2">
                        <span>X: {(Number(position.x) || 0).toFixed(1)}%</span>
                        <span>Y: {(Number(position.y) || 0).toFixed(1)}%</span>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-300 hover:text-white font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(position)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95"
                    >
                        <Save size={16} />
                        Save Position
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImagePositionModal;
