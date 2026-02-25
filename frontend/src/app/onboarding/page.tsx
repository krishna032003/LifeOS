"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        degree: '',
        year: '1',
        batch: '',
        goal1: '',
        goal2: ''
    });

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        if (errorMessage) setErrorMessage('');
    };

    const handleNext = () => {
        if (step === 1 && !formData.name) {
            setErrorMessage("Please enter your name.");
            return;
        }
        if (step === 2 && (!formData.degree || !formData.batch)) {
            setErrorMessage("Please complete your academic details.");
            return;
        }
        setErrorMessage('');
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setErrorMessage('');
        setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        if (!formData.goal1 || !formData.goal2) {
            setErrorMessage("Please provide your top 2 goals.");
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const payload = {
            user_id: "Krishna Sahu",
            name: formData.name,
            degree: formData.degree,
            year: parseInt(formData.year, 10),
            batch: formData.batch,
            goals: [formData.goal1, formData.goal2].filter(g => g.trim() !== '')
        };

        try {
            const response = await fetch("http://localhost:8000/api/onboard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("Failed to save profile. Please try again.");
            }

            router.push("/");
        } catch (err) {
            console.error("Onboarding error:", err);
            setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
            setIsLoading(false);
        }
    };

    // Strict requirements physics
    const springTransition = {
        type: "spring",
        stiffness: 300,
        damping: 30
    };

    const slideVariants = {
        enter: {
            x: 20,
            opacity: 0
        },
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: {
            zIndex: 0,
            x: -20,
            opacity: 0
        }
    };

    return (
        <div className="min-h-screen bg-[#040404] text-white flex items-center justify-center p-4 overflow-hidden relative selection:bg-[#ADFFA6]/20">
            {/* Background ambient glow matching Opal vibe */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#B0A8FE]/10 rounded-full blur-[120px] pointer-events-none opacity-50"></div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-[480px] w-full z-10"
            >
                <div className="mb-10 text-center">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[#ADFFA6] to-[#B0A8FE] rounded-2xl opacity-90 backdrop-blur-3xl overflow-hidden relative shadow-[0_0_50px_rgba(173,255,166,0.15)] flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-white/10" />
                        <div className="w-8 h-8 rounded-full border border-white/30" />
                    </motion.div>

                    <h1 className="text-3xl font-medium tracking-tight mb-2 text-white">Initialize Core</h1>
                    <p className="text-[#838179] text-sm tracking-wide">Configure your autonomous protocol.</p>
                </div>

                {/* Progress Indicators */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-[#ADFFA6]' : 'w-4 bg-white/10'}`}
                        />
                    ))}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                    {/* Top glare line */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50"></div>

                    <div className="relative min-h-[220px]">
                        <AnimatePresence mode="wait">
                            {/* STEP 1: IDENTITY */}
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={springTransition}
                                    className="absolute inset-0"
                                >
                                    <div className="space-y-6">
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-[#838179] mb-2 uppercase tracking-wider text-xs">Identity Registry</label>
                                            <input
                                                id="name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-[#838179]/50 outline-none ring-0 focus:border-[#ADFFA6]/50 transition-colors"
                                                placeholder="Full Legal Name"
                                                autoComplete="off"
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 2: ACADEMICS */}
                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={springTransition}
                                    className="absolute inset-0"
                                >
                                    <div className="space-y-5">
                                        <div>
                                            <label htmlFor="degree" className="block text-sm font-medium text-[#838179] mb-2 uppercase tracking-wider text-xs">Academic Program</label>
                                            <input
                                                id="degree"
                                                name="degree"
                                                value={formData.degree}
                                                onChange={handleChange}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-[#838179]/50 outline-none ring-0 focus:border-[#ADFFA6]/50 transition-colors"
                                                placeholder="e.g. B.Tech Computer Science"
                                                autoComplete="off"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="year" className="block text-sm font-medium text-[#838179] mb-2 uppercase tracking-wider text-xs">Year</label>
                                                <div className="relative">
                                                    <select
                                                        id="year"
                                                        name="year"
                                                        value={formData.year}
                                                        onChange={handleChange}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none ring-0 focus:border-[#ADFFA6]/50 transition-colors appearance-none"
                                                    >
                                                        {[1, 2, 3, 4, 5].map(y => (
                                                            <option key={y} value={y} className="bg-[#040404]">Year {y}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#838179]"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="batch" className="block text-sm font-medium text-[#838179] mb-2 uppercase tracking-wider text-xs">Division / Batch</label>
                                                <input
                                                    id="batch"
                                                    name="batch"
                                                    value={formData.batch}
                                                    onChange={handleChange}
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-[#838179]/50 outline-none ring-0 focus:border-[#ADFFA6]/50 transition-colors"
                                                    placeholder="e.g. F4"
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: OBJECTIVES */}
                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={springTransition}
                                    className="absolute inset-0"
                                >
                                    <div className="space-y-5">
                                        <div>
                                            <label htmlFor="goal1" className="block text-sm font-medium text-[#838179] mb-2 uppercase tracking-wider text-xs">Primary Objective</label>
                                            <input
                                                id="goal1"
                                                name="goal1"
                                                value={formData.goal1}
                                                onChange={handleChange}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-[#838179]/50 outline-none ring-0 focus:border-[#ADFFA6]/50 transition-colors"
                                                placeholder="e.g. Secure a top tier internship"
                                                autoComplete="off"
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="goal2" className="block text-sm font-medium text-[#838179] mb-2 uppercase tracking-wider text-xs">Secondary Objective</label>
                                            <input
                                                id="goal2"
                                                name="goal2"
                                                value={formData.goal2}
                                                onChange={handleChange}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-[#838179]/50 outline-none ring-0 focus:border-[#ADFFA6]/50 transition-colors"
                                                placeholder="e.g. Master dynamic programming"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Error display inline */}
                    <AnimatePresence>
                        {errorMessage && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, y: -10 }}
                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                exit={{ opacity: 0, height: 0, y: -10 }}
                                className="text-red-400 text-sm mt-4 text-center"
                            >
                                {errorMessage}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="mt-8 flex items-center gap-3">
                        {step > 1 && (
                            <button
                                onClick={handleBack}
                                disabled={isLoading}
                                className="px-5 py-3.5 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors focus:outline-none focus:ring-0 disabled:opacity-50"
                            >
                                Back
                            </button>
                        )}

                        <button
                            onClick={step === 3 ? handleSubmit : handleNext}
                            disabled={isLoading}
                            className="flex-1 bg-white text-[#040404] font-medium py-3.5 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none focus:ring-0 disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
                        >
                            {isLoading ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-4 h-4 border-2 border-[#040404]/30 border-t-[#040404] rounded-full"
                                    />
                                    <span className="opacity-80">Deploying System Core...</span>
                                </>
                            ) : (
                                step === 3 ? "Initialize Protocol" : "Continue"
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
