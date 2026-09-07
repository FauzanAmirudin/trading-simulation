"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, LogOut, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SessionTimeoutModalProps = {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
};

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onExtend,
  onLogout,
}: SessionTimeoutModalProps) {
  const isUrgent = secondsRemaining <= 15;
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-timeout-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-2xl border border-border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl p-6 flex flex-col items-center text-center"
          >
            {/* Subtle decorative glow */}
            <div
              className={`pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 ${
                isUrgent ? "bg-rose-500" : "bg-amber-500"
              }`}
            />

            {/* Warning Icon Badge */}
            <div
              className={`relative mb-4 flex size-14 items-center justify-center rounded-2xl border transition-all duration-300 ${
                isUrgent
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isUrgent ? (
                <AlertCircle className="size-7" />
              ) : (
                <Clock className="size-7" />
              )}
              <span
                className={`absolute -top-1 -right-1 size-3 rounded-full border-2 border-background ${
                  isUrgent ? "bg-rose-500 animate-ping" : "bg-amber-500"
                }`}
              />
            </div>

            {/* Title & Description */}
            <h3
              id="session-timeout-title"
              className="text-lg font-black tracking-tight text-foreground sm:text-xl"
            >
              Sesi Akan Segera Berakhir
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs">
              Tidak ada aktivitas terdeteksi selama hampir 1 jam. Demi keamanan akun,
              Anda akan otomatis keluar dalam:
            </p>

            {/* Prominent Countdown Display */}
            <div className="my-5 flex flex-col items-center">
              <div
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full border font-mono text-2xl font-black transition-colors ${
                  isUrgent
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                }`}
              >
                <Clock className="size-5" />
                <span>{formattedTime}</span>
              </div>
              <span className="mt-1 text-[11px] text-muted-foreground font-medium">
                {secondsRemaining} detik tersisa
              </span>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row items-center gap-2.5 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onLogout}
                className="w-full sm:flex-1 h-11 text-xs sm:text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 gap-2 order-2 sm:order-1"
              >
                <LogOut className="size-4" />
                Keluar Sekarang
              </Button>
              <Button
                type="button"
                onClick={onExtend}
                className={`w-full sm:flex-1 h-11 text-xs sm:text-sm font-bold gap-2 order-1 sm:order-2 shadow-md ${
                  isUrgent
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                <RotateCcw className="size-4" />
                Lanjutkan Sesi
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
