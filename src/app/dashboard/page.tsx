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

  const [resumeData, setResumeData] = useState({
    totalBuy: 0,
    totalSell: 0,
    netPnl: 0,
    history: [] as any[],
  });

  const fetchResumeData = () => {
    if (!user) return;
    fetch(`/api/resume/responder?userId=${user.id}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setResumeData({
            totalBuy: resData.totalBuy,
            totalSell: resData.totalSell,
            netPnl: resData.netPnl,
            history: resData.history,
          });
        }
      })
      .catch((err) => console.error("Error fetching dashboard resume data:", err));
  };

  useEffect(() => {
    if (hydrated && user) fetchResumeData();
  }, [hydrated, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push("/login"); return; }
    setLoading(false);
  }, [hydrated, user, router]);

  useEffect(() => {
    if (!hydrated || !user) return;
    const socket = getSocket();

    socket.on("connect", () => socket.emit("authenticate", { userId: user.id }));
    socket.on("session-state", (data: any) => setSession(data));
    socket.on("round-started", (data: { roundNumber: number; period: number }) => {
      setRoundNumber(data.roundNumber);
      setPeriod(data.period);
      setSession({ sessionId: 1, status: "active", timeLeft: 60 });
    });
    socket.on("sub-session-started", (data: {
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
    });
    socket.on("timer-tick", (data: { timeLeft: number }) => {
      setSession(prev => prev ? { ...prev, timeLeft: data.timeLeft } : prev);
    });
    socket.on("intervention-triggered", (data: {
      type: InterventionType;
      title: string;
      content: string;
    }) => {
      setActiveIntervention(data.type);
      setInterventionContent({ title: data.title, content: data.content });
    });
    socket.on("round-ended", () => {
      setSession(null);
      setRoundNumber(null);
      setPhase("IDLE");
      setSubSession(null);
    });
    socket.on("balance-update", (data: { userId: number; balance: number }) => {
      if (data.userId === user.id) {
        setBalance(data.balance);
        fetchResumeData(); // Real-time sync for trade history & PnL
      }
    });
    socket.on("portfolio-data", (data: { portfolio: any[] }) => {
      setPortfolio((data.portfolio || []).map((p: any) => ({
        stock: p.stockCode, lot: p.jumlahLot, value: Number(p.currentValue),
      })));
    });
    socket.emit("get-portfolio", { userId: user.id });

    return () => {
      socket.off("connect"); socket.off("session-state");
      socket.off("round-started"); socket.off("sub-session-started");
      socket.off("timer-tick"); socket.off("intervention-triggered");
      socket.off("round-ended"); socket.off("balance-update"); socket.off("portfolio-data");
    };
  }, [hydrated, user]);

  if (!hydrated || !user) return null;

  const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
  const totalWealth = balance + totalValue;
  const { totalBuy, totalSell, netPnl, history } = resumeData;

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

        {/* Ringkasan Resume */}
        <Card className="border-white/5 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4 text-zinc-400" />
              Ringkasan Resume
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
      </div>

      {/* Riwayat Transaksi Terakhir */}
      <Card className="border-white/5 bg-zinc-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScrollText className="size-4 text-zinc-400" />
              Riwayat Transaksi Terakhir
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/5">
            {history.slice(0, 5).map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-600 w-14">{tx.time}</span>
                  <span className="font-medium text-zinc-300 w-12">{tx.stock}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    tx.tipe === "BID" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  }`}>{tx.tipe}</span>
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
              Belum ada transaksi
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
