"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import {
  PERIOD_MATRIX, PeriodDef, InterventionType, PhaseType,
  getInterventionLabel, getPhaseLabel, INTERVENTION_KEYS,
} from "@/lib/experimental-matrix";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, PauseCircle, StopCircle, Loader2, Clock,
  RadioTower, TrendingUp, TrendingDown, RefreshCw,
  ChevronRight, DownloadCloud, Zap, Activity, Timer,
  BookOpen, CheckCircle2, Circle, AlertCircle, SkipForward,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Stock = { id: number; kodeSaham: string; namaSaham: string; basePrice?: number };

type ExperimentState = {
  activePeriod: 1 | 2 | 3 | null;
  activeSessionIdx: number | null;
  activeRoundIdx: number | null;
  currentPhase: PhaseType;
  timeLeft: number;
  sessionGroup: number | null;
  isPaused: boolean;
  currentIntervention: InterventionType;
  stocks: Stock[];
  openingPrices: Record<number, number>;
  interventionCache: Record<string, { title: string; content: string }>;
  periodStates: Record<number, string>;
  completedSessions: Record<number, number[]>;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const PHASE_CONFIG: Record<PhaseType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  IDLE:       { label: "Menunggu",       color: "text-muted-foreground",   bg: "bg-zinc-700/40",         icon: <Circle className="size-3.5" /> },
  PRE_MARKET: { label: "Pra-Perdagangan", color: "text-amber-400",  bg: "bg-amber-500/10",        icon: <BookOpen className="size-3.5" /> },
  TRADING:    { label: "Perdagangan",    color: "text-emerald-400", bg: "bg-emerald-500/10",      icon: <Activity className="size-3.5" /> },
  COOLDOWN:   { label: "Jeda",           color: "text-sky-400",    bg: "bg-sky-500/10",          icon: <Timer className="size-3.5" /> },
  CLOSED:     { label: "Selesai",        color: "text-muted-foreground",   bg: "bg-zinc-800/40",         icon: <CheckCircle2 className="size-3.5" /> },
};

const INTERVENTION_CONFIG: Record<InterventionType, { label: string; color: string; icon: React.ReactNode }> = {
  NONE:        { label: "Tanpa Intervensi", color: "text-muted-foreground", icon: null },
  BERITA_BAIK: { label: "Berita Baik",      color: "text-emerald-400", icon: <TrendingUp className="size-3.5" /> },
  BERITA_BURUK:{ label: "Berita Buruk",     color: "text-rose-400",    icon: <TrendingDown className="size-3.5" /> },
};

