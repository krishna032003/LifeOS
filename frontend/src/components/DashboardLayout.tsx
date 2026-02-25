"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry {
    id: string;
    agent: string;
    message: string;
    timestamp: string;
    status: "active" | "completed" | "pending";
}

interface DashboardLayoutProps {
    sidebarContent: ReactNode;
    centralArea: ReactNode;
    logs: LogEntry[];
}

export default function DashboardLayout({ sidebarContent, centralArea, logs }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-opal-base text-white p-6 pb-20 sm:p-12 font-[family-name:var(--font-geist-sans)] selection:bg-mint/30">

            {/* Header */}
            <header className="flex justify-between items-center mb-12">
                <motion.h1
                    className="text-2xl font-bold tracking-tighter"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    LifeOS <span className="text-silver font-normal">/ Alpha</span>
                </motion.h1>
                <div className="text-sm font-medium text-silver">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)]">

                {/* Left Sidebar: Focus Ring & Daily Stats */}
                <motion.aside
                    className="lg:col-span-3 flex flex-col space-y-12"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
                >
                    <div className="p-8 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-2xl shadow-xl">
                        {sidebarContent}
                    </div>
                </motion.aside>

                {/* Center: The AI Gem and Chat Interface */}
                <motion.section
                    className="lg:col-span-5 flex flex-col items-center justify-center relative rounded-[32px] overflow-hidden border border-white/5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                >
                    {/* Subtle noise pattern overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

                    <div className="z-10 flex flex-col items-center justify-between h-full py-12">
                        {centralArea}
                    </div>
                </motion.section>

                {/* Right Sidebar: Thinking Pipeline (Logs) */}
                <motion.aside
                    className="lg:col-span-4 flex flex-col p-6 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-2xl shadow-xl overflow-hidden"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
                >
                    <h2 className="text-sm font-semibold tracking-widest text-silver uppercase mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-lavender animate-pulse"></span>
                        Thinking Pipeline
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <AnimatePresence>
                            {logs.map((log) => (
                                <motion.div
                                    key={log.id}
                                    layout
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className="p-4 rounded-2xl bg-black/40 border border-white/5 text-sm"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium text-lavender">{log.agent} Node</span>
                                        <span className="text-xs text-silver">{log.timestamp}</span>
                                    </div>
                                    <p className="text-gray-300 leading-relaxed">{log.message}</p>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.aside>

            </main>
        </div>
    );
}
