import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingProps {
    onComplete: () => void;
    userId: string;
}

export default function Onboarding({ onComplete, userId }: OnboardingProps) {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: userId,
        degree: '',
        year: '',
        batch: '',
        goals: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleNext = () => setStep(step + 1);

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const active_goals = formData.goals.split('\n').filter(g => g.trim() !== '');
            const payload = {
                user_id: userId,
                name: formData.name,
                degree: formData.degree,
                year: formData.year,
                batch: formData.batch,
                active_goals
            };

            await fetch("http://localhost:8000/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            onComplete(); // Triggers the dashboard to load
        } catch (err) {
            console.error("Failed to save profile", err);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full"
            >
                <div className="mb-12 text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-16 h-16 mx-auto mb-6 bg-gradient-to-tr from-mint to-lavender rounded-3xl opacity-80 backdrop-blur-3xl overflow-hidden relative shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                    >
                        <div className="absolute inset-0 bg-white/10" />
                    </motion.div>
                    <h1 className="text-3xl font-medium tracking-tight mb-2">Configure LifeOS</h1>
                    <p className="text-silver text-sm">Personalize your autonomous student agent.</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Display Name</label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint/50 transition-colors"
                                        placeholder="Krishna Sahu"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Degree</label>
                                        <input
                                            name="degree"
                                            value={formData.degree}
                                            onChange={handleChange}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint/50 transition-colors"
                                            placeholder="B.Tech CSE"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Year</label>
                                        <input
                                            name="year"
                                            value={formData.year}
                                            onChange={handleChange}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint/50 transition-colors"
                                            placeholder="3rd Year"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Batch / Division</label>
                                    <input
                                        name="batch"
                                        value={formData.batch}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint/50 transition-colors"
                                        placeholder="F4"
                                    />
                                </div>
                                <button
                                    onClick={handleNext}
                                    disabled={!formData.name || !formData.degree || !formData.year}
                                    className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                    Continue
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Top Technical Goals</label>
                                    <p className="text-xs text-silver/70 mb-4">Enter one goal per line. LifeOS will optimize your schedule and resources around these.</p>
                                    <textarea
                                        name="goals"
                                        value={formData.goals}
                                        onChange={handleChange}
                                        rows={4}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mint/50 transition-colors resize-none"
                                        placeholder="Solve 3 LeetCode Hard questions per day&#10;Complete distributed systems project by Friday"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isLoading || !formData.goals}
                                        className="flex-1 bg-mint text-black font-medium py-3 rounded-xl hover:bg-mint/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
                                            />
                                        ) : (
                                            "Initialize System"
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
