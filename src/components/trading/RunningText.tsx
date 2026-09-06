"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { InterventionType } from "@/lib/experimental-matrix";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunningTextProps {
  active?: boolean;
  type: InterventionType;
  title?: string;
  content: string;
  onDismiss?: () => void;
  className?: string;
}

export default function RunningText({
  active = true,
  type,
  title = "",
  content = "",
  className,
}: RunningTextProps) {
  const isPositive = type === "BERITA_BAIK";

  // Sanitize content: replace raw enum keys with natural informative copy
  const rawText = (() => {
    let txt = (content || title || "").trim();
    if (!txt || txt === "BERITA_BAIK" || txt === "BERITA_BURUK" || txt === "NONE") {
      return isPositive
        ? "Sentimen pasar sangat positif: Kinerja emiten menguat dan antusiasme akumulasi beli meningkat signifikan."
        : "Sentimen pasar tertekan: Terjadi aksi jual dan kehati-hatian investor terhadap pergerakan emiten.";
    }
    return txt;
  })();

  // Split the content by the ✦ separator that server.ts uses to join per-stock news
  // Each item looks like: "[ S-19 ] Berita bagus ..."
  const segments = rawText
    .split(/\s*✦\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Fallback if empty
  if (segments.length === 0) {
    segments.push(rawText);
  }

  // Parse each segment: extract stock code from "[ S-19 ] some text"
  const parsed = segments.map((seg) => {
    const match = seg.match(/^\[\s*(.+?)\s*\]\s*(.+)$/);
    if (match) return { code: match[1].trim(), text: match[2].trim() };
    return { code: null, text: seg };
  });

  // Build the ticker items — repeat 6 times so the ticker loops seamlessly
  const items = Array.from({ length: 6 }, () => parsed).flat();

  const colorCls = {
    bg: "bg-zinc-950/95 dark:bg-zinc-950/95",
    border: isPositive
      ? "border-emerald-500/40 shadow-emerald-500/10"
      : "border-rose-500/40 shadow-rose-500/10",
    badgeBg: isPositive
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : "bg-rose-500/15 text-rose-400 border-rose-500/30",
    beaconBg: isPositive ? "bg-emerald-400" : "bg-rose-400",
    text: "text-zinc-100",
    stockCode: isPositive
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40",
    separator: isPositive ? "text-emerald-400/60" : "text-rose-400/60",
    gradFrom: "from-zinc-950",
    gradTo: "to-zinc-950",
  };

  // Dynamic marquee speed based on total character length
  const totalLength = segments.reduce((acc, s) => acc + s.length, 0);
  const durationSec = Math.max(12, Math.min(55, (totalLength / 14) + (segments.length * 3.5)));

  return (
    <AnimatePresence>
      {active && type !== "NONE" && (
        <motion.div
          key="running-text"
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "relative w-full overflow-hidden rounded-xl sm:rounded-2xl border shadow-lg backdrop-blur-xl flex items-center select-none",
            colorCls.bg,
            colorCls.border,
            className
          )}
          role="marquee"
          aria-live="polite"
        >
          {/* Left Fluid Sticky Category Badge */}
          <div className="relative z-20 flex items-center gap-1 sm:gap-1.5 pl-2 sm:pl-2.5 pr-1.5 sm:pr-2 py-1.5 sm:py-2 shrink-0 bg-zinc-950/90 border-r border-border/30 backdrop-blur-md">
            <span className="relative flex size-1.5 sm:size-2 shrink-0">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", colorCls.beaconBg)} />
              <span className={cn("relative inline-flex rounded-full size-1.5 sm:size-2", colorCls.beaconBg)} />
            </span>
            <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md sm:rounded-lg border text-[9.5px] sm:text-[11px] font-black tracking-wider uppercase", colorCls.badgeBg)}>
              {isPositive ? (
                <TrendingUp className="size-2.5 sm:size-3 shrink-0" />
              ) : (
                <TrendingDown className="size-2.5 sm:size-3 shrink-0" />
              )}
              <span className="whitespace-nowrap font-sans">
                {isPositive ? "Berita Baik" : "Berita Buruk"}
              </span>
            </div>
          </div>

          {/* Scrolling ticker area with relative fluid edge fades */}
          <div className="flex-1 py-1.5 sm:py-2 overflow-hidden relative min-w-0">
            {/* Left & Right relative fade edges without fixed pixel bounds */}
            <div className={cn("absolute inset-y-0 left-0 w-3 sm:w-6 z-10 pointer-events-none bg-gradient-to-r", colorCls.gradFrom, "to-transparent")} />
            <div className={cn("absolute inset-y-0 right-0 w-3 sm:w-6 z-10 pointer-events-none bg-gradient-to-l", colorCls.gradTo, "to-transparent")} />

            <div
              className="flex items-center whitespace-nowrap will-change-transform w-max hover:[animation-play-state:paused]"
              style={{ animation: `rt-marquee ${durationSec}s linear infinite` }}
            >
              {items.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4">
                  {item.code && (
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-black font-mono tracking-wide",
                        colorCls.stockCode
                      )}
                    >
                      {item.code}
                    </span>
                  )}
                  <span className={cn("text-[11px] sm:text-xs md:text-[13px] font-medium leading-tight", colorCls.text)}>
                    {item.text}
                  </span>
                  {/* Separator between items */}
                  {i < items.length - 1 && (
                    <span className={cn("mx-1.5 sm:mx-2 text-[10px] sm:text-xs select-none", colorCls.separator)}>✦</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <style>{`
            @keyframes rt-marquee {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-${(100 / 6).toFixed(4)}%); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
