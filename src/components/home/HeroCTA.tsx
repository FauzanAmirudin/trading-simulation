"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, ChevronRight, Zap } from "lucide-react";

export function HeroCTA() {
  const { user } = useAuth();

  return (
    <div className="w-full max-w-xs sm:max-w-sm">
      {user ? (
        <Link
          href={user.role === "admin" ? "/admin" : "/dashboard"}
          prefetch={true}
          className="block w-full"
        >
          <Button
            size="lg"
            className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-between px-4 sm:px-6 min-h-[48px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="truncate">Lanjutkan Sesi ({user.nama})</span>
            </div>
            <ArrowRight className="size-4 shrink-0 ml-2" />
          </Button>
        </Link>
      ) : (
        <Link href="/login" prefetch={true} className="block w-full">
          <Button
            size="lg"
            className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-4 sm:px-6 min-h-[48px]"
          >
            <Zap className="size-4 shrink-0" />
            <span>Masuk Simulasi</span>
            <ChevronRight className="size-4 ml-auto" />
          </Button>
        </Link>
      )}
    </div>
  );
}
