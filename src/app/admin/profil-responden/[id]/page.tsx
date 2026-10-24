"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Brain,
  ArrowLeft,
  ArrowRight,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Lock,
  User,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  RefreshCw,
  HelpCircle,
  Award,
  ChevronUp,
  X,
  DownloadCloud,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EVALUATION_QUESTIONS,
  getEvaluationOptionLabel,
} from "@/lib/evaluation-questions";

type QuestionResponse = {
  id: number | null;
  questionId: number;
  instrument: "LA" | "EI";
  orderNumber: number;
  questionText: string;
  score: number | null;
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  createdAt: string | null;
};

type RespondentBiodata = {
  jenisKelamin: string;
  usia: number;
  programStudi: string;
  semester: number;
  pernahInvestasiSaham: string;
  pernahPelatihanInvestasi: string;
  sumberPenghasilan: string;
  sumberPenghasilanLainnya: string | null;
  jurusanSma: string;
  createdAt: string | null;
};

type RespondentEvaluation = {
  isCompleted: boolean;
  completedAt: string | null;
  answers: any;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7: number;
  q8: number;
  q9: number;
  q10: number;
};

type RespondentDetail = {
  userId: number;
  nama: string;
  role: string;
  isCompleted: boolean;
  biodata?: RespondentBiodata | null;
  evaluation?: RespondentEvaluation | null;
  laRawScore: number | null;
  laAvgScore: number | null;
  laCategory: "T" | "S" | "R" | null;
  eiRawScore: number | null;
  eiAvgScore: number | null;
  eiCategory: "T" | "S" | "R" | null;
  profileCode: string | null;
  profileLabel: string | null;
  profileGroup: string | null;
  profileGroupName: string | null;
  profileDescription: string | null;
  investmentImplications: string | null;
  completedAt: string | null;
  laRank?: number | null;
  eiRank?: number | null;
  totalCompletedUsers?: number | null;
};

type ScoreStats = {
  totalQuestions: number;
  answeredCount: number;
  scoreFrequency: Record<number, number>;
  laScoreFrequency: Record<number, number>;
  eiScoreFrequency: Record<number, number>;
};

type NavigationInfo = {
  prevUserId: number | null;
  nextUserId: number | null;
  currentIndex: number;
  totalRespondents: number;
};