// ─────────────────────────────────────────────
// InterventionConfigForm
// ─────────────────────────────────────────────
function InterventionConfigForm({ onSaved }: { onSaved?: () => void }) {
  const [form, setForm] = useState<Record<"BERITA_BAIK" | "BERITA_BURUK", { title: string; content: string }>>({
    BERITA_BAIK:  { title: "", content: "" },
    BERITA_BURUK: { title: "", content: "" },
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/intervention")
      .then(r => r.json())
      .then(data => {
        if (data.config) {
          setForm(prev => ({
            BERITA_BAIK:  data.config.BERITA_BAIK  || prev.BERITA_BAIK,
            BERITA_BURUK: data.config.BERITA_BURUK || prev.BERITA_BURUK,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: "BERITA_BAIK" | "BERITA_BURUK") => {
    setSaving(key);
    try {
      const res = await fetch("/api/intervention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...form[key] }),
      });
      if (res.ok) {
        toast.success(`${getInterventionLabel(key)} disimpan!`);
        onSaved?.();
        const socket = getSocket();
        socket.emit("reload-intervention-cache");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
      <Loader2 className="size-3 animate-spin" /> Memuat konten intervensi...
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-3">
      {(["BERITA_BAIK", "BERITA_BURUK"] as const).map(key => {
        const cfg = INTERVENTION_CONFIG[key];
        return (
          <div key={key} className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none p-3 space-y-2">
            <div className={`flex items-center gap-2 text-xs font-semibold ${cfg.color}`}>
              {cfg.icon}{cfg.label}
            </div>
            <Input
              value={form[key].title}
              onChange={e => setForm(p => ({ ...p, [key]: { ...p[key], title: e.target.value } }))}
              placeholder="Judul running text..."
              className="text-xs bg-background border-border text-foreground placeholder:text-muted-foreground h-8"
            />
            <textarea
              value={form[key].content}
              onChange={e => setForm(p => ({ ...p, [key]: { ...p[key], content: e.target.value } }))}
              placeholder="Isi pesan / teks berjalan..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
            <Button
              size="sm" variant="outline"
              className="w-full text-xs h-7 border-border hover:bg-muted"
              onClick={() => handleSave(key)}
              disabled={saving === key || !form[key].title || !form[key].content}
            >
              {saving === key ? <Loader2 className="size-3 animate-spin mr-1" /> : <DownloadCloud className="size-3 mr-1" />}
              {saving === key ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// PeriodSummaryCard
// ─────────────────────────────────────────────
function PeriodSummaryCard({
  period, activePeriod, onStartSession, periodState, completedSessions
}: {
  period: PeriodDef;
  activePeriod: 1 | 2 | 3 | null;
  onStartSession: (period: 1|2|3, sessionIndex: number) => void;
  periodState?: string;
  completedSessions: number[];
}) {
  const isActive = activePeriod === period.periodNumber;
  const isPaused = periodState === "paused";
  const totalRounds = period.sessions.reduce((a, s) => a + s.rounds.length, 0);
  const hasIntervention = period.sessions.some(s => s.intervention !== "NONE");

  return (
    <div className={`rounded-2xl border p-4 transition-all ${isActive
      ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/10"
      : "border-border bg-card shadow-sm dark:shadow-none hover:border-border/80"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-muted-foreground font-medium">{period.label}</div>
          <div className="text-sm font-semibold text-foreground mt-0.5">
            {period.sessions.length} Sesi · {totalRounds} Ronde
          </div>
        </div>
        {isActive && !isPaused && (
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-medium animate-pulse">
            <RadioTower className="size-2.5" /> Berjalan
          </span>
        )}
        {isPaused && (
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-medium">
            <PauseCircle className="size-2.5" /> Dijeda
          </span>
        )}
      </div>

      <div className="space-y-2 mb-3">
        {period.sessions.map((s, idx) => {
          const isCompleted = completedSessions.includes(idx);
          return (
            <div key={s.sessionNumber} className="flex items-center gap-2 text-xs text-muted-foreground bg-background rounded-lg p-2 border">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                {s.sessionNumber}
              </span>
              <span className="flex-1 text-foreground/90">{s.label}</span>
              {s.intervention !== "NONE" && (
                <span className={`${INTERVENTION_CONFIG[s.intervention].color} flex items-center gap-0.5`}>
                  {INTERVENTION_CONFIG[s.intervention].icon}
                </span>
              )}
              <span className="text-muted-foreground">{s.rounds.length}R</span>
              
              <Button
                size="sm"
                variant={isCompleted ? "secondary" : "default"}
                className={`ml-2 h-6 px-2 text-[10px] font-medium ${isCompleted ? 'opacity-60 cursor-default' : 'hover:bg-primary/90'}`}
                onClick={() => !isCompleted && onStartSession(period.periodNumber as 1|2|3, idx)}
                disabled={activePeriod !== null || isCompleted}
              >
                {isCompleted ? <CheckCircle2 className="size-3 mr-1 text-emerald-500" /> : <PlayCircle className="size-3 mr-1" />}
                {isCompleted ? "Selesai" : "Mulai"}
              </Button>
            </div>
          );
        })}
      </div>

      {hasIntervention && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
          {[...new Set(period.sessions.filter(s => s.intervention !== "NONE").map(s => s.intervention))].map(int => (
            <span key={int} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium border ${int === "BERITA_BAIK" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
              {INTERVENTION_CONFIG[int].icon}
              {INTERVENTION_CONFIG[int].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LiveStatusPanel
// ─────────────────────────────────────────────
function LiveStatusPanel({
  state, onPause, onResume, onStop,
}: {
  state: ExperimentState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const { activePeriod, activeSessionIdx, activeRoundIdx, currentPhase, timeLeft, isPaused, currentIntervention, stocks, sessionGroup } = state;
  if (activePeriod === null) return null;

  const periodCfg = PERIOD_MATRIX.find(p => p.periodNumber === activePeriod)!;
  const sessionCfg = activeSessionIdx !== null ? periodCfg.sessions[activeSessionIdx] : null;
  const phaseCfg = PHASE_CONFIG[currentPhase];
  const intCfg = INTERVENTION_CONFIG[currentIntervention];
  const totalRounds = sessionCfg?.rounds.length ?? 0;

  // Timer percentage
  const maxTime = currentPhase === "PRE_MARKET" ? 60 : currentPhase === "TRADING" ? 120 : 180;
  const pct = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-background p-4 space-y-4 shadow-xl shadow-primary/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${phaseCfg.bg} ${phaseCfg.color} border-current/20`}>
            {phaseCfg.icon}{phaseCfg.label}
          </span>
          {isPaused && (
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">
              <PauseCircle className="size-2.5" /> Dijeda
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {isPaused ? (
            <Button size="sm" onClick={onResume} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1">
              <PlayCircle className="size-3" /> Resume
            </Button>
          ) : (
            <Button size="sm" onClick={onPause} variant="outline" className="h-7 text-xs border-white/10 gap-1">
              <PauseCircle className="size-3" /> Jeda
            </Button>
          )}
          <Button size="sm" onClick={onStop} variant="outline" className="h-7 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1">
            <StopCircle className="size-3" /> Stop
          </Button>
        </div>
      </div>

      {/* Progress context */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 p-2 border border-border/50">
          <div className="text-[10px] text-muted-foreground mb-0.5">Periode</div>
          <div className="text-sm font-bold text-foreground">{activePeriod} / 3</div>
        </div>
        <div className="rounded-xl bg-muted/50 p-2 border border-border/50">
          <div className="text-[10px] text-muted-foreground mb-0.5">Sesi</div>
          <div className="text-sm font-bold text-foreground">
            {sessionGroup ?? "—"} / {periodCfg.sessions.length}
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 p-2 border border-border/50">
          <div className="text-[10px] text-muted-foreground mb-0.5">Ronde</div>
          <div className="text-sm font-bold text-foreground">
            {activeRoundIdx !== null ? activeRoundIdx + 1 : "—"} / {totalRounds}
          </div>
        </div>
      </div>

      {/* Timer */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground font-medium">{phaseCfg.label}</span>
          <span className={`font-mono font-bold text-lg ${phaseCfg.color}`}>{formatTime(timeLeft)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${currentPhase === "TRADING" ? "bg-emerald-500" : currentPhase === "PRE_MARKET" ? "bg-amber-500" : "bg-sky-500"}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Session label */}
      {sessionCfg && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Sesi saat ini</span>
          <span className="text-foreground font-medium">{sessionCfg.label}</span>
        </div>
      )}

      {/* Active stocks */}
      {stocks.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-1.5">Saham Aktif</div>
          <div className="flex flex-wrap gap-1.5">
            {stocks.map(s => (
              <span key={s.id} className="rounded-lg bg-muted border border-border px-2 py-1 text-xs font-medium text-foreground">
                {s.kodeSaham}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Intervention status */}
      {currentIntervention !== "NONE" && currentPhase === "PRE_MARKET" && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs border ${currentIntervention === "BERITA_BAIK" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
          {intCfg.icon}
          <span className="font-medium">Running Text Aktif:</span>
          <span>{intCfg.label}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Session Progress Tracker
// ─────────────────────────────────────────────
function SessionProgress({ state }: { state: ExperimentState }) {
  const { activePeriod, activeSessionIdx, activeRoundIdx, currentPhase } = state;
  if (activePeriod === null) return null;
  const periodCfg = PERIOD_MATRIX.find(p => p.periodNumber === activePeriod)!;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm dark:shadow-none p-4 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground">Progress {periodCfg.label}</div>
      {periodCfg.sessions.map((session, si) => {
        const isCurrentSession = si === activeSessionIdx;
        const isPastSession = activeSessionIdx !== null && si < activeSessionIdx;
        return (
          <div key={session.sessionNumber} className={`rounded-xl p-3 border transition-all ${isCurrentSession ? "border-primary/30 bg-primary/5" : isPastSession ? "border-border bg-muted/20 opacity-50" : "border-border bg-transparent opacity-30"}`}>
            <div className="flex items-center gap-2 mb-2">
              {isPastSession ? <CheckCircle2 className="size-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                : isCurrentSession ? <RadioTower className="size-3.5 text-primary animate-pulse shrink-0" />
                : <Circle className="size-3.5 text-muted-foreground shrink-0" />}
              <span className="text-xs font-medium text-foreground/90">{session.label}</span>
              {session.intervention !== "NONE" && (
                <span className={`ml-auto ${INTERVENTION_CONFIG[session.intervention].color} flex items-center gap-0.5 text-[10px]`}>
                  {INTERVENTION_CONFIG[session.intervention].icon}
                  {INTERVENTION_CONFIG[session.intervention].label}
                </span>
              )}
            </div>
            {isCurrentSession && (
              <div className="flex gap-1 flex-wrap">
                {session.rounds.map((r, ri) => {
                  const isPast = activeRoundIdx !== null && ri < activeRoundIdx;
                  const isCurrent = ri === activeRoundIdx;
                  return (
                    <div key={ri} className={`rounded-lg px-2 py-1 text-[10px] font-medium border transition-colors ${isCurrent
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : isPast
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400"
                      : "bg-muted border-border text-muted-foreground"}`}>
                      R{ri + 1} · {r.stockCodes.join(", ")}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function AdminSchedulerBoard() {
  const { user } = useAuth();
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const [expState, setExpState] = useState<ExperimentState>({
    activePeriod: null,
    activeSessionIdx: null,
    activeRoundIdx: null,
    currentPhase: "IDLE",
    timeLeft: 0,
    sessionGroup: null,
    isPaused: false,
    currentIntervention: "NONE",
    stocks: [],
    openingPrices: {},
    interventionCache: {},
    periodStates: {},
    completedSessions: { 1: [], 2: [], 3: [] },
  });

  const [loading, setLoading] = useState(true);
  const [startingPeriod, setStartingPeriod] = useState<number | null>(null);

  // ── Socket setup ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) socket.connect();

    socket.emit("authenticate", { userId: user.id });
    socket.emit("get-scheduler-state");

    // State sync
    socket.on("scheduler-state", (data: any) => {
      setExpState(prev => ({
        ...prev,
        activePeriod: data.activePeriod ?? null,
        activeSessionIdx: data.activeSessionIdx ?? null,
        activeRoundIdx: data.activeRoundIdx ?? null,
        currentPhase: data.currentPhase ?? data.phase ?? "IDLE",
        timeLeft: data.timeLeft ?? 0,
        sessionGroup: data.sessionGroup ?? null,
        isPaused: data.isPaused ?? false,
        currentIntervention: data.currentIntervention ?? "NONE",
        stocks: data.stocks ?? [],
        openingPrices: data.openingPrices ?? {},
        interventionCache: data.interventionCache ?? {},
        periodStates: data.periodStates ?? {},
      }));
      setLoading(false);
    });

    // State sync
    socket.on("period-state-changed", (states: Record<number, string>) => {
      setExpState(prev => ({ ...prev, periodStates: states }));
    });
    socket.on("completed-sessions-changed", (completed: Record<number, number[]>) => {
      setExpState(prev => ({ ...prev, completedSessions: completed }));
    });

    // Period events
    socket.on("period-started", (data: { periodNumber: number; label: string; totalSessions: number }) => {
      setExpState(prev => ({ ...prev, activePeriod: data.periodNumber as 1|2|3, currentPhase: "IDLE" }));
      setStartingPeriod(null);
    });
    socket.on("period-ended", (data: { periodNumber: number }) => {
      setExpState(prev => ({ ...prev, activePeriod: null, activeSessionIdx: null, activeRoundIdx: null, currentPhase: "IDLE", stocks: [], currentIntervention: "NONE" }));
    });
    socket.on("session-completed", (data: { periodNumber: number, sessionIdx: number }) => {
      toast.success(`Sesi selesai!`);
    });
    socket.on("period-aborted", () => {
      setExpState(prev => ({ ...prev, activePeriod: null, activeSessionIdx: null, activeRoundIdx: null, currentPhase: "IDLE", stocks: [], currentIntervention: "NONE" }));
      toast.info("Sesi dihentikan");
    });
    socket.on("experiment-reset", () => {
      setExpState(prev => ({ ...prev, activePeriod: null, activeSessionIdx: null, activeRoundIdx: null, currentPhase: "IDLE", stocks: [], currentIntervention: "NONE", isPaused: false, completedSessions: { 1: [], 2: [], 3: [] } }));
      toast.info("Eksperimen direset");
    });

    // Session events
    socket.on("session-group-started", (data: any) => {
      setExpState(prev => ({
        ...prev,
        activeSessionIdx: data.sessionIdx ?? null,
        sessionGroup: data.sessionNumber ?? null,
      }));
    });

    // Round events
    socket.on("round-started", (data: any) => {
      setExpState(prev => ({
        ...prev,
        activeRoundIdx: (data.roundNumber ?? 1) - 1,
        stocks: data.stocks ?? [],
      }));
    });

    // Phase events
    socket.on("sub-session-started", (data: any) => {
      setExpState(prev => ({
        ...prev,
        currentPhase: data.phase,
        timeLeft: data.duration ?? 0,
        currentIntervention: data.intervention ?? "NONE",
      }));
    });
    socket.on("cooldown-started", (data: any) => {
      setExpState(prev => ({ ...prev, currentPhase: "COOLDOWN", timeLeft: data.duration ?? 180 }));
    });

    // Timer
    socket.on("timer-tick", (data: any) => {
      setExpState(prev => ({
        ...prev,
        timeLeft: data.timeLeft ?? prev.timeLeft,
        currentPhase: data.phase ?? prev.currentPhase,
        sessionGroup: data.sessionGroup ?? prev.sessionGroup,
        activeRoundIdx: data.roundIndex ?? prev.activeRoundIdx,
      }));
    });

    // Intervention
    socket.on("intervention-triggered", (data: any) => {
      setExpState(prev => ({ ...prev, currentIntervention: data.type ?? "NONE" }));
    });
    socket.on("intervention-ended", () => {
      setExpState(prev => ({ ...prev, currentIntervention: "NONE" }));
    });

    // Pause/Resume
    socket.on("experiment-paused", () => setExpState(prev => ({ ...prev, isPaused: true })));
    socket.on("experiment-resumed", () => setExpState(prev => ({ ...prev, isPaused: false })));

    // Cache
    socket.on("intervention-cache-loaded", (cache: any) => {
      setExpState(prev => ({ ...prev, interventionCache: cache }));
    });

    // Errors
    socket.on("admin-error", (data: { message: string }) => {
      toast.error(data.message);
      setStartingPeriod(null);
    });

    setLoading(false);
    return () => {
      socket.off("scheduler-state"); socket.off("period-started"); socket.off("period-ended");
      socket.off("period-aborted"); socket.off("experiment-reset"); socket.off("session-group-started");
      socket.off("round-started"); socket.off("sub-session-started"); socket.off("cooldown-started");
      socket.off("timer-tick"); socket.off("intervention-triggered"); socket.off("intervention-ended");
      socket.off("experiment-paused"); socket.off("experiment-resumed"); socket.off("completed-sessions-changed");
      socket.off("intervention-cache-loaded"); socket.off("admin-error"); socket.off("session-completed");
    };
  }, [user]);

  // ── Actions ─────────────────────────────────────────────────
  const handleStartSession = useCallback((periodNumber: 1 | 2 | 3, sessionIndex: number) => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit("admin-start-session", { periodNumber, sessionIndex, userId: user.id });
    toast.info(`Memulai Sesi...`);
  }, [user]);

  const handlePause = useCallback(() => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit("admin-pause", { userId: user.id });
  }, [user]);

  const handleResume = useCallback(() => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit("admin-resume", { userId: user.id });
  }, [user]);

  const handleStop = useCallback(() => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit("admin-stop-period", { userId: user.id });
    toast.warning("Sesi dihentikan");
  }, [user]);

  const handleReset = useCallback(() => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit("admin-reset-experiment");
  }, [user]);

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Memuat panel kontrol...
        </div>
      </div>
    );
  }

  const { activePeriod } = expState;

  return (
    <div className="space-y-5">
      {/* ── LIVE STATUS ──────────────────────────────────────── */}
      <AnimatePresence>
        {activePeriod !== null && (
          <motion.div key="live" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <LiveStatusPanel
              state={expState}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SESSION PROGRESS ──────────────────────────────────── */}
      <AnimatePresence>
        {activePeriod !== null && (
          <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SessionProgress state={expState} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PERIOD SELECTOR ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="size-3.5 text-primary" />
            Mulai Periode Eksperimen
          </h3>
          {activePeriod === null && (
            <Button
              size="sm" variant="ghost"
              className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1"
              onClick={handleReset}
            >
              <RefreshCw className="size-3" /> Reset
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3">
            {PERIOD_MATRIX.map(period => (
              <PeriodSummaryCard
                key={period.periodNumber}
                period={period}
                activePeriod={expState.activePeriod}
                periodState={expState.periodStates[period.periodNumber]}
                completedSessions={expState.completedSessions[period.periodNumber] || []}
                onStartSession={handleStartSession}
              />
            ))}
        </div>
      </div>

      {/* ── LEGEND ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Keterangan Alur</div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Pra-Perdagangan (60 detik)</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Perdagangan (120 detik)</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" /> Jeda / Cooldown (3 menit)</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" /> Periode I: Prediksi Saja</div>
        </div>
      </div>
    </div>
  );
}
