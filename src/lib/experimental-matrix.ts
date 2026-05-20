// ============================================================
// EXPERIMENTAL DESIGN MATRIX — Type-Safe Configuration
// ============================================================
// Structure: 3 Periods → 12 Rounds → 4 Sub-Sessions each
// Sub-Sessions: Sesi 1 (PRE_OPENING), Sesi 2-4 (TRADING)
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
  | "TRADING_S2"     // Sesi 2: Main trading 1 (120s)
  | "TRADING_S3"     // Sesi 3: Main trading 2 (120s)
  | "TRADING_S4"     // Sesi 4: Main trading 3 (120s)
  | "CLOSED";        // Round complete

// === SESSION CONFIG — config for one sub-session within a round ===
export interface SessionConfig {
  sessionNumber: 1 | 2 | 3 | 4;
  phase: SubSessionPhase;
  durationSeconds: number;
  intervention: InterventionType;
  label: string;
}

// === ROUND CONFIG — full config for one round (all 4 sub-sessions) ===
export interface RoundConfig {
  roundNumber: number;
  period: 1 | 2 | 3;
  periodLabel: "I" | "II" | "III";
  sessions: SessionConfig[];
}

// === FULL EXPERIMENTAL MATRIX ===
export const EXPERIMENTAL_MATRIX: RoundConfig[] = [
  // ============================================================
  // PERIOD I (Rounds 1-4): Control group — no interventions
  // ============================================================
  {
    roundNumber: 1,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60, intervention: "NONE",      label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 2,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60, intervention: "NONE",      label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 3,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60, intervention: "NONE",      label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 4,
    period: 1,
    periodLabel: "I",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60, intervention: "NONE",      label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",    label: "Perdagangan 3" },
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
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "BERITA_BAIK", label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_1",    label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",       label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 6,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",          label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",       label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_1",     label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "BERITA_BURUK", label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 7,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",         label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "BERITA_BAIK", label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_1",    label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",       label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 8,
    period: 2,
    periodLabel: "II",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",          label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",       label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_1",     label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "BERITA_BURUK", label: "Perdfunding 3" },
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
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "BERITA_BURUK", label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_2",      label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",        label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 10,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",         label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",         label: "Perdagangan 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_2",       label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "BERITA_BAIK",  label: "Perdagangan 3" },
    ],
  },
  {
    roundNumber: 11,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",           label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "BERITA_BURUK",  label: "Perdfunding 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_2",       label: "Perdagangan 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "NONE",         label: "Perdagang 3" },
    ],
  },
  {
    roundNumber: 12,
    period: 3,
    periodLabel: "III",
    sessions: [
      { sessionNumber: 1, phase: "PRE_OPENING", durationSeconds: 60,  intervention: "NONE",         label: "Pra Pembukaan" },
      { sessionNumber: 2, phase: "TRADING_S2",  durationSeconds: 120, intervention: "NONE",         label: "Perdagang 1" },
      { sessionNumber: 3, phase: "TRADING_S3",  durationSeconds: 120, intervention: "TMNP_2",       label: "Perdagang 2" },
      { sessionNumber: 4, phase: "TRADING_S4",  durationSeconds: 120, intervention: "BERITA_BAIK",  label: "Perdagang 3" },
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
    TRADING_S2: "Perdagangan 1",
    TRADING_S3: "Perdagangan 2",
    TRADING_S4: "Perdagang 3",
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