const LIKERT_CHOICES = [
  { value: 1, label: "Sangat Tidak Setuju", short: "STS", color: "text-rose-600 dark:text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { value: 2, label: "Tidak Setuju", short: "TS", color: "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30" },
  { value: 3, label: "Netral", short: "N", color: "text-zinc-600 dark:text-zinc-400 bg-zinc-500/15 border-zinc-500/30" },
  { value: 4, label: "Setuju", short: "S", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  { value: 5, label: "Sangat Setuju", short: "SS", color: "text-teal-600 dark:text-teal-400 bg-teal-500/15 border-teal-500/30" },
];

export default function RespondentProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [respondent, setRespondent] = useState<RespondentDetail | null>(null);
  const [stats, setStats] = useState<ScoreStats | null>(null);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [navigation, setNavigation] = useState<NavigationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<"ALL" | "LA" | "EI">("ALL");
  const [scoreFilter, setScoreFilter] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingEval, setExportingEval] = useState(false);

  const handleExportEvaluation = async () => {
    if (!respondent) return;
    setExportingEval(true);
    toast.info(`Menyiapkan berkas evaluasi untuk ${respondent.nama}...`, { id: "export-user-eval" });
    try {
      const res = await fetch(`/api/admin/export-evaluation?userId=${respondent.userId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal mengekspor data");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = respondent.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `Evaluasi_Responden_${respondent.userId}_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Berhasil mengunduh berkas evaluasi!", { id: "export-user-eval" });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor data", { id: "export-user-eval" });
    } finally {
      setExportingEval(false);
    }
  };

  const handleExportSingle = async () => {
    if (!respondent) return;
    setExporting(true);
    toast.info(`Menyiapkan berkas Excel untuk ${respondent.nama}...`, { id: "export-user-toast" });
    try {
      const res = await fetch(`/api/admin/export-profiles?userId=${respondent.userId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal mengekspor data");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = respondent.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `Profil_Responden_${respondent.userId}_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Berhasil mengunduh berkas Excel responden!", { id: "export-user-toast" });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor data", { id: "export-user-toast" });
    } finally {
      setExporting(false);
    }
  };

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/profiles/${id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRespondent(data.respondent);
        setStats(data.stats);
        setResponses(data.responses || []);
        setNavigation(data.navigation);
      } else {
        toast.error(data.error || "Gagal memuat detail responden.", { id: "detail-error" });
      }
    } catch (err) {
      console.error("Error fetching respondent detail:", err);
      toast.error("Gagal terhubung ke server.", { id: "detail-error" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetchDetail();
  }, [hydrated, user, router, fetchDetail]);

  // Filtered responses
  const filteredResponses = responses.filter((r) => {
    if (activeTab === "LA" && r.instrument !== "LA") return false;
    if (activeTab === "EI" && r.instrument !== "EI") return false;
    if (scoreFilter !== "ALL" && r.score !== scoreFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.questionText.toLowerCase().includes(q) || r.orderNumber.toString().includes(q);
    }
    return true;
  });

  const getCategoryBadge = (category: "T" | "S" | "R" | null) => {
    switch (category) {
      case "T":
        return {
          label: "Tinggi (T)",
          className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        };
      case "S":
        return {
          label: "Sedang (S)",
          className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        };
      case "R":
        return {
          label: "Rendah (R)",
          className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        };
      default:
        return {
          label: "Belum Ada",
          className: "bg-muted text-muted-foreground border-border",
        };
    }
  };

  const laBadge = getCategoryBadge(respondent?.laCategory || null);
  const eiBadge = getCategoryBadge(respondent?.eiCategory || null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs animate-pulse">
            <Brain className="size-6" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-foreground">Memuat Hasil Kuesioner Responden...</p>
          <p className="text-[11px] text-muted-foreground max-w-xs">Menyiapkan butir instrumen Loss Aversion & Emotional Intelligence</p>
        </div>
      </div>
    );
  }

  if (!respondent) {
    return (
      <div className="p-6 text-center space-y-4 max-w-md mx-auto my-12">
        <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20 shadow-xs">
          <HelpCircle className="size-6" />
        </div>
        <h2 className="text-base sm:text-lg font-black text-foreground">Responden Tidak Ditemukan</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Data kuesioner untuk responden nomor {navigation?.currentIndex || id} tidak tersedia atau belum tersimpan.
        </p>
        <Button
          onClick={() => router.push("/admin/profil-responden")}
          variant="outline"
          className="rounded-xl h-10 text-xs font-bold gap-2 active:scale-95"
        >
          <ArrowLeft className="size-4" />
          <span>Kembali ke Daftar Profil</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-5 pb-32 sm:pb-16 w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
      {/* ── 1. Fluid Header Navigation Bar (Ultra-Narrow 320px+ Friendly) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-card/90 border border-border/80 p-2.5 sm:p-4 backdrop-blur-md shadow-2xs flex items-center justify-between gap-2">
        {/* Left: Back Button with Fluid Typography */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/profil-responden")}
          className="h-9 px-2.5 sm:px-3 rounded-xl gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 active:scale-95 touch-manipulation"
        >
          <ArrowLeft className="size-3.5 sm:size-4" />
          <span className="hidden xs:inline">Daftar Profil</span>
          <span className="xs:hidden">Kembali</span>
        </Button>

        {/* Center: Sequence Pill Indicator */}
        {navigation && (
          <div className="flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-xl bg-muted/50 border border-border/60 text-center">
            <span className="text-[11px] sm:text-xs font-bold font-mono text-foreground truncate">
              Responden {navigation.currentIndex} <span className="text-muted-foreground font-normal font-sans text-[10px] sm:text-[11px]">/ {navigation.totalRespondents}</span>
            </span>
          </div>
        )}

        {/* Right: Desktop Pager & Print Action */}
        <div className="flex items-center gap-1 shrink-0">
          {navigation && (
            <div className="hidden sm:flex items-center gap-0.5 bg-muted/40 border border-border/80 rounded-xl p-0.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={!navigation.prevUserId}
                onClick={() => navigation.prevUserId && router.push(`/admin/profil-responden/${navigation.prevUserId}`)}
                className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground active:scale-90"
                title="Responden Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!navigation.nextUserId}
                onClick={() => navigation.nextUserId && router.push(`/admin/profil-responden/${navigation.nextUserId}`)}
                className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground active:scale-90"
                title="Responden Berikutnya"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSingle}
            disabled={exporting}
            className="h-9 px-2.5 sm:px-3 text-xs font-bold rounded-xl gap-1.5 border-border hover:bg-muted active:scale-95 touch-manipulation print:hidden cursor-pointer"
            title="Unduh Excel Responden Ini"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <DownloadCloud className="size-3.5 text-primary" />
            )}
            <span className="hidden md:inline">Ekspor Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 px-2.5 sm:px-3 text-xs font-bold rounded-xl gap-1.5 border-border hover:bg-muted active:scale-95 touch-manipulation print:hidden cursor-pointer"
            title="Cetak Lembar Jawaban"
          >
            <Printer className="size-3.5" />
            <span className="hidden md:inline">Cetak</span>
          </Button>
        </div>
      </div>

      {/* ── 2. Respondent Hero & Profile Card (Fluid Mobile-First) ── */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-gradient-to-b from-card/95 via-card to-card p-3 sm:p-5 shadow-xs space-y-3.5 sm:space-y-4">
        {/* Profile Top Row: Avatar + Name + Group Tag */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-10 sm:size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-sm sm:text-base border border-primary/20 shadow-2xs shrink-0">
              {respondent.nama.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1
                  className="font-black text-foreground tracking-tight truncate"
                  style={{ fontSize: "clamp(0.95rem, 4vw, 1.35rem)" }}
                >
                  {respondent.nama}
                </h1>
                <span className="text-[10px] sm:text-[10.5px] font-mono font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.2 rounded-md border border-border/60 shrink-0">
                  No. {navigation?.currentIndex || respondent.userId}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground flex-wrap">
                {respondent.isCompleted ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded-full text-[9px] sm:text-[10px]">
                    <CheckCircle2 className="size-2.5 sm:size-3" /> Lengkap ({stats?.answeredCount}/{stats?.totalQuestions} Butir)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.2 rounded-full text-[9px] sm:text-[10px]">
                    <Clock className="size-2.5 sm:size-3" /> Belum Selesai ({stats?.answeredCount}/{stats?.totalQuestions})
                  </span>
                )}
                {respondent.completedAt && (
                  <span className="hidden xs:inline text-muted-foreground/80">
                    • {new Date(respondent.completedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profile Group Badge Ribbon (Clean & Compact) */}
          {respondent.profileGroup && (
            <div className="flex items-center gap-2 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 shrink-0 shadow-2xs">
              <div className="text-right hidden xs:block">
                <span className="text-[8.5px] font-bold uppercase text-primary/80 block leading-tight">
                  Kelompok
                </span>
                <span className="text-[10.5px] sm:text-xs font-mono font-black text-primary block leading-tight">
                  {respondent.profileLabel}
                </span>
              </div>
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg sm:rounded-xl bg-primary text-primary-foreground font-mono font-black text-xs sm:text-sm shadow-xs">
                {respondent.profileGroup}
              </div>
            </div>
          )}
        </div>

        {/* ── 2-Column Bento Grid for LA & EI Metrics (Extreme Space-Saving on Mobile) ── */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 pt-0.5">
          {/* Card 1: Loss Aversion (LA) */}
          <div className="rounded-xl sm:rounded-2xl border border-teal-500/20 bg-teal-500/5 p-2.5 sm:p-4 space-y-1.5 sm:space-y-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 truncate">
                Loss Aversion
              </span>
              <span className={cn("text-[8.5px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-md border shrink-0", laBadge.className)}>
                {laBadge.label}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-1">
              <div>
                <span className="text-base sm:text-2xl font-black font-mono text-foreground">
                  {respondent.laRawScore ?? 0}
                </span>
                <span className="text-[9px] sm:text-xs text-muted-foreground font-mono ml-0.5">/75</span>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-black font-mono text-teal-600 dark:text-teal-400">
                  {respondent.laAvgScore ? respondent.laAvgScore.toFixed(2) : "0.00"}
                </span>
                <span className="text-[8px] sm:text-[9.5px] text-muted-foreground block leading-none">Rerata</span>
              </div>
            </div>

            <div className="h-1 sm:h-1.5 rounded-full bg-teal-500/20 overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((respondent.laRawScore || 0) / 75) * 100)}%` }}
              />
            </div>
            {respondent.laRank && (
              <div className="text-[9px] sm:text-[10px] text-teal-700 dark:text-teal-300 font-semibold pt-0.5">
                Peringkat #{respondent.laRank} {respondent.totalCompletedUsers ? `dari ${respondent.totalCompletedUsers} responden` : ""}
              </div>
            )}
          </div>

          {/* Card 2: Emotional Intelligence (EI) */}
          <div className="rounded-xl sm:rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-2.5 sm:p-4 space-y-1.5 sm:space-y-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 truncate">
                Emotional Intel
              </span>
              <span className={cn("text-[8.5px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-md border shrink-0", eiBadge.className)}>
                {eiBadge.label}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-1">
              <div>
                <span className="text-base sm:text-2xl font-black font-mono text-foreground">
                  {respondent.eiRawScore ?? 0}
                </span>
                <span className="text-[9px] sm:text-xs text-muted-foreground font-mono ml-0.5">/75</span>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {respondent.eiAvgScore ? respondent.eiAvgScore.toFixed(2) : "0.00"}
                </span>
                <span className="text-[8px] sm:text-[9.5px] text-muted-foreground block leading-none">Rerata</span>
              </div>
            </div>

            <div className="h-1 sm:h-1.5 rounded-full bg-indigo-500/20 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((respondent.eiRawScore || 0) / 75) * 100)}%` }}
              />
            </div>
            {respondent.eiRank && (
              <div className="text-[9px] sm:text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold pt-0.5">
                Peringkat #{respondent.eiRank} {respondent.totalCompletedUsers ? `dari ${respondent.totalCompletedUsers} responden` : ""}
              </div>
            )}
          </div>
        </div>

        {/* Behavioral Characteristic Box (Full-Width Slim Card) */}
        <div className="rounded-xl sm:rounded-2xl border border-border/80 bg-muted/40 p-2.5 sm:p-3.5 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-foreground font-bold">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            <span className="text-[11px] sm:text-xs">{respondent.profileGroupName || "Karakteristik Responden"}</span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
            {respondent.profileDescription || "Responden belum menyelesaikan pengisian kuesioner secara lengkap."}
          </p>
        </div>
      </div>

      {/* ── 2.5 Data Demografi & Biodata Responden (8 Pertanyaan) ── */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="size-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Data Demografi & Biodata Responden
              </h2>
              <p className="text-[10px] text-muted-foreground">
                8 Butir Instrumen Profil Awal Responden
              </p>
            </div>
          </div>
          {respondent.biodata ? (
            <span className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircle2 className="size-3" /> Biodata Lengkap
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
              <Clock className="size-3" /> Belum Mengisi Biodata
            </span>
          )}
        </div>

        {respondent.biodata ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                1. Jenis Kelamin
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground block">
                {respondent.biodata.jenisKelamin}
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                2. Usia
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground block">
                {respondent.biodata.usia} Tahun
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                3. Program Studi / Jurusan
              </span>
              <span
                className="text-xs sm:text-sm font-bold text-foreground block truncate"
                title={respondent.biodata.programStudi}
              >
                {respondent.biodata.programStudi}
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                4. Semester
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground block">
                Semester {respondent.biodata.semester}
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                5. Pernah Investasi Saham
              </span>
              <span
                className={cn(
                  "text-[11px] sm:text-xs font-bold inline-flex items-center px-2 py-0.5 rounded-md mt-0.5",
                  respondent.biodata.pernahInvestasiSaham === "Ya"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20"
                )}
              >
                {respondent.biodata.pernahInvestasiSaham}
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                6. Pelatihan Keuangan
              </span>
              <span
                className={cn(
                  "text-[11px] sm:text-xs font-bold inline-flex items-center px-2 py-0.5 rounded-md mt-0.5",
                  respondent.biodata.pernahPelatihanInvestasi === "Ya"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20"
                )}
              >
                {respondent.biodata.pernahPelatihanInvestasi}
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                7. Sumber Penghasilan
              </span>
              <span
                className="text-xs sm:text-sm font-bold text-foreground block truncate"
                title={
                  respondent.biodata.sumberPenghasilan === "Lainnya"
                    ? `Lainnya: ${respondent.biodata.sumberPenghasilanLainnya || ""}`
                    : respondent.biodata.sumberPenghasilan
                }
              >
                {respondent.biodata.sumberPenghasilan === "Lainnya" &&
                respondent.biodata.sumberPenghasilanLainnya
                  ? `Lainnya (${respondent.biodata.sumberPenghasilanLainnya})`
                  : respondent.biodata.sumberPenghasilan}
              </span>
            </div>

            <div className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-semibold text-muted-foreground uppercase block">
                8. Jurusan SMA
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground block">
                {respondent.biodata.jurusanSma}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-1">
            Responden belum melengkapi 8 pertanyaan biodata pada tahap awal kuesioner.
          </p>
        )}
      </div>

      {/* ── 2.6 Evaluasi Akhir Simulasi Perdagangan (10 Pertanyaan Pasca Sesi 4) ── */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-3 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <ClipboardCheck className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-foreground">
                  Evaluasi Akhir Simulasi Perdagangan
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  Periode 3 Sesi 4
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                10 butir pertanyaan evaluasi pasca simulasi perdagangan saham
              </p>
            </div>
          </div>

          {respondent.evaluation?.isCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportEvaluation}
              disabled={exportingEval}
              className="h-7 px-2.5 rounded-xl text-[11px] font-bold text-teal-600 dark:text-teal-400 border-teal-500/20 hover:bg-teal-500/10 gap-1 self-start sm:self-center"
            >
              {exportingEval ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <DownloadCloud className="size-3" />
              )}
              <span>Ekspor Evaluasi (Excel)</span>
            </Button>
          )}
        </div>

        {respondent.evaluation?.isCompleted ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                <span>Evaluasi Lengkap (10/10)</span>
              </span>
              {respondent.evaluation.completedAt && (
                <span className="font-mono text-[11px]">
                  Submit: {new Date(respondent.evaluation.completedAt).toLocaleString("id-ID")} WIB
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVALUATION_QUESTIONS.map((q) => {
                const score = (respondent.evaluation as any)?.[`q${q.orderNumber}`] || 0;
                const label = getEvaluationOptionLabel(score);

                return (
                  <div
                    key={q.id}
                    className="p-2.5 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 space-y-1 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <span className="size-4.5 rounded-md bg-card border border-border flex items-center justify-center font-mono font-bold text-[9.5px] text-foreground shrink-0 mt-0.5">
                        {q.orderNumber}
                      </span>
                      <p className="text-[11px] font-medium text-foreground line-clamp-2">
                        {q.questionText}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-0.5 text-[10px]">
                      <span className="text-muted-foreground">Tanggapan:</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md font-bold border",
                          score >= 4
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : score <= 2
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        )}
                      >
                        {label} ({score}/5)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-1">
            Responden belum menyelesaikan 10 pertanyaan evaluasi akhir simulasi perdagangan.
          </p>
        )}
      </div>

      {/* ── 3. Filters, Search & Likert Score Frequency Bar ── */}
      <div className="rounded-2xl border border-border/80 bg-card p-2.5 sm:p-4 space-y-2 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Instrument Filter Tabs (Semua 30, LA 15, EI 15) */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-muted/60 p-1 rounded-xl sm:rounded-2xl border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={cn(
                "px-2 sm:px-3 py-1.5 text-[10.5px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all text-center min-h-[36px] sm:min-h-0 flex items-center justify-center touch-manipulation active:scale-95",
                activeTab === "ALL"
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semua ({responses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("LA")}
              className={cn(
                "px-2 sm:px-3 py-1.5 text-[10.5px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all text-center min-h-[36px] sm:min-h-0 flex items-center justify-center touch-manipulation active:scale-95",
                activeTab === "LA"
                  ? "bg-teal-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              LA (15)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("EI")}
              className={cn(
                "px-2 sm:px-3 py-1.5 text-[10.5px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition-all text-center min-h-[36px] sm:min-h-0 flex items-center justify-center touch-manipulation active:scale-95",
                activeTab === "EI"
                  ? "bg-indigo-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              EI (15)
            </button>
          </div>

          {/* Search Keyword Input with Clear Button */}
          <div className="relative flex-1 max-w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kata butir soal..."
              className="h-10 sm:h-9 pl-8 pr-8 text-xs rounded-xl bg-card border-border/80 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] active:scale-90"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Likert Score Filter Frequency Horizontal Scroll Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          <span className="text-[9px] font-bold uppercase text-muted-foreground shrink-0 mr-0.5">
            Skor:
          </span>
          <button
            type="button"
            onClick={() => setScoreFilter("ALL")}
            className={cn(
              "px-2.5 py-1 text-[10px] sm:text-[10.5px] font-bold rounded-xl border transition-all shrink-0 min-h-[32px] flex items-center active:scale-95 touch-manipulation",
              scoreFilter === "ALL"
                ? "bg-foreground text-background border-foreground shadow-2xs"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            Semua
          </button>
          {LIKERT_CHOICES.map((opt) => {
            const count =
              activeTab === "LA"
                ? stats?.laScoreFrequency[opt.value] || 0
                : activeTab === "EI"
                ? stats?.eiScoreFrequency[opt.value] || 0
                : stats?.scoreFrequency[opt.value] || 0;

            const isSelected = scoreFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScoreFilter(isSelected ? "ALL" : opt.value)}
                className={cn(
                  "px-2 py-1 text-[10px] sm:text-[10.5px] font-bold rounded-xl border transition-all flex items-center gap-1 shrink-0 min-h-[32px] active:scale-95 touch-manipulation",
                  isSelected
                    ? opt.color + " ring-1 ring-current shadow-2xs font-black"
                    : "bg-muted/30 text-muted-foreground border-border/80 hover:bg-muted/70"
                )}
              >
                <span>{opt.value} ({opt.short})</span>
                <span className="size-4 rounded-full bg-background/90 flex items-center justify-center text-[9px] font-mono font-black border">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. Question Responses List (Mobile High-Contrast Spectrum) ── */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-semibold">
          <span className="text-[10.5px] sm:text-xs">
            Menampilkan <strong className="text-foreground">{filteredResponses.length}</strong> dari {responses.length} Butir Soal
          </span>
          {scoreFilter !== "ALL" && (
            <span className="text-primary font-bold text-[10.5px] sm:text-xs">
              Skor: {scoreFilter} ({LIKERT_CHOICES.find((c) => c.value === scoreFilter)?.short})
            </span>
          )}
        </div>

        {filteredResponses.length === 0 ? (
          <div className="p-8 text-center rounded-2xl sm:rounded-3xl border border-dashed border-border bg-card/40 space-y-2">
            <Filter className="size-6 text-muted-foreground mx-auto opacity-50" />
            <p className="text-xs font-bold text-foreground">Tidak ada butir soal yang sesuai filter</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveTab("ALL");
                setScoreFilter("ALL");
                setSearchQuery("");
              }}
              className="text-xs text-primary font-bold"
            >
              Reset Semua Filter
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {filteredResponses.map((r) => {
              const selectedOption = LIKERT_CHOICES.find((c) => c.value === r.score);
              const isLA = r.instrument === "LA";

              return (
                <Card
                  key={r.questionId}
                  className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/90 shadow-2xs p-3 sm:p-4.5 space-y-2.5 transition-all"
                >
                  {/* Top: Header Info Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "size-6 sm:size-7 rounded-lg sm:rounded-xl flex items-center justify-center text-[10.5px] sm:text-xs font-mono font-black shrink-0 border shadow-2xs",
                          isLA
                            ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                        )}
                      >
                        {r.orderNumber}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] sm:text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-md border shrink-0",
                          isLA
                            ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                        )}
                      >
                        {isLA ? "Loss Aversion" : "Emotional Intel"}
                      </span>
                    </div>

                    {/* Selected Score Indicator Badge */}
                    {r.score !== null ? (
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border text-[10px] sm:text-[11px] font-bold shadow-2xs shrink-0",
                          selectedOption?.color
                        )}
                      >
                        <Check className="size-3" />
                        <span>Skor {r.score}</span>
                        <span className="hidden xs:inline">• {selectedOption?.short}</span>
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-muted-foreground italic shrink-0">
                        Belum diisi
                      </span>
                    )}
                  </div>

                  {/* Question Text (Fluid Typography) */}
                  <p className="text-[12px] sm:text-[13.5px] font-semibold text-foreground leading-relaxed text-pretty">
                    {r.questionText}
                  </p>

                  {/* Likert 5-Scale Visual Spectrum Grid */}
                  <div className="pt-0.5">
                    <div className="grid grid-cols-5 gap-1 sm:gap-2">
                      {LIKERT_CHOICES.map((choice) => {
                        const isChosen = r.score === choice.value;

                        return (
                          <div
                            key={choice.value}
                            className={cn(
                              "p-1 sm:p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center min-h-[42px] sm:min-h-[50px]",
                              isChosen
                                ? cn(choice.color, "ring-2 ring-current font-black shadow-xs")
                                : "bg-muted/15 border-border/60 opacity-40 text-muted-foreground"
                            )}
                          >
                            <span className="text-xs sm:text-sm font-mono font-black block leading-none">
                              {choice.value}
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-semibold leading-tight mt-1 block truncate max-w-full px-0.5">
                              <span className="sm:hidden">{choice.short}</span>
                              <span className="hidden sm:inline">{choice.label}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 5. Desktop Footer Navigation Back ── */}
      <div className="hidden sm:flex items-center justify-between gap-2.5 pt-4 border-t border-border/80">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/profil-responden")}
          className="h-10 rounded-xl gap-2 text-xs font-bold"
        >
          <ArrowLeft className="size-4" />
          <span>Kembali ke Daftar Profil</span>
        </Button>

        {navigation?.nextUserId && (
          <Button
            onClick={() => router.push(`/admin/profil-responden/${navigation.nextUserId}`)}
            className="h-10 rounded-xl gap-2 text-xs font-bold"
          >
            <span>Lihat Responden Berikutnya</span>
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      {/* ── 6. Mobile Floating Sticky Thumb-Zone Pager Bar (Fixed Sepertiga Bawah) ── */}
      <div className="fixed bottom-[4.5rem] left-2 right-2 sm:hidden z-40">
        <div className="rounded-2xl bg-card/95 border border-border/90 backdrop-blur-xl p-1.5 shadow-lg flex items-center justify-between gap-1.5">
          {/* Prev Button */}
          <Button
            size="sm"
            variant="outline"
            disabled={!navigation?.prevUserId}
            onClick={() => navigation?.prevUserId && router.push(`/admin/profil-responden/${navigation.prevUserId}`)}
            className="h-10 px-2.5 rounded-xl text-[11px] font-bold border-border/80 bg-background/80 gap-1 flex-1 active:scale-95 touch-manipulation"
          >
            <ChevronLeft className="size-3.5" />
            <span className="truncate">Sebelumnya</span>
          </Button>

          {/* Indicator & Scroll to Top */}
          <button
            type="button"
            onClick={scrollToTop}
            className="px-2 py-1 text-center min-w-[70px] active:scale-90 transition-transform touch-manipulation"
            title="Ketuk untuk kembali ke atas"
          >
            <span className="text-[10px] font-mono font-black text-foreground block leading-tight">
              {navigation?.currentIndex || 1}/{navigation?.totalRespondents || 1}
            </span>
            <span className="text-[8px] text-muted-foreground flex items-center justify-center gap-0.5 leading-none mt-0.5">
              <ChevronUp className="size-2.5 text-primary" /> Ke Atas
            </span>
          </button>

          {/* Next Button */}
          <Button
            size="sm"
            disabled={!navigation?.nextUserId}
            onClick={() => navigation?.nextUserId && router.push(`/admin/profil-responden/${navigation.nextUserId}`)}
            className="h-10 px-2.5 rounded-xl text-[11px] font-bold bg-primary text-primary-foreground gap-1 flex-1 shadow-xs active:scale-95 touch-manipulation"
          >
            <span className="truncate">Berikutnya</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
