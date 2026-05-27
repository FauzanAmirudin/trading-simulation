"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type User = {
  id: number;
  nama: string;
  role: "admin" | "responden";
};

type AuthContext = {
  user: User | null;
  hydrated: boolean;
  login: (user: User) => void;
  logout: () => void;
};

const AuthCtx = createContext<AuthContext>({
  user: null,
  hydrated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem("user");
    }
  }, []);

  const login = useCallback((u: User) => {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("user");
  }, []);

  // Auto-logout after 1 hour of inactivity
  useEffect(() => {
    if (!user) return; // Only track if logged in

    const IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        // Optional: reload the page to ensure complete cleanup, though state update triggers redirect
        window.location.href = "/login";
      }, IDLE_TIMEOUT);
    };

    resetTimer();
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, logout]);

  return <AuthCtx.Provider value={{ user, hydrated, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
