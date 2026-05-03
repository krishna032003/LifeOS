/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * ProfileMenu.tsx
 *
 * A floating dropdown in the dashboard header showing:
 *  - User avatar (Google picture or initials fallback)
 *  - Name + email
 *  - Academic info (degree, year, batch) from stored profile
 *  - Active goals list
 *  - Logout button  →  clears localStorage and redirects to /login
 * 
 * Usage:
 *   <ProfileMenu />
 * 
 * Reads user data from localStorage (set during Google login / onboarding).
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/services/api";

interface UserProfile {
  user_id: string;
  name: string;
  email?: string;
  picture?: string;
  degree?: string;
  year?: string | number;
  batch?: string;
  active_goals?: string[];
  goals?: string[];
}

/* ── Helpers ── */
function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ profile, size = 36 }: { profile: UserProfile | null; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const name = profile?.name ?? "?";
  const pic = profile?.picture;

  if (pic && !imgErr) {
    return (
      <img
        src={pic}
        alt={name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
        className="rounded-full object-cover ring-2 ring-white/10"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#ADFFA6] to-[#B0A8FE] flex items-center justify-center font-semibold text-black select-none ring-2 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

export default function ProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Load profile ── */
  useEffect(() => {
    const userId = localStorage.getItem("lifeos_user_id");
    if (!userId) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    fetch(`${API_BASE}/api/user/${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: UserProfile | null) => {
        if (data) setProfile(data);
        else {
          // Fallback to localStorage if backend is down
          setProfile({
            user_id: userId,
            name: localStorage.getItem("lifeos_user_name") ?? "User",
            email: localStorage.getItem("lifeos_user_email") ?? undefined,
          });
        }
      })
      .catch(() => {
        setProfile({
          user_id: userId,
          name: localStorage.getItem("lifeos_user_name") ?? "User",
          email: localStorage.getItem("lifeos_user_email") ?? undefined,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  /* ── Close on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ── Logout ── */
  const handleLogout = () => {
    localStorage.removeItem("lifeos_user_id");
    localStorage.removeItem("lifeos_user_email");
    localStorage.removeItem("lifeos_user_name");
    router.push("/login");
  };

  const goals = profile?.active_goals ?? profile?.goals ?? [];
  const displayName = profile?.name ?? "Loading…";
  const email = profile?.email ?? localStorage.getItem("lifeos_user_email") ?? "";

  return (
    <div className="relative" ref={menuRef}>
      {/* ── Trigger button ── */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        {loading ? (
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        ) : (
          <Avatar profile={profile} size={32} />
        )}
        <div className="hidden sm:block text-left leading-none">
          <p className="text-sm font-medium text-white truncate max-w-[120px]">{displayName}</p>
          <p className="text-[11px] text-[#838179] truncate max-w-[120px]">{email}</p>
        </div>
        {/* Caret */}
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-3.5 h-3.5 text-[#838179] shrink-0"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </motion.button>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="profile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 rounded-3xl bg-[#0c0c0c] border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-2xl overflow-hidden"
          >
            {/* Top glare */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* ── Profile header ── */}
            <div className="p-5 border-b border-white/8">
              <div className="flex items-center gap-4">
                <Avatar profile={profile} size={52} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{displayName}</p>
                  <p className="text-xs text-[#838179] truncate mt-0.5">{email}</p>
                  {/* Online pill */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ADFFA6] animate-pulse" />
                    <span className="text-[11px] text-[#ADFFA6]/80">Agent active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Academic info ── */}
            {(profile?.degree || profile?.year || profile?.batch) && (
              <div className="px-5 py-4 border-b border-white/8 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#838179] mb-3">
                  Academic Profile
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {profile?.degree && (
                    <InfoChip icon="🎓" label="Degree" value={profile.degree} />
                  )}
                  {profile?.year && (
                    <InfoChip icon="📅" label="Year" value={`Year ${profile.year}`} />
                  )}
                  {profile?.batch && (
                    <InfoChip icon="👥" label="Batch" value={profile.batch} />
                  )}
                </div>
              </div>
            )}

            {/* ── Active goals ── */}
            {goals.length > 0 && (
              <div className="px-5 py-4 border-b border-white/8">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#838179] mb-3">
                  Active Goals
                </p>
                <ul className="space-y-2">
                  {goals.slice(0, 3).map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#ADFFA6]/70 shrink-0" />
                      <span className="leading-snug">{g}</span>
                    </li>
                  ))}
                  {goals.length > 3 && (
                    <li className="text-xs text-[#838179] pl-3.5">+{goals.length - 3} more…</li>
                  )}
                </ul>
              </div>
            )}

            {/* ── Actions ── */}
            <div className="p-3 space-y-1">
              <MenuAction
                icon="👤"
                label="Edit Profile"
                sublabel="Update your academic details & goals"
                onClick={() => { setOpen(false); router.push("/onboarding"); }}
              />
              <MenuAction
                icon="🔐"
                label="Login Information"
                sublabel={email || "Google account"}
                onClick={() => {}}
                readonly
              />
              <div className="my-2 h-px bg-white/8" />
              <MenuAction
                icon="🚪"
                label="Sign Out"
                sublabel="Logout and return to login page"
                onClick={handleLogout}
                danger
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ── */

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
      <span className="text-base">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-[#838179]">{label}</p>
        <p className="text-xs font-medium text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function MenuAction({
  icon, label, sublabel, onClick, danger = false, readonly = false,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  danger?: boolean;
  readonly?: boolean;
}) {
  return (
    <button
      onClick={readonly ? undefined : onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors",
        readonly
          ? "cursor-default opacity-60"
          : danger
          ? "hover:bg-red-500/15 cursor-pointer group"
          : "hover:bg-white/8 cursor-pointer group",
      ].join(" ")}
    >
      <span className="text-lg w-7 text-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? "text-red-400" : "text-white"}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-[#838179] truncate">{sublabel}</p>
        )}
      </div>
      {!readonly && !danger && (
        <svg className="w-3.5 h-3.5 text-[#838179] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}
