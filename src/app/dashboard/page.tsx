"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign, Briefcase,
  Activity, Timer, ArrowRight, ScrollText, Clock, Wallet,
  Zap, AlertTriangle, TrendingDown as TrendingDownIcon,
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
  const [portfolio, setPortfolio] = useState<{ stock: string; lot: number; value: number }[]>([]);
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
        stock: p.stockCode, lot: p.jumlahLot, value: Number(p.currentValue),
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
        <Skeleton className="h-8 w-56 bg-zinc-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 bg-zinc-800" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      {/* Header with Round/Session info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-200">
            Hallo, {user.nama}
          </h1>
          <p className="text-sm text-zinc-500">Ringkasan akun dan aktivitas kamu</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Round + Session indicator */}
          {roundNumber && (
            <div className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1">
              <span className="text-[10px] font-medium text-zinc-400">Round {roundNumber}</span>
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
            <span className="font-mono text-sm text-zinc-400">
              Rp {balance.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan Akun */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
              <DollarSign className="size-4" /> Sisa Kas
            </div>
            <div className="font-mono text-2xl font-bold text-emerald-500">
              Rp {balance.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
              <Briefcase className="size-4" /> Portofolio
            </div>
            <div className="font-mono text-2xl font-bold text-zinc-200">
              Rp {totalValue.toLocaleString("id-ID")}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              {portfolio.length} saham
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
              <Activity className="size-4" /> Total Kekayaan
            </div>
            <div className="font-mono text-2xl font-bold text-zinc-200">
              Rp {totalWealth.toLocaleString("id-ID")}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              Kas + Portofolio
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sesi Aktif */}
        <Card className="border-white/5 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="size-4 text-emerald-500" />
              Sesi Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Sesi #{session.sessionId}</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-500 capitalize">{session.status}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-zinc-500" />
                  <span className="font-mono text-zinc-300">
                    {Math.floor(session.timeLeft / 60)}:{String(session.timeLeft % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-zinc-600">tersisa</span>
                </div>
                <Button size="sm" className="w-full gap-2 mt-2"
                  onClick={() => router.push("/dashboard/trading")}>
                  <TrendingUp className="size-4" /> Buka Trading
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="rounded-full bg-zinc-800 p-3 mb-3">
                  <Timer className="size-6 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">Tidak ada sesi aktif</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Tunggu admin untuk memulai sesi trading
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ringkasan Resume — only shown during active session */}
        {session ? (
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="size-4 text-zinc-400" />
                Ringkasan Sesi Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500 mb-0.5">Total Beli</div>
                  <div className="font-mono text-sm font-bold text-emerald-500">
                    Rp {totalBuy.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500 mb-0.5">Total Jual</div>
                  <div className="font-mono text-sm font-bold text-rose-500">
                    Rp {totalSell.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500 mb-0.5">P&L Bersih</div>
                  <div className={`font-mono text-sm font-bold ${netPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {netPnl >= 0 ? "+" : ""}Rp {Math.abs(netPnl).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <div className="text-xs text-zinc-500 mb-0.5">Total Transaksi</div>
                  <div className="font-mono text-sm font-bold text-zinc-200">
                    {history.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/5 bg-zinc-900">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="size-6 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-600">Ringkasan sesi akan muncul saat sesi berjalan</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Riwayat Transaksi Sesi Ini — only shown during active session */}
      {session && (
        <Card className="border-white/5 bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ScrollText className="size-4 text-zinc-400" />
                Riwayat Transaksi Sesi Ini
              </CardTitle>
              <span className="text-[10px] text-zinc-600 font-mono">
                {history.length} transaksi
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-white/5">
              {history.slice(0, 10).map((tx, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-600 w-14">{tx.time}</span>
                    <span className="font-medium text-zinc-300 w-12">{tx.stock}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      tx.tipe === "SELF" ? "bg-amber-500/10 text-amber-500" :
                      tx.tipe === "BID" || tx.tipe === "buy" ? "bg-emerald-500/10 text-emerald-500" : 
                      "bg-rose-500/10 text-rose-500"
                    }`}>{
                      tx.tipe === "SELF" ? "SELF" : 
                      tx.tipe === "buy" || tx.tipe === "BID" ? "BELI" : "JUAL"
                    }</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-zinc-400">
                    <span>Rp {tx.harga.toLocaleString("id-ID")}</span>
                    <span className="text-zinc-600">{tx.jumlah} lot</span>
                  </div>
                </div>
              ))}
            </div>
            {history.length === 0 && (
              <div className="py-6 text-center text-zinc-600 text-xs">
                Belum ada transaksi dalam sesi ini
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
