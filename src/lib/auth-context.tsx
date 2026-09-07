"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  useIdleTimeout,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_WARNING_BEFORE_MS,
} from "./useIdleTimeout";
import { SessionTimeoutModal } from "@/components/auth/SessionTimeoutModal";
import { disconnectSocket } from "./socket";

type User = {
  id: number;
  nama: string;
  role: "admin" | "responden";
};

type AuthContext = {
  user: User | null;
  hydrated: boolean;
  balance: number | null;
  updateBalance: (newBalance: number) => void;
  login: (user: User) => void;
  logout: (reason?: string | unknown) => void;
  resetIdleTimer: () => void;
};

const AuthCtx = createContext<AuthContext>({
  user: null,
  hydrated: false,
  balance: null,
  updateBalance: () => {},
  login: () => {},
  logout: () => {},
  resetIdleTimer: () => {},
});

const BROADCAST_CHANNEL_NAME = "simulasi_investasi_session_sync";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [hydrated, setHydrated] = useState(false);
  const [balance, setBalance] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        const cachedBal = sessionStorage.getItem(`simulasi_balance_${u.id}`);
        return cachedBal ? Number(cachedBal) : null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    setHydrated(true);
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        const cachedBal = sessionStorage.getItem(`simulasi_balance_${u.id}`);
        if (cachedBal) setBalance(Number(cachedBal));
      }
    } catch {
      localStorage.removeItem("user");
    }
  }, []);


  const updateBalance = useCallback((newBalance: number) => {
    setBalance(newBalance);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("user");
        const uid = user?.id || (stored ? JSON.parse(stored)?.id : null);
        if (uid) {
          sessionStorage.setItem(`simulasi_balance_${uid}`, String(newBalance));
        }
      } catch {
        // ignore
      }
    }
  }, [user?.id]);

  const login = useCallback((u: User) => {
    setUser(u);
    try {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("simulasi_investasi_last_active", String(Date.now()));
      const cachedBal = sessionStorage.getItem(`simulasi_balance_${u.id}`);
      if (cachedBal) setBalance(Number(cachedBal));
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback((reason?: string | unknown) => {
    const reasonStr = typeof reason === "string" ? reason : undefined;
    setUser(null);
    setBalance(null);

    try {
      localStorage.removeItem("user");
      localStorage.removeItem("simulasi_investasi_last_active");

      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: "LOGOUT", reason: reasonStr });
        bc.close();
      }
    } catch {
      // ignore
    }

    // Putuskan koneksi socket secara bersih
    try {
      disconnectSocket();
    } catch {
      // ignore
    }

    // Kirim request logout ke server di background tanpa menghambat navigasi
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/logout");
      } else {
        fetch("/api/logout", { method: "POST", keepalive: true }).catch(() => {});
      }
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      const target =
        reasonStr && reasonStr !== "manual"
          ? `/login?reason=${encodeURIComponent(reasonStr)}`
          : "/login";
      if (window.location.pathname !== "/login" || (reasonStr && !window.location.search.includes("reason="))) {
        window.location.replace(target);
      }
    }
  }, []);

  // Multi-tab logout listener
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    try {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event?.data?.type === "LOGOUT") {
          setUser(null);
          setBalance(null);
          try {
            localStorage.removeItem("user");
            localStorage.removeItem("simulasi_investasi_last_active");
          } catch {
            // ignore
          }
          try {
            disconnectSocket();
          } catch {
            // ignore
          }
          const reason = event.data.reason;
          const target =
            reason && reason !== "manual"
              ? `/login?reason=${encodeURIComponent(reason)}`
              : "/login";
          if (window.location.pathname !== "/login") {
            window.location.replace(target);
          }
        }
      };
      return () => {
        bc.close();
      };
    } catch {
      // ignore
    }
  }, []);

  // 1-Hour Inactivity Auto-Logout Hook
  const handleAutoTimeout = useCallback(() => {
    logout("timeout");
  }, [logout]);

  const { isWarning, secondsRemaining, resetTimer } = useIdleTimeout({
    enabled: hydrated && !!user,
    timeoutMs: DEFAULT_IDLE_TIMEOUT_MS, // 1 Jam (60 menit) untuk semua peran
    warningBeforeMs: DEFAULT_WARNING_BEFORE_MS, // 60 detik peringatan modal
    onTimeout: handleAutoTimeout,
  });

  return (
    <AuthCtx.Provider
      value={{
        user,
        hydrated,
        balance,
        updateBalance,
        login,
        logout,
        resetIdleTimer: resetTimer,
      }}
    >
      {children}
      {user && (
        <SessionTimeoutModal
          isOpen={isWarning}
          secondsRemaining={secondsRemaining}
          onExtend={resetTimer}
          onLogout={() => logout("manual")}
        />
      )}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

