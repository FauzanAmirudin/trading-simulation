// ============================================================
// EXPERIMENTAL DESIGN MATRIX — Revised Architecture v2
// ============================================================
// Structure: 3 Periods → Sessions per Period → Rounds per Session
// Intervention Rule: Running Text ONLY during PRE_MARKET phase
// Cooldown: 3 minutes between rounds AND between sessions (Period 2 & 3)
// Period 1: PRE_MARKET (prediction input) ONLY — no live trading
// ============================================================

// === TYPES ===
export type InterventionType = "NONE" | "BERITA_BAIK" | "BERITA_BURUK";
export type PhaseType = "PRE_MARKET" | "TRADING" | "COOLDOWN" | "IDLE" | "CLOSED";

// Backward-compatibility alias used in existing frontend components
export type SubSessionPhase = PhaseType;

export interface RoundDef {
  stockCodes: string[]; // exactly 3 stock codes, e.g. ["S-1","S-2","S-3"]
}

export interface SessionGroupDef {
  sessionNumber: 1 | 2 | 3 | 4;
  label: string;
  intervention: InterventionType; // active running text during PRE_MARKET
  hasTrading: boolean;            // false = PRE_MARKET only (Period 1)
  rounds: RoundDef[];
}

export interface PeriodDef {
  periodNumber: 1 | 2 | 3;
  label: string;
  sessions: SessionGroupDef[];
}

// === TIMER DURATIONS (seconds) ===
export const DURATIONS = {
  PRE_MARKET: 180,       // 3 minute prediction phase
  TRADING: 120,          // 2 minute live trading phase
  COOLDOWN: 180,         // 3 minute cooldown (between rounds AND between sessions)
  // Legacy aliases
  PRE_OPENING: 180,
  TRADING_SESSION: 120,
  ROUND_COOLDOWN: 180,
} as const;

// ============================================================
// FULL EXPERIMENTAL MATRIX
// ============================================================
export const PERIOD_MATRIX: PeriodDef[] = [

  // ── PERIOD 1: Prediction Only, S-1 to S-12 ────────────────────
  {
    periodNumber: 1,
    label: "Periode I",
    sessions: [
      {
        sessionNumber: 1,
        label: "Pra-Perdagangan",
        intervention: "NONE",
        hasTrading: false, // NO live trading in Period 1
        rounds: [
          { stockCodes: ["S-1",  "S-2",  "S-3"]  },
          { stockCodes: ["S-4",  "S-5",  "S-6"]  },
          { stockCodes: ["S-7",  "S-8",  "S-9"]  },
          { stockCodes: ["S-10", "S-11", "S-12"] },
        ],
      },
    ],
  },

  // ── PERIOD 2: S-13 to S-24, 4 Sessions ────────────────────────
  {
    periodNumber: 2,
    label: "Periode II",
    sessions: [
      {
        sessionNumber: 1,
        label: "Sesi Normal",
        intervention: "NONE",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-13", "S-14", "S-15"] },
          { stockCodes: ["S-16", "S-17", "S-18"] },
          { stockCodes: ["S-19", "S-20", "S-21"] },
          { stockCodes: ["S-22", "S-23", "S-24"] },
        ],
      },
      {
        sessionNumber: 2,
        label: "Sesi Berita Baik",
        intervention: "BERITA_BAIK",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-13", "S-14", "S-15"] },
          { stockCodes: ["S-19", "S-20", "S-21"] },
        ],
      },
      {
        sessionNumber: 3,
        label: "Sesi Netral",
        intervention: "NONE",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-13", "S-14", "S-15"] },
          { stockCodes: ["S-16", "S-17", "S-18"] },
          { stockCodes: ["S-19", "S-20", "S-21"] },
          { stockCodes: ["S-22", "S-23", "S-24"] },
        ],
      },
      {
        sessionNumber: 4,
        label: "Sesi Berita Buruk",
        intervention: "BERITA_BURUK",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-16", "S-17", "S-18"] },
          { stockCodes: ["S-22", "S-23", "S-24"] },
        ],
      },
    ],
  },

  // ── PERIOD 3: S-25 to S-36, 4 Sessions ────────────────────────
  {
    periodNumber: 3,
    label: "Periode III",
    sessions: [
      {
        sessionNumber: 1,
        label: "Sesi Normal",
        intervention: "NONE",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-25", "S-26", "S-27"] },
          { stockCodes: ["S-28", "S-29", "S-30"] },
          { stockCodes: ["S-31", "S-32", "S-33"] },
          { stockCodes: ["S-34", "S-35", "S-36"] },
        ],
      },
      {
        sessionNumber: 2,
        label: "Sesi Berita Buruk",
        intervention: "BERITA_BURUK",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-25", "S-26", "S-27"] },
          { stockCodes: ["S-31", "S-32", "S-33"] },
        ],
      },
      {
        sessionNumber: 3,
        label: "Sesi Netral",
        intervention: "NONE",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-25", "S-26", "S-27"] },
          { stockCodes: ["S-28", "S-29", "S-30"] },
          { stockCodes: ["S-31", "S-32", "S-33"] },
          { stockCodes: ["S-34", "S-35", "S-36"] },
        ],
      },
      {
        sessionNumber: 4,
        label: "Sesi Berita Baik",
        intervention: "BERITA_BAIK",
        hasTrading: true,
        rounds: [
          { stockCodes: ["S-28", "S-29", "S-30"] },
          { stockCodes: ["S-34", "S-35", "S-36"] },
        ],
      },
    ],
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getPeriodConfig(periodNumber: 1 | 2 | 3): PeriodDef {
  const config = PERIOD_MATRIX.find(p => p.periodNumber === periodNumber);
  if (!config) throw new Error(`Period ${periodNumber} not found in matrix`);
  return config;
}

export function getInterventionLabel(type: InterventionType): string {
  const labels: Record<InterventionType, string> = {
    NONE: "Tanpa Intervensi",
    BERITA_BAIK: "Berita Baik",
    BERITA_BURUK: "Berita Buruk",
  };
  return labels[type];
}

export function getPhaseLabel(phase: PhaseType): string {
  const labels: Record<PhaseType, string> = {
    PRE_MARKET: "Pra-Perdagangan",
    TRADING: "Perdagangan",
    COOLDOWN: "Jeda",
    IDLE: "Menunggu",
    CLOSED: "Selesai",
  };
  return labels[phase];
}

export const INTERVENTION_KEYS: InterventionType[] = ["BERITA_BAIK", "BERITA_BURUK"];

// ── Legacy exports for backward compatibility ──────────────────
// These aliases let existing frontend files continue to compile
// without requiring simultaneous updates.
export const EXPERIMENTAL_MATRIX = PERIOD_MATRIX;
export type { SessionGroupDef as SessionConfig };
export type { PeriodDef as RoundConfig };

// Legacy no-op stubs (previously used in server.ts, now replaced)
export function getRoundConfig(roundNumber: number): never {
  throw new Error("getRoundConfig is deprecated — use getPeriodConfig");
}
export function getCurrentSessionConfig(): never {
  throw new Error("getCurrentSessionConfig is deprecated");
}
export function getInterventionForSubSession(): InterventionType {
  return "NONE";
}