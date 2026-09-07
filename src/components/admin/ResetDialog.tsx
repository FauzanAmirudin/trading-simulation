"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Trash2,
  X,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ResetMode = "state" | "session" | "full";

interface ResetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: ResetMode, confirmToken?: string) => void;
  isProcessing?: boolean;
}

export function ResetDialog({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
}: ResetDialogProps) {
  const [selectedMode, setSelectedMode] = useState<ResetMode>("state");
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmInput, setConfirmInput] = useState("");

  if (!isOpen) return null;

  const handleModeSelect = (mode: ResetMode) => {
    setSelectedMode(mode);
  };

  const handleNextOrConfirm = () => {
    if (selectedMode === "full" && step === 1) {
      setStep(2);
      setConfirmInput("");
      return;
    }
    if (selectedMode === "full" && step === 2) {
      if (confirmInput.trim().toUpperCase() !== "RESET") return;
      onConfirm("full", "RESET");
      return;
    }
    onConfirm(selectedMode);
  };

  const handleClose = () => {
    setStep(1);
    setConfirmInput("");
    setSelectedMode("state");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-card/95 border border-border/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "p-2 rounded-xl border flex items-center justify-center",
                  selectedMode === "full"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : selectedMode === "session"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                )}
              >
                {selectedMode === "full" ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <RefreshCw className="size-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {step === 2
                    ? "Konfirmasi Tindakan Berbahaya"
                    : "Pilih Opsi Reset Eksperimen"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {step === 2
                    ? "Penghapusan data riset bersifat permanen"
                    : "Pilih cakupan reset sesuai kebutuhan"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {step === 1 ? (
              <div className="space-y-3">
                {/* Level 1: State Only (Recommended / Safe) */}
                <div
                  onClick={() => handleModeSelect("state")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5",
                    selectedMode === "state"
                      ? "border-emerald-500/80 bg-emerald-500/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-muted/20"
                  )}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Level 1: Reset State Saja
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/20">
                        Aman · Direkomendasikan
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Mereset timer, ronde, dan status sesi kembali ke awal
                      (tombol <em>Mulai</em> aktif kembali). Riwayat transaksi,
                      order book, saldo, dan portofolio <strong>tetap utuh tersimpan</strong>.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "size-4 rounded-full border flex items-center justify-center mt-1 transition-colors",
                      selectedMode === "state"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {selectedMode === "state" && (
                      <CheckCircle2 className="size-3 text-emerald-950 stroke-[3]" />
                    )}
                  </div>
                </div>

                {/* Level 2: Session Reset */}
                <div
                  onClick={() => handleModeSelect("session")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5",
                    selectedMode === "session"
                      ? "border-amber-500/80 bg-amber-500/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-muted/20"
                  )}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Zap className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Level 2: Reset Sesi & Batalkan Order
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-400 rounded-full border border-amber-500/20">
                        Sedang
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Semua aksi Level 1 ditambah pembatalan seluruh antrean order
                      terbuka (<em>open orders</em>) yang menggantung. Transaksi yang
                      sudah match tetap tersimpan.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "size-4 rounded-full border flex items-center justify-center mt-1 transition-colors",
                      selectedMode === "session"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {selectedMode === "session" && (
                      <CheckCircle2 className="size-3 text-amber-950 stroke-[3]" />
                    )}
                  </div>
                </div>

                {/* Level 3: Full Data Wipe */}
                <div
                  onClick={() => handleModeSelect("full")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5",
                    selectedMode === "full"
                      ? "border-rose-500/80 bg-rose-500/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-muted/20"
                  )}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                    <Trash2 className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Level 3: Reset Penuh & Bersihkan Data
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/15 text-rose-400 rounded-full border border-rose-500/20">
                        Danger Zone
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Menghapus <strong>seluruh data transaksi, order book, dan prediksi</strong>.
                      Mengembalikan saldo semua responden ke Rp 100.000.000 dan portofolio
                      ke kondisi awal.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "size-4 rounded-full border flex items-center justify-center mt-1 transition-colors",
                      selectedMode === "full"
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {selectedMode === "full" && (
                      <CheckCircle2 className="size-3 text-rose-950 stroke-[3]" />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Danger Zone Confirmation */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="size-4" /> Peringatan Kehilangan Data:
                  </div>
                  <p>
                    Tindakan ini akan <strong>menghapus permanen seluruh riwayat transaksi</strong>,
                    prediksi harga, antrean lelang, serta mengembalikan seluruh saldo responden
                    menjadi Rp 100.000.000.
                  </p>
                  <p className="text-muted-foreground">
                    Pastikan Anda telah mengekspor file laporan Excel terlebih dahulu jika data riset ini masih dibutuhkan.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="size-3 text-rose-400" />
                    Ketik kata <strong className="text-rose-400 font-mono">RESET</strong> untuk mengonfirmasi:
                  </label>
                  <Input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="Ketik RESET di sini"
                    className="font-mono uppercase tracking-wider text-sm border-rose-500/40 focus-visible:border-rose-500"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
            {step === 2 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={isProcessing}
                className="text-xs"
              >
                ‹ Kembali
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isProcessing}
                className="text-xs text-muted-foreground"
              >
                Batal
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNextOrConfirm}
              disabled={
                isProcessing ||
                (step === 2 && confirmInput.trim().toUpperCase() !== "RESET")
              }
              className={cn(
                "text-xs font-semibold gap-1.5 min-w-[120px]",
                selectedMode === "full"
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/40"
                  : selectedMode === "session"
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-950/40"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/40"
              )}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="size-3 animate-spin" /> Memproses...
                </>
              ) : step === 2 ? (
                <>
                  <Trash2 className="size-3" /> Hapus & Reset Penuh
                </>
              ) : selectedMode === "full" ? (
                <>
                  Lanjut ke Konfirmasi ›
                </>
              ) : (
                <>
                  <RefreshCw className="size-3" /> Jalankan Reset
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
