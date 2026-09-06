"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  RadioTower,
  Timer,
  Signal,
  AlertCircle,
  PlayCircle,
  Clock,
  ArrowRight,
  Zap,
  DollarSign,
  BarChart3,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  InterventionType,
  SubSessionPhase,
  getPhaseLabel,
  getInterventionLabel,
} from "@/lib/experimental-matrix";
import { cn } from "@/lib/utils";

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
  const activeRoundRef = useRef<number | null>(null);

  // Keep activeRoundRef in sync
  useEffect(() => {
    activeRoundRef.current = activeRound;
  }, [activeRound]);

  // 1. Fetch current database transactions & stats for the round
  const fetchAdminData = useCallback(async (roundId: number) => {
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

        const txs = resData.transactions || [];
        const stockUpdates: Record<number, { lastPrice?: number; volume: number }> = {};

        setStocks((prev) => {
          const newStocks = { ...prev };
          const stockCodesToIds = Object.fromEntries(
            Object.values(newStocks).map((s) => [s.kodeSaham, s.id])
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

          Object.keys(newStocks).forEach((idStr) => {
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

  // 2. Setup Socket.io listeners
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
        activeRoundRef.current = data.activeRound;
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
        activeRoundRef.current = null;
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
      activeRoundRef.current = data.roundNumber;
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

      toast.success(`Ronde ${data.roundNumber} dimulai — Sesi Pra-Perdagangan berjalan.`, {
        id: "round-status",
      });
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
      data.prices.forEach((p) => {
        openingPricesRef.current[p.stockId] = p.price;
      });
      setStocks((prev) => {
        const newStocks = { ...prev };
        data.prices.forEach((p) => {
          if (newStocks[p.stockId]) {
            newStocks[p.stockId].lastPrice = p.price;
            const base = newStocks[p.stockId].basePrice;
            newStocks[p.stockId].change = base > 0 ? ((p.price - base) / base) * 100 : 0;
          }
        });
        return newStocks;
      });
      toast.info("Harga keseimbangan pasar (Equilibrium) berhasil dihitung.", {
        id: "equilibrium-calc",
      });
    };

    const onOrderBookUpdate = (data: { stockId: number; bids: any[]; asks: any[] }) => {
      setStocks((prev) => {
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

    const onTradeExecuted = () => {
      if (activeRoundRef.current) {
        fetchAdminData(activeRoundRef.current);
      }
    };

    const onExperimentPaused = () => {
      setIsPaused(true);
      toast.info("Sesi perdagangan ditangguhkan oleh Admin.", {
        id: "pause-status",
      });
    };

    const onExperimentResumed = () => {
      setIsPaused(false);
      toast.success("Sesi perdagangan dilanjutkan.", {
        id: "resume-status",
      });
    };

    const onRoundEnded = (data: { roundNumber: number }) => {
      toast.warning(`Ronde ${data.roundNumber} telah selesai.`, {
        id: "round-status",
      });
      setActiveRound(null);
      activeRoundRef.current = null;
      setStocks({});
      setTransactions([]);
    };

    const onExperimentStopped = () => {
      setActiveRound(null);
      activeRoundRef.current = null;
      setStocks({});
      setTransactions([]);
    };

    const onExperimentReset = () => {
      setActiveRound(null);
      activeRoundRef.current = null;
      setStocks({});
      setTransactions([]);
      toast.info("Eksperimen di-reset sepenuhnya.", {
        id: "reset-status",
      });
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
  }, [hydrated, user, router, fetchAdminData]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!hydrated || !user) return null;

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 space-y-4">
        <Skeleton className="h-10 w-48 rounded-2xl bg-muted/60" />
        <Skeleton className="h-28 w-full rounded-3xl bg-muted/60" />
        <Skeleton className="h-44 w-full rounded-3xl bg-muted/60" />
      </div>
    );
  }

  // Beautiful empty state panel if there are no active rounds running
  if (activeRound === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl mx-auto px-4 min-h-[70vh] flex flex-col items-center justify-center text-center space-y-5 pb-24"
      >
        <div className="rounded-3xl bg-card border border-border/80 p-6 shadow-sm">
          <Activity className="size-12 text-muted-foreground/60 animate-pulse mx-auto" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-black text-foreground">
            Tidak Ada Ronde Aktif Berjalan
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Halaman Monitor Trading memantau aktivitas lelang harga, spread, dan transaksi real-time selama ronde eksperimen berlangsung.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold shadow-md active:scale-95 transition-all"
        >
          <PlayCircle className="size-4" />
          <span>Buka Panel Kontrol Eksperimen</span>
        </button>
      </motion.div>
    );
  }

  const activeStocks = Object.values(stocks);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-3.5 sm:space-y-6 pb-28 md:pb-8"
    >
      {/* ─── 1. COMPACT FLUID HEADER & LIVE SESSION STATUS CARD ─── */}
      <div className="rounded-3xl bg-card/70 border border-border/80 p-3.5 sm:p-5 backdrop-blur-md shadow-xs space-y-3">
        {/* Top Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Activity className="size-3.5 sm:size-4" />
            </div>
            <h1 className="text-[clamp(1.05rem,4vw,1.35rem)] font-extrabold tracking-tight text-foreground truncate">
              Monitor Trading
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-2xs",
                isConnected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                )}
              />
              <span>{isConnected ? "Koneksi Live" : "Terputus"}</span>
            </span>

            {isPaused && (
              <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-2xs">
                <AlertCircle className="size-3" />
                Ditangguhkan
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Session & Timer Info Banner */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-muted/40 border border-border/60">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] sm:text-xs font-bold font-mono text-primary uppercase">
                Ronde {activeRound} • Sesi {subSession || 1}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-muted text-foreground border border-border/60">
                {getPhaseLabel(phase)}
              </span>
            </div>
            <p className="text-[10.5px] sm:text-xs text-muted-foreground truncate">
              Intervensi:{" "}
              <span className="font-bold text-foreground">
                {getInterventionLabel(activeIntervention)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-card border border-border/80 px-3 py-1.5 rounded-2xl shadow-2xs shrink-0">
            <Timer
              className={cn(
                "size-4 sm:size-5",
                sessionTimer <= 10
                  ? "text-rose-500 animate-pulse"
                  : sessionTimer <= 30 || isPaused
                  ? "text-amber-500"
                  : "text-emerald-500"
              )}
            />
            <span
              className={cn(
                "font-mono font-black text-lg sm:text-2xl",
                sessionTimer <= 10
                  ? "text-rose-600 dark:text-rose-400"
                  : sessionTimer <= 30 || isPaused
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-foreground"
              )}
            >
              {formatTimer(sessionTimer)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. 2x2 BENTO KPI GRID (Strategically Placed Above the Fold) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Peserta Aktif */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Peserta Aktif
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-lg sm:text-2xl text-foreground">
              {stats.participantsCount}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Akun terhubung</span>
          </div>
        </div>

        {/* KPI 2: Total Match Transaksi */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Transaksi
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <BarChart3 className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-lg sm:text-2xl text-foreground">
              {stats.totalTransactionsCount}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Match terjadi</span>
          </div>
        </div>

        {/* KPI 3: Total Volume Rupiah */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Total Volume
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <DollarSign className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-sm sm:text-xl text-foreground truncate">
              Rp{" "}
              {stats.totalVolume >= 1_000_000_000
                ? `${(stats.totalVolume / 1_000_000_000).toFixed(2)} M`
                : stats.totalVolume >= 1_000_000
                ? `${(stats.totalVolume / 1_000_000).toFixed(1)} Jt`
                : stats.totalVolume.toLocaleString("id-ID")}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Nilai match</span>
          </div>
        </div>

        {/* KPI 4: Rerata Nilai Match */}
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex flex-col justify-between gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground truncate">
              Rerata / Match
            </span>
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
              <RadioTower className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div>
            <div className="font-mono font-black text-sm sm:text-xl text-foreground truncate">
              Rp{" "}
              {stats.avgTransactionValue >= 1_000_000
                ? `${(stats.avgTransactionValue / 1_000_000).toFixed(2)} Jt`
                : stats.avgTransactionValue.toLocaleString("id-ID")}
            </div>
            <span className="text-[9.5px] text-muted-foreground font-medium">Rata-rata order</span>
          </div>
        </div>
      </div>

      {/* ─── 3. ACTIVE STOCKS OVERVIEW (Fintech Stock Cards) ─── */}
      <div className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-1.5 px-1">
          <Layers className="size-3.5 text-primary" />
          <span>Status Saham & Spread Lelang</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {activeStocks.length === 0
            ? Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="rounded-3xl border-border bg-card shadow-2xs">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-20 bg-muted" />
                    <Skeleton className="h-8 w-32 bg-muted" />
                  </CardContent>
                </Card>
              ))
            : activeStocks.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs hover:border-primary/40 transition-all space-y-2.5"
                >
                  {/* Stock Header: Ticker, Name, Price & Change */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-mono font-black text-xs sm:text-sm border border-primary/20 shrink-0">
                        {s.kodeSaham}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-foreground truncate max-w-[120px] sm:max-w-[160px]">
                          {s.namaSaham}
                        </h3>
                        <span className="text-[9.5px] font-mono text-muted-foreground">
                          Dasar: Rp {s.basePrice.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm sm:text-base font-black text-foreground">
                        Rp {s.lastPrice.toLocaleString("id-ID")}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] font-mono font-bold",
                          s.change >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {s.change >= 0 ? (
                          <TrendingUp className="size-2.5" />
                        ) : (
                          <TrendingDown className="size-2.5" />
                        )}
                        {s.change >= 0 ? "+" : ""}
                        {s.change.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Spread Bid/Ask & Volume Pills */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[10.5px]">
                    <div className="bg-muted/40 rounded-xl p-2 border border-border/50">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold block">
                        Spread Bid / Ask
                      </span>
                      <span className="font-mono font-bold text-foreground text-[10.5px] sm:text-xs truncate block mt-0.5">
                        {s.highestBid > 0 ? `Rp ${s.highestBid.toLocaleString("id-ID")}` : "-"}
                        <span className="text-muted-foreground mx-1">/</span>
                        {s.lowestAsk > 0 ? `Rp ${s.lowestAsk.toLocaleString("id-ID")}` : "-"}
                      </span>
                    </div>

                    <div className="bg-muted/40 rounded-xl p-2 border border-border/50">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold block">
                        Volume Terpasang
                      </span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10.5px] sm:text-xs truncate block mt-0.5">
                        {s.volume.toLocaleString("id-ID")} Lot
                      </span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* ─── 4. LIVE TRANSACTION MATCH FEED (Mobile Tickets + Desktop Table) ─── */}
      <Card className="rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-emerald-600 dark:text-emerald-500" />
            <CardTitle className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Aktivitas Transaksi Pasar Terkini</span>
              <span className="text-xs font-mono font-normal text-muted-foreground">
                ({transactions.length})
              </span>
            </CardTitle>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Feed
          </span>
        </CardHeader>

        <CardContent className="p-3 sm:p-6">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2 text-center">
              <Activity className="size-8 opacity-40 animate-pulse" />
              <p className="text-xs font-bold text-foreground">Belum Ada Aktivitas Transaksi</p>
              <p className="text-[11px] text-muted-foreground">
                Menunggu order beli dan jual saling berpasangan (match) pada sesi ini.
              </p>
            </div>
          ) : (
            <>
              {/* ── Mobile View: Compact Transaction Ticket Cards (< md) ── */}
              <div className="space-y-2 md:hidden">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs space-y-2"
                  >
                    {/* Top Row: Stock Badge, Intervention & Time */}
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {tx.stock}
                        </span>
                        {tx.intervention !== "NONE" && (
                          <span
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded-md border",
                              tx.intervention === "FLOOD"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            {tx.intervention}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        <Clock className="size-3" />
                        <span>{tx.time}</span>
                      </div>
                    </div>

                    {/* Middle Row: Buyer -> Seller */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 text-[11px] font-medium">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-muted-foreground text-[10px]">Beli:</span>
                        <span className="font-bold text-foreground truncate max-w-[85px]">
                          {tx.buyer}
                        </span>
                      </div>
                      <ArrowRight className="size-3 text-muted-foreground shrink-0 opacity-50" />
                      <div className="flex items-center gap-1 min-w-0 justify-end">
                        <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-muted-foreground text-[10px]">Jual:</span>
                        <span className="font-bold text-foreground truncate max-w-[85px]">
                          {tx.seller}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Price, Lot & Total Match Value */}
                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <div className="text-[11px]">
                        <span className="text-muted-foreground">
                          Rp {tx.harga.toLocaleString("id-ID")}
                        </span>
                        <span className="text-muted-foreground font-sans text-[10px]"> × </span>
                        <span className="font-bold text-foreground">{tx.jumlah}L</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-muted-foreground block font-sans">
                          Total Nilai
                        </span>
                        <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                          Rp {tx.total.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop View: Full Data Table (>= md) ── */}
              <div className="hidden md:block overflow-x-auto max-h-[360px]">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border/50">
                    <TableRow className="border-border">
                      <TableHead className="text-xs text-muted-foreground w-[90px]">Waktu</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Pembeli</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Penjual</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-center">
                        Saham
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">Harga</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">Lot</TableHead>
                      <TableHead className="text-xs text-muted-foreground text-right">
                        Total Nilai
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence initial={false}>
                      {transactions.map((tx) => (
                        <motion.tr
                          key={tx.id}
                          initial={{
                            opacity: 0,
                            y: -8,
                            backgroundColor: "rgba(16, 185, 129, 0.05)",
                          }}
                          animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }}
                          transition={{ duration: 0.3 }}
                          className="border-border hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {tx.time}
                          </TableCell>
                          <TableCell className="text-xs text-foreground font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              {tx.buyer}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-foreground font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              {tx.seller}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg border border-primary/20 text-xs font-mono font-bold">
                              {tx.stock}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground text-right">
                            Rp {tx.harga.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground text-right font-bold">
                            {tx.jumlah} L
                          </TableCell>
                          <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400 text-right font-black">
                            Rp {tx.total.toLocaleString("id-ID")}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

