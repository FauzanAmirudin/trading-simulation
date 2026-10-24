"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Loader2,
  Lock,
  LogOut,
  AlertCircle,
  HelpCircle,
  PartyPopper,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EVALUATION_QUESTIONS,
  EVALUATION_LIKERT_OPTIONS,
} from "@/lib/evaluation-questions";

export default function EvaluationPage() {
  const { user, hydrated, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  // Map question ID (1..10) to selected Likert value (1..5)
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role === "admin") {
      router.push("/admin");
      return;
    }

    async function checkStatus() {
      try {
        const res = await fetch(`/api/evaluation/status?userId=${user?.id}`);
        const data = await res.json();

        if (data.success && data.isCompleted) {
          setIsCompleted(true);
          setCompletedAt(data.completedAt);
          if (data.evaluation) {
            const loadedAnswers: Record<number, number> = {};
            for (let i = 1; i <= 10; i++) {
              if (data.evaluation[`q${i}`]) {
                loadedAnswers[i] = data.evaluation[`q${i}`];
              }
            }
            setAnswers(loadedAnswers);
          }
        }
      } catch (err) {
        console.error("Gagal memeriksa status evaluasi:", err);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [hydrated, user, router]);

  const handleSelectAnswer = (questionId: number, value: number) => {
    if (isCompleted) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((val) => typeof val === "number").length;
  }, [answers]);

  const progressPercentage = Math.round((answeredCount / 10) * 100);

  const missingQuestions = useMemo(() => {
    return EVALUATION_QUESTIONS.filter((q) => answers[q.id] === undefined).map(
      (q) => q.orderNumber
    );
  }, [answers]);

  const handleSubmit = async () => {
    if (missingQuestions.length > 0) {
      toast.error(
        `Semua 10 pertanyaan wajib diisi! Pertanyaan yang belum diisi: nomor ${missingQuestions.join(", ")}.`
      );
      return;
    }

    setSubmitting(true);
    toast.info("Mengirimkan jawaban evaluasi simulasi...", { id: "submit-eval-toast" });

    try {
      const res = await fetch("/api/evaluation/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          answers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan jawaban evaluasi.");
      }

      setIsCompleted(true);
      setCompletedAt(new Date().toISOString());

      // Cache completion in session storage
      try {
        sessionStorage.setItem(`simulasi_eval_done_${user?.id}`, "true");
      } catch {
        // ignore
      }

      toast.success("Evaluasi simulasi berhasil disimpan! Terima kasih.", {
        id: "submit-eval-toast",
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan evaluasi.", { id: "submit-eval-toast" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">
            Memuat evaluasi akhir simulasi...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-muted/20 to-background flex flex-col justify-between">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <ClipboardCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-foreground truncate tracking-tight">
                  Evaluasi Akhir Simulasi Perdagangan
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Tahap Akhir (Selesai Sesi 4)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Kuesioner evaluasi pasca simulasi perdagangan saham · 10 Pertanyaan Wajib
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                {user?.nama}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ID: #{user?.id}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1">
        {/* If already completed, show completed view */}
        {isCompleted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center space-y-5 shadow-sm">
              <div className="mx-auto size-16 sm:size-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-md shadow-emerald-500/10">
                <CheckCircle2 className="size-9 sm:size-11" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black tracking-wide uppercase border border-emerald-500/20">
                  <Sparkles className="size-3.5" />
                  <span>Evaluasi Berhasil Disimpan</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground">
                  Terima Kasih Atas Partisipasi Anda!
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Seluruh rangkaian simulasi perdagangan saham dan evaluasi akhir telah Anda selesaikan secara lengkap. Jawaban Anda telah tersimpan dengan aman ke dalam sistem penelitian.
                </p>
                {completedAt && (
                  <p className="text-[11px] font-mono text-muted-foreground/80 pt-1">
                    Waktu submit: {new Date(completedAt).toLocaleString("id-ID")} WIB
                  </p>
                )}
              </div>

              {/* Review Answers Accordion or Quick Summary */}
              <div className="pt-4 border-t border-border/60 text-left space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ClipboardCheck className="size-3.5 text-primary" />
                  <span>Ringkasan 10 Jawaban Anda:</span>
                </h3>
                <div className="space-y-2">
                  {EVALUATION_QUESTIONS.map((q) => {
                    const score = answers[q.id];
                    const opt = EVALUATION_LIKERT_OPTIONS.find((o) => o.value === score);
                    return (
                      <div
                        key={q.id}
                        className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="size-5 rounded-md bg-card border border-border flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">
                            {q.orderNumber}
                          </span>
                          <span className="font-medium text-foreground line-clamp-2">
                            {q.questionText}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-bold text-primary block text-[11px] sm:text-xs">
                            {opt?.label || `Skor ${score}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Skor: {score}/5
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={logout}
                  variant="outline"
                  className="w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-xs"
                >
                  <LogOut className="size-4 mr-2" />
                  <span>Selesai & Keluar</span>
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* ── BANNER INFORMASI ── */}
            <Card className="rounded-3xl border border-border/80 bg-linear-to-r from-primary/10 via-card to-background p-5 sm:p-6 space-y-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                  <ClipboardCheck className="size-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Evaluasi Simulasi Perdagangan Saham
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Selamat, Anda telah menyelesaikan seluruh sesi simulasi perdagangan saham hingga <strong>Periode 3 Sesi 4</strong>. Mohon berikan tanggapan yang objektif pada 10 pernyataan di bawah ini. Semua pertanyaan <strong>wajib dijawab</strong> sebelum sesi berakhir.
                  </p>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-foreground">Kelengkapan Jawaban</span>
                  <span className="font-mono text-primary text-xs sm:text-sm font-black">
                    {answeredCount} / 10 Terisi ({progressPercentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* ── 10 EVALUATION QUESTIONS ── */}
            <div className="space-y-3.5 sm:space-y-4">
              {EVALUATION_QUESTIONS.map((q) => {
                const selectedValue = answers[q.id];
                const isAnswered = selectedValue !== undefined;

                return (
                  <Card
                    key={q.id}
                    className={cn(
                      "rounded-2xl sm:rounded-3xl border transition-all p-4 sm:p-5 space-y-3 shadow-2xs",
                      isAnswered
                        ? "border-primary/50 bg-card shadow-xs ring-1 ring-primary/15"
                        : "border-border/80 bg-card/70 hover:border-border"
                    )}
                  >
                    {/* Question Statement */}
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "size-7 sm:size-8 rounded-xl flex items-center justify-center text-xs sm:text-sm font-mono font-black shrink-0 transition-colors shadow-2xs mt-0.5",
                          isAnswered
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {q.orderNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-foreground leading-relaxed text-pretty">
                          {q.questionText}
                        </p>
                      </div>
                    </div>

                    {/* Likert 5 Options Scale */}
                    <div className="space-y-1.5 pt-1">
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                        {EVALUATION_LIKERT_OPTIONS.map((opt) => {
                          const isSelected = selectedValue === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleSelectAnswer(q.id, opt.value)}
                              className={cn(
                                "flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all min-h-[52px] sm:min-h-[64px] active:scale-95 select-none touch-manipulation cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30 font-bold"
                                  : "border-border/70 bg-muted/30 hover:bg-muted/70 text-foreground"
                              )}
                            >
                              <span
                                className={cn(
                                  "font-mono font-black text-sm sm:text-base block leading-none",
                                  isSelected ? "text-primary-foreground" : "text-foreground"
                                )}
                              >
                                {opt.value}
                              </span>
                              <span
                                className={cn(
                                  "text-[8.5px] sm:text-[10px] font-semibold leading-tight mt-1.5 block truncate max-w-full px-0.5 tracking-tight",
                                  isSelected ? "text-primary-foreground font-bold" : "text-muted-foreground"
                                )}
                              >
                                <span className="sm:hidden">{opt.short}</span>
                                <span className="hidden sm:inline">{opt.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Scale description on mobile */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-0.5 sm:hidden font-medium">
                        <span>1: Sangat Tdk Setuju</span>
                        <span>5: Sangat Setuju</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* ── SUBMISSION CARD ── */}
            <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Status Kelengkapan:
                    </span>
                    {answeredCount === 10 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="size-3" />
                        <span>Lengkap (10/10)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <AlertCircle className="size-3" />
                        <span>Belum Lengkap ({answeredCount}/10)</span>
                      </span>
                    )}
                  </div>
                  {missingQuestions.length > 0 && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      Pertanyaan belum diisi: nomor {missingQuestions.join(", ")}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || answeredCount < 10}
                  className="h-11 sm:h-12 px-6 sm:px-8 rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      <span>Menyimpan Jawaban...</span>
                    </>
                  ) : (
                    <>
                      <span>Kirim Jawaban Evaluasi</span>
                      <ArrowRight className="size-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/60 py-4 text-center text-[11px] text-muted-foreground">
        <p>© 2026 Platform Simulasi Perdagangan Saham · Instrumen Evaluasi Akhir</p>
      </footer>
    </div>
  );
}
