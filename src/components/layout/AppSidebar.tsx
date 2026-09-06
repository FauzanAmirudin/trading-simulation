"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  TrendingUp,
  ScrollText,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Activity,
  Trophy,
  ClipboardList,
  Brain,
} from "lucide-react";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const respondentNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="size-4" /> },
  { label: "Trading", href: "/dashboard/trading", icon: <TrendingUp className="size-4" /> },
];

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <Activity className="size-4" /> },
  { label: "Trading", href: "/admin/trading", icon: <TrendingUp className="size-4" /> },
  { label: "Kuesioner", href: "/admin/kuesioner", icon: <ClipboardList className="size-4" /> },
  { label: "Profil Responden", href: "/admin/profil-responden", icon: <Brain className="size-4" /> },
  { label: "Resume", href: "/admin/resume", icon: <ScrollText className="size-4" /> },
  { label: "Hasil", href: "/admin/hasil", icon: <Trophy className="size-4" /> },
];


export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNav : respondentNav;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const linkIsActive = (href: string) => pathname === href;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-shrink-0 border-r border-sidebar-border bg-sidebar flex-col transition-all duration-300 sticky top-0 h-screen z-30",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex h-13 sm:h-14 items-center border-b border-sidebar-border px-3 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex size-7 items-center justify-center rounded-lg overflow-hidden shrink-0 bg-background shadow-2xs">
              <Image
                src="/logo-icon-64.png"
                alt="Logo Simulasi Investasi"
                width={28}
                height={28}
                className="size-full object-contain"
                priority
                unoptimized
              />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              {isAdmin ? "Panel Admin" : "Trader"}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors ml-auto"
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const active = linkIsActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {active && <ChevronRight className="size-3.5 shrink-0" />}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* User info */}
      {!collapsed && user && (
        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="text-xs text-sidebar-foreground truncate font-medium">{user.nama}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role}</div>
        </div>
      )}

      {/* Logout */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full gap-2 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10",
            collapsed && "justify-center px-0"
          )}
          onClick={handleLogout}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Keluar</span>}
        </Button>
      </div>
    </aside>
  );
}
