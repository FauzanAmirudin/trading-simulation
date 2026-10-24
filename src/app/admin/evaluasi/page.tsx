"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Users,
  FileSpreadsheet,
  X,
  Eye,
  Star,
  BarChart3,
  DownloadCloud,
  PieChart,
  FileText,
  TrendingUp,
  DollarSign,
  Activity,
  Info,
  Brain,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EVALUATION_QUESTIONS,
  getEvaluationOptionLabel,
} from "@/lib/evaluation-questions";

type QuestionStat = {
  id: number;
  orderNumber: number;
  questionText: string;
  average: number;
  totalAnswered: number;
  distribution: {
    value: number;
    label: string;
    short: string;
    count: number;
    percentage: number;
  }[];
};

type RespondentEval = {
  userId: number;
  nama: string;
  isCompleted: boolean;
  completedAt: string | null;
  answers: Record<string, { score: number; label: string }> | null;
};

type EvaluationStats = {
  totalRegistered: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number;
  questions: QuestionStat[];
};

type PieSlice = {
  label: string;
  count: number;
  percentage: number;
  color: string;
  shortLabel?: string;
};

// ── Reusable Standalone Circular Pie Chart Component (Diagram Lingkaran Gambar) ──
function CircularPieChartCard({
  title,
  questionNumber,
  slices,
  total,
  icon,
  badgeText,
}: {
  title: string;
  questionNumber: number;
  slices: PieSlice[];
  total: number;
  icon?: React.ReactNode;
  badgeText?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Slices that have at least 1 count
  const activeSlices = slices.filter((s) => s.count > 0);
  const totalCount = activeSlices.reduce((acc, s) => acc + s.count, 0);

  const cx = 130;
  const cy = 130;
  const radius = 95;

  let currentAngle = -90; // Start at 12 o'clock

  const sliceData = activeSlices.map((slice, idx) => {
    const angle = (slice.count / (totalCount || 1)) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const midAngle = startAngle + angle / 2;
    const midRad = (midAngle * Math.PI) / 180;

    const isFullCircle = angle >= 359.9;
    const largeArcFlag = angle > 180 ? 1 : 0;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const pathData = isFullCircle
      ? ""
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    // Center text coordinates
    const labelRadius = radius * 0.62;
    const lx = cx + labelRadius * Math.cos(midRad);
    const ly = cy + labelRadius * Math.sin(midRad);

    // Explode effect on hover
    const isHovered = hoveredIdx === idx;
    const explodeDist = isHovered ? 6 : 0;
    const ex = explodeDist * Math.cos(midRad);
    const ey = explodeDist * Math.sin(midRad);

    return {
      slice,
      idx,
      angle,
      isFullCircle,
      pathData,
      lx,
      ly,
      ex,
      ey,
      isHovered,
    };
  });

  return (
    <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-4 shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-colors group">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="size-7 rounded-xl bg-primary/10 text-primary font-mono font-black text-xs flex items-center justify-center shrink-0 border border-primary/20 mt-0.5">
            {questionNumber}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-foreground leading-snug line-clamp-2" title={title}>
              {title}
            </h3>
            {badgeText && (
              <span className="text-[10px] text-muted-foreground block truncate mt-0.5 font-medium">
                {badgeText}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div className="p-1.5 rounded-xl bg-muted/60 text-muted-foreground shrink-0 mt-0.5">
            {icon}
          </div>
        )}
      </div>

      {/* Pie Chart SVG Canvas (Diagram Lingkaran Gambar Full) */}
      <div className="flex flex-col items-center justify-center py-1">
        <div className="relative size-60 sm:size-64 flex items-center justify-center">
          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="size-36 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
                <PieChart className="size-8 text-muted-foreground/40" />
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                Belum ada data evaluasi
              </span>
            </div>
          ) : (
            <svg
              viewBox="0 0 260 260"
              className="size-full overflow-visible drop-shadow-md select-none"
            >
              <defs>
                <filter id={`shadow-eval-${questionNumber}`} x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Slices Rendering */}
              {sliceData.map((item) => {
                if (item.isFullCircle) {
                  return (
                    <circle
                      key={item.idx}
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={item.slice.color}
                      stroke="hsl(var(--card))"
                      strokeWidth="2.5"
                      onMouseEnter={() => setHoveredIdx(item.idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer transition-all duration-200"
                    />
                  );
                }

                return (
                  <path
                    key={item.idx}
                    d={item.pathData}
                    fill={item.slice.color}
                    stroke="hsl(var(--card))"
                    strokeWidth="2.5"
                    transform={`translate(${item.ex}, ${item.ey})`}
                    onMouseEnter={() => setHoveredIdx(item.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer transition-transform duration-200"
                  />
                );
              })}

              {/* Text Labels inside Slices (Percentage & Count) */}
              {sliceData.map((item) => {
                if (item.slice.percentage < 6) return null;

                const isLarge = item.slice.percentage >= 15;
                const isMedium = item.slice.percentage >= 9;

                return (
                  <g
                    key={`text-${item.idx}`}
                    transform={`translate(${item.ex}, ${item.ey})`}
                    className="pointer-events-none select-none transition-transform duration-200"
                  >
                    {/* Percentage Text */}
                    <text
                      x={item.lx}
                      y={isMedium ? item.ly - 4 : item.ly + 3}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#FFFFFF"
                      fontWeight="900"
                      fontSize={isLarge ? "14" : isMedium ? "11.5" : "10"}
                      style={{ textShadow: "0 1.5px 3px rgba(0,0,0,0.6)" }}
                      className="font-mono tracking-tight"
                    >
                      {item.slice.percentage}%
                    </text>

                    {/* Respondent Count Subtext */}
                    {isMedium && (
                      <text
                        x={item.lx}
                        y={item.ly + 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#FFFFFF"
                        fontWeight="700"
                        fontSize="8.5"
                        opacity="0.95"
                        style={{ textShadow: "0 1.5px 2px rgba(0,0,0,0.6)" }}
                        className="font-sans"
                      >
                        ({item.slice.count})
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Legend & Breakdown Badges */}
      <div className="space-y-1.5 pt-1 border-t border-border/50">
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {slices.map((slice, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={slice.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  "p-2 rounded-xl border transition-all flex items-center justify-between gap-1.5 cursor-pointer",
                  isHovered
                    ? "bg-accent border-primary/40 shadow-xs ring-1 ring-primary/20 scale-[1.02]"
                    : "bg-muted/40 border-border/60 hover:bg-muted/70",
                  idx === slices.length - 1 && slices.length % 2 !== 0 && "col-span-2"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-3 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-[11px] font-bold text-foreground truncate" title={slice.label}>
                    {slice.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black font-mono text-foreground block leading-none">
                    {slice.percentage}%
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {slice.count} resp.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export default function AdminEvaluasiPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingUserId, setExportingUserId] = useState<number | null>(null);

  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [respondents, setRespondents] = useState<RespondentEval[]>([]);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "PENDING">("ALL");

  // Selected respondent for detail modal
  const [selectedRespondent, setSelectedRespondent] = useState<RespondentEval | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/admin/evaluation");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat data evaluasi.");
      }

      setStats(data.stats);
      setRespondents(data.respondents || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data", { id: "eval-fetch-error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

    fetchData();
  }, [hydrated, user, router, fetchData]);

  // Export all evaluations to Excel
  const handleExportAll = async () => {
    setExportingAll(true);
    toast.info("Menyiapkan berkas Excel rekap evaluasi...", { id: "export-eval-toast" });

    try {
      const res = await fetch("/api/admin/export-evaluation");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal mengekspor data");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Evaluasi_Simulasi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Berhasil mengunduh berkas Excel evaluasi!", { id: "export-eval-toast" });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor data", { id: "export-eval-toast" });
    } finally {
      setExportingAll(false);
    }
  };

  // Export single respondent evaluation to Excel
  const handleExportSingle = async (uId: number, nama: string) => {
    setExportingUserId(uId);
    toast.info(`Menyiapkan lembar evaluasi untuk ${nama}...`, { id: "export-single-eval" });

    try {
      const res = await fetch(`/api/admin/export-evaluation?userId=${uId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal mengekspor data responden.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = nama.replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `Evaluasi_Responden_${uId}_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Berhasil mengunduh evaluasi ${nama}!`, { id: "export-single-eval" });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor data responden", { id: "export-single-eval" });
    } finally {
      setExportingUserId(null);
    }
  };

  // Filtered respondents
  const filteredRespondents = useMemo(() => {
    return respondents.filter((r) => {
      const matchesSearch =
        search === "" ||
        r.nama.toLowerCase().includes(search.toLowerCase()) ||
        String(r.userId).includes(search);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "COMPLETED" && r.isCompleted) ||
        (statusFilter === "PENDING" && !r.isCompleted);

      return matchesSearch && matchesStatus;
    });
  }, [respondents, search, statusFilter]);

  // Overall average calculation across all questions
  const overallAvg = useMemo(() => {
    if (!stats || !stats.questions.length) return "0.00";
    const sum = stats.questions.reduce((acc, q) => acc + q.average, 0);
    return (sum / stats.questions.length).toFixed(2);
  }, [stats]);

  // Helper icons for 10 questions
  const questionIcons: Record<number, React.ReactNode> = {
    1: <FileText className="size-4" />,
    2: <TrendingUp className="size-4" />,
    3: <DollarSign className="size-4" />,
    4: <Activity className="size-4" />,
    5: <Sparkles className="size-4" />,
    6: <Info className="size-4" />,
    7: <Brain className="size-4" />,
    8: <Eye className="size-4" />,
    9: <Layers className="size-4" />,
    10: <BarChart3 className="size-4" />,
  };

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">
            Memuat data evaluasi simulasi responden...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
              Instrumen Pasca-Simulasi
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Periode 3 Sesi 4</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground mt-1 tracking-tight">
            Diagram Evaluasi Simulasi Perdagangan Saham
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Analisis diagram lingkaran gambar 10 butir pertanyaan evaluasi akhir simulasi serta ekspor jawaban per responden.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            <span>Segarkan</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportAll}
            disabled={exportingAll || stats?.completedCount === 0}
            className="h-9 px-4 rounded-xl text-xs font-black gap-2 shadow-sm shadow-primary/20 cursor-pointer disabled:opacity-50"
          >
            {exportingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            <span>Ekspor Semua (Excel)</span>
          </Button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Terdaftar */}
        <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Responden</span>
            <Users className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono">
              {stats?.totalRegistered || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Akun responden terdaftar</p>
          </div>
        </Card>

        {/* Sudah Mengisi */}
        <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Selesai Mengisi</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats?.completedCount || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tingkat partisipasi: {stats?.completionRate || 0}%
            </p>
          </div>
        </Card>

        {/* Belum Mengisi */}
        <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Belum Mengisi</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {stats?.pendingCount || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Menunggu selesai simulasi</p>
          </div>
        </Card>

        {/* Rata-Rata Skor */}
        <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Rerata Skor Total</span>
            <Star className="size-4 text-amber-500 fill-amber-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-foreground font-mono">
              {overallAvg} <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Skala Likert (1-5)</p>
          </div>
        </Card>
      </div>

      {/* ── SECTION: 10 CIRCULAR PIE CHART CARDS (DIAGRAM LINGKARAN GAMBAR) ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground">
              Diagram Lingkaran Evaluasi (10 Butir Pertanyaan)
            </h2>
            <p className="text-xs text-muted-foreground">
              Persentase dan jumlah responden yang memilih opsi Sangat Setuju hingga Sangat Tidak Setuju pada setiap butir soal.
            </p>
          </div>
          <span className="text-xs font-bold font-mono text-primary px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 shrink-0 self-start sm:self-auto">
            {stats?.completedCount || 0} Data Responden
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {stats?.questions.map((q) => {
            const countsMap = Object.fromEntries(
              q.distribution.map((d) => [d.value, { count: d.count, percentage: d.percentage }])
            );

            // Slices ordered 5 down to 1 (Sangat Setuju down to Sangat Tidak Setuju)
            const slices: PieSlice[] = [
              {
                label: "Sangat Setuju",
                count: countsMap[5]?.count || 0,
                percentage: countsMap[5]?.percentage || 0,
                color: "#16A34A", // Emerald Green
              },
              {
                label: "Setuju",
                count: countsMap[4]?.count || 0,
                percentage: countsMap[4]?.percentage || 0,
                color: "#2563EB", // Royal Blue
              },
              {
                label: "Netral",
                count: countsMap[3]?.count || 0,
                percentage: countsMap[3]?.percentage || 0,
                color: "#EAB308", // Amber Yellow
              },
              {
                label: "Tidak Setuju",
                count: countsMap[2]?.count || 0,
                percentage: countsMap[2]?.percentage || 0,
                color: "#F97316", // Orange
              },
              {
                label: "Sangat Tidak Setuju",
                count: countsMap[1]?.count || 0,
                percentage: countsMap[1]?.percentage || 0,
                color: "#DC2626", // Red
              },
            ];

            return (
              <CircularPieChartCard
                key={q.id}
                questionNumber={q.orderNumber}
                title={q.questionText}
                badgeText={`Rerata: ${q.average} / 5.0 (${q.totalAnswered} Tanggapan)`}
                slices={slices}
                total={q.totalAnswered}
                icon={questionIcons[q.orderNumber]}
              />
            );
          })}
        </div>
      </div>

      {/* ── SECTION: DATA TABEL RESPONDEN & EKSPOR PER USER ── */}
      <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Daftar Tanggapan Evaluasi Responden
              </h2>
              <p className="text-xs text-muted-foreground">
                Menampilkan {filteredRespondents.length} dari {respondents.length} responden
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama atau User ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Badges */}
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
            {(
              [
                { key: "ALL", label: "Semua Responden", count: respondents.length },
                {
                  key: "COMPLETED",
                  label: "Sudah Mengisi",
                  count: stats?.completedCount || 0,
                },
                {
                  key: "PENDING",
                  label: "Belum Mengisi",
                  count: stats?.pendingCount || 0,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                  statusFilter === tab.key
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20 text-[11px] font-bold">
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead className="w-20 text-center">User ID</TableHead>
                <TableHead>Nama Responden</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-28 text-center">Rerata Skor</TableHead>
                <TableHead className="w-44 text-center">Waktu Submit</TableHead>
                <TableHead className="w-48 text-right pr-5">Aksi & Ekspor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs divide-y divide-border/60">
              {filteredRespondents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Tidak ada responden yang sesuai kriteria pencarian.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRespondents.map((r, idx) => {
                  let rAvg = "—";
                  if (r.answers) {
                    const scores = Object.values(r.answers).map((a) => a.score);
                    if (scores.length > 0) {
                      rAvg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
                    }
                  }

                  return (
                    <TableRow key={r.userId} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        #{r.userId}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {r.nama}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="size-3" />
                            <span>Lengkap</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                            <Clock className="size-3" />
                            <span>Belum Mengisi</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        {rAvg !== "—" ? `${rAvg} pts` : "—"}
                      </TableCell>
                      <TableCell className="text-center text-[11px] font-mono text-muted-foreground">
                        {r.completedAt
                          ? new Date(r.completedAt).toLocaleString("id-ID")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.isCompleted ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedRespondent(r)}
                                className="h-7 px-2 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg gap-1"
                              >
                                <Eye className="size-3" />
                                <span>Lihat</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExportSingle(r.userId, r.nama)}
                                disabled={exportingUserId === r.userId}
                                className="h-7 px-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20 rounded-lg gap-1"
                              >
                                {exportingUserId === r.userId ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <DownloadCloud className="size-3" />
                                )}
                                <span>Ekspor</span>
                              </Button>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              Belum ada data
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── MODAL DETAIL JAWABAN INDIVIDUAL RESPONDEN ── */}
      {selectedRespondent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border/60">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    ID #{selectedRespondent.userId}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedRespondent.completedAt
                      ? new Date(selectedRespondent.completedAt).toLocaleString("id-ID") + " WIB"
                      : "—"}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  Lembar Evaluasi: {selectedRespondent.nama}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleExportSingle(selectedRespondent.userId, selectedRespondent.nama)
                  }
                  disabled={exportingUserId === selectedRespondent.userId}
                  className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                >
                  {exportingUserId === selectedRespondent.userId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <DownloadCloud className="size-3.5" />
                  )}
                  <span>Ekspor Excel</span>
                </Button>

                <button
                  onClick={() => setSelectedRespondent(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Content - List of 10 Answers */}
            <div className="overflow-y-auto space-y-2.5 pr-1 max-h-[60vh]">
              {EVALUATION_QUESTIONS.map((q) => {
                const ans = selectedRespondent.answers?.[`q${q.orderNumber}`];
                const score = ans?.score || 0;
                const label = ans?.label || "—";

                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="size-5 rounded-md bg-card border border-border flex items-center justify-center font-mono font-bold text-[10px] text-foreground shrink-0 mt-0.5">
                        {q.orderNumber}
                      </span>
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {q.questionText}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Tanggapan Responden:
                      </span>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                          score >= 4
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : score <= 2
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        )}
                      >
                        {label} (Skor {score}/5)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-border/60 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRespondent(null)}
                className="h-9 px-4 rounded-xl text-xs font-bold"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
