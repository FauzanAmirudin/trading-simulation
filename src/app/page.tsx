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
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 60%)",
          }}
        />
        <TrendingUp className="pointer-events-none absolute -left-12 top-20 size-48 text-emerald-500/5 rotate-12" />
        <Activity className="pointer-events-none absolute -right-8 bottom-20 size-40 text-emerald-500/5 -rotate-12" />

        <div className="mx-auto max-w-5xl px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="size-7 text-emerald-500" />
            </div>

            <div className="mb-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <span className="relative flex size-3">
                <RadioTower className="size-3 text-rose-500 animate-ping absolute" />
                <RadioTower className="size-3 text-rose-500 relative" />
              </span>
              <span>Sesi perdagangan <span className="text-zinc-400 font-medium">tidak aktif</span></span>
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
              Simulasi Trading{" "}
              <span className="text-emerald-500">&</span> Analisis
              <br />
              Perilaku Pasar
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-500 leading-relaxed">
              Platform eksperimen perdagangan saham berbasis riset. Uji strategi trading
              Anda dengan modal virtual Rp 100.000.000 dalam lingkungan pasar yang
              terkontrol dan terukur.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/login">
                <Button
                  size="lg"
                  className="gap-2 px-6 text-sm transition-all duration-300 hover:shadow-[0_0_20px_-5px] hover:shadow-emerald-500/20 hover:translate-x-[-2px] group"
                  disabled={!sessionActive}
                >
                  Masuk ke Panel Responden
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="px-6 text-sm">
                  Login Admin
                </Button>
              </Link>
            </div>
            {!sessionActive && (
              <p className="mt-3 text-xs text-zinc-600">
                Tombol responden aktif saat sesi dimulai oleh Admin
              </p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-2xl font-bold tracking-tight">Mekanisme Simulasi</h2>
            <p className="mt-1.5 text-sm text-zinc-500">Pahami alur eksperimen sebelum memulai</p>
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
                <Card className="h-full border-white/5 bg-zinc-900/50">
                  <CardHeader>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                      <f.icon className="size-4.5 text-emerald-500" />
                    </div>
                    <CardTitle className="mt-1.5 text-sm">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
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
