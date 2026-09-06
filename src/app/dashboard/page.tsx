"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Briefcase,
  Activity,
  Timer,
  ArrowRight,
  ScrollText,
  Clock,
  Wallet,
  Zap,
  ChevronRight,
  PieChart,
  Eye,
  EyeOff,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  PackageOpen,
} from "lucide-react";
import {
  InterventionType,
  SubSessionPhase,
  getPhaseLabel,
  getInterventionLabel,
} from "@/lib/experimental-matrix";
import RunningText from "@/components/trading/RunningText";

export default function DashboardPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<{ sessionId: number; status: string; timeLeft: number } | null>(null);
  const [balance, setBalance] = useState(100_000_000);
  const [portfolio, setPortfolio] = useState<{
    stockId: number;
    stock: string;
    namaSaham: string;
    lot: number;
    avgPrice: number;
    basePrice: number;
    value: number;
  }[]>([]);

  // Experimental state
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [period, setPeriod] = useState<number | null>(null);
  const [subSession, setSubSession] = useState<number | null>(null);
  const [phase, setPhase] = useState<SubSessionPhase>("IDLE");
  const [activeIntervention, setActiveIntervention] = useState<InterventionType>("NONE");
  const [interventionContent, setInterventionContent] = useState<{ title: string; content: string } | null>(null);

  // Mobile Tabs State
  const [activeTab, setActiveTab] = useState<"portfolio" | "activity" | "stats">("portfolio");
  const [showBalance, setShowBalance] = useState(true);

  // Per-session transaction history
  const [sessionHistory, setSessionHistory] = useState<{
    time: string;
    stock: string;
    tipe: string;
    harga: number;
    jumlah: number;
  }[]>([]);

  // Summary stats
  const totalBuy = sessionHistory.filter((t) => t.tipe === "BID").reduce((s, t) => s + t.harga * t.jumlah * 100, 0);
  const totalSell = sessionHistory.filter((t) => t.tipe === "ASK").reduce((s, t) => s + t.harga * t.jumlah * 100, 0);
  const netPnl = totalSell - totalBuy;

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  useEffect(() => {
    if (!hydrated || !user) return;
    const socket = getSocket();

    const onConnect = () => socket.emit("authenticate", { userId: user.id });
    const onAuthSuccess = (data: { user: { saldo: number } }) => {
      setBalance(data.user.saldo);
      socket.emit("get-session-history", { userId: user.id });
    };
    const onSessionState = (data: any) => setSession(data);
    const onRoundStarted = (data: { roundNumber: number; period: number }) => {
      setRoundNumber(data.roundNumber);
      setPeriod(data.period);
      setSession({ sessionId: 1, status: "active", timeLeft: 60 });
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
      setSession({ sessionId: 1, status: "active", timeLeft: data.duration });
      setActiveIntervention(data.intervention);
    };
    const onTimerTick = (data: { timeLeft: number }) => {
      setSession((prev) => (prev ? { ...prev, timeLeft: data.timeLeft } : prev));
    };
    const onInterventionTriggered = (data: {
      type: InterventionType;
      title?: string;
      content?: { title?: string; content?: string } | string;
    }) => {
      setActiveIntervention(data.type);
      const title = typeof data.content === "object" ? (data.content?.title || data.title || "") : (data.title || "");
      const content = typeof data.content === "object" ? (data.content?.content || "") : (typeof data.content === "string" ? data.content : "");
      setInterventionContent({ title, content });
    };
    const onInterventionEnded = () => {
      setActiveIntervention("NONE");
      setInterventionContent(null);
    };
    const onSchedulerState = (data: {
      activePeriod?: number | null;
      activeRound?: number | null;
      activeRoundIdx?: number | null;
      activeSubSession?: number | null;
      phase?: SubSessionPhase;
      currentPhase?: SubSessionPhase;
      currentIntervention?: InterventionType;
      activeIntervention?: InterventionType;
      timeLeft?: number;
      interventionTitle?: string;
      interventionContent?: string;
      interventionCache?: Record<string, { title: string; content: string }>;
    }) => {
      if (data.activeRoundIdx !== undefined && data.activeRoundIdx !== null) {
        setRoundNumber(data.activeRoundIdx + 1);
      } else if (data.activeRound) {
        setRoundNumber(data.activeRound);
      }
      if (data.activePeriod !== undefined && data.activePeriod !== null) {
        setPeriod(data.activePeriod);
      }
      if (data.activeSubSession !== undefined && data.activeSubSession !== null) {
        setSubSession(data.activeSubSession);
      }
      const curPhase = data.phase || data.currentPhase || "IDLE";
      setPhase(curPhase);

      const intervention = data.activeIntervention || data.currentIntervention || "NONE";
      setActiveIntervention(intervention);

      if (intervention !== "NONE") {
        const title = data.interventionTitle || (data.interventionCache?.[intervention]?.title) || (intervention === "BERITA_BAIK" ? "Berita Baik" : "Berita Buruk");
        const content = data.interventionContent || (data.interventionCache?.[intervention]?.content) || "";
        setInterventionContent({ title, content });
      } else {
        setInterventionContent(null);
      }
    };
    const clearHistory = () => setSessionHistory([]);
    const onRoundEnded = () => {
      setSession(null);
      setRoundNumber(null);
      setPhase("IDLE");
      setSubSession(null);
      setActiveIntervention("NONE");
      setInterventionContent(null);
      clearHistory();
    };
    const onBalanceUpdate = (data: { userId: number; balance: number }) => {
      if (data.userId === user.id) setBalance(data.balance);
    };
    const onSessionHistoryData = (data: any[]) => {
      setSessionHistory(data);
    };
    const onTradeExecuted = (data: {
      stockId: number;
      price: number;
      quantity: number;
      buyerId: number;
      sellerId: number;
      stockCode?: string;
      timestamp?: string;
    }) => {
      if (data.buyerId !== user.id && data.sellerId !== user.id) return;

      const time = data.timestamp
        ? new Date(data.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      let tipe = "BID";
      if (data.buyerId === user.id && data.sellerId === user.id) tipe = "SELF";
      else if (data.buyerId === user.id) tipe = "BID";
      else tipe = "ASK";

      setSessionHistory((prev) => [
        {
          time,
          stock: data.stockCode || `#${data.stockId}`,
          tipe,
          harga: data.price,
          jumlah: data.quantity,
        },
        ...prev,
      ]);

      socket.emit("get-portfolio", { userId: user.id });
    };
    const onExperimentReset = clearHistory;
    const onPeriodAborted = clearHistory;
    const onPortfolioData = (data: { portfolio: any[] }) => {
      setPortfolio(
        (data.portfolio || []).map((p: any) => ({
          stockId: p.stockId,
          stock: p.stockCode,
          namaSaham: p.namaSaham || p.stockCode,
          lot: p.jumlahLot,
          avgPrice: Number(p.avgPrice) || Number(p.basePrice) || 0,
          basePrice: Number(p.basePrice) || 0,
          value: Number(p.currentValue),
        }))
      );
    };

    socket.on("connect", onConnect);
    socket.on("auth-success", onAuthSuccess);
    socket.on("session-state", onSessionState);
    socket.on("scheduler-state", onSchedulerState);
    socket.on("round-started", onRoundStarted);
    socket.on("sub-session-started", onSubSessionStarted);
    socket.on("timer-tick", onTimerTick);
    socket.on("intervention-triggered", onInterventionTriggered);
    socket.on("intervention-ended", onInterventionEnded);
    socket.on("round-ended", onRoundEnded);
    socket.on("balance-update", onBalanceUpdate);
    socket.on("session-history-data", onSessionHistoryData);
    socket.on("trade-executed", onTradeExecuted);
    socket.on("experiment-reset", onExperimentReset);
    socket.on("period-aborted", onPeriodAborted);
    socket.on("portfolio-data", onPortfolioData);

    socket.emit("get-scheduler-state");
    socket.emit("get-portfolio", { userId: user.id });

    return () => {
      socket.off("connect", onConnect);
      socket.off("auth-success", onAuthSuccess);
      socket.off("session-state", onSessionState);
      socket.off("scheduler-state", onSchedulerState);
      socket.off("round-started", onRoundStarted);
      socket.off("sub-session-started", onSubSessionStarted);
      socket.off("timer-tick", onTimerTick);
      socket.off("intervention-triggered", onInterventionTriggered);
      socket.off("intervention-ended", onInterventionEnded);
      socket.off("round-ended", onRoundEnded);
      socket.off("balance-update", onBalanceUpdate);
      socket.off("session-history-data", onSessionHistoryData);
      socket.off("trade-executed", onTradeExecuted);
      socket.off("experiment-reset", onExperimentReset);
      socket.off("period-aborted", onPeriodAborted);
      socket.off("portfolio-data", onPortfolioData);
    };
  }, [hydrated, user]);

  if (!hydrated || !user) return null;

  const totalPortfolioValue = portfolio.reduce((s, p) => s + p.value, 0);
  const totalWealth = balance + totalPortfolioValue;
  const activeStocks = portfolio.filter((p) => p.lot > 0);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-6">
      {/* ─── 1. ULTRA-COMPACT INTEGRATED HEADER (Mobile 320px+ Friendly) ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
              Hai, {user.nama}
            </h1>
            <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary uppercase">
              {user.role}
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            Simulasi Investasi & Riset Pasar
          </p>
        </div>

        {/* Live Session / Round Badge */}
        <div className="flex items-center gap-1 shrink-0">
          {roundNumber && (
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>R{roundNumber}</span>
              {subSession && <span className="opacity-70">·S{subSession}</span>}
            </div>
          )}

          {activeIntervention !== "NONE" && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0",
                activeIntervention === "BERITA_BAIK"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : activeIntervention === "BERITA_BURUK"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              )}
            >
              <Zap className="size-2.5 shrink-0" />
              <span className="truncate max-w-[75px] sm:max-w-[120px]">{getInterventionLabel(activeIntervention)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. RUNNING TEXT INTERVENSI (BERITA BAIK / BERITA BURUK) ─── */}
      {activeIntervention !== "NONE" && (
        <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
          <RunningText
            active={true}
            type={activeIntervention}
            title={interventionContent?.title || (activeIntervention === "BERITA_BAIK" ? "Berita Baik" : "Berita Buruk")}
            content={interventionContent?.content || ""}
          />
        </div>
      )}

      {/* ─── 3. MODERN FLUID HERO FINANCIAL CARD (Ultra-Narrow 320px Ready) ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-950 p-3.5 sm:p-6 text-white shadow-xl border border-indigo-500/20">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-56 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-3 sm:gap-5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-slate-300 text-[11px] font-medium min-w-0">
              <Wallet className="size-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Total Kekayaan</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center shrink-0 min-h-[32px] min-w-[32px]"
                aria-label="Toggle Saldo"
              >
                {showBalance ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              </button>
            </div>

            {session ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold shrink-0">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Trading
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[9px] font-medium shrink-0">
                Pasar Tutup
              </span>
            )}
          </div>

          {/* Main Balance Display with fluid clamp typography */}
          <div>
            <div className="font-mono text-[clamp(1.35rem,5.5vw,2.25rem)] font-extrabold tracking-tight text-white drop-shadow-xs truncate leading-tight">
              {showBalance ? `Rp ${totalWealth.toLocaleString("id-ID")}` : "••••••••••••"}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-300 flex-wrap">
              <span className="inline-flex items-center text-emerald-400 font-semibold gap-0.5">
                <Sparkles className="size-2.5" /> Siap Digunakan
              </span>
              <span>•</span>
              <span className="opacity-80">Modal Rp 100 Jt</span>
            </div>
          </div>

          {/* Dual Metrics Grid (Kas & Portofolio) */}
          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10">
            {/* Sisa Kas */}
            <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-2.5 border border-white/10 flex flex-col justify-between min-w-0">
              <div className="flex items-center gap-1 text-slate-400 text-[9.5px] font-medium truncate">
                <DollarSign className="size-3 text-amber-400 shrink-0" />
                <span className="truncate">Sisa Kas</span>
              </div>
              <div className="font-mono text-[clamp(0.72rem,2.8vw,0.95rem)] font-bold text-white mt-1 truncate">
                {showBalance ? `Rp ${balance.toLocaleString("id-ID")}` : "••••••"}
              </div>
            </div>

            {/* Nilai Portofolio */}
            <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-2.5 border border-white/10 flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1 text-slate-400 text-[9.5px] font-medium">
                <div className="flex items-center gap-1 truncate">
                  <Briefcase className="size-3 text-violet-400 shrink-0" />
                  <span className="truncate">Portofolio</span>
                </div>
                <span className="text-[8.5px] bg-white/15 px-1 py-0.2 rounded-full font-mono text-white shrink-0">
                  {activeStocks.length}
                </span>
              </div>
              <div className="font-mono text-[clamp(0.72rem,2.8vw,0.95rem)] font-bold text-white mt-1 truncate">
                {showBalance ? `Rp ${totalPortfolioValue.toLocaleString("id-ID")}` : "••••••"}
              </div>
            </div>
          </div>

          {/* Ergonomic Full-Width CTA to Trading */}
          <Button
            onClick={() => router.push("/dashboard/trading")}
            className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-2xl font-bold py-2.5 text-xs sm:text-sm h-11 sm:h-12 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform min-h-[44px]"
          >
            <TrendingUp className="size-4" />
            <span>Masuk Ruang Trading</span>
            <ChevronRight className="size-4 ml-auto" />
          </Button>
        </div>
      </div>

      {/* ─── 4. REAL-TIME SESSION LIVE BANNER (If Active) ─── */}
      {session && (
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 backdrop-blur-xs shadow-xs">
          <CardContent className="p-2.5 sm:p-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Timer className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">Sesi #{session.sessionId} Aktif</span>
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <Clock className="size-2.5 text-emerald-500 shrink-0" />
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {Math.floor(session.timeLeft / 60)}:{String(session.timeLeft % 60).padStart(2, "0")}
                  </span>
                  <span className="truncate">tersisa</span>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => router.push("/dashboard/trading")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-semibold px-2.5 h-7.5 shrink-0 shadow-xs gap-1"
            >
              <span>Trade</span>
              <ArrowRight className="size-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── 5. SEGMENTED TABS (PROGRESSIVE DISCLOSURE) ─── */}
      <div className="space-y-2.5">
        {/* Tab Selector */}
        <div className="flex rounded-2xl bg-muted/70 p-1 border border-border/50">
          <button
            onClick={() => setActiveTab("portfolio")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[10.5px] sm:text-xs font-semibold transition-all min-h-[42px]",
              activeTab === "portfolio"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Briefcase className="size-3 shrink-0" />
            <span>Portofolio</span>
            <span className="px-1 py-0.1 text-[9px] rounded-full bg-primary/10 text-primary font-mono font-bold">
              {activeStocks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[10.5px] sm:text-xs font-semibold transition-all min-h-[42px]",
              activeTab === "activity"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ScrollText className="size-3 shrink-0" />
            <span>Aktivitas</span>
            {sessionHistory.length > 0 && (
              <span className="px-1 py-0.1 text-[9px] rounded-full bg-primary/10 text-primary font-mono font-bold">
                {sessionHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("stats")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl text-[10.5px] sm:text-xs font-semibold transition-all min-h-[42px]",
              activeTab === "stats"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="size-3 shrink-0" />
            <span>Statistik</span>
          </button>
        </div>

        {/* Tab Content Display */}
        <AnimatePresence mode="wait">
          {/* TAB 1: PORTOFOLIO SAHAM */}
          {activeTab === "portfolio" && (
            <motion.div
              key="portfolio"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
              className="space-y-2.5"
            >
              {activeStocks.length === 0 ? (
                <Card className="rounded-2xl border-border bg-card p-5 text-center shadow-xs">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground mx-auto mb-2.5">
                    <PackageOpen className="size-5 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">Portofolio Belum Ada Saham</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs mx-auto leading-relaxed">
                    Saldo kas Anda siap digunakan untuk membeli saham saat sesi trading dibuka.
                  </p>
                  <Button
                    onClick={() => router.push("/dashboard/trading")}
                    className="mt-3.5 rounded-xl text-xs font-semibold h-8.5 px-3.5 gap-1.5"
                  >
                    <TrendingUp className="size-3.5" /> Mulai Beli Saham
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {activeStocks.map((p, i) => {
                    const lembar = p.lot * 100;
                    const nilaiTotal = p.avgPrice * lembar;
                    const nilaiDasar = p.basePrice * lembar;
                    const pnl = nilaiTotal - nilaiDasar;
                    const pnlPct = nilaiDasar > 0 ? (pnl / nilaiDasar) * 100 : 0;
                    const isProfit = pnl >= 0;

                    return (
                      <Card
                        key={p.stockId ?? i}
                        className="rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-xs p-3"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-[11px] shrink-0">
                              {p.stock}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-foreground truncate">{p.stock}</h4>
                              <p className="text-[9.5px] text-muted-foreground truncate">{p.namaSaham}</p>
                            </div>
                          </div>

                          {/* PnL Badge */}
                          <div
                            className={cn(
                              "flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono shrink-0",
                              isProfit
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {isProfit ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
                            <span>{Math.abs(pnlPct).toFixed(2)}%</span>
                          </div>
                        </div>

                        {/* Stock Metrics Grid */}
                        <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-border/60 text-[11px]">
                          <div>
                            <span className="text-[9px] text-muted-foreground">Posisi Lot</span>
                            <p className="font-mono font-bold text-foreground mt-0.5 text-[11px]">
                              {p.lot} lot <span className="text-[8.5px] text-muted-foreground font-normal">({lembar} lbr)</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-muted-foreground">Harga Beli Avg</span>
                            <p className="font-mono font-bold text-foreground mt-0.5 text-[11px]">
                              Rp {p.avgPrice.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] text-muted-foreground">Harga Dasar</span>
                            <p className="font-mono text-muted-foreground mt-0.5 text-[11px]">
                              Rp {p.basePrice.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-muted-foreground">Total Nilai</span>
                            <p className="font-mono font-bold text-foreground mt-0.5 text-[11px]">
                              Rp {nilaiTotal.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: AKTIVITAS SESI */}
          {activeTab === "activity" && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
              className="space-y-2.5"
            >
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] text-muted-foreground">Total Beli</span>
                  <p className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                    Rp {totalBuy.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] text-muted-foreground">Total Jual</span>
                  <p className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                    Rp {totalSell.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] text-muted-foreground">P&L Sesi Ini</span>
                  <p
                    className={cn(
                      "font-mono text-xs font-bold mt-0.5 truncate",
                      netPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {netPnl >= 0 ? "+" : ""}Rp {Math.abs(netPnl).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] text-muted-foreground">Total Transaksi</span>
                  <p className="font-mono text-xs font-bold text-foreground mt-0.5">
                    {sessionHistory.length} kali
                  </p>
                </div>
              </div>

              {/* Transaction Logs */}
              <Card className="rounded-2xl border-border bg-card shadow-xs">
                <CardHeader className="p-3 border-b border-border/60 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                    <ScrollText className="size-3.5 text-primary" />
                    Feed Transaksi Sesi Ini
                  </CardTitle>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {sessionHistory.length} Riwayat
                  </span>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/60">
                  {sessionHistory.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground text-[11px]">
                      Belum ada transaksi di sesi ini.
                    </div>
                  ) : (
                    sessionHistory.map((tx, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "px-1.5 py-0.2 rounded font-bold text-[8.5px] uppercase",
                              tx.tipe === "SELF"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : tx.tipe === "BID" || tx.tipe === "buy"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {tx.tipe === "SELF" ? "SELF" : tx.tipe === "BID" || tx.tipe === "buy" ? "BELI" : "JUAL"}
                          </span>
                          <div>
                            <span className="font-bold text-foreground text-xs">{tx.stock}</span>
                            <span className="text-[9.5px] text-muted-foreground ml-1.5 font-mono">{tx.time}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="font-bold text-foreground text-xs">
                            Rp {tx.harga.toLocaleString("id-ID")}
                          </div>
                          <div className="text-[9.5px] text-muted-foreground">{tx.jumlah} lot</div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 3: STATISTIK & ALOKASI */}
          {activeTab === "stats" && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
              className="space-y-2.5"
            >
              <Card className="rounded-2xl border-border bg-card p-3.5 sm:p-5 space-y-3.5 shadow-xs">
                <h3 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                  <PieChart className="size-3.5 text-primary" />
                  Alokasi Portofolio & Kas
                </h3>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Kas Tunai</span>
                    <span className="font-mono font-bold">
                      {totalWealth > 0 ? ((balance / totalWealth) * 100).toFixed(1) : 100}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${totalWealth > 0 ? (balance / totalWealth) * 100 : 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Portofolio Saham</span>
                    <span className="font-mono font-bold">
                      {totalWealth > 0 ? ((totalPortfolioValue / totalWealth) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${totalWealth > 0 ? (totalPortfolioValue / totalWealth) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
