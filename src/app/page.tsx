"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ArrowRight,
  BarChart3,
  Users,
  Timer,
  Layers,
  Sparkles,
  Zap,
  ChevronRight,
  DollarSign,
} from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Modal Rp 100 Jt",
    desc: "Dana virtual bebas risiko finansial untuk setiap responden.",
    color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    icon: Timer,
    title: "6 Sesi Riset",
    desc: "Putaran perdagangan terukur yang dikontrol server.",
    color: "from-indigo-500/10 to-violet-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  {
    icon: BarChart3,
    title: "Order Book Live",
    desc: "Mekanisme lelang kontinu dengan antrean Bid/Ask instan.",
    color: "from-cyan-500/10 to-blue-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  {
    icon: Layers,
    title: "Multi-Saham",
    desc: "Saham pilihan untuk diprediksi & ditradingkan.",
    color: "from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    icon: Sparkles,
    title: "Prediksi Harga",
    desc: "Tebakan harga pra-pasar untuk riset perilaku ekonomi.",
    color: "from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    icon: Users,
    title: "Multi-Trader",
    desc: "Partisipasi simultan puluhan responden real-time.",
    color: "from-sky-500/10 to-indigo-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
];

export default function Home() {
  const { user, hydrated } = useAuth();

  return (
    <div className="flex flex-col w-full min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-12">
        {/* ─── 1. HERO SECTION (ULTRA-FLUID & ERGONOMIC) ─── */}
        <section className="relative overflow-hidden w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-14 pb-6 sm:pb-12">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 sm:size-96 rounded-full bg-gradient-to-tr from-indigo-500/15 to-cyan-500/15 blur-3xl" />

        <div className="mx-auto max-w-3xl text-center relative z-10 space-y-3.5 sm:space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            {/* Brand Favicon Logo with Soft Glow */}
            <div className="relative mb-3 sm:mb-4 group">
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-indigo-500/30 to-cyan-500/30 blur-md opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex size-12 sm:size-16 items-center justify-center rounded-2xl bg-background border border-border/80 shadow-md">
                <Image
                  src="/logo-icon-64.png"
                  alt="Logo Simulasi Investasi"
                  width={56}
                  height={56}
                  className="size-8 sm:size-11 object-contain"
                  priority
                  unoptimized
                />
              </div>
            </div>

            {/* Fluid Headline Clamp (Balanced, No Overflow) */}
            <h1 className="font-extrabold tracking-tight text-foreground text-[clamp(1.25rem,5.5vw,2.25rem)] leading-tight max-w-2xl text-balance">
              Simulasi Investasi & Riset Pasar
            </h1>
            
            <p className="mt-2 text-[11px] sm:text-sm text-muted-foreground max-w-xl text-balance leading-relaxed">
              Platform lelang pasar saham kontinu untuk riset ekonomi eksperimental & analisis perilaku pasar modal secara real-time.
            </p>
          </motion.div>

          {/* Primary Call-To-Action in Thumb-Zone */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="pt-1 sm:pt-2 flex flex-col items-center"
          >
            <div className="w-full max-w-xs sm:max-w-sm">
              {!hydrated ? (
                <div className="h-12 w-full rounded-2xl bg-muted/60 animate-pulse" />
              ) : user ? (
                <Link href={user.role === "admin" ? "/admin" : "/dashboard"} className="block w-full">
                  <Button
                    size="lg"
                    className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-between px-4 sm:px-6 min-h-[48px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="truncate">Lanjutkan Sesi ({user.nama})</span>
                    </div>
                    <ArrowRight className="size-4 shrink-0" />
                  </Button>
                </Link>
              ) : (
                <Link href="/login" className="block w-full">
                  <Button
                    size="lg"
                    className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-4 sm:px-6 min-h-[48px]"
                  >
                    <Zap className="size-4" />
                    <span>Masuk Simulasi</span>
                    <ChevronRight className="size-4 ml-auto" />
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── 2. COMPACT BENTO FEATURES GRID (2 COLUMNS ON MOBILE) ─── */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-10">
        <div className="text-center mb-3 sm:mb-6">
          <h2 className="text-xs sm:text-lg font-bold tracking-tight text-foreground">
            Fitur Utama Eksperimen
          </h2>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            Didesain khusus untuk riset perilaku ekonomi pasar modal
          </p>
        </div>

        {/* 2-Columns on Mobile (320px+), 3-Columns on Tablet/Desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3.5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <Card className="rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-all shadow-2xs p-2.5 sm:p-4 flex flex-col justify-between h-full group">
                  <div className="space-y-1.5">
                    <div
                      className={`flex size-8 sm:size-9 items-center justify-center rounded-xl bg-gradient-to-br border shrink-0 ${f.color} transition-transform group-hover:scale-105`}
                    >
                      <Icon className="size-4 sm:size-4.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[11px] sm:text-xs text-foreground truncate">
                        {f.title}
                      </h3>
                      <p className="text-[9.5px] sm:text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
}
