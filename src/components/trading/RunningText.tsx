"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadioTower, TrendingUp, TrendingDown } from "lucide-react";
import type { InterventionType } from "@/lib/experimental-matrix";

interface RunningTextProps {
  active: boolean;
  type: InterventionType;
  title: string;
  content: string;
}

export default function RunningText({ active, type, title, content }: RunningTextProps) {
  const isPositive = type === "BERITA_BAIK";
  const text = content ? `${title}  ——  ${content}` : title;

  return (
    <AnimatePresence>
      {active && type !== "NONE" && (
        <motion.div
          key="running-text"
          initial={{ opacity: 0, y: -20, scaleY: 0.8 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -20, scaleY: 0.8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`relative overflow-hidden rounded-xl border px-0 py-0 ${
            isPositive
              ? "bg-emerald-950/80 border-emerald-500/30 shadow-lg shadow-emerald-500/10"
              : "bg-rose-950/80 border-rose-500/30 shadow-lg shadow-rose-500/10"
          }`}
          style={{ backdropFilter: "blur(8px)" }}
        >
          {/* Label badge */}
          <div className={`flex items-center gap-2 px-4 pt-2.5 pb-1.5 border-b ${isPositive ? "border-emerald-500/20" : "border-rose-500/20"}`}>
            <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
              {isPositive
                ? <TrendingUp className="size-3" />
                : <TrendingDown className="size-3" />}
              {isPositive ? "Berita Baik" : "Berita Buruk"}
            </span>
            <span className={`flex items-center gap-1 text-[9px] font-medium ml-auto animate-pulse ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
              <RadioTower className="size-2.5" /> SIARAN LANGSUNG
            </span>
          </div>

          {/* Scrolling ticker area */}
          <div className="relative py-2 overflow-hidden">
            <div className={`absolute inset-y-0 left-0 w-8 z-10 pointer-events-none ${isPositive ? "bg-gradient-to-r from-emerald-950/80" : "bg-gradient-to-r from-rose-950/80"}`} />
            <div className={`absolute inset-y-0 right-0 w-8 z-10 pointer-events-none ${isPositive ? "bg-gradient-to-l from-emerald-950/80" : "bg-gradient-to-l from-rose-950/80"}`} />

            {/* Infinitely scrolling text */}
            <div className="flex whitespace-nowrap will-change-transform" style={{ animation: "marquee 24s linear infinite" }}>
              <span className={`text-sm font-medium px-8 ${isPositive ? "text-emerald-100" : "text-rose-100"}`}>
                {text}
              </span>
              <span className={`text-sm font-medium px-8 ${isPositive ? "text-emerald-100" : "text-rose-100"}`} aria-hidden>
                {text}
              </span>
              <span className={`text-sm font-medium px-8 ${isPositive ? "text-emerald-100" : "text-rose-100"}`} aria-hidden>
                {text}
              </span>
            </div>
          </div>

          {/* CSS for marquee animation */}
          <style>{`
            @keyframes marquee {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-33.333%); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
