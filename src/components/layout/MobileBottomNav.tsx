"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  ScrollText,
  Activity,
  Trophy,
  User,
  LogOut,
  Moon,
  Sun,
  Zap,
  ClipboardList,
  Brain,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { getSocket } from "@/lib/socket";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const socket = getSocket();
    const onSessionState = (data: any) => {
      setIsSessionActive(Boolean(data && data.status === "active"));
    };
    const onSubSessionStarted = () => setIsSessionActive(true);
    const onRoundEnded = () => setIsSessionActive(false);

    socket.on("session-state", onSessionState);
    socket.on("sub-session-started", onSubSessionStarted);
    socket.on("round-ended", onRoundEnded);

    return () => {
      socket.off("session-state", onSessionState);
      socket.off("sub-session-started", onSubSessionStarted);
      socket.off("round-ended", onRoundEnded);
    };
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    setShowProfileSheet(false);
    logout();
    router.push("/login");
  };

  type NavTab = {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    badge?: boolean;
  };

  const respondentTabs: NavTab[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Trading",
      href: "/dashboard/trading",
      icon: TrendingUp,
      badge: isSessionActive,
    },
  ];

  const adminTabs: NavTab[] = [
    {
      label: "Monitor",
      href: "/admin",
      icon: Activity,
    },
    {
      label: "Trading",
      href: "/admin/trading",
      icon: TrendingUp,
    },
    {
      label: "Resume",
      href: "/admin/resume",
      icon: ScrollText,
    },
    {
      label: "Hasil",
      href: "/admin/hasil",
      icon: Trophy,
    },
  ];

  const tabs: NavTab[] = isAdmin ? adminTabs : respondentTabs;

  return (
    <>
      {/* Bottom Sheet Modal Profil untuk Mobile */}
      {showProfileSheet && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowProfileSheet(false)}
          />
          <div className="relative z-10 w-full rounded-t-3xl bg-background border-t border-border p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom-8 duration-200">
            {/* Drag Handle */}
            <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />

            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600/10 dark:bg-cyan-500/10 text-indigo-600 dark:text-cyan-400 font-bold text-xl border border-indigo-500/20 shadow-xs">
                {user.nama.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-foreground truncate">{user.nama}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                    {user.role}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">ID #{user.id}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setShowProfileSheet(false);
                      router.push("/admin/kuesioner");
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-semibold transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardList className="size-4" />
                      <span>Pengelolaan Kuesioner (LA & EI)</span>
                    </div>
                    <span className="text-xs font-mono font-bold">›</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileSheet(false);
                      router.push("/admin/profil-responden");
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Brain className="size-4" />
                      <span>Hasil Profil Responden</span>
                    </div>
                    <span className="text-xs font-mono font-bold">›</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-muted/60 hover:bg-muted text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-3">
                  {theme === "dark" ? <Moon className="size-4 text-cyan-400" /> : <Sun className="size-4 text-amber-500" />}
                  <span>Mode Tampilan ({theme === "dark" ? "Gelap" : "Terang"})</span>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">Ganti</span>
              </button>


              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-sm font-semibold transition-colors"
              >
                <LogOut className="size-4" />
                <span>Keluar dari Akun</span>
              </button>
            </div>

            <button
              onClick={() => setShowProfileSheet(false)}
              className="w-full py-3.5 rounded-2xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modern Ergonomic Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none">
        <div className="pointer-events-auto bg-background/95 backdrop-blur-xl border-t border-border/60 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] px-2 sm:px-4 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <nav className="flex items-center justify-around gap-1 sm:gap-2 max-w-sm mx-auto">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 py-1 px-1 sm:px-3 rounded-2xl transition-all duration-200 min-h-[48px] relative group active:scale-95",
                    active
                      ? "text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {/* Active Indicator Background */}
                  {active && (
                    <div className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-2xl -z-10 animate-in fade-in" />
                  )}

                  <div className="relative">
                    <Icon className={cn("size-4.5 sm:size-5 transition-transform", active ? "scale-110 text-primary" : "text-muted-foreground")} />
                    {tab.badge && (
                      <span className="absolute -top-1 -right-1.5 flex size-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] sm:text-[11px] mt-1 leading-none tracking-tight font-medium">
                    {tab.label}
                  </span>
                </button>
              );
            })}

            {/* Profile Tab */}
            <button
              onClick={() => setShowProfileSheet(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 px-1 sm:px-3 rounded-2xl text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-200 min-h-[48px]"
            >
              <div className="flex size-4.5 sm:size-5 items-center justify-center rounded-full bg-muted text-[9.5px] sm:text-[10px] font-bold text-foreground ring-1 ring-border/80">
                {user.nama.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-[10px] sm:text-[11px] mt-1 leading-none tracking-tight font-medium">
                Profil
              </span>
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
