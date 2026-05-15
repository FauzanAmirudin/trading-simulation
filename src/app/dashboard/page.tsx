"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Timer,
  Send,
} from "lucide-react";
import { toast } from "sonner";

// Mock data — akan diganti dengan API nyata
const MOCK_STOCKS = [
  { kode: "BBCA", nama: "Bank Central Asia Tbk.", price: 10250 },
  { kode: "BBRI", nama: "Bank Rakyat Indonesia Tbk.", price: 5650 },
  { kode: "TLKM", nama: "Telkom Indonesia Tbk.", price: 3950 },
];

const MOCK_ORDERS = [
  { tipe: "BID", harga: 10200, jumlah: 5, user: "A-01" },
  { tipe: "BID", harga: 10150, jumlah: 3, user: "A-02" },
  { tipe: "ASK", harga: 10300, jumlah: 2, user: "A-03" },
  { tipe: "ASK", harga: 10350, jumlah: 4, user: "A-04" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"premarket" | "trading">("premarket");
  const [predictions, setPredictions] = useState<Record<string, string>>({});
  const [balance] = useState(100_000_000);
  const [portfolio] = useState<{ kode: string; lot: number; avg: number }[]>([]);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  if (!user) return null;

  const cashStyle = {
    color: balance >= 0 ? "#16a34a" : "#dc2626",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard Responden
          </h1>
          <p className="text-sm text-muted-foreground">
            Selamat datang, {user.nama}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "premarket" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("premarket")}
          >
            <Timer className="size-4" />
            Pre-Market
          </Button>
          <Button
            variant={activeTab === "trading" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("trading")}
          >
            <TrendingUp className="size-4" />
            Trading
          </Button>
        </div>
      </motion.div>

      {/* Portfolio Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Wallet className="size-5 text-muted-foreground" />
            <div className="text-sm font-medium">Sisa Kas</div>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={balance}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold"
                style={cashStyle}
              >
                Rp {balance.toLocaleString("id-ID")}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <TrendingUp className="size-5 text-muted-foreground" />
            <div className="text-sm font-medium">Total Portofolio</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {(balance + portfolio.reduce((s, p) => s + p.lot * 100 * p.avg, 0)).toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <DollarSign className="size-5 text-muted-foreground" />
            <div className="text-sm font-medium">Saham Dimiliki</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.length} Lot</div>
          </CardContent>
        </Card>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "premarket" ? (
          <motion.div
            key="premarket"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Pre-Market — Sesi 1</CardTitle>
                <CardDescription>
                  Masukkan tebahan harga untuk 3 saham sesi ini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  {MOCK_STOCKS.map((s) => (
                    <Card key={s.kode} size="sm">
                      <CardHeader>
                        <CardTitle>{s.kode}</CardTitle>
                        <CardDescription>{s.nama}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-2 text-sm text-muted-foreground">
                          Harga awal: Rp {s.price.toLocaleString("id-ID")}
                        </div>
                        <Input
                          type="number"
                          placeholder="Tebakan harga"
                          value={predictions[s.kode] || ""}
                          onChange={(e) =>
                            setPredictions((p) => ({
                              ...p,
                              [s.kode]: e.target.value,
                            }))
                          }
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => toast.success("Tebakan harga dikirim!")}
                >
                  <Send className="size-4" />
                  Kirim Prediksi
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="trading"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid gap-6 lg:grid-cols-3"
          >
            {/* Order Book */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Order Book — BBCA</CardTitle>
                  <CardDescription>
                    Daftar permintaan jual (ASK) dan beli (BID)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Harga</TableHead>
                        <TableHead>Jumlah (Lot)</TableHead>
                        <TableHead>Dari</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_ORDERS.map((o, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                                o.tipe === "BID"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                              }`}
                            >
                              {o.tipe === "BID" ? (
                                <TrendingUp className="size-3" />
                              ) : (
                                <TrendingDown className="size-3" />
                              )}
                              {o.tipe}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono">
                            Rp {o.harga.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell>{o.jumlah}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {o.user}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Portofolio Saya</CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolio.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Belum memiliki saham
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {portfolio.map((p) => (
                        <div
                          key={p.kode}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <div className="font-medium">{p.kode}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.lot} lot @ Rp {p.avg.toLocaleString("id-ID")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm font-medium">
                              Rp{" "}
                              {(p.lot * 100 * p.avg).toLocaleString("id-ID")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Buat Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Harga" type="number" />
                  <Input placeholder="Jumlah (Lot)" type="number" />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    >
                      BID (Beli)
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      ASK (Jual)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
