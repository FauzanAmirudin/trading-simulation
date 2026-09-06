"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  Brain,
  ShieldAlert,
  Sparkles,
  Layers,
  X,
  ChevronRight,
  BarChart3,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type QuestionItem = {
  id: number;
  instrument: "LA" | "EI";
  orderNumber: number;
  questionText: string;
  isActive: boolean;
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  totalResponses: number;
  averageScore: number;
};

export default function AdminQuestionnairePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [instrumentFilter, setInstrumentFilter] = useState<"ALL" | "LA" | "EI">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Bottom Sheet State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentEditId, setCurrentEditId] = useState<number | null>(null);
  const [formInstrument, setFormInstrument] = useState<"LA" | "EI">("LA");
  const [formOrderNumber, setFormOrderNumber] = useState(1);
  const [formText, setFormText] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/questionnaire");
      const data = await res.json();
      if (res.ok && data.success) {
        setQuestions(data.questions || []);
      } else {
        toast.error(data.error || "Gagal memuat pertanyaan.", { id: "fetch-q-error" });
      }
    } catch (err) {
      console.error("Error fetching questions:", err);
      toast.error("Gagal memuat data pertanyaan kuesioner.", { id: "fetch-q-error" });
    } finally {
      setLoading(false);
    }
  };

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

    fetchQuestions();
  }, [hydrated, user, router]);

  const handleOpenAdd = () => {
    setModalMode("add");
    setCurrentEditId(null);
    setFormInstrument("LA");
    const laCount = questions.filter((q) => q.instrument === "LA").length;
    setFormOrderNumber(laCount + 1);
    setFormText("");
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setModalMode("edit");
    setCurrentEditId(q.id);
    setFormInstrument(q.instrument);
    setFormOrderNumber(q.orderNumber);
    setFormText(q.questionText);
    setFormIsActive(q.isActive);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (q: QuestionItem) => {
    try {
      const res = await fetch("/api/admin/questionnaire", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: q.id,
          isActive: !q.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Status ${q.instrument} #${q.orderNumber} diubah menjadi ${!q.isActive ? "Aktif" : "Non-Aktif"}.`, {
          id: `toggle-${q.id}`,
        });
        fetchQuestions();
      } else {
        toast.error(data.error || "Gagal mengubah status.", { id: `toggle-${q.id}` });
      }
    } catch (err) {
      toast.error("Gagal memperbarui status.", { id: `toggle-${q.id}` });
    }
  };

  const handleDelete = async (id: number, orderNum: number, inst: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus butir pertanyaan ${inst} #${orderNum}?`)) return;

    try {
      const res = await fetch(`/api/admin/questionnaire?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Pertanyaan berhasil dihapus.", { id: "delete-q-toast" });
        fetchQuestions();
      } else {
        toast.error(data.error || "Gagal menghapus pertanyaan.", { id: "delete-q-toast" });
      }
    } catch (err) {
      toast.error("Gagal menghapus pertanyaan.", { id: "delete-q-toast" });
    }
  };

  const handleSaveModal = async () => {
    if (!formText.trim()) {
      toast.error("Teks pertanyaan tidak boleh kosong.", { id: "save-q-err" });
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "add") {
        const res = await fetch("/api/admin/questionnaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instrument: formInstrument,
            orderNumber: formOrderNumber,
            questionText: formText.trim(),
            isActive: formIsActive,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success("Pertanyaan baru berhasil ditambahkan!", { id: "save-q-success" });
          setIsModalOpen(false);
          fetchQuestions();
        } else {
          toast.error(data.error || "Gagal menambahkan pertanyaan.", { id: "save-q-error" });
        }
      } else {
        const res = await fetch("/api/admin/questionnaire", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentEditId,
            instrument: formInstrument,
            orderNumber: formOrderNumber,
            questionText: formText.trim(),
            isActive: formIsActive,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success("Pertanyaan berhasil diperbarui!", { id: "save-q-success" });
          setIsModalOpen(false);
          fetchQuestions();
        } else {
          toast.error(data.error || "Gagal memperbarui pertanyaan.", { id: "save-q-error" });
        }
      }
    } catch (err) {
      toast.error("Terjadi kesalahan pada server.", { id: "save-q-error" });
    } finally {
      setSaving(false);
    }
  };

  // Filter questions
  const filtered = questions.filter((q) => {
    const matchesInst = instrumentFilter === "ALL" || q.instrument === instrumentFilter;
    const matchesSearch =
      q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${q.instrument} ${q.orderNumber}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesInst && matchesSearch;
  });

  const laCount = questions.filter((q) => q.instrument === "LA").length;
  const eiCount = questions.filter((q) => q.instrument === "EI").length;
  const activeCount = questions.filter((q) => q.isActive).length;

  if (!hydrated || !user || user.role !== "admin") return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6 space-y-3.5 sm:space-y-5 pb-28 md:pb-8">
      {/* ── 1. Fluid Header Bar ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-card/85 border border-border/80 p-3 sm:p-5 backdrop-blur-md shadow-xs flex flex-col gap-3">
        <div className="flex items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-500/10 text-indigo-500 shrink-0 border border-indigo-500/20 shadow-2xs">
              <ClipboardList className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[14px] sm:text-lg font-black tracking-tight text-foreground truncate" style={{ fontSize: "clamp(0.95rem, 3.5vw, 1.25rem)" }}>
                Pengelolaan Kuesioner (LA & EI)
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">
                Manajemen butir instrumen Loss Aversion & Emotional Intelligence skala Likert 1–5.
              </p>
            </div>
          </div>

          {/* Desktop/Tablet Header Actions */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchQuestions}
              disabled={loading}
              className="h-9 px-3 rounded-xl text-xs font-bold border-border hover:bg-muted gap-1.5 active:scale-95"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="h-9 px-3.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs active:scale-95"
            >
              <Plus className="size-4" />
              <span>Tambah Pertanyaan</span>
            </Button>
          </div>
        </div>

        {/* Mobile Header Action Buttons (< sm) */}
        <div className="grid grid-cols-2 gap-2 sm:hidden pt-1 border-t border-border/40">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchQuestions}
            disabled={loading}
            className="h-10 px-3 rounded-xl text-xs font-bold border-border bg-card/80 text-foreground gap-1.5 active:scale-95 touch-manipulation"
          >
            <RefreshCw className={cn("size-3.5 text-muted-foreground", loading && "animate-spin text-primary")} />
            <span>Refresh Data</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-10 px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs active:scale-95 touch-manipulation"
          >
            <Plus className="size-4" />
            <span>+ Butir Baru</span>
          </Button>
        </div>
      </div>

      {/* ── 2. KPI Metrics 2x2 Bento Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Total Soal */}
        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">
            Total Butir
          </span>
          <div className="text-base sm:text-2xl font-mono font-black text-foreground">{questions.length}</div>
          <span className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block truncate">
            {activeCount} Butir Aktif ({questions.length > 0 ? Math.round((activeCount / questions.length) * 100) : 0}%)
          </span>
        </div>

        {/* Loss Aversion */}
        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-teal-500/5 border border-teal-500/20 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9.5px] sm:text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider block truncate">
            Loss Aversion
          </span>
          <div className="text-base sm:text-2xl font-mono font-black text-teal-600 dark:text-teal-400">{laCount}</div>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Toleransi Risiko (15)</span>
        </div>

        {/* Emotional Intelligence */}
        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-500/5 border border-indigo-500/20 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9.5px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider block truncate">
            Emotional Intel
          </span>
          <div className="text-base sm:text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400">{eiCount}</div>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">Regulasi Emosi (15)</span>
        </div>

        {/* Skala Pengukuran */}
        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">
            Skala Likert
          </span>
          <div className="text-base sm:text-2xl font-mono font-black text-foreground">1 – 5</div>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">STS s/d SS</span>
        </div>
      </div>

      {/* ── 3. Filters & Search Bar (Mobile Ultra-Fluid) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Segmented Filter Tab (Ultra-Narrow 320px Safe) */}
        <div className="flex items-center p-1 rounded-xl sm:rounded-2xl bg-muted/60 border border-border/60 w-full sm:w-auto">
          {(["ALL", "LA", "EI"] as const).map((inst) => {
            const count = inst === "ALL" ? questions.length : inst === "LA" ? laCount : eiCount;
            const isSelected = instrumentFilter === inst;
            return (
              <button
                key={inst}
                type="button"
                onClick={() => setInstrumentFilter(inst)}
                className={cn(
                  "flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 select-none touch-manipulation min-h-[36px]",
                  isSelected
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground active:bg-card/40"
                )}
              >
                <span>{inst === "ALL" ? "Semua" : inst === "LA" ? "Loss Aversion" : "Emotional Intel"}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-md text-[9px] font-mono font-bold",
                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari teks pertanyaan / nomor..."
            className="pl-8 pr-8 text-xs bg-card border-border/80 h-10 sm:h-9 rounded-xl shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Main Question List & Table ── */}
      <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/90 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground text-xs gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Memuat daftar butir kuesioner...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 text-muted-foreground px-4">
              <ClipboardList className="size-8 opacity-40" />
              <p className="text-xs font-bold text-foreground">Tidak Ada Pertanyaan</p>
              <p className="text-[11px] max-w-xs">Tidak ada butir kuesioner yang sesuai dengan kata kunci atau filter yang dipilih.</p>
              {searchQuery && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="h-8 px-3 text-xs rounded-xl mt-1 font-semibold"
                >
                  Reset Pencarian
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile View: Ultra-Ergonomic Question Cards (< md) ── */}
              <div className="divide-y divide-border/60 md:hidden">
                {filtered.map((q) => (
                  <div key={q.id} className="p-3 sm:p-4 space-y-2.5 bg-card/40 transition-colors">
                    {/* Top Identity & Action Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Instrument Pill */}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-black border shadow-2xs whitespace-nowrap",
                            q.instrument === "LA"
                              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                              : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                          )}
                        >
                          {q.instrument} #{q.orderNumber}
                        </span>

                        {/* Interactive Status Switch Pill */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(q)}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all active:scale-95 touch-manipulation min-h-[26px]",
                            q.isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20"
                          )}
                        >
                          {q.isActive ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-zinc-400" />}
                          <span>{q.isActive ? "Aktif" : "Non-Aktif"}</span>
                        </button>
                      </div>

                      {/* Quick Action Buttons (Touch Target >= 44pt Ergonomics) */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(q)}
                          aria-label={`Edit pertanyaan ${q.instrument} #${q.orderNumber}`}
                          className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 touch-manipulation"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(q.id, q.orderNumber, q.instrument)}
                          aria-label={`Hapus pertanyaan ${q.instrument} #${q.orderNumber}`}
                          className="size-9 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:bg-rose-500/20 touch-manipulation"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Question Statement Text */}
                    <p className="text-xs font-semibold text-foreground/95 leading-relaxed break-words">
                      {q.questionText}
                    </p>

                    {/* Bottom Analytics & Response Bar */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-2 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Users className="size-3 text-muted-foreground/80" />
                        <span>{q.totalResponses} Responden</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <BarChart3 className="size-3 text-primary/80" />
                        <span className="font-bold text-foreground">
                          Rerata: {q.averageScore > 0 ? q.averageScore.toFixed(2) : "—"} / 5.0
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop View: Full Data Table (>= md) ── */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-14 text-center text-xs font-bold text-muted-foreground">No</TableHead>
                      <TableHead className="w-28 text-xs font-bold text-muted-foreground">Instrumen</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground min-w-[320px]">Teks Pernyataan</TableHead>
                      <TableHead className="w-28 text-center text-xs font-bold text-muted-foreground">Status</TableHead>
                      <TableHead className="w-24 text-right text-xs font-bold text-muted-foreground">Jawaban</TableHead>
                      <TableHead className="w-28 text-right text-xs font-bold text-muted-foreground">Rerata Skor</TableHead>
                      <TableHead className="w-20 text-center text-xs font-bold text-muted-foreground">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q) => (
                      <TableRow key={q.id} className="border-border/60 hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-mono font-bold text-xs text-foreground">
                          {q.orderNumber}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[10px] font-mono font-black border shadow-2xs whitespace-nowrap",
                              q.instrument === "LA"
                                ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                            )}
                          >
                            {q.instrument === "LA" ? "Loss Aversion" : "Emotional Intel"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-foreground/90 whitespace-normal leading-relaxed py-3">
                          {q.questionText}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(q)}
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all cursor-pointer select-none whitespace-nowrap",
                              q.isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20"
                            )}
                          >
                            {q.isActive ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                            <span>{q.isActive ? "Aktif" : "Non-Aktif"}</span>
                          </button>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {q.totalResponses}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs tabular-nums text-foreground">
                          {q.averageScore > 0 ? q.averageScore.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEdit(q)}
                              className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(q.id, q.orderNumber, q.instrument)}
                              className="size-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Add / Edit Mobile Bottom Sheet & Desktop Dialog ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => !saving && setIsModalOpen(false)}
            />

            {/* Modal Box / Mobile Slide-up Drawer */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-background border border-border p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Mobile Drawer Drag Indicator */}
              <div className="flex sm:hidden justify-center pt-1 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60 shrink-0">
                <h3 className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
                  <ClipboardList className="size-4 text-primary" />
                  <span>{modalMode === "add" ? "Tambah Butir Pertanyaan" : "Edit Butir Pertanyaan"}</span>
                </h3>
                <button
                  onClick={() => !saving && setIsModalOpen(false)}
                  className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center touch-manipulation"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="space-y-3.5 overflow-y-auto flex-1 pr-0.5">
                <div className="grid grid-cols-2 gap-2">
                  {/* Instrumen Selector */}
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Instrumen</label>
                    <select
                      value={formInstrument}
                      onChange={(e) => setFormInstrument(e.target.value as "LA" | "EI")}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10"
                    >
                      <option value="LA">Loss Aversion (LA)</option>
                      <option value="EI">Emotional Intel (EI)</option>
                    </select>
                  </div>

                  {/* Order Number */}
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Nomor Urut</label>
                    <Input
                      type="number"
                      min={1}
                      value={formOrderNumber}
                      onChange={(e) => setFormOrderNumber(Number(e.target.value))}
                      className="h-10 text-xs rounded-xl bg-card border-border"
                    />
                  </div>
                </div>

                {/* Question Text */}
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Teks Pernyataan</label>
                  <textarea
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="Masukkan teks pernyataan kuesioner..."
                    rows={4}
                    className="w-full rounded-2xl border border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                  />
                </div>

                {/* Status Toggle Card */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/60">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-bold text-foreground block">Status Publikasi</span>
                    <span className="text-[10px] text-muted-foreground block">Tampilkan dalam lembar kuesioner responden</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs touch-manipulation shrink-0",
                      formIsActive
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {formIsActive ? "🟢 Aktif" : "⚪ Non-Aktif"}
                  </button>
                </div>
              </div>

              {/* Modal Actions (Thumb-Zone Sticky Bar) */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="h-11 sm:h-9 flex-1 sm:flex-none px-4 text-xs font-bold rounded-xl border-border touch-manipulation"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveModal}
                  disabled={saving || !formText.trim()}
                  className="h-11 sm:h-9 flex-1 sm:flex-none px-5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs touch-manipulation"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Pertanyaan</span>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

