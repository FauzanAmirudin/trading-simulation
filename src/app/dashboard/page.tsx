"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SpotlightCard from "@/components/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign, Briefcase,
  Activity, Timer, ArrowRight, ScrollText, Clock, Wallet,
  Zap, AlertTriangle, TrendingDown as TrendingDownIcon, Package2,
} from "lucide-react";
import {
  InterventionType,
  SubSessionPhase,
  getPhaseLabel,
  getInterventionLabel,
} from "@/lib/experimental-matrix";

// Real-time history will be fetched from database instead of MOCK_TX

export default function DashboardPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ sessionId: number; status: string; timeLeft: number } | null>(null);
  const [balance, setBalance] = useState(100_000_000);
  const [portfolio, setPortfolio] = useState<{ stockId: number; stock: string; namaSaham: string; lot: number; avgPrice: number; basePrice: number; value: number }[]>([]);
  // New experimental state
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [period, setPeriod] = useState<number | null>(null);
  const [subSession, setSubSession] = useState<number | null>(null);
  const [phase, setPhase] = useState<SubSessionPhase>("IDLE");
  const [activeIntervention, setActiveIntervention] = useState<InterventionType>("NONE");
  const [interventionContent, setInterventionContent] = useState<{ title: string; content: string } | null>(null);

  // Per-session transaction history — populated in real-time via socket, cleared when session ends
  const [sessionHistory, setSessionHistory] = useState<{
    time: string; stock: string; tipe: string; harga: number; jumlah: number;
  }[]>([]);

  // Derive summary stats from live session history
  const totalBuy = sessionHistory.filter(t => t.tipe === "BID").reduce((s, t) => s + t.harga * t.jumlah * 100, 0);
  const totalSell = sessionHistory.filter(t => t.tipe === "ASK").reduce((s, t) => s + t.harga * t.jumlah * 100, 0);
  const netPnl = totalSell - totalBuy;
  const history = sessionHistory;

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push("/login"); return; }
    setLoading(false);
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
      setSession(prev => prev ? { ...prev, timeLeft: data.timeLeft } : prev);
    };
    const onInterventionTriggered = (data: {
      type: InterventionType;
      title: string;
      content: string;
    }) => {
      setActiveIntervention(data.type);
      setInterventionContent({ title: data.title, content: data.content });
    };
    const clearHistory = () => setSessionHistory([]);
    const onRoundEnded = () => {
      setSession(null);
      setRoundNumber(null);
      setPhase("IDLE");
      setSubSession(null);
      clearHistory();
    };
    const onBalanceUpdate = (data: { userId: number; balance: number }) => {
      if (data.userId === user.id) setBalance(data.balance);
    };
    const onSessionHistoryData = (data: any[]) => {
      setSessionHistory(data);
    };
    const onTradeExecuted = (data: { stockId: number; price: number; quantity: number; buyerId: number; sellerId: number; stockCode?: string; timestamp?: string }) => {
      if (data.buyerId !== user.id && data.sellerId !== user.id) return;

      const time = data.timestamp
        ? new Date(data.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      
      let tipe = "BID";
      if (data.buyerId === user.id && data.sellerId === user.id) tipe = "SELF";
      else if (data.buyerId === user.id) tipe = "BID";
      else tipe = "ASK";

      setSessionHistory(prev => [{
        time,
        stock: data.stockCode || `#${data.stockId}`,
        tipe,
        harga: data.price,
        jumlah: data.quantity,
      }, ...prev]);

      socket.emit("get-portfolio", { userId: user.id });
    };
    const onExperimentReset = clearHistory;
    const onPeriodAborted = clearHistory;
    const onExperimentPaused = () => {};
    const onPortfolioData = (data: { portfolio: any[] }) => {
      setPortfolio((data.portfolio || []).map((p: any) => ({
        stockId: p.stockId,
        stock: p.stockCode,
        namaSaham: p.namaSaham || p.stockCode,
        lot: p.jumlahLot,
        avgPrice: Number(p.avgPrice) || Number(p.basePrice) || 0,
        basePrice: Number(p.basePrice) || 0,
        value: Number(p.currentValue),
      })));
    };

    socket.on("connect", onConnect);
    socket.on("auth-success", onAuthSuccess);
    socket.on("session-state", onSessionState);
    socket.on("round-started", onRoundStarted);
    socket.on("sub-session-started", onSubSessionStarted);
    socket.on("timer-tick", onTimerTick);
    socket.on("intervention-triggered", onInterventionTriggered);
    socket.on("round-ended", onRoundEnded);
    socket.on("balance-update", onBalanceUpdate);
    socket.on("session-history-data", onSessionHistoryData);
    socket.on("trade-executed", onTradeExecuted);
    socket.on("experiment-reset", onExperimentReset);
    socket.on("period-aborted", onPeriodAborted);
    socket.on("experiment-paused", onExperimentPaused);
    socket.on("portfolio-data", onPortfolioData);

    socket.emit("get-portfolio", { userId: user.id });

    return () => {
      socket.off("connect", onConnect);
      socket.off("auth-success", onAuthSuccess);
      socket.off("session-state", onSessionState);
      socket.off("round-started", onRoundStarted);
      socket.off("sub-session-started", onSubSessionStarted);
      socket.off("timer-tick", onTimerTick);
      socket.off("intervention-triggered", onInterventionTriggered);
      socket.off("round-ended", onRoundEnded);
      socket.off("balance-update", onBalanceUpdate);
      socket.off("session-history-data", onSessionHistoryData);
      socket.off("trade-executed", onTradeExecuted);
      socket.off("experiment-reset", onExperimentReset);
      socket.off("period-aborted", onPeriodAborted);
      socket.off("experiment-paused", onExperimentPaused);
      socket.off("portfolio-data", onPortfolioData);
    };
  }, [hydrated, user]);

  if (!hydrated || !user) return null;

  const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
  const totalWealth = balance + totalValue;



  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-56 bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 bg-muted" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      {/* Header with Round/Session info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Hallo, {user.nama}
          </h1>
          <p className="text-sm text-muted-foreground">Ringkasan akun dan aktivitas kamu</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Round + Session indicator */}
          {roundNumber && (
            <div className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1">
              <span className="text-[10px] font-medium text-muted-foreground">Round {roundNumber}</span>
              {subSession && (
                <>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[10px] font-medium text-emerald-400">Sesi {subSession}</span>
                </>
              )}
            </div>
          )}
          {/* Active intervention indicator */}
          {activeIntervention !== "NONE" && (
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1",
              activeIntervention === "BERITA_BAIK" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" :
              activeIntervention === "BERITA_BURUK" ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" :
              "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            )}>
              <Zap className="size-3" />
              <span className="text-[10px] font-medium">{getInterventionLabel(activeIntervention)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-emerald-500" />
            <span className="font-mono text-sm text-muted-foreground">
              Rp {balance.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan Akun */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SpotlightCard spotlightColor="rgba(255, 255, 255, 0.2)" className="relative overflow-hidden rounded-[2rem] border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-[#f99b5a]">
          {/* Intersecting Circles Background */}
          <div className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden pointer-events-none rounded-[inherit]">
            <div className="absolute -top-12 -right-6 size-48 rounded-full bg-white/20" />
            <div className="absolute -bottom-16 -right-16 size-56 rounded-full bg-white/20" />
            <div className="absolute -top-8 right-12 size-64 rounded-full border border-white/20" />
          </div>

          <CardContent className="p-6 md:p-8 relative z-10 flex flex-col justify-between h-full min-h-[160px]">
            <div className="text-lg md:text-xl font-medium text-white/90 tracking-wide">
              Sisa Kas
            </div>
            <div className="flex items-end gap-3 mt-8">
              <div className="font-sans text-4xl md:text-5xl font-semibold tracking-tight text-white drop-shadow-sm">
                Rp {balance.toLocaleString("id-ID")}
              </div>
              <DollarSign className="size-6 text-white/80 mb-1 md:mb-2" />
            </div>
          </CardContent>
        </SpotlightCard>
        <SpotlightCard spotlightColor="rgba(255, 255, 255, 0.2)" className="relative overflow-hidden rounded-[2rem] border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-[#403989]">
          <div className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden pointer-events-none rounded-[inherit]">
            <div className="absolute -top-12 -right-6 size-48 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -right-16 size-56 rounded-full bg-white/10" />
            <div className="absolute -top-8 right-12 size-64 rounded-full border border-white/10" />
          </div>

          <CardContent className="p-6 md:p-8 relative z-10 flex flex-col justify-between h-full min-h-[160px]">
            <div className="flex justify-between items-start">
              <div className="text-lg md:text-xl font-medium text-white/90 tracking-wide">
                Portofolio
              </div>
              <div className="text-xs font-medium text-white/80 bg-white/10 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                {portfolio.length} saham
              </div>
            </div>
            <div className="flex items-end gap-3 mt-8">
              <div className="font-sans text-4xl md:text-5xl font-semibold tracking-tight text-white drop-shadow-sm">
                Rp {totalValue.toLocaleString("id-ID")}
              </div>
              <Briefcase className="size-6 text-white/80 mb-1 md:mb-2" />
            </div>
          </CardContent>
        </SpotlightCard>
        <SpotlightCard spotlightColor="rgba(255, 255, 255, 0.2)" className="relative overflow-hidden rounded-[2rem] border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-[#ef4f7b]">
          <div className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden pointer-events-none rounded-[inherit]">
            <div className="absolute -top-12 -right-6 size-48 rounded-full bg-white/20" />
            <div className="absolute -bottom-16 -right-16 size-56 rounded-full bg-white/20" />
            <div className="absolute -top-8 right-12 size-64 rounded-full border border-white/20" />
          </div>

          <CardContent className="p-6 md:p-8 relative z-10 flex flex-col justify-between h-full min-h-[160px]">
            <div className="text-lg md:text-xl font-medium text-white/90 tracking-wide">
              Total Kekayaan
            </div>
            <div className="flex items-end gap-3 mt-8">
              <div className="font-sans text-4xl md:text-5xl font-semibold tracking-tight text-white drop-shadow-sm">
                Rp {totalWealth.toLocaleString("id-ID")}
              </div>
              <Activity className="size-6 text-white/80 mb-1 md:mb-2" />
            </div>
          </CardContent>
        </SpotlightCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sesi Aktif */}
        <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm border-t-2 border-t-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all dark:shadow-none dark:bg-slate-950/40 dark:border-t-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Timer className="size-4 text-emerald-500" />
              Sesi Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sesi #{session.sessionId}</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-500 capitalize">{session.status}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="font-mono text-foreground">
                    {Math.floor(session.timeLeft / 60)}:{String(session.timeLeft % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted-foreground">tersisa</span>
                </div>
                <Button size="sm" className="w-full gap-2 mt-2"
                  onClick={() => router.push("/dashboard/trading")}>
                  <TrendingUp className="size-4" /> Buka Trading
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Timer className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Tidak ada sesi aktif</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Tunggu admin untuk memulai sesi trading
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ringkasan Resume — only shown during active session */}
        {session ? (
          <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm border-t-2 border-t-blue-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all dark:shadow-none dark:bg-slate-950/40 dark:border-t-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <BarChart3 className="size-4 text-muted-foreground" />
                Ringkasan Sesi Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Total Beli</div>
                  <div className="font-mono text-sm font-bold text-emerald-500">
                    Rp {totalBuy.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Total Jual</div>
                  <div className="font-mono text-sm font-bold text-rose-500">
                    Rp {totalSell.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">P&L Bersih</div>
                  <div className={`font-mono text-sm font-bold ${netPnl >= 0 ? "text-emerald-500 dark:text-green-400" : "text-rose-500"}`}>
                    {netPnl >= 0 ? "+" : ""}Rp {Math.abs(netPnl).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Total Transaksi</div>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {history.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm dark:shadow-none dark:bg-slate-950/40">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="size-6 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">Ringkasan sesi akan muncul saat sesi berjalan</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Riwayat Transaksi Sesi Ini — only shown during active session */}
      {session && (
        <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm dark:shadow-none dark:bg-slate-950/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <ScrollText className="size-4 text-muted-foreground" />
                Riwayat Transaksi Sesi Ini
              </CardTitle>
              <span className="text-[10px] text-muted-foreground font-mono">
                {history.length} transaksi
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {history.slice(0, 10).map((tx, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted-foreground w-14">{tx.time}</span>
                    <span className="font-medium text-foreground w-12">{tx.stock}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      tx.tipe === "SELF" ? "bg-amber-500/10 text-amber-500" :
                      tx.tipe === "BID" || tx.tipe === "buy" ? "bg-emerald-500/10 text-emerald-500" : 
                      "bg-rose-500/10 text-rose-500"
                    }`}>{
                      tx.tipe === "SELF" ? "SELF" : 
                      tx.tipe === "buy" || tx.tipe === "BID" ? "BELI" : "JUAL"
                    }</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-muted-foreground">
                    <span>Rp {tx.harga.toLocaleString("id-ID")}</span>
                    <span className="text-muted-foreground/70">{tx.jumlah} lot</span>
                  </div>
                </div>
              ))}
            </div>
            {history.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-xs">
                Belum ada transaksi dalam sesi ini
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabel Portofolio Lengkap */}
      <Card className="border-border bg-white/70 backdrop-blur-md shadow-sm dark:shadow-none dark:bg-slate-950/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Briefcase className="size-4 text-violet-500" />
              Portofolio Saham
            </CardTitle>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">
              {portfolio.filter(p => p.lot > 0).length} saham aktif
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {portfolio.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center gap-2">
              <Briefcase className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Memuat data portofolio...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Kode</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Lot</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Lembar</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Harga Rata-rata</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Harga Dasar</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Nilai Total</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Unrealized P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {portfolio.map((p, i) => {
                    const lembar = p.lot * 100;
                    const nilaiTotal = p.avgPrice * lembar;
                    const nilaiDasar = p.basePrice * lembar;
                    const pnl = nilaiTotal - nilaiDasar;
                    const pnlPct = nilaiDasar > 0 ? (pnl / nilaiDasar) * 100 : 0;
                    const isProfit = pnl >= 0;
                    return (
                      <tr
                        key={p.stockId ?? i}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          p.lot === 0 && "opacity-40"
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-foreground">{p.stock}</span>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">{p.namaSaham}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-foreground">{p.lot}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{lembar.toLocaleString("id-ID")}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">
                          Rp {p.avgPrice.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                          Rp {p.basePrice.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                          Rp {nilaiTotal.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className={cn(
                            "font-mono font-semibold",
                            isProfit ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"
                          )}>
                            {isProfit ? "+" : ""}Rp {Math.abs(pnl).toLocaleString("id-ID")}
                          </div>
                          <div className={cn(
                            "text-[10px]",
                            isProfit ? "text-emerald-500/70 dark:text-emerald-400/70" : "text-rose-500/70"
                          )}>
                            {isProfit ? "▲" : "▼"} {Math.abs(pnlPct).toFixed(2)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-muted-foreground">Total Portofolio</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground text-sm">
                      Rp {portfolio.reduce((s, p) => s + p.avgPrice * p.lot * 100, 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const totalPnl = portfolio.reduce((s, p) => s + (p.avgPrice - p.basePrice) * p.lot * 100, 0);
                        const isP = totalPnl >= 0;
                        return (
                          <span className={cn("font-mono font-bold text-sm", isP ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500")}>
                            {isP ? "+" : ""}Rp {Math.abs(totalPnl).toLocaleString("id-ID")}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
