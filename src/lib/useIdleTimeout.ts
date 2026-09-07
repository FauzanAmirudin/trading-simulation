"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export const DEFAULT_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 Jam (60 menit)
export const DEFAULT_WARNING_BEFORE_MS = 60 * 1000; // 60 detik peringatan sebelum logout

const STORAGE_KEY_LAST_ACTIVE = "simulasi_investasi_last_active";
const BROADCAST_CHANNEL_NAME = "simulasi_investasi_session_sync";

export type IdleTimeoutOptions = {
  enabled?: boolean;
  timeoutMs?: number;
  warningBeforeMs?: number;
  onTimeout: () => void;
};

export type IdleTimeoutReturn = {
  isWarning: boolean;
  secondsRemaining: number;
  resetTimer: () => void;
};

export function useIdleTimeout({
  enabled = true,
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  warningBeforeMs = DEFAULT_WARNING_BEFORE_MS,
  onTimeout,
}: IdleTimeoutOptions): IdleTimeoutReturn {
  const [isWarning, setIsWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.round(warningBeforeMs / 1000));

  const lastActiveRef = useRef<number>(Date.now());
  const isWarningRef = useRef<boolean>(false);
  const lastBroadcastRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Keep latest onTimeout ref to avoid stale closures
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Read initial timestamp from localStorage if available
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now()) {
          lastActiveRef.current = parsed;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [enabled]);

  // Setup BroadcastChannel for multi-tab sync
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (!event?.data) return;
        const { type, timestamp } = event.data;

        if (type === "ACTIVITY" && typeof timestamp === "number") {
          lastActiveRef.current = Math.max(lastActiveRef.current, timestamp);
          if (isWarningRef.current) {
            isWarningRef.current = false;
            setIsWarning(false);
          }
        } else if (type === "RESET_SESSION") {
          lastActiveRef.current = Date.now();
          if (isWarningRef.current) {
            isWarningRef.current = false;
            setIsWarning(false);
          }
        }
      };

      return () => {
        channel.close();
        channelRef.current = null;
      };
    } catch (err) {
      console.warn("BroadcastChannel not supported or failed:", err);
    }
  }, [enabled]);

  // Function to explicitly reset the activity timer
  const resetTimer = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    isWarningRef.current = false;
    setIsWarning(false);
    setSecondsRemaining(Math.round(warningBeforeMs / 1000));

    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
      if (channelRef.current) {
        channelRef.current.postMessage({ type: "RESET_SESSION", timestamp: now });
      }
    } catch {
      // Ignore storage errors
    }
  }, [warningBeforeMs]);

  // Main tick evaluation logic
  const checkIdleStatus = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    const lastActive = lastActiveRef.current;
    const elapsed = now - lastActive;

    if (elapsed >= timeoutMs) {
      // 1 hour elapsed -> trigger logout
      isWarningRef.current = false;
      setIsWarning(false);
      onTimeoutRef.current();
    } else if (elapsed >= timeoutMs - warningBeforeMs) {
      // In warning period (< warningBeforeMs remaining)
      const remainingMs = timeoutMs - elapsed;
      const secLeft = Math.max(1, Math.ceil(remainingMs / 1000));
      isWarningRef.current = true;
      setIsWarning(true);
      setSecondsRemaining(secLeft);
    } else {
      // Normal active state
      if (isWarningRef.current) {
        isWarningRef.current = false;
        setIsWarning(false);
      }
    }
  }, [enabled, timeoutMs, warningBeforeMs]);

  // Periodic heartbeat tick (every 1 second)
  useEffect(() => {
    if (!enabled) return;

    // Run immediate check
    checkIdleStatus();

    const interval = setInterval(() => {
      checkIdleStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, checkIdleStatus]);

  // Activity event listeners with throttling
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const THROTTLE_MS = 1000; // Only update once per second for high-frequency events

    const handleUserActivity = () => {
      // If currently showing warning modal, don't auto-dismiss on subtle mouse moves
      // The user should explicitly click "Lanjutkan Sesi" or press keys
      if (isWarningRef.current) return;

      const now = Date.now();
      if (now - lastActiveRef.current < THROTTLE_MS) return;

      lastActiveRef.current = now;

      try {
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));

        // Throttle broadcast messages to other tabs to once every 5 seconds
        if (now - lastBroadcastRef.current > 5000 && channelRef.current) {
          lastBroadcastRef.current = now;
          channelRef.current.postMessage({ type: "ACTIVITY", timestamp: now });
        }
      } catch {
        // Ignore storage errors
      }
    };

    // Instant check when user focuses or returns to the tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        // Check latest timestamp from localStorage in case another tab had activity
        try {
          const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
          if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed > lastActiveRef.current) {
              lastActiveRef.current = parsed;
            }
          }
        } catch {
          // Ignore
        }
        checkIdleStatus();
      }
    };

    // Listen to storage event as fallback cross-tab synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LAST_ACTIVE && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed) && parsed > lastActiveRef.current) {
          lastActiveRef.current = parsed;
          if (isWarningRef.current) {
            isWarningRef.current = false;
            setIsWarning(false);
          }
        }
      }
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "click",
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [enabled, checkIdleStatus]);

  return {
    isWarning,
    secondsRemaining,
    resetTimer,
  };
}
