"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { TrendingUp, LogOut } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-5 text-emerald-500" />
          <span>Trading Simulasi</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.nama} ({user.role})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
              >
                <LogOut className="size-4" />
                Keluar
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Masuk</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
