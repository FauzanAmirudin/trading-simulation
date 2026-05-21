"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import {
  EXPERIMENTAL_MATRIX,
  InterventionType,
  SubSessionPhase,
  getInterventionLabel,
  getPhaseLabel,
  INTERVENTION_KEYS,
  RoundConfig,
} from "@/lib/experimental-matrix";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, PauseCircle, SkipForward, Loader2, Clock,
  RadioTower, Zap, AlertTriangle, TrendingUp, TrendingDown,
  ChevronRight, ChevronDown, DownloadCloud, Settings2,
  Timer, BookOpen, Activity, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Stock = { id: number; kode: string; nama: string; basePrice?: number };

type SchedulerState = {
  activeRound: number | null;
  activeSubSession: number | null;
  phase: SubSessionPhase | null;
  timeLeft: number;
  currentIntervention: InterventionType;
  isPaused: boolean;
  openingPrices: Record<number, number>;
  stocks: Stock[];
  interventionCache: Record<string, { title: string; content: string }>;
  completedRounds: number[];
  usedStockIds: number[];
};

type InterventionContent = {
  [K in InterventionType]: { title: string; content: string };
};

// ─────────────────────────────────────────────
// InterventionContentForm
// ─────────────────────────────────────────────
function InterventionContentForm({
  onSaved,
}: {
  onSaved?: (key: string, data: { title: string; content: string }) => void;
}) {
  const [form, setForm] = useState<Omit<InterventionContent, "NONE">>({
    BERITA_BAIK: { title: "Berita Baik: Saham X Laba Naik 20%", content: "" },
    BERITA_BURUK: { title: "Berita Buruk: Saham X Terdampak Regulasi", content: "" },
    TMNP_1: { title: "Trading Halt — Pengumuman Antrian", content: "Trading dihentikan sementara. Harap tunggu pengumuman selanjutnya." },
    TMNP_2: { title: "Trading Halt — Pengumuman Antrian", content: "Trading dihentikan sementara. Harap tunggu pengumuman selanjutnya." },
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing config
  useEffect(() => {
    fetch("/api/intervention")
      .then(r => r.json())
      .then(data => {
        if (data.config) {
          setForm(prev => ({
            BERITA_BAIK: data.config.BERITA_BAIK || prev.BERITA_BAIK,
            BERITA_BURUK: data.config.BERITA_BURUK || prev.BERITA_BURUK,
            TMNP_1: data.config.TMNP_1 || prev.TMNP_1,
            TMNP_2: data.config.TMNP_2 || prev.TMNP_2,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: "BERITA_BAIK" | "BERITA_BURUK" | "TMNP_1" | "TMNP_2") => {
    setSaving(key);
    try {
      const res = await fetch("/api/intervention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...form[key] }),
      });
      if (res.ok) {
        toast.success(`${getInterventionLabel(key)} saved`);
        onSaved?.(key, form[key]);
        // Reload cache so the server picks up the new content
        await fetch("/api/intervention", { method: "GET" });
      } else {
        toast.error("Failed to save");
      }
    } finally {
      setSaving(null);
    }
  };

  const interventionColors: Record<InterventionType, string> = {
    NONE: "text-zinc-500",
    BERITA_BAIK: "text-emerald-500",
    BERITA_BURUK: "text-rose-500",
    TMNP_1: "text-amber-500",
    TMNP_2: "text-amber-500",
  };

  const interventionIcons: Record<InterventionType, React.ReactNode> = {
    NONE: null,
    BERITA_BAIK: <TrendingUp className="size-4" />,
    BERITA_BURUK: <TrendingDown className="size-4" />,
    TMNP_1: <AlertTriangle className="size-4" />,
    TMNP_2: <AlertTriangle className="size-4" />,
  };

  if (loading) {
    return <Skeleton className="h-40 bg-zinc-800" />;
  }

  return (
    <div className="space-y-4">
      {(["BERITA_BAIK", "BERITA_BURUK", "TMNP_1", "TMNP_2"] as (keyof Omit<InterventionContent, "NONE">)[]).map(key => (
        <div key={key} className="space-y-2 rounded-lg border border-white/5 bg-zinc-800/30 p-3">
          <div className={`flex items-center gap-2 text-xs font-medium ${interventionColors[key]}`}>
            {interventionIcons[key]}
            {getInterventionLabel(key)}
          </div>
          <Input
            value={form[key].title}
            onChange={e => setForm(prev => ({
              ...prev,
              [key]: { ...prev[key], title: e.target.value },
            }))}
            placeholder="Title..."
            className="text-xs bg-zinc-900 border-white/10 text-zinc-200 placeholder:text-zinc-600"
          />
          <textarea
            value={form[key].content}
            onChange={e => setForm(prev => ({
              ...prev,
              [key]: { ...prev[key], content: e.target.value },
            }))}
            placeholder="Content..."
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-7"
            onClick={() => handleSave(key)}
            disabled={saving === key || !form[key].title || !form[key].content}
          >
            {saving === key ? <Loader2 className="size-3 animate-spin" /> : <DownloadCloud className="size-3" />}
            {saving === key ? "Saving..." : "Save"}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// InterventionBadge
// ─────────────────────────────────────────────
function InterventionBadge({ type }: { type: InterventionType }) {
  const config: Record<InterventionType, { label: string; className: string; icon: React.ReactNode }> = {
    NONE: { label: "Tanpa Intervensi", className: "bg-zinc-700/50 text-zinc-400", icon: null },
    BERITA_BAIK: { label: "Berita Baik", className: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20", icon: <TrendingUp className="size-3" /> },
    BERITA_BURUK: { label: "Berita Buruk", className: "bg-rose-500/10 text-rose-500 border border-rose-500/20", icon: <TrendingDown className="size-3" /> },
    TMNP_1: { label: "Trading Halt 1", className: "bg-amber-500/10 text-amber-500 border border-amber-500/20", icon: <AlertTriangle className="size-3" /> },
    TMNP_2: { label: "Trading Halt 2", className: "bg-amber-500/10 text-amber-500 border border-amber-500/20", icon: <AlertTriangle className="size-3" /> },
  };
  const c = config[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// ExperimentProgress — visual matrix grid
// ─────────────────────────────────────────────
function ExperimentProgress({ activeRound }: { activeRound: number | null }) {
  const periods = [
    { label: "Period I", rounds: EXPERIMENTAL_MATRIX.slice(0, 4), period: 1 },
    { label: "Period II", rounds: EXPERIMENTAL_MATRIX.slice(4, 8), period: 2 },
    { label: "Period III", rounds: EXPERIMENTAL_MATRIX.slice(8, 12), period: 3 },
  ];

  return (
    <div className="space-y-3">
      {periods.map(period => (
        <div key={period.period} className="space-y-1.5">
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{period.label}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {period.rounds.map(round => {
              const isActive = round.roundNumber === activeRound;
              const isDone = activeRound !== null && round.roundNumber < activeRound;

              return (
                <div
                  key={round.roundNumber}
                  className={`relative rounded-lg border p-1.5 text-center transition-all ${
                    isActive
                      ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : isDone
                      ? "border-white/10 bg-zinc-800/50 opacity-60"
                      : "border-white/5 bg-zinc-800/20 opacity-40"
                  }`}
                >
                  <div className={`text-[10px] font-bold ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>
                    R{round.roundNumber}
                  </div>
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {round.sessions.slice(1).map(sess => (
                      <InterventionBadge key={sess.sessionNumber} type={sess.intervention} />
                    ))}
                  </div>
                  {isActive && (
                    <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// SchedulerPanel — main start/control UI
// ─────────────────────────────────────────────
function SchedulerPanel({
  state,
  allStocks,
  onStartRound,
  onPause,
  onResume,
}: {
  state: SchedulerState;
  allStocks: Stock[];
  onStartRound: (roundNumber: number, stockIds: number[]) => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedStockIds, setSelectedStockIds] = useState<number[]>([]);
  const [starting, setStarting] = useState(false);
  const [interventionOverride, setInterventionOverride] = useState<InterventionType>("NONE");

  // Find next available round
  const nextRound = state.activeRound === null
    ? (() => {
        for (let i = 1; i <= 12; i++) {
          if (!EXPERIMENTAL_MATRIX[i - 1]) return 1;
        }
        return 12;
      })()
    : null;

  const isRunning = state.activeRound !== null;

  const handleStart = () => {
    if (selectedStockIds.length === 0) {
      toast.error("Select exactly 3 stocks before starting");
      return;
    }
    setStarting(true);
    onStartRound(selectedRound, selectedStockIds);
    setTimeout(() => setStarting(false), 3000);
  };

  const toggleStock = (id: number) => {
    setSelectedStockIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };



  const roundConfig = EXPERIMENTAL_MATRIX[selectedRound - 1];

  return (
    <div className="space-y-4">
      {/* Active round status */}
      {isRunning && state.activeRound && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-400">
              Round {state.activeRound} Sedang Aktif
            </span>
            <span className="ml-auto text-xs text-zinc-500">
              Period {Math.ceil(state.activeRound / 4)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="size-4 text-zinc-500" />
            <span className="font-mono text-lg font-bold text-zinc-200">
              {Math.floor(state.timeLeft / 60)}:{String(state.timeLeft % 60).padStart(2, "0")}
            </span>
            <span className="text-xs text-zinc-500">
              {getPhaseLabel(state.phase!)} — Sesi {state.activeSubSession}
            </span>
          </div>

          {state.stocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {state.stocks.map(s => (
                <span key={s.id} className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
                  {s.kode}
                </span>
              ))}
            </div>
          )}

          {state.currentIntervention !== "NONE" && (
            <div className="flex items-center gap-2 rounded bg-amber-500/10 border border-amber-500/20 p-2">
              <Zap className="size-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-400">
                INTERVENSI AKTIF: {getInterventionLabel(state.currentIntervention)}
              </span>
            </div>
          )}

          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-zinc-700 overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: "100%" }}
              animate={{ width: `${Math.max(0, (state.timeLeft / 120) * 100)}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        </div>
      )}

      {/* Pause/Resume */}
      {isRunning && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={state.isPaused ? onResume : onPause}
          >
            {state.isPaused ? (
              <>
                <PlayCircle className="size-4 text-emerald-500" />
                Lanjutkan
              </>
            ) : (
              <>
                <PauseCircle className="size-4 text-amber-500" />
                Jeda
              </>
            )}
          </Button>
        </div>
      )}

      {/* Not running: show start panel */}
      {!isRunning && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500">
            Pilih Round dan 3 saham untuk memulai
          </div>

          {/* Round selector */}
          <div className="grid grid-cols-4 gap-1">
            {EXPERIMENTAL_MATRIX.map((round: RoundConfig) => {
              const isCompleted = (state.completedRounds || []).includes(round.roundNumber);
              return (
                <button
                  key={round.roundNumber}
                  onClick={() => {
                    setSelectedRound(round.roundNumber);
                    setSelectedStockIds([]);
                  }}
                  disabled={isCompleted}
                  className={`rounded border px-2 py-1.5 text-[10px] font-medium transition-all ${
                    selectedRound === round.roundNumber
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : isCompleted
                      ? "border-white/5 bg-zinc-800/20 text-zinc-600 opacity-50 cursor-not-allowed"
                      : "border-white/5 bg-zinc-800/50 text-zinc-500 hover:border-white/10 hover:text-zinc-300"
                  }`}
                >
                  R{round.roundNumber} {isCompleted && "✓"}
                </button>
              );
            })}
          </div>

          {/* Selected round intervention preview */}
          {roundConfig && (
            <div className="rounded border border-white/5 bg-zinc-800/30 p-2 space-y-1">
              <div className="text-[10px] text-zinc-600">
                Intervensi untuk Round {selectedRound}:
              </div>
              <div className="flex flex-wrap gap-1">
                {roundConfig.sessions.slice(1).map(sess => (
                  <div key={sess.sessionNumber} className="text-[10px] text-zinc-400">
                    S{sess.sessionNumber}: <InterventionBadge type={sess.intervention} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock selector */}
          <div className="text-[10px] text-zinc-600 font-medium">
            Pilih 3 Saham ({selectedStockIds.length}/3):
          </div>
          <div className="grid grid-cols-2 gap-1">
            {allStocks.map(stock => {
              const sel = selectedStockIds.includes(stock.id);
              const isUsed = (state.usedStockIds || []).includes(stock.id);
              return (
                <button
                  key={stock.id}
                  onClick={() => toggleStock(stock.id)}
                  disabled={(selectedStockIds.length >= 3 && !sel) || isUsed}
                  className={`rounded border px-2 py-1.5 text-left text-xs transition-all ${
                    sel
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : isUsed
                      ? "border-rose-500/20 bg-rose-500/5 text-rose-400/50 cursor-not-allowed"
                      : selectedStockIds.length >= 3
                      ? "border-white/5 bg-zinc-800/30 text-zinc-600 opacity-40 cursor-not-allowed"
                      : "border-white/5 bg-zinc-800/50 text-zinc-400 hover:border-white/10 hover:text-zinc-200"
                  }`}
                >
                  <span className="font-medium">{stock.kode}</span>
                  <span className="ml-1 text-[10px] opacity-70">{stock.nama}</span>
                  {isUsed && <span className="ml-2 text-[8px] text-rose-500/80 uppercase">Digunakan</span>}
                </button>
              );
            })}
          </div>


          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            onClick={handleStart}
            disabled={selectedStockIds.length !== 3 || starting}
          >
            {starting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <SkipForward className="size-3.5" />
            )}
            {starting ? "Memulai..." : `Mulai Round ${selectedRound} Saja`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            onClick={() => {
              if (confirm("Reset semua sesi? Semua data round akan dihapus dan saham bisa dipilih ulang.")) {
                const socket = getSocket();
                socket.emit("admin-reset-experiment");
              }
            }}
          >
            <RefreshCw className="size-3.5" />
            Reset Semua Sesi
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main AdminSchedulerBoard component
// ─────────────────────────────────────────────
export default function AdminSchedulerBoard() {
  const { user } = useAuth();
  const [state, setState] = useState<SchedulerState>({
    activeRound: null,
    activeSubSession: null,
    phase: null,
    timeLeft: 0,
    currentIntervention: "NONE",
    isPaused: false,
    openingPrices: {},
    stocks: [],
    interventionCache: {},
    completedRounds: [],
    usedStockIds: [],
  });
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"scheduler" | "intervention" | "matrix" | "export">("scheduler");
  const [socketConnected, setSocketConnected] = useState(false);

  // Auto authenticate socket whenever it connects
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const socket = getSocket();
    const auth = () => socket.emit("authenticate", { userId: user.id });
    
    if (socket.connected) auth();
    socket.on("connect", auth);
    return () => { socket.off("connect", auth); };
  }, [user]);

  useEffect(() => {
    fetch("/api/stocks")
      .then(r => r.json())
      .then(data => setAllStocks(
        (data.stocks || []).map((s: any) => ({
          id: s.id,
          kode: s.kodeSaham,
          nama: s.namaSaham,
          basePrice: s.basePrice
        }))
      ))
      .catch(() => {});

    // Request initial scheduler state
    const socket = getSocket();
    socket.emit("get-scheduler-state");

    setLoading(false);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // Track socket connection
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    setSocketConnected(socket.connected);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("scheduler-state", (data: SchedulerState) => {
      setState({
        ...data,
        completedRounds: data.completedRounds || [],
        usedStockIds: data.usedStockIds || [],
      });
    });

    socket.on("round-started", (data: { roundNumber: number; stocks: Stock[] }) => {
      setState(prev => ({
        ...prev,
        activeRound: data.roundNumber,
        stocks: data.stocks,
        phase: "PRE_OPENING",
        timeLeft: 60,
        currentIntervention: "NONE",
      }));
      toast.dismiss("start-round");
      toast.success(`Round ${data.roundNumber} berhasil dimulai! Fase: Pra Pembukaan (60 detik)`);
    });

    socket.on("sub-session-started", (data: {
      roundNumber: number;
      sessionNumber: number;
      phase: SubSessionPhase;
      duration: number;
      intervention: InterventionType;
    }) => {
      setState(prev => ({
        ...prev,
        activeRound: data.roundNumber,
        activeSubSession: data.sessionNumber,
        phase: data.phase,
        timeLeft: data.duration,
        currentIntervention: data.intervention,
      }));
    });

    socket.on("timer-tick", (data: { timeLeft: number }) => {
      setState(prev => ({ ...prev, timeLeft: data.timeLeft }));
    });

    socket.on("intervention-triggered", (data: { type: InterventionType }) => {
      setState(prev => ({ ...prev, currentIntervention: data.type }));
      toast.warning(`Intervensi aktif: ${getInterventionLabel(data.type)}`, {
        description: data.type !== "NONE" ? state.interventionCache[data.type]?.content : undefined,
      });
    });

    socket.on("round-ended", () => {
      setState(prev => ({
        ...prev,
        activeRound: null,
        activeSubSession: null,
        phase: null,
        timeLeft: 0,
        currentIntervention: "NONE",
        openingPrices: {},
      }));
      // Fetch updated scheduler state to get the new completedRounds and usedStockIds
      socket.emit("get-scheduler-state");
      toast.success("Ronde selesai.");
    });

    socket.on("experiment-ended", () => {
      toast.success("Eksperimen selesai! Semua 12 ronde telah selesai.");
    });

    socket.on("experiment-reset", () => {
      setState({
        activeRound: null,
        activeSubSession: null,
        phase: null,
        timeLeft: 0,
        currentIntervention: "NONE",
        isPaused: false,
        openingPrices: {},
        stocks: [],
        interventionCache: {},
        completedRounds: [],
        usedStockIds: [],
      });
      toast.info("Semua sesi telah direset.");
    });

    socket.on("experiment-stopped", () => {
      setState(prev => ({
        ...prev,
        activeRound: null,
        activeSubSession: null,
        phase: null,
        timeLeft: 0,
        currentIntervention: "NONE",
        openingPrices: {},
        stocks: [],
      }));
      toast.info("Eksperimen dihentikan.");
    });

    socket.on("round-cooldown-started", (data: { nextRound: number; cooldownSeconds: number }) => {
      toast.info(`Jeda 3 menit sebelum Round ${data.nextRound}...`);
    });

    socket.on("intervention-cache-loaded", (data: Record<string, { title: string; content: string }>) => {
      setState(prev => ({ ...prev, interventionCache: data }));
    });


    socket.on("admin-error", (data: { message: string }) => {
      toast.error(`Error: ${data.message}`);
    });

    socket.on("admin-warning", (data: { message: string; missingInterventions?: string[] }) => {
      toast.warning(data.message);
    });

    socket.on("intervention-config-status", (data: {
      roundNumber: number;
      available: string[];
      missing: string[];
    }) => {
      if (data.missing.length > 0) {
        toast.warning(`Round ${data.roundNumber} butuh intervensi: ${data.missing.join(", ")}`);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("scheduler-state");
      socket.off("round-started");
      socket.off("sub-session-started");
      socket.off("timer-tick");
      socket.off("intervention-triggered");
      socket.off("round-ended");
      socket.off("experiment-ended");
      socket.off("experiment-reset");
      socket.off("experiment-stopped");
      socket.off("round-cooldown-started");
      socket.off("intervention-cache-loaded");
      socket.off("admin-warning");
      socket.off("admin-error");
      socket.off("intervention-config-status");
    };
  }, []);

  const handleStartRound = useCallback((roundNumber: number, stockIds: number[]) => {
    const socket = getSocket();
    if (!socket.connected) {
      toast.error("Server WebSocket tidak terhubung! Jalankan: npm run dev:server", {
        description: "Hentikan 'npm run dev' lalu jalankan 'npm run dev:server'",
        duration: 8000,
      });
      return;
    }
    toast.loading(`Memulai Round ${roundNumber}...`, { id: "start-round" });
    socket.emit("admin-start-round", { roundNumber, stockIds, userId: user?.id });
  }, [user]);

  const handlePause = useCallback(() => {
    const socket = getSocket();
    socket.emit("admin-pause", { userId: user?.id });
  }, [user]);

  const handleResume = useCallback(() => {
    const socket = getSocket();
    socket.emit("admin-resume", { userId: user?.id });
  }, [user]);

  const handleExport = async () => {
    const res = await fetch("/api/export?format=csv");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data berhasil diunduh");
  };

  const tabs = [
    { key: "scheduler", label: "Scheduler", icon: <Timer className="size-3.5" /> },
    { key: "intervention", label: "Intervensi", icon: <Settings2 className="size-3.5" /> },
    { key: "matrix", label: "Matriks", icon: <BookOpen className="size-3.5" /> },
    { key: "export", label: "Export", icon: <DownloadCloud className="size-3.5" /> },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Socket Connection Status */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        socketConnected
          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
      }`}>
        <span className={`size-2 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
        {socketConnected
          ? "Server WebSocket terhubung — Siap memulai sesi"
          : "Server WebSocket tidak terhubung — Jalankan: npm run dev:server (bukan npm run dev)"}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/5 pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Scheduler */}
      {activeTab === "scheduler" && (
        <div className="space-y-4">
          <SchedulerPanel
            state={state}
            allStocks={allStocks}
            onStartRound={handleStartRound}
            onPause={handlePause}
            onResume={handleResume}
          />
        </div>
      )}

      {/* Tab: Intervention Content */}
      {activeTab === "intervention" && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500">
            Definisikan konten intervensi sebelum memulai eksperimen.
            Teks ini akan ditampilkan ke semua responden saat intervensi dipicu.
          </div>
          <InterventionContentForm />
        </div>
      )}

      {/* Tab: Matrix Preview */}
      {activeTab === "matrix" && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500">
            Matriks desain eksperimen — menunjukkan intervensi per sesi per ronde.
          </div>
          <ExperimentProgress activeRound={state.activeRound} />

          {/* Full intervention legend */}
          <div className="rounded-lg border border-white/5 bg-zinc-800/30 p-3">
            <div className="mb-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              Legenda Intervensi
            </div>
            <div className="space-y-1">
              {(["NONE", "BERITA_BAIK", "BERITA_BURUK", "TMNP_1", "TMNP_2"] as InterventionType[]).map(type => (
                <div key={type} className="flex items-center gap-2 text-xs text-zinc-400">
                  <InterventionBadge type={type} />
                  <span className="text-[10px] text-zinc-600">
                    {type === "NONE" && "Tanpa intervensi (kontrol)"}
                    {type === "BERITA_BAIK" && "Berita positif tentang saham"}
                    {type === "BERITA_BURUK" && "Berita negatif tentang saham"}
                    {type === "TMNP_1" && "Trading halt periode 1"}
                    {type === "TMNP_2" && "Trading halt periode 2"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Export */}
      {activeTab === "export" && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500">
            Ekspor data eksperimen dalam format CSV untuk analisis statistik.
            Data mencakup prediksi dan transaksi yang ditandai dengan intervensi aktif.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
            >
              <DownloadCloud className="size-3.5" />
              Download CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                const res = await fetch("/api/export?format=json");
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `experiment_data_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("JSON data downloaded");
              }}
            >
              <DownloadCloud className="size-3.5" />
              Download JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
