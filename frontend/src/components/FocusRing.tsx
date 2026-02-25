"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface FocusRingProps {
    progress: number; // 0 to 100
    label: string;
}

export default function FocusRing({ progress, label }: FocusRingProps) {
    const [currentProgress, setCurrentProgress] = useState(0);

    useEffect(() => {
        // Small delay to trigger animation on mount
        const timer = setTimeout(() => setCurrentProgress(progress), 300);
        return () => clearTimeout(timer);
    }, [progress]);

    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (currentProgress / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center w-64 h-64">
                <svg className="absolute w-full h-full -rotate-90">
                    <circle
                        cx="128"
                        cy="128"
                        r={radius}
                        strokeWidth="8"
                        stroke="rgba(255, 255, 255, 0.05)"
                        fill="transparent"
                    />
                    <motion.circle
                        cx="128"
                        cy="128"
                        r={radius}
                        strokeWidth="8"
                        stroke="#ADFFA6" /* Mint Green */
                        fill="transparent"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{
                            type: "spring",
                            stiffness: 70, // Slower, elegant spring
                            damping: 20,
                            mass: 1.2
                        }}
                        style={{
                            filter: "drop-shadow(0 0 15px rgba(173, 255, 166, 0.5))"
                        }}
                    />
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-light text-white">
                        {Math.round(currentProgress)}%
                    </span>
                    <span className="text-xs font-medium text-mint tracking-widest uppercase mt-1">
                        Focus
                    </span>
                </div>
            </div>
            <p className="text-sm text-silver font-medium text-center max-w-[200px]">
                {label}
            </p>
        </div>
    );
}
