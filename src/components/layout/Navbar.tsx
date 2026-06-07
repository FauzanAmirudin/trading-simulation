"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { TrendingUp, LogOut, User, LayoutDashboard, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { user, hydrated, logout } = useAuth();

  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium group relative">
          <div className="absolute -inset-2 rounded-full bg-indigo-500/20 dark:bg-cyan-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 dark:from-cyan-400 dark:to-blue-600 shadow-inner">
            <TrendingUp className="size-4 text-white" />
          </div>
          <span className="text-foreground/90 font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-300">
            Simulasi<span className="text-indigo-600 dark:text-cyan-400">Trading</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          {!hydrated ? (
            <div className="h-8 w-20" />
          ) : user ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                <User className="size-3.5" />
                {user.nama}
              </span>
              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant={pathname.startsWith("/admin") ? "secondary" : "ghost"} size="xs" className="gap-1.5 font-medium">
                    <Settings className="size-3.5" /> Panel Admin
                  </Button>
                </Link>
              )}
              {user.role === "responden" && (
                <Link href="/dashboard">
                  <Button variant={pathname.startsWith("/dashboard") ? "secondary" : "ghost"} size="xs" className="gap-1.5 font-medium">
                    <LayoutDashboard className="size-3.5" /> Dashboard
                  </Button>
                </Link>
              )}
              <ThemeToggle />
              <Button variant="ghost" size="xs" onClick={logout} title="Keluar">
                <LogOut className="size-3.5" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/login">
                <Button size="xs" variant="default" className="shadow-sm">Masuk</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
