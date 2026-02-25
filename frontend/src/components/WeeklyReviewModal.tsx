import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Activity, Zap, X } from 'lucide-react';

interface WeeklyReviewData {
    score: number;
    review: string;
    recommendation: string;
}

interface WeeklyReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    data: WeeklyReviewData | null;
}

export default function WeeklyReviewModal({ isOpen, onClose, isLoading, data }: WeeklyReviewModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="w-full max-w-lg bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-silver hover:text-white transition-colors z-10"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-medium tracking-tight mb-2">Weekly AI Review</h2>
                                <p className="text-silver text-sm">Deep scanning your productivity and learning metrics.</p>
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-8">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            rotate: [0, 180, 360],
                                            opacity: [0.5, 1, 0.5]
                                        }}
                                        transition={{
                                            duration: 3,
                                            repeat: Infinity,
                                            ease: "linear"
                                        }}
                                        className="w-16 h-16 rounded-full border-t-2 border-r-2 border-mint/50"
                                    />
                                    <div className="space-y-2 text-center">
                                        <motion.p
                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="text-mint font-medium tracking-wide text-sm uppercase"
                                        >
                                            Synthesizing Cognitive Logs
                                        </motion.p>
                                        <p className="text-silver text-xs">Cross-referencing goals with performance data...</p>
                                    </div>
                                </div>
                            ) : data ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="flex justify-center mb-8">
                                        <div className="relative flex items-center justify-center">
                                            <svg className="w-32 h-32 transform -rotate-90">
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    className="stroke-white/5 fill-none"
                                                    strokeWidth="12"
                                                />
                                                <motion.circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    className="stroke-mint fill-none"
                                                    strokeWidth="12"
                                                    strokeDasharray={351.8}
                                                    initial={{ strokeDashoffset: 351.8 }}
                                                    animate={{ strokeDashoffset: 351.8 - (351.8 * data.score) / 100 }}
                                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-3xl font-regular">{data.score}</span>
                                                <span className="text-[10px] text-silver uppercase tracking-widest">Health</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}
                                            className="bg-white/5 rounded-2xl p-4 border border-white/5"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Activity size={16} className="text-lavender" />
                                                <h4 className="text-sm font-medium">Analysis</h4>
                                            </div>
                                            <p className="text-sm text-silver leading-relaxed">{data.review}</p>
                                        </motion.div>

                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.4 }}
                                            className="bg-mint/10 rounded-2xl p-4 border border-mint/20"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Zap size={16} className="text-mint" />
                                                <h4 className="text-sm font-medium text-mint">Action Item</h4>
                                            </div>
                                            <p className="text-sm text-silver/90 leading-relaxed">{data.recommendation}</p>
                                        </motion.div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="text-center py-12 text-silver text-sm">
                                    Data retrieval failed. Please try again.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
