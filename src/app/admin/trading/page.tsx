"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Users, RadioTower, Timer, Signal, AlertCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { InterventionType, SubSessionPhase, getPhaseLabel, getInterventionLabel } from "@/lib/experimental-matrix";

type Stock = {
  id: number;
  kodeSaham: string;
  namaSaham: string;
  basePrice: number;
  lastPrice: number;
  highestBid: number;
  lowestAsk: number;
  volume: number;
  change: number;
};

type TransactionItem = {
  id: number;
  time: string;
  buyer: string;
  seller: string;
  stock: string;
  harga: number;
  jumlah: number;
  total: number;
  intervention: string;
  roundId: number;
};

export default function AdminTradingPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Real-time experimental state
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [subSession, setSubSession] = useState<number | null>(null);
  const [phase, setPhase] = useState<SubSessionPhase>("IDLE");
  const [sessionTimer, setSessionTimer] = useState(0);
  const [activeIntervention, setActiveIntervention] = useState<InterventionType>("NONE");
  const [isPaused, setIsPaused] = useState(false);
  
  const [stocks, setStocks] = useState<Record<number, Stock>>({});
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [stats, setStats] = useState({
    participantsCount: 0,
    totalTransactionsCount: 0,
    totalVolume: 0,
    avgTransactionValue: 0,
  });

  const openingPricesRef = useRef<Record<number, number>>({});

  // 1. Fetch current database transactions & stats for the round
  const fetchAdminData = useCallback(async (roundId: number, currentStocksList?: any[]) => {
    try {
      const res = await fetch(`/api/resume/admin?roundId=${roundId}`);
      const resData = await res.json();
      if (!resData.error) {
        setStats({
          participantsCount: resData.participantsCount,
          totalTransactionsCount: resData.totalTransactionsCount,
          totalVolume: resData.totalVolume,
          avgTransactionValue: resData.avgTransactionValue,
        });
        setTransactions(resData.transactions || []);

        // Calculate volumes and last prices from historical trades in this round
        const txs = resData.transactions || [];
        const stockUpdates: Record<number, { lastPrice?: number; volume: number }> = {};
        
        // We need stockId maps to map trades back to stocks. We can use the stock codes.
        setStocks(prev => {
          const newStocks = { ...prev };
          const stockCodesToIds = Object.fromEntries(
            Object.values(newStocks).map(s => [s.kodeSaham, s.id])
          );

          txs.forEach((tx: any) => {
            const sId = stockCodesToIds[tx.stock];
            if (sId) {
              if (!stockUpdates[sId]) {
                stockUpdates[sId] = { volume: 0 };
              }
              stockUpdates[sId].volume += tx.jumlah;
              if (stockUpdates[sId].lastPrice === undefined) {
                stockUpdates[sId].lastPrice = tx.harga;
              }
            }
          });

          // Apply calculated numbers
          Object.keys(newStocks).forEach(idStr => {
            const id = Number(idStr);
            const update = stockUpdates[id];
            const s = newStocks[id];
            const opening = openingPricesRef.current[id] || s.basePrice;
            
            if (update) {
              s.volume = update.volume;
              s.lastPrice = update.lastPrice ?? opening;
            } else {
              s.volume = 0;
              s.lastPrice = opening;
            }
            s.change = s.basePrice > 0 ? ((s.lastPrice - s.basePrice) / s.basePrice) * 100 : 0;
          });

          return newStocks;
        });
      }
    } catch (err) {
      console.error("Error fetching admin statistics:", err);
    }
  }, []);

  // 2. Setup Socket.io listeners and initial synchronization
  useEffect(() => {
    if (!hydrated || !user) return;
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit("authenticate", { userId: user.id });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    if (socket.connected) onConnect();
    else socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const onSchedulerState = (data: any) => {
      setLoading(false);
      setIsPaused(data.isPaused || false);
      if (data.activeRound !== null) {
        setActiveRound(data.activeRound);
        setSubSession(data.activeSubSession);
        setPhase(data.phase || "PENDING");
        setSessionTimer(data.timeLeft || 0);
        setActiveIntervention(data.currentIntervention || "NONE");

        if (data.openingPrices) {
          openingPricesRef.current = data.openingPrices;
        }

        if (data.stocks && data.stocks.length > 0) {
          const initialStocks: Record<number, Stock> = {};
          data.stocks.forEach((s: any) => {
            const base = Number(s.basePrice || s.hargaDasar || 1000);
            initialStocks[s.id] = {
              id: s.id,
              kodeSaham: s.kodeSaham,
              namaSaham: s.namaSaham,
              basePrice: base,
              lastPrice: openingPricesRef.current[s.id] || base,
              highestBid: 0,
              lowestAsk: 0,
              volume: 0,
              change: 0,
            };
          });
          setStocks(initialStocks);
          fetchAdminData(data.activeRound);
        }
      } else {
        setActiveRound(null);
        setStocks({});
        setTransactions([]);
        setStats({
          participantsCount: 0,
          totalTransactionsCount: 0,
          totalVolume: 0,
          avgTransactionValue: 0,
        });
      }
    };

    const onRoundStarted = (data: { roundNumber: number; period: number; stocks: any[] }) => {
      setActiveRound(data.roundNumber);
      setSubSession(1);
      setPhase("PRE_MARKET");
      setActiveIntervention("NONE");
      setIsPaused(false);
      openingPricesRef.current = {};

      const initialStocks: Record<number, Stock> = {};
      data.stocks.forEach((s: any) => {
        const base = Number(s.basePrice || 1000);
        initialStocks[s.id] = {
          id: s.id,
          kodeSaham: s.kodeSaham || s.kode,
          namaSaham: s.namaSaham || s.nama,
          basePrice: base,
          lastPrice: base,
          highestBid: 0,
          lowestAsk: 0,
          volume: 0,
          change: 0,
        };
      });
      setStocks(initialStocks);
      setTransactions([]);
      
      toast.success(`Ronde ${data.roundNumber} dimulai! Sesi PRE_OPENING berjalan.`);
      fetchAdminData(data.roundNumber);
    };

    const onSubSessionStarted = (data: {
      roundNumber: number;
      sessionNumber: number;
      phase: SubSessionPhase;
      duration: number;
      intervention: InterventionType;
    }) => {
      setSubSession(data.sessionNumber);
      setPhase(data.phase);
      setSessionTimer(data.duration);
      setActiveIntervention(data.intervention);
      setIsPaused(false);
    };

    const onTimerTick = (data: { timeLeft: number }) => {
      setSessionTimer(data.timeLeft);
    };

    const onOpeningPricesCalculated = (data: { prices: { stockId: number; price: number }[] }) => {
      data.prices.forEach(p => {
        openingPricesRef.current[p.stockId] = p.price;
      });
      setStocks(prev => {
        const newStocks = { ...prev };
        data.prices.forEach(p => {
          if (newStocks[p.stockId]) {
            newStocks[p.stockId].lastPrice = p.price;
            const base = newStocks[p.stockId].basePrice;
            newStocks[p.stockId].change = base > 0 ? ((p.price - base) / base) * 100 : 0;
          }
        });
        return newStocks;
      });
      toast.info("Harga keseimbangan pasar (Equilibrium) berhasil dihitung.");
    };

    const onOrderBookUpdate = (data: { stockId: number; bids: any[]; asks: any[] }) => {
      setStocks(prev => {
        const s = prev[data.stockId];
        if (!s) return prev;
        const highestBid = data.bids.length > 0 ? data.bids[0].harga : 0;
        const lowestAsk = data.asks.length > 0 ? data.asks[0].harga : 0;
        return {
          ...prev,
          [data.stockId]: {
            ...s,
            highestBid,
            lowestAsk,
          },
        };
      });
    };

    const onTradeExecuted = (trade: { stockId: number; price: number; quantity: number }) => {
      if (activeRound) {
        fetchAdminData(activeRound);
      }
    };

    const onExperimentPaused = () => {
      setIsPaused(true);
      toast.info("Sesi perdagangan ditangguhkan oleh Admin.");
    };

    const onExperimentResumed = () => {
      setIsPaused(false);
      toast.success("Sesi perdagangan dilanjutkan.");
    };

    const onRoundEnded = (data: { roundNumber: number }) => {
      toast.warning(`Ronde ${data.roundNumber} telah selesai.`);
      setActiveRound(null);
      setStocks({});
      setTransactions([]);
    };

    const onExperimentStopped = () => {
      setActiveRound(null);
      setStocks({});
      setTransactions([]);
    };

    const onExperimentReset = () => {
      setActiveRound(null);
      setStocks({});
      setTransactions([]);
      toast.info("Eksperimen di-reset sepenuhnya.");
    };

    socket.on("scheduler-state", onSchedulerState);
    socket.on("round-started", onRoundStarted);
    socket.on("sub-session-started", onSubSessionStarted);
    socket.on("timer-tick", onTimerTick);
    socket.on("opening-prices-calculated", onOpeningPricesCalculated);
    socket.on("order-book-update", onOrderBookUpdate);
    socket.on("trade-executed", onTradeExecuted);
    socket.on("experiment-paused", onExperimentPaused);
    socket.on("experiment-resumed", onExperimentResumed);
    socket.on("round-ended", onRoundEnded);
    socket.on("experiment-stopped", onExperimentStopped);
    socket.on("experiment-reset", onExperimentReset);

    socket.emit("get-scheduler-state");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("scheduler-state", onSchedulerState);
      socket.off("round-started", onRoundStarted);
      socket.off("sub-session-started", onSubSessionStarted);
      socket.off("timer-tick", onTimerTick);
      socket.off("opening-prices-calculated", onOpeningPricesCalculated);
      socket.off("order-book-update", onOrderBookUpdate);
      socket.off("trade-executed", onTradeExecuted);
      socket.off("experiment-paused", onExperimentPaused);
      socket.off("experiment-resumed", onExperimentResumed);
      socket.off("round-ended", onRoundEnded);
      socket.off("experiment-stopped", onExperimentStopped);
      socket.off("experiment-reset", onExperimentReset);
    };
  }, [hydrated, user, router, activeRound, fetchAdminData]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!hydrated || !user) return null;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-32 w-full bg-zinc-800" />
      </div>
    );
  }

  // Beautiful empty state panel if there are no active rounds running
  if (activeRound === null) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="rounded-full bg-zinc-800/40 p-6 border border-white/5 shadow-inner">
          <Activity className="size-16 text-zinc-600 animate-pulse" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-semibold text-zinc-300">Tidak Ada Ronde Aktif Berjalan</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Halaman Monitor Trading memantau aktivitas transaksi real-time secara dinamis selama ronde eksperimen berjalan.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-500/20 transition-all shadow-md"
        >
          <PlayCircle className="size-4" />
          Buka Panel Kontrol Eksperimen
        </button>
      </motion.div>
    );
  }

  const activeStocks = Object.values(stocks);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      {/* Header with status badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-zinc-200">Monitor Trading</h1>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              isConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}>
              {isConnected ? <Signal className="size-3" /> : <Signal className="size-3 opacity-40 text-rose-500" />}
              {isConnected ? "Koneksi Live" : "Koneksi Terputus"}
            </span>
            {isPaused && (
              <span className="bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <AlertCircle className="size-3" />
                Ditangguhkan
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">Memantau detail volume, spread harga, dan transaksi Ronde {activeRound}</p>
        </div>
        
        {/* Dynamic Timer and Subsession details */}
        <div className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 shadow-md">
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Sesi {subSession || 1} • {getPhaseLabel(phase)}
            </div>
            <div className="text-xs text-zinc-400 font-medium">
              Intervensi: <span className="text-emerald-400 font-bold">{getInterventionLabel(activeIntervention)}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Timer className="size-5 text-emerald-500" />
            <span className="font-mono text-2xl font-bold text-zinc-200">{formatTimer(sessionTimer)}</span>
          </div>
        </div>
      </div>

      {/* Market Overview of Active Stocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeStocks.length === 0 ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx} className="border-white/5 bg-zinc-900 shadow">
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-16 bg-zinc-800 mb-2" />
                <Skeleton className="h-8 w-24 bg-zinc-800" />
              </CardContent>
            </Card>
          ))
        ) : (
          activeStocks.map((s) => (
            <Card key={s.id} className="border-white/5 bg-zinc-900 hover:border-zinc-800 transition-colors shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="bg-zinc-800 px-2 py-0.5 rounded border border-white/5 text-xs font-bold text-zinc-300 uppercase">
                      {s.kodeSaham}
                    </span>
                    <h3 className="text-xs text-zinc-500 font-medium mt-1.5 truncate max-w-[150px]">{s.namaSaham}</h3>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-zinc-100">
                      Rp {s.lastPrice.toLocaleString("id-ID")}
                    </div>
                    <div className={`font-mono text-xs flex items-center justify-end gap-1 ${s.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {s.change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {s.change >= 0 ? "+" : ""}{s.change.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                  <div className="bg-zinc-950/40 rounded-lg p-2 border border-white/5 text-center">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Spread Bid/Ask</div>
                    <div className="font-mono text-xs font-bold text-zinc-300 mt-1">
                      {s.highestBid > 0 ? `Rp ${s.highestBid.toLocaleString("id-ID")}` : "-"}
                      <span className="text-zinc-600 mx-1">/</span>
                      {s.lowestAsk > 0 ? `Rp ${s.lowestAsk.toLocaleString("id-ID")}` : "-"}
                    </div>
                  </div>
                  <div className="bg-zinc-950/40 rounded-lg p-2 border border-white/5 text-center">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Volume Saham</div>
                    <div className="font-mono text-xs font-bold text-emerald-400 mt-1">
                      {s.volume.toLocaleString("id-ID")} Lot
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Live Transaction Logs */}
      <Card className="border-white/5 bg-zinc-900 shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/5 bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold text-zinc-300">Aktivitas Transaksi Pasar Terkini</CardTitle>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring
            </span>
          </div>
          <CardDescription className="text-xs">Daftar transaksi yang berhasil dipasangkan (match) di database</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <Activity className="size-10 mb-2 text-zinc-700 animate-pulse" />
              <p className="text-xs font-medium">Belum ada aktivitas transaksi di ronde ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[300px]">
              <Table>
                <TableHeader className="bg-zinc-950/20 sticky top-0 z-10">
                  <TableRow className="border-white/5">
                    <TableHead className="text-xs text-zinc-500 w-[100px]">Waktu</TableHead>
                    <TableHead className="text-xs text-zinc-500">Pembeli</TableHead>
                    <TableHead className="text-xs text-zinc-500">Penjual</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-center">Saham</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Harga</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Lot</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Total Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {transactions.map((tx, idx) => (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0, y: -10, backgroundColor: "rgba(16, 185, 129, 0.05)" }}
                        animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }}
                        transition={{ duration: 0.4 }}
                        className="border-white/5 hover:bg-zinc-800/20 transition-colors"
                      >
                        <TableCell className="font-mono text-xs text-zinc-400">{tx.time}</TableCell>
                        <TableCell className="text-xs text-zinc-300 font-medium">{tx.buyer}</TableCell>
                        <TableCell className="text-xs text-zinc-300 font-medium">{tx.seller}</TableCell>
                        <TableCell className="text-center">
                          <span className="bg-zinc-800 px-2 py-0.5 rounded border border-white/5 text-[10px] font-bold text-zinc-300">
                            {tx.stock}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-300 text-right">
                          Rp {tx.harga.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-200 text-right font-bold">{tx.jumlah}</TableCell>
                        <TableCell className="font-mono text-xs text-emerald-400 text-right font-semibold">
                          Rp {tx.total.toLocaleString("id-ID")}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary KPI Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2.5">
              <Users className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Peserta Aktif</div>
              <div className="font-mono text-lg font-bold text-zinc-200">{stats.participantsCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2.5">
              <Activity className="size-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Transaksi Terjadi</div>
              <div className="font-mono text-lg font-bold text-zinc-200">{stats.totalTransactionsCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <RadioTower className="size-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Total Volume Rupiah</div>
              <div className="font-mono text-lg font-bold text-zinc-200">
                Rp {stats.totalVolume.toLocaleString("id-ID")}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900 shadow-md">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-violet-500/10 p-2.5">
              <Timer className="size-5 text-violet-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-medium">Rerata Per Transaksi</div>
              <div className="font-mono text-lg font-bold text-zinc-200">
                Rp {stats.avgTransactionValue.toLocaleString("id-ID")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
