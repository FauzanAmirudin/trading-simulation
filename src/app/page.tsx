"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ArrowRight,
  Activity,
  RadioTower,
  BarChart3,
  Users,
  Timer,
  Wallet,
  Layers,
  BookOpen,
  DollarSign,
} from "lucide-react";

const features = [
  { icon: DollarSign, title: "Modal Virtual Rp 100 Juta", desc: "Setiap responden mendapatkan dana virtual untuk bertransaksi tanpa risiko finansial nyata." },
  { icon: Timer, title: "6 Sesi Perdagangan", desc: "Eksperimen terdiri dari 6 putaran sesi yang dikontrol penuh oleh peneliti melalui panel admin." },
  { icon: BarChart3, title: "Order Book Real-time", desc: "Mekanisme lelang saham dengan antrean Bid dan Ask yang dapat dipantau secara langsung." },
  { icon: Layers, title: "3 Saham Per Sesi", desc: "Setiap sesi menyajikan 3 saham pilihan untuk diprediksi dan diperdagangkan oleh responden." },
  { icon: BookOpen, title: "Prediksi Harga", desc: "Responden memasukkan tebakan harga sebelum sesi dimulai sebagai data riset perilaku." },
  { icon: Users, title: "Multi Responden", desc: "Hingga 60 responden berpartisipasi bersamaan dalam satu lingkungan pasar eksperimental." },
];

export default function Home() {
  const sessionActive = false;

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,70,229,0.15)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(6,182,212,0.12)_0%,transparent_60%)]" />
        <TrendingUp className="pointer-events-none absolute -left-12 top-20 size-48 text-primary/5 rotate-12" />
        <Activity className="pointer-events-none absolute -right-8 bottom-20 size-40 text-primary/5 -rotate-12" />

        <div className="mx-auto max-w-5xl px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 dark:from-cyan-400 dark:to-blue-600 shadow-lg shadow-indigo-500/20 dark:shadow-cyan-500/20 ring-1 ring-white/10">
              <TrendingUp className="size-8 text-white" />
            </div>

            <div className="mb-6 inline-flex items-center justify-center gap-2 text-xs font-medium px-4 py-1.5 rounded-full bg-muted/50 border border-border/50 backdrop-blur-sm">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2.5 bg-rose-500"></span>
              </span>
              <span className="text-muted-foreground">Sesi perdagangan <span className="text-foreground">tidak aktif</span></span>
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
              Simulasi Trading{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-600 dark:from-cyan-400 dark:to-blue-500">&</span> Analisis
              <br className="hidden sm:block" />
              <span className="relative">
                Perilaku Pasar
                <svg className="absolute -bottom-2 w-full h-3 text-indigo-500/30 dark:text-cyan-400/30 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Platform eksperimen perdagangan saham berbasis riset. Uji strategi trading
              Anda dengan modal virtual Rp 100.000.000 dalam lingkungan pasar yang
              terkontrol dan terukur.
            </p>

          </motion.div>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Mekanisme Simulasi</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Pahami alur eksperimen sebelum memulai</p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="group h-full border-border bg-white/80 backdrop-blur-md shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 dark:shadow-none dark:bg-slate-950/60 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-0 right-0 p-8 bg-indigo-500/5 dark:bg-cyan-500/5 rounded-bl-[100px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                  <CardHeader className="relative">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/40 dark:to-violet-900/40 text-indigo-600 dark:text-indigo-400 shadow-inner border border-indigo-100/50 dark:border-indigo-800/30 mb-2 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                      <f.icon className="size-5" />
                    </div>
                    <CardTitle className="text-base font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
