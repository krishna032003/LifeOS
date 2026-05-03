"use client";

/**
 * /app/auth/callback/page.tsx
 *
 * Google OAuth2 implicit-flow callback page.
 *
 * Google redirects here after the user signs in:
 *   http://localhost:3000/auth/callback#id_token=xxx&...
 *
 * This page:
 *  1. Pulls the id_token from the URL hash fragment.
 *  2. Sends it to the parent window via postMessage.
 *  3. Closes itself.
 *
 * Add http://localhost:3000/auth/callback to your Google Cloud Console
 * OAuth client's "Authorised redirect URIs".
 */

import { useEffect, useState } from "react";

export default function AuthCallback() {
  const [status, setStatus] = useState("Processing…");

  useEffect(() => {
    try {
      // Google puts tokens in the hash fragment: #id_token=...&...
      const hash = window.location.hash.substring(1); // strip #
      const params = new URLSearchParams(hash);
      const idToken = params.get("id_token");
      const accessToken = params.get("access_token");
      const error = params.get("error");

      if (error) {
        queueMicrotask(() => setStatus(`Sign-in cancelled: ${error}`));
        window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error }, window.location.origin);
        setTimeout(() => window.close(), 1500);
        return;
      }

      if (!idToken && !accessToken) {
        queueMicrotask(() => setStatus("No token received from Google."));
        window.opener?.postMessage(
          { type: "GOOGLE_AUTH_ERROR", error: "No token in callback URL" },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
        return;
      }

      queueMicrotask(() => setStatus("Authenticated! Closing…"));
      window.opener?.postMessage(
        { type: "GOOGLE_AUTH_SUCCESS", idToken, accessToken },
        window.location.origin
      );
      window.close();
    } catch {
      queueMicrotask(() => setStatus("Something went wrong. Please close this window and try again."));
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#040404",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        gap: 16,
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid rgba(255,255,255,0.1)",
          borderTop: "3px solid #ADFFA6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "#838179", fontSize: 14 }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
