"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { TrendingUp, LogOut, User } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="size-4 text-emerald-500" />
          <span className="text-zinc-300">Riset Pasar Modal</span>
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <User className="size-3.5" />
                {user.nama}
              </span>
              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="xs">Panel Admin</Button>
                </Link>
              )}
              {user.role === "responden" && (
                <Link href="/dashboard">
                  <Button variant="ghost" size="xs">Dashboard</Button>
                </Link>
              )}
              <Button variant="ghost" size="xs" onClick={logout}>
                <LogOut className="size-3.5" />
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button size="xs" variant="outline">Masuk</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
