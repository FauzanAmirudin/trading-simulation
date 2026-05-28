"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { InterventionType } from "@/lib/experimental-matrix";

interface RunningTextProps {
  active: boolean;
  type: InterventionType;
  title: string;
  content: string;
}

export default function RunningText({ active, type, title, content }: RunningTextProps) {
  const isPositive = type === "BERITA_BAIK";
  const rawText = content || title;

  // Split the content by the ✦ separator that server.ts uses to join per-stock news
  // Each item looks like: "[ S-19 ] Berita bagus ..."
  const segments = rawText
    .split(/\s*✦\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Parse each segment: extract stock code from "[ S-19 ] some text"
  const parsed = segments.map((seg) => {
    const match = seg.match(/^\[\s*(.+?)\s*\]\s*(.+)$/);
    if (match) return { code: match[1].trim(), text: match[2].trim() };
    return { code: null, text: seg };
  });

  // Build the ticker items — we repeat 6 times so the ticker never "runs out"
  const items = Array.from({ length: 6 }, () => parsed).flat();

  const colorCls = {
    bg: isPositive ? "bg-emerald-950/80" : "bg-rose-950/80",
    border: isPositive ? "border-emerald-500/30" : "border-rose-500/30",
    shadow: isPositive ? "shadow-emerald-500/10" : "shadow-rose-500/10",
    text: isPositive ? "text-emerald-100" : "text-rose-100",
    badge: isPositive
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40",
    separator: isPositive ? "text-emerald-500/60" : "text-rose-500/60",
    gradFrom: isPositive ? "from-emerald-950/90" : "from-rose-950/90",
    gradTo: isPositive ? "to-emerald-950/90" : "to-rose-950/90",
  };

  // Animation duration
  const durationSec = Math.max(10, segments.length * 4.5);

  return (
    <AnimatePresence>
      {active && type !== "NONE" && (
        <motion.div
          key="running-text"
          initial={{ opacity: 0, y: -16, scaleY: 0.85 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -16, scaleY: 0.85 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`relative overflow-hidden rounded-xl border ${colorCls.bg} ${colorCls.border} shadow-lg ${colorCls.shadow}`}
          style={{ backdropFilter: "blur(8px)" }}
        >

          {/* Fade edges */}
          <div className={`absolute inset-y-0 left-0 w-8 z-10 pointer-events-none bg-gradient-to-r ${colorCls.gradFrom} to-transparent`} />
          <div className={`absolute inset-y-0 right-0 w-8 z-10 pointer-events-none bg-gradient-to-l ${colorCls.gradTo} to-transparent`} />

          {/* Scrolling ticker */}
          <div className="py-2.5 overflow-hidden">
            <div
              className="flex items-center whitespace-nowrap will-change-transform w-max"
              style={{ animation: `rt-marquee ${durationSec}s linear infinite` }}
            >
              {items.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 px-4">
                  {item.code && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide ${colorCls.badge}`}
                    >
                      {item.code}
                    </span>
                  )}
                  <span className={`text-sm font-medium ${colorCls.text}`}>{item.text}</span>
                  {/* Separator between items, not after last */}
                  {i < items.length - 1 && (
                    <span className={`mx-3 text-lg font-light select-none ${colorCls.separator}`}>◆</span>
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
