"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LogOut, User, LayoutDashboard, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { user, hydrated, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-xs">
      <div className="w-full max-w-7xl mx-auto flex h-13 sm:h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2 group shrink-0 min-w-0">
          <div className="relative flex size-7 sm:size-8 items-center justify-center rounded-xl overflow-hidden shadow-xs shrink-0 bg-background">
            <Image
              src="/logo-icon-64.png"
              alt="Logo Simulasi Investasi"
              width={32}
              height={32}
              className="size-full object-contain"
              priority
              unoptimized
            />
          </div>
          <span className="text-foreground tracking-tight text-xs sm:text-base font-bold truncate">
            Simulasi<span className="text-indigo-600 dark:text-cyan-400">Investasi</span>
          </span>
        </Link>

        {/* Right Navigation & Controls */}
        <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!hydrated ? (
            <div className="h-7 w-14" />
          ) : user ? (
            <>
              {/* Desktop links */}
              <div className="hidden md:flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/50">
                  <User className="size-3.5 text-primary" />
                  {user.nama}
                </span>
                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button variant={pathname.startsWith("/admin") ? "secondary" : "ghost"} size="sm" className="gap-1.5 font-medium text-xs h-8">
                      <Settings className="size-3.5" /> Panel Admin
                    </Button>
                  </Link>
                )}
                {user.role === "responden" && (
                  <Link href="/dashboard">
                    <Button variant={pathname.startsWith("/dashboard") ? "secondary" : "ghost"} size="sm" className="gap-1.5 font-medium text-xs h-8">
                      <LayoutDashboard className="size-3.5" /> Dashboard
                    </Button>
                  </Link>
                )}
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={logout} title="Keluar" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500">
                  <LogOut className="size-4" />
                </Button>
              </div>

              {/* Mobile compact header right */}
              <div className="flex md:hidden items-center gap-1.5">
                <ThemeToggle />
                <div className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="max-w-[65px] truncate">{user.nama}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <Link href="/login">
                <Button size="sm" variant="default" className="rounded-xl px-3 text-xs font-semibold h-7.5 shadow-xs">
                  Masuk
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
