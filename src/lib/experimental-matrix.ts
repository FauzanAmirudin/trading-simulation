// ============================================================
// EXPERIMENTAL DESIGN MATRIX — Type-Safe Configuration
// ============================================================
// Structure: 3 Periods → 12 Rounds → 2 Sub-Sessions each
// Sub-Sessions: Sesi 1 (PRE_OPENING 60s), Sesi 2 (TRADING 120s)
// Round ends after Sesi 2 completes
// ============================================================

// === INTERVENTION TYPES ===
export type InterventionType =
  | "NONE"
  | "BERITA_BAIK"
  | "BERITA_BURUK"
  | "TMNP_1"
  | "TMNP_2";

// === SUB-SESSION PHASES ===
export type SubSessionPhase =
  | "PENDING"
  | "PRE_OPENING"   // Sesi 1: Prediction input (60s)
  | "TRADING"        // Sesi 2: Main trading (120s) — replaces TRADING_S2/S3/S4
  | "CLOSED";        // Round complete

// === SESSION CONFIG — config for one sub-session within a round ===
export interface SessionConfig {
  sessionNumber: 1 | 2;
  phase: SubSessionPhase;
  durationSeconds: number;
  intervention: InterventionType;
  label: string;
}

// === ROUND CONFIG — full config for one round (2 sub-sessions) ===
export interface RoundConfig {
  roundNumber: number;
  period: 1 | 2 | 3;
  periodLabel: "I" | "II" | "III";
  sessions: SessionConfig[];
}

// === FULL EXPERIMENTAL MATRIX ===
// Intervention mapping (new 2-session structure):
// Period I (R1-4): Control — Sesi 2 = NONE
// Period II (R5-8):
//   R5: Sesi 2 = BERITA_BAIK
//   R6: Sesi 2 = TMNP_1
//   R7: Sesi 2 = BERITA_BAIK
//   R8: Sesi 2 = TMNP_1
// Period III (R9-12):
//   R9:  Sesi 2 = BERITA_BURUK
//   R10: Sesi 2 = TMNP_2
//   R11: Sesi 2 = BERITA_BURUK
//   R12: Sesi 2 = TMNP_2
// ============================================================
export const EXPERIMENTAL_MATRIX: RoundConfig[] = [
  // ============================================================
  // PERIOD I (Rounds 1-4): Control group — no interventions
  // ============================================================
  {
    roundNumber: 1,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE", label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "NONE", label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 2,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE", label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "NONE", label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 3,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE", label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "NONE", label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 4,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE", label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "NONE", label: "Perdagangan" },
    ],
  },

  // ============================================================
  // PERIOD II (Rounds 5-8): Mixed interventions
  // ============================================================
  {
    roundNumber: 5,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",         label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "BERITA_BAIK",   label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 6,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",      label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "TMNP_1",   label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 7,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",         label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "BERITA_BAIK",   label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 8,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",      label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "TMNP_1",   label: "Perdagangan" },
    ],
  },

  // ============================================================
  // PERIOD III (Rounds 9-12): Mixed interventions
  // ============================================================
  {
    roundNumber: 9,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",           label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "BERITA_BURUK", label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 10,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",       label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "TMNP_2",   label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 11,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",           label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "BERITA_BURUK", label: "Perdagangan" },
    ],
  },
  {
    roundNumber: 12,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",       label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING",        durationSeconds: 120, intervention: "TMNP_2",   label: "Perdagangan" },
    ],
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getRoundConfig(roundNumber: number): RoundConfig {
  const config = EXPERIMENTAL_MATRIX.find(r => r.roundNumber === roundNumber);
  if (!config) throw new Error(`Round ${roundNumber} not found in matrix`);
  return config;
}

export function getCurrentSessionConfig(
  roundNumber: number,
  sessionNumber: number
): SessionConfig {
  const round = getRoundConfig(roundNumber);
  const session = round.sessions.find(s => s.sessionNumber === sessionNumber);
  if (!session) throw new Error(`Session ${sessionNumber} not found for round ${roundNumber}`);
  return session;
}

export function getInterventionForSubSession(
  roundNumber: number,
  sessionNumber: number
): InterventionType {
  return getCurrentSessionConfig(roundNumber, sessionNumber).intervention;
}

export function getPhaseLabel(phase: SubSessionPhase): string {
  const labels: Record<SubSessionPhase, string> = {
    PENDING: "Menunggu",
    PRE_OPENING: "Pra Pembukaan",
    TRADING: "Perdagangan",
    CLOSED: "Selesai",
  };
  return labels[phase];
}

export function getInterventionLabel(type: InterventionType): string {
  const labels: Record<InterventionType, string> = {
    NONE: "Tanpa Intervensi",
    BERITA_BAIK: "Berita Baik",
    BERITA_BURUK: "Berita Buruk",
    TMNP_1: "Trading Halt 1",
    TMNP_2: "Trading Halt 2",
  };
  return labels[type];
}

// All 4 intervention keys used in the experiment
export const INTERVENTION_KEYS: InterventionType[] = [
  "BERITA_BAIK",
  "BERITA_BURUK",
  "TMNP_1",
  "TMNP_2",
];

// Sub-session duration constants (server-side, authoritative)
export const DURATIONS = {
  PRE_OPENING: 60,
  TRADING_SESSION: 120,
  ROUND_COOLDOWN: 180, // 3-minute pause between rounds
} as const;