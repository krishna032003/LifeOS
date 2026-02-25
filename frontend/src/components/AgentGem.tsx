"use client";

import { motion } from "framer-motion";

export default function AgentGem() {
    return (
        <div className="relative flex items-center justify-center w-32 h-32">
            {/* Outer ambient glow */}
            <motion.div
                className="absolute w-40 h-40 rounded-full bg-lavender/10 blur-3xl"
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            {/* The Core Gem */}
            <motion.div
                className="relative z-10 w-24 h-24 rounded-full border border-white/20 bg-gradient-to-br from-lavender/40 to-white/5 backdrop-blur-md shadow-[0_0_30px_rgba(176,168,254,0.3)] flex items-center justify-center overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: [1, 1.02, 1], opacity: 1 }}
                transition={{
                    scale: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                    },
                    opacity: {
                        type: "spring",
                        stiffness: 300,
                        damping: 20
                    }
                }}
            >
                {/* Inner subtle moving light */}
                <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                    animate={{
                        x: ["-100%", "100%", "-100%"],
                        y: ["-100%", "100%", "-100%"]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
                <div className="w-8 h-8 rounded-full bg-lavender shadow-[0_0_20px_#B0A8FE]" />
            </motion.div>
        </div>
    );
}
