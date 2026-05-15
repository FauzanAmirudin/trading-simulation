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
  TrendingUp,
  TrendingDown,
  Timer,
  Send,
  BellRing,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const MOCK_STOCKS = [
  { kode: "BBCA", nama: "Bank Central Asia Tbk.", price: 10250 },
  { kode: "BBRI", nama: "Bank Rakyat Indonesia Tbk.", price: 5650 },
  { kode: "TLKM", nama: "Telkom Indonesia Tbk.", price: 3950 },
];

const MOCK_BIDS = [
  { harga: 10200, jumlah: 5, user: "R-01" },
  { harga: 10150, jumlah: 3, user: "R-02" },
  { harga: 10100, jumlah: 8, user: "R-07" },
];

const MOCK_ASKS = [
  { harga: 10300, jumlah: 2, user: "R-03" },
  { harga: 10350, jumlah: 4, user: "R-04" },
  { harga: 10400, jumlah: 1, user: "R-09" },
];

const MOCK_NEWS = "Peningkatan laba emiten sektor keuangan triwulan ini";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<"premarket" | "trading">("premarket");
  const [predictions, setPredictions] = useState<Record<string, string>>({});
  const [selectedStock, setSelectedStock] = useState(MOCK_STOCKS[0].kode);
  const [balance] = useState(100_000_000);
  const [portfolio] = useState<Record<string, { lot: number; avg: number }>>({});
  const [orderType, setOrderType] = useState<"beli" | "jual">("beli");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderLot, setOrderLot] = useState("");
  const [predicted, setPredicted] = useState(false);
  const [flashBid, setFlashBid] = useState(false);
  const [flashAsk, setFlashAsk] = useState(false);
  const [newsVisible, setNewsVisible] = useState(false);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (phase === "trading") {
      setNewsVisible(true);
      const timer = setTimeout(() => setNewsVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    const bidInterval = setInterval(() => {
      setFlashBid(true);
      setTimeout(() => setFlashBid(false), 500);
    }, 8000);
    const askInterval = setInterval(() => {
      setFlashAsk(true);
      setTimeout(() => setFlashAsk(false), 500);
    }, 11000);
    return () => {
      clearInterval(bidInterval);
      clearInterval(askInterval);
    };
  }, []);

  if (!user) return null;

  const totalPortfolio = Object.values(portfolio).reduce(
    (sum, p) => sum + p.lot * 100 * p.avg, 0
  );

  const handleSendPrediction = () => {
    setPredicted(true);
    toast.success("Prediksi tersimpan");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      {/* Header + Ticker Bar */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-medium text-zinc-300">
              {phase === "premarket" ? "Pre-Market" : "Area Live Trading"}
            </h1>
            <p className="text-xs text-zinc-600">Sesi 1 — Putaran 1</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono tabular-nums text-sm text-zinc-400">
              <Timer className="size-3.5 text-emerald-500" />
              <span>01:45</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPhase("premarket")}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  phase === "premarket"
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                Prediksi
              </button>
              <button
                onClick={() => setPhase("trading")}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  phase === "trading"
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                Trading
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {newsVisible && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
            >
              <BellRing className="size-3.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-400/90">{MOCK_NEWS}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {phase === "premarket" ? (
          <motion.div
            key="premarket"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-white/5 bg-zinc-900">
              <CardHeader>
                <CardTitle className="text-sm">Prediksi Harga Saham</CardTitle>
                <CardDescription className="text-xs">
                  Masukkan tebakan harga untuk 3 saham sesi ini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5">
                      <TableHead className="text-xs text-zinc-500">Saham</TableHead>
                      <TableHead className="text-xs text-zinc-500 text-right">Base Price</TableHead>
                      <TableHead className="text-xs text-zinc-500">Tebakan Harga</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_STOCKS.map((s) => (
                      <TableRow key={s.kode} className="border-white/5">
                        <TableCell>
                          <div className="text-sm font-medium text-zinc-200">{s.kode}</div>
                          <div className="text-xs text-zinc-600">{s.nama}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm text-zinc-400">
                          Rp {s.price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="w-48">
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
                            disabled={predicted}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleSendPrediction}
                    disabled={predicted}
                  >
                    {predicted ? (
                      <>
                        <RefreshCw className="size-3.5" /> Sudah Dikirim
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" /> Kirim Prediksi
                      </>
                    )}
                  </Button>
                  {predicted && (
                    <p className="text-xs text-emerald-500">Prediksi tersimpan</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="trading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-12"
          >
            {/* Left: Stock List */}
            <div className="lg:col-span-2 space-y-2">
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider">Saham Aktif</p>
              {MOCK_STOCKS.map((s) => (
                <button
                  key={s.kode}
                  onClick={() => setSelectedStock(s.kode)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                    selectedStock === s.kode
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-white/5 bg-zinc-900 hover:border-white/10"
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-200">{s.kode}</div>
                  <div className="font-mono tabular-nums text-xs text-zinc-500">
                    Rp {s.price.toLocaleString("id-ID")}
                  </div>
                </button>
              ))}
            </div>

            {/* Center: Order Book */}
            <div className="lg:col-span-6">
              <Card className="border-white/5 bg-zinc-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Order Book — {selectedStock}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 divide-x divide-white/5">
                    {/* Bid Column */}
                    <div className="p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                        <TrendingUp className="size-3" /> BID
                      </div>
                      <div className="space-y-1">
                        {MOCK_BIDS.map((o, i) => (
                          <motion.div
                            key={i}
                            animate={
                              flashBid
                                ? { backgroundColor: "rgba(16,185,129,0.08)" }
                                : { backgroundColor: "rgba(16,185,129,0)" }
                            }
                            transition={{ duration: 0.5 }}
                            className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                          >
                            <span className="font-mono tabular-nums font-medium text-zinc-200">
                              {o.harga.toLocaleString("id-ID")}
                            </span>
                            <span className="text-zinc-500">{o.jumlah} lot</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    {/* Ask Column */}
                    <div className="p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-rose-500">
                        <TrendingDown className="size-3" /> ASK
                      </div>
                      <div className="space-y-1">
                        {MOCK_ASKS.map((o, i) => (
                          <motion.div
                            key={i}
                            animate={
                              flashAsk
                                ? { backgroundColor: "rgba(244,63,94,0.08)" }
                                : { backgroundColor: "rgba(244,63,94,0)" }
                            }
                            transition={{ duration: 0.5 }}
                            className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                          >
                            <span className="font-mono tabular-nums font-medium text-zinc-200">
                              {o.harga.toLocaleString("id-ID")}
                            </span>
                            <span className="text-zinc-500">{o.jumlah} lot</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Order Form + Portfolio */}
            <div className="lg:col-span-4 space-y-3">
              {/* Order Form */}
              <Card className="border-white/5 bg-zinc-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Buat Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex rounded-lg border border-white/5 p-0.5 bg-zinc-800">
                    <button
                      onClick={() => setOrderType("beli")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        orderType === "beli"
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Beli
                    </button>
                    <button
                      onClick={() => setOrderType("jual")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        orderType === "jual"
                          ? "bg-rose-500/20 text-rose-500"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Jual
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      placeholder="Harga"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Jumlah (Lot)"
                      value={orderLot}
                      onChange={(e) => setOrderLot(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className={`w-full gap-1 ${
                      orderType === "beli"
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-rose-600 hover:bg-rose-500"
                    }`}
                    onClick={() => toast.success(`Order ${orderType} dikirim`)}
                  >
                    {orderType === "beli" ? (
                      <TrendingUp className="size-3.5" />
                    ) : (
                      <TrendingDown className="size-3.5" />
                    )}
                    {orderType === "beli" ? "Beli (BID)" : "Jual (ASK)"}
                  </Button>
                </CardContent>
              </Card>

              {/* Portfolio Widget */}
              <Card className="border-white/5 bg-zinc-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Portofolio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-zinc-800/50 p-3">
                    <div className="text-xs text-zinc-500 mb-0.5">Sisa Kas</div>
                    <div className="font-mono tabular-nums text-base font-bold text-emerald-500">
                      Rp {balance.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-3">
                    <div className="text-xs text-zinc-500 mb-0.5">Total Portofolio</div>
                    <div className="font-mono tabular-nums text-base font-bold text-zinc-200">
                      Rp {(balance + totalPortfolio).toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs text-zinc-600 font-medium">Daftar Saham</div>
                    {Object.keys(portfolio).length === 0 ? (
                      <p className="text-xs text-zinc-600">Belum memiliki saham</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(portfolio).map(([kode, p]) => (
                          <div
                            key={kode}
                            className="flex items-center justify-between rounded border border-white/5 px-2.5 py-2"
                          >
                            <div>
                              <div className="text-sm font-medium text-zinc-300">{kode}</div>
                              <div className="font-mono tabular-nums text-xs text-zinc-600">
                                {p.lot} lot @ {p.avg.toLocaleString("id-ID")}
                              </div>
                            </div>
                            <div className="font-mono tabular-nums text-sm text-zinc-400">
                              Rp {(p.lot * 100 * p.avg).toLocaleString("id-ID")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
