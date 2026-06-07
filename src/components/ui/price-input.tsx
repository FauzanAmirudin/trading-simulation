"use client";

import { useCallback } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTickSize, incrementPrice, decrementPrice, snapToTickSize } from "@/lib/market-rules";

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  basePrice?: number;
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
  basePrice,
  min = 1,
  max,
  placeholder = "Harga",
  className,
  disabled = false,
  id,
}: PriceInputProps) {
  const numericValue = parseInt(value) || 0;
  const currentRefPrice = numericValue > 0 ? numericValue : (basePrice || 0);
  const tickSize = currentRefPrice > 0 ? getTickSize(currentRefPrice) : 1;

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    const current = parseInt(value) || 0;
    let next: number;
    if (current > 0) {
      next = incrementPrice(current);
    } else {
      // If empty, increment from basePrice using its tick
      const ref = basePrice && basePrice > 0 ? basePrice : min;
      next = snapToTickSize(ref) + getTickSize(ref);
    }
    if (max !== undefined && next > max) return;
    onChange(String(next));
  }, [value, basePrice, min, max, disabled, onChange]);

  const handleDecrement = useCallback(() => {
    if (disabled) return;
    const current = parseInt(value) || 0;
    let next: number;
    if (current > 0) {
      next = decrementPrice(current);
    } else {
      // If empty, decrement from basePrice
      const ref = basePrice && basePrice > 0 ? basePrice : min;
      next = snapToTickSize(ref) - getTickSize(ref);
    }
    if (next < min) return;
    onChange(String(next));
  }, [value, basePrice, min, disabled, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Hanya terima angka positif, tidak boleh minus
    if (raw === "" || /^\d+$/.test(raw)) {
      onChange(raw);
    }
  }, [onChange]);

  const canDecrement = currentRefPrice > min;
  const canIncrement = max === undefined || currentRefPrice < max;

  return (
    <div className={cn("flex items-center rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-primary overflow-hidden", className)}>
      {/* Tombol Kurang */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || !canDecrement}
        className={cn(
          "flex items-center justify-center h-8 w-8 shrink-0 transition-colors bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-r border-border",
          "disabled:opacity-30 disabled:cursor-not-allowed"
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
        className="h-8 w-full min-w-[60px] bg-transparent text-center text-sm font-mono font-medium text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* Tombol Tambah */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || !canIncrement}
        className={cn(
          "flex items-center justify-center h-8 w-8 shrink-0 transition-colors bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-l border-border",
          "disabled:opacity-30 disabled:cursor-not-allowed"
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
export function TickSizeBadge({ price, basePrice }: { price: number; basePrice?: number }) {
  const effectivePrice = basePrice && basePrice > 0 ? basePrice : price;
  if (effectivePrice <= 0) return null;
  const tick = getTickSize(effectivePrice);
  return (
    <span className="text-[10px] text-muted-foreground font-mono">
      Fraksi: Rp {tick.toLocaleString("id-ID")}
    </span>
  );
}
