"use client";

/**
 * /app/login/page.tsx
 *
 * The LifeOS Google Sign-In page.
 *
 * Flow:
 *  1. User clicks "Continue with Google" → Google pops up / One-Tap opens
 *  2. GoogleAuthButton sends the JWT credential to POST /auth/google
 *  3. Backend verifies token, creates/finds user, returns { user_id, email, name }
 *  4. user_id is stored in localStorage so every page can pick it up
 *  5. If user exists       → redirect to "/"  (dashboard)
 *     If new user          → redirect to "/onboarding"
 *
 * Environment variable needed:
 *   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your OAuth client ID>
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import GoogleAuthButton from "@/components/GoogleAuthButton";

import { API_BASE } from "@/services/api";

// ── Animated background orbs ─────────────────────────────────────────────────
const orbs = [
  { cx: "15%", cy: "20%", color: "#B0A8FE", size: 320, delay: 0 },
  { cx: "80%", cy: "70%", color: "#ADFFA6", size: 280, delay: 1.2 },
  { cx: "55%", cy: "10%", color: "#B0A8FE", size: 160, delay: 0.6 },
  { cx: "5%",  cy: "75%", color: "#ADFFA6", size: 120, delay: 1.8 },
];

// ── Feature blurbs shown on the left panel ───────────────────────────────────
const features = [
  {
    icon: "🧠",
    title: "AI Agent Swarm",
    description: "Multiple specialised agents collaborate to plan your day.",
  },
  {
    icon: "📅",
    title: "Auto-Schedule",
    description: "Your calendar optimised around goals and hard constraints.",
  },
  {
    icon: "📊",
    title: "Weekly AI review",
    description: "Pattern analysis and personalised growth insights every week.",
  },
  {
    icon: "💻",
    title: "Deep Work Mode",
    description: "Distraction-free sessions tracked and reviewed in real time.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    const existing = localStorage.getItem("lifeos_user_id");
    if (!existing) return;

    // Validate the stored session against the backend before redirecting.
    // If the backend no longer knows this user (e.g. server restarted with
    // empty MOCK_DB), clear stale localStorage and show the login button.
    fetch(`${API_BASE}/api/user/${encodeURIComponent(existing)}`)
      .then((res) => {
        if (res.ok) {
          router.replace("/");
        } else {
          // Stale / unknown user — clear storage and stay on login page
          localStorage.removeItem("lifeos_user_id");
          localStorage.removeItem("lifeos_user_email");
          localStorage.removeItem("lifeos_user_name");
        }
      })
      .catch(() => {
        // Backend unreachable — stay on login page so user can try again
      });
  }, [router]);

  /* ── Called by GoogleAuthButton on successful /auth/google response ── */
  const handleAuthSuccess = async (
    userId: string,
    email: string,
    name: string
  ) => {
    setIsAuthenticating(true);
    setStatusMsg(`Welcome, ${name}! Syncing your profile…`);

    // Persist user_id so all pages can read it
    localStorage.setItem("lifeos_user_id", userId);
    localStorage.setItem("lifeos_user_email", email);
    localStorage.setItem("lifeos_user_name", name);

    // Check whether the user already has a profile (degree/goals etc.)
    try {
      const res = await fetch(
        `${API_BASE}/api/user/${encodeURIComponent(userId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const hasProfile = !!(data.degree && data.goals?.length);
        setStatusMsg(hasProfile ? "Profile loaded. Launching LifeOS…" : "New user detected. Starting onboarding…");
        await pause(800);
        router.push(hasProfile ? "/" : "/onboarding");
      } else {
        // 404 → brand new user, send to onboarding
        setStatusMsg("First time? Let's set up your agent.");
        await pause(700);
        router.push("/onboarding");
      }
    } catch {
      // Backend might be down; go to onboarding as a safe default
      setStatusMsg("Could not reach backend. Continuing to onboarding…");
      await pause(1000);
      router.push("/onboarding");
    }
  };

  const handleAuthError = (msg: string) => {
    setIsAuthenticating(false);
    setStatusMsg(null);
    console.error("Auth error:", msg);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#040404] text-white flex overflow-hidden relative selection:bg-[#ADFFA6]/20">

      {/* ── Ambient orb background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {orbs.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-[0.12]"
            style={{
              left: orb.cx,
              top: orb.cy,
              width: orb.size,
              height: orb.size,
              background: orb.color,
              filter: "blur(80px)",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.08, 0.14, 0.08],
            }}
            transition={{
              duration: 6 + i * 1.5,
              repeat: Infinity,
              delay: orb.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ── Left panel: hero copy (visible on lg screens) ── */}
      <motion.aside
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-14 relative z-10"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo / wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ADFFA6] to-[#B0A8FE] flex items-center justify-center text-sm font-bold text-[#040404] shadow-[0_0_24px_rgba(173,255,166,0.25)]">
            L
          </div>
          <span className="font-medium text-lg tracking-tight">LifeOS</span>
          <span className="text-[#838179] text-sm">/Alpha</span>
        </div>

        {/* Hero heading */}
        <div className="space-y-6">
          <h1 className="text-5xl font-medium tracking-tight leading-[1.1]">
            Your autonomous{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ADFFA6] to-[#B0A8FE]">
              student OS.
            </span>
          </h1>
          <p className="text-[#838179] text-lg leading-relaxed max-w-sm">
            An AI agent swarm that learns your schedule, goals, and habits — then
            optimises everything automatically.
          </p>

          {/* Feature list */}
          <ul className="space-y-4 pt-4">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3 items-start">
                <span className="text-xl mt-0.5">{f.icon}</span>
                <div>
                  <p className="font-medium text-white text-sm">{f.title}</p>
                  <p className="text-[#838179] text-sm">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[#838179]/50 text-xs">
          © {new Date().getFullYear()} LifeOS — Student Autonomous Agent System
        </p>
      </motion.aside>

      {/* Divider */}
      <div className="hidden lg:block w-px bg-white/[0.06] shrink-0" />

      {/* ── Right panel: login card ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {/* Mobile logo (only visible < lg) */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ADFFA6] to-[#B0A8FE] flex items-center justify-center text-sm font-bold text-[#040404]">
              L
            </div>
            <span className="font-medium tracking-tight">LifeOS</span>
            <span className="text-[#838179] text-sm">/Alpha</span>
          </div>

          {/* Card */}
          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] relative overflow-hidden">

            {/* Top glare */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Heading */}
            <div className="mb-8">
              <motion.div
                className="w-12 h-12 mb-5 rounded-2xl bg-gradient-to-br from-[#ADFFA6]/80 to-[#B0A8FE]/80 flex items-center justify-center shadow-[0_0_32px_rgba(173,255,166,0.2)]"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
              >
                {/* Gem icon */}
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                  <path
                    d="M12 2L3 9l1.5 11h15L21 9 12 2z"
                    fill="rgba(0,0,0,0.6)"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="0.8"
                  />
                  <path d="M12 2l3 7H9L12 2z" fill="rgba(255,255,255,0.15)" />
                  <path d="M3 9h18" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                </svg>
              </motion.div>

              <h2 className="text-2xl font-medium tracking-tight text-white">
                Sign in to LifeOS
              </h2>
              <p className="text-[#838179] text-sm mt-1">
                Use your Google account to access your autonomous workspace.
              </p>
            </div>

            {/* ── Authentication state vs. login button ── */}
            <AnimatePresence mode="wait">
              {isAuthenticating ? (
                <motion.div
                  key="authenticating"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="py-6 flex flex-col items-center gap-4"
                >
                  {/* Spinner ring */}
                  <div className="relative w-14 h-14">
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#ADFFA6]/20"
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#ADFFA6]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    {/* Inner dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[#ADFFA6] animate-pulse" />
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={statusMsg}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-sm text-[#838179] text-center"
                    >
                      {statusMsg}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {/* GSI Button */}
                  <GoogleAuthButton
                    onSuccess={handleAuthSuccess}
                    onError={handleAuthError}
                    disabled={isAuthenticating}
                  />

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-xs text-[#838179]">secure authentication</span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>

                  {/* Trust badges */}
                  <div className="flex justify-center gap-6 text-[11px] text-[#838179]/60">
                    <span className="flex items-center gap-1">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-[#ADFFA6]/60">
                        <path d="M8 0L1 3v5c0 4.418 3.582 7 7 7s7-2.582 7-7V3L8 0z" />
                      </svg>
                      OAuth 2.0
                    </span>
                    <span className="flex items-center gap-1">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-[#ADFFA6]/60">
                        <circle cx="8" cy="8" r="7" />
                        <path d="M5 8l2 2 4-4" stroke="#040404" strokeWidth="1.5" fill="none" />
                      </svg>
                      No password stored
                    </span>
                    <span className="flex items-center gap-1">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-[#ADFFA6]/60">
                        <rect x="3" y="7" width="10" height="8" rx="1" />
                        <path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      Encrypted
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer note */}
          <p className="text-center text-[11px] text-[#838179]/40 mt-6 leading-relaxed">
            By signing in you agree to LifeOS storing your academic profile
            to power AI scheduling and recommendations.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Utility ── */
function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
