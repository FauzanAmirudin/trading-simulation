"use client";

import { useCallback } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTickSize, incrementPrice, decrementPrice, snapToTickSize } from "@/lib/market-rules";

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Komponen input harga dengan tombol +/- yang menyesuaikan fraksi BEI secara dinamis.
 * Step tombol +/- berubah otomatis berdasarkan harga saat ini sesuai aturan Fraksi Harga BEI.
 */
export function PriceInput({
  value,
  onChange,
  min = 1,
  max,
  placeholder = "Harga",
  className,
  disabled = false,
  id,
}: PriceInputProps) {
  const numericValue = parseInt(value) || 0;
  const tickSize = numericValue > 0 ? getTickSize(numericValue) : 1;

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    const current = parseInt(value) || 0;
    const next = current > 0 ? incrementPrice(current) : snapToTickSize(min);
    if (max !== undefined && next > max) return;
    onChange(String(next));
  }, [value, min, max, disabled, onChange]);

  const handleDecrement = useCallback(() => {
    if (disabled) return;
    const current = parseInt(value) || 0;
    if (current <= 0) return;
    const next = decrementPrice(current);
    if (next < min) return;
    onChange(String(next));
  }, [value, min, disabled, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Hanya terima angka positif, tidak boleh minus
    if (raw === "" || /^\d+$/.test(raw)) {
      onChange(raw);
    }
  }, [onChange]);

  const canDecrement = numericValue > min;
  const canIncrement = max === undefined || numericValue < max;

  return (
    <div className={cn("flex items-center rounded-md border border-white/10 bg-zinc-800 overflow-hidden", className)}>
      {/* Tombol Kurang */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || !canDecrement}
        className={cn(
          "flex items-center justify-center h-8 w-8 shrink-0 transition-colors",
          "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        )}
        tabIndex={-1}
        aria-label="Turunkan harga"
      >
        <Minus className="size-3" />
      </button>

      {/* Input Angka */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex-1 min-w-0 bg-transparent text-center text-xs font-mono text-zinc-200",
          "focus:outline-none placeholder:text-zinc-600",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />

      {/* Tombol Tambah */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || !canIncrement}
        className={cn(
          "flex items-center justify-center h-8 w-8 shrink-0 transition-colors",
          "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        )}
        tabIndex={-1}
        aria-label="Naikkan harga"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

/**
 * Badge kecil yang menampilkan fraksi aktif berdasarkan harga.
 */
export function TickSizeBadge({ price }: { price: number }) {
  if (price <= 0) return null;
  const tick = getTickSize(price);
  return (
    <span className="text-[10px] text-zinc-600 font-mono">
      Fraksi: Rp {tick.toLocaleString("id-ID")}
    </span>
  );
}
