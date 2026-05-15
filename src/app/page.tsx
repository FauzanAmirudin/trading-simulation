"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Wallet,
  Layers,
  ArrowRight,
  BarChart3,
  Users,
  Timer,
} from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Modal Virtual Rp 100 Juta",
    desc: "Setiap responden mendapat modal virtual untuk melakukan simulasi transaksi jual-beli saham tanpa risiko nyata.",
  },
  {
    icon: Timer,
    title: "Sistem Sesi Perdagangan",
    desc: "Terdapat 6 putaran sesi perdagangan dengan durasi tertentu yang dikontrol oleh admin riset.",
  },
  {
    icon: BarChart3,
    title: "Order Book Real-time",
    desc: "Pantau harga Bid/Ask secara langsung dan lakukan transaksi dengan mekanisme order book yang transparan.",
  },
  {
    icon: TrendingUp,
    title: "3 Saham Per Sesi",
    desc: "Setiap sesi menyajikan 3 saham pilihan untuk diprediksi dan diperdagangkan oleh responden.",
  },
  {
    icon: Layers,
    title: "Prediksi Harga",
    desc: "Sebelum sesi dimulai, responden memasukkan tebakan harga saham sebagai bagian dari data riset.",
  },
  {
    icon: Users,
    title: "Multi Responden",
    desc: "Hingga 60 responden dapat berpartisipasi secara bersamaan dalam satu sesi eksperimen.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-emerald-50 to-white py-24 dark:from-emerald-950/20 dark:to-background">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50">
              <TrendingUp className="size-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Simulasi Trading Saham
              <span className="block text-emerald-600 dark:text-emerald-400">
                Eksperimental
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Platform simulasi perdagangan saham berbasis riset. Uji strategi
              trading Anda dengan modal virtual Rp 100.000.000 dalam lingkungan
              pasar yang terkontrol.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/login">
                <Button size="lg" className="gap-2 text-base">
                  Mulai Eksperimen
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="#tentang">
                <Button variant="outline" size="lg" className="text-base">
                  Pelajari Lebih Lanjut
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="tentang" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight">
              Aturan Main Simulasi
            </h2>
            <p className="mt-2 text-muted-foreground">
              Pahami mekanisme sebelum memulai perdagangan
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                      <f.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <CardTitle className="mt-2">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-bold tracking-tight">
              Siap Memulai?
            </h2>
            <p className="mt-2 text-muted-foreground">
              Login sebagai responden atau admin untuk mengakses panel
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Masuk ke Panel Responden
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="outline" size="lg">
                  Panel Admin
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
