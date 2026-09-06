"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Lock,
  LogOut,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Question = {
  id: number;
  instrument: "LA" | "EI";
  orderNumber: number;
  questionText: string;
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
};

const LIKERT_OPTIONS = [
  { value: 1, label: "Sangat Tidak Setuju", short: "STS", color: "hover:border-rose-500/50 hover:bg-rose-500/5 selected:bg-rose-500 text-rose-600" },
  { value: 2, label: "Tidak Setuju", short: "TS", color: "hover:border-amber-500/50 hover:bg-amber-500/5 selected:bg-amber-500 text-amber-600" },
  { value: 3, label: "Netral", short: "N", color: "hover:border-zinc-500/50 hover:bg-zinc-500/5 selected:bg-zinc-500 text-zinc-600" },
  { value: 4, label: "Setuju", short: "S", color: "hover:border-emerald-500/50 hover:bg-emerald-500/5 selected:bg-emerald-500 text-emerald-600" },
  { value: 5, label: "Sangat Setuju", short: "SS", color: "hover:border-teal-500/50 hover:bg-teal-500/5 selected:bg-teal-500 text-teal-600" },
];

export default function QuestionnairePage() {
  const { user, hydrated, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1); // 1: LA, 2: EI, 3: Completed

  const [laQuestions, setLaQuestions] = useState<Question[]>([]);
  const [eiQuestions, setEiQuestions] = useState<Question[]>([]);
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

    // Check if user already completed questionnaire
    async function loadData() {
      try {
        const [statusRes, questionsRes] = await Promise.all([
          fetch(`/api/questionnaire/status?userId=${user?.id}`),
          fetch("/api/questionnaire/questions"),
        ]);

        const statusData = await statusRes.json();
        const questionsData = await questionsRes.json();

        if (statusData.success && statusData.isCompleted) {
          // Already completed -> redirect straight to dashboard
          router.push("/dashboard/trading");
          return;
        }

        if (questionsData.success) {
          setLaQuestions(questionsData.la || []);
          setEiQuestions(questionsData.ei || []);
        }
      } catch (err) {
        console.error("Error loading questionnaire data:", err);
        toast.error("Gagal memuat pertanyaan kuesioner");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [hydrated, user, router]);

  const handleSelectAnswer = (questionId: number, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: score,
    }));
  };

  // Progress calculations
  const currentQuestions = currentStep === 1 ? laQuestions : eiQuestions;
  const answeredInCurrentStep = currentQuestions.filter((q) => answers[q.id] !== undefined).length;
  const totalInCurrentStep = currentQuestions.length;
  const currentStepProgress = totalInCurrentStep > 0 ? (answeredInCurrentStep / totalInCurrentStep) * 100 : 0;
  const isCurrentStepComplete = answeredInCurrentStep === totalInCurrentStep && totalInCurrentStep > 0;

  // Next step handler
  const handleNextStep = () => {
    if (!isCurrentStepComplete) {
      toast.error(`Mohon lengkapi seluruh ${totalInCurrentStep} pertanyaan sebelum melanjutkan.`);
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Previous step handler
  const handlePrevStep = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final submit handler
  const handleSubmit = async () => {
    if (!user) return;

    // Check all questions answered
    const allQuestions = [...laQuestions, ...eiQuestions];
    const unanswered = allQuestions.filter((q) => answers[q.id] === undefined);

    if (unanswered.length > 0) {
      toast.error(`Terdapat ${unanswered.length} pertanyaan yang belum diisi.`);
      return;
    }

    setSubmitting(true);
    try {
      const responsePayload = allQuestions.map((q) => ({
        questionId: q.id,
        score: answers[q.id],
      }));

      const res = await fetch("/api/questionnaire/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          responses: responsePayload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStep(3);
        toast.success("Kuesioner berhasil dikirimkan!");
      } else {
        toast.error(data.error || "Gagal mengirimkan kuesioner.");
      }
    } catch (err) {
      console.error("Error submitting questionnaire:", err);
      toast.error("Terjadi kendala jaringan saat mengirim jawaban.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnterExperiment = () => {
    router.push("/dashboard/trading");
  };

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-foreground">Menyiapkan Kuesioner Eksperimen...</p>
          <p className="text-xs text-muted-foreground">Memuat instrumen Loss Aversion & Emotional Intelligence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* ── Top Header Navigation ── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="relative flex size-7 sm:size-8 items-center justify-center rounded-xl bg-primary/10 overflow-hidden shrink-0 border border-primary/20">
            <Image
              src="/logo-icon-64.png"
              alt="Logo Simulasi Investasi"
              width={26}
              height={26}
              className="size-full object-contain"
              priority
              unoptimized
            />
          </div>
          <div className="min-w-0">
            <span className="text-[clamp(13px,3.8vw,15px)] font-black tracking-tight text-foreground block truncate">
              SimulasiInvestasi
            </span>
            <span className="text-[clamp(9px,2.5vw,10.5px)] text-muted-foreground block -mt-0.5 truncate">
              Kuesioner Profil Keputusan Pasar
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 bg-muted/60 border border-border/60 rounded-full px-3 py-1">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-semibold text-foreground">{user?.nama}</span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase bg-card px-1.5 py-0.2 rounded border">
              ID #{user?.id}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 gap-1.5 rounded-xl shrink-0"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-2.5 sm:px-6 py-3.5 sm:py-8 space-y-4 sm:space-y-6">
        {/* ── Step 3: SUCCESS COMPLETION SCREEN ── */}
        {currentStep === 3 ? (
          <div className="min-h-[75vh] flex items-center justify-center py-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="w-full rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-card to-card p-4 sm:p-10 text-center space-y-4 sm:space-y-6 shadow-2xl relative overflow-hidden"
            >
              {/* Background ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-24 sm:h-32 bg-emerald-500/15 blur-2xl pointer-events-none rounded-full" />

              {/* Animated Success Badge Icon */}
              <div className="relative">
                <div className="flex size-14 sm:size-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="size-8 sm:size-12" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2 max-w-lg mx-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[10.5px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-2xs">
                  <Sparkles className="size-3.5" /> Kuesioner Selesai & Terverifikasi
                </span>
                <h1 className="text-[clamp(1.15rem,4.5vw,1.5rem)] font-black text-foreground tracking-tight text-balance">
                  Profil Responden Berhasil Disimpan
                </h1>
                <p className="text-[12px] sm:text-sm text-muted-foreground leading-relaxed text-pretty max-w-md mx-auto">
                  Terima kasih atas partisipasi Anda dalam mengisi instrumen profil keputusan psikologis.
                  Jawaban Anda telah tersimpan secara aman dan siap digunakan dalam simulasi eksperimen.
                </p>
              </div>

              {/* Summary Stats Chips */}
              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto text-left">
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Instrumen 1</span>
                  <span className="text-xs font-black text-foreground">Loss Aversion</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                    ✓ 15/15 Terisi
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Instrumen 2</span>
                  <span className="text-xs font-black text-foreground">Emotional Intel</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                    ✓ 15/15 Terisi
                  </span>
                </div>
              </div>

              {/* Data Confidentiality Box */}
              <div className="p-3 sm:p-4 rounded-2xl bg-muted/30 border border-border/60 max-w-md mx-auto text-left space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Lock className="size-3.5 text-primary" />
                  <span>Kerahasiaan Data Penelitian</span>
                </div>
                <p className="text-[10.5px] sm:text-[11px] text-muted-foreground leading-relaxed">
                  Skor dan pengelompokan profil bersifat konfidensial untuk tujuan riset akademis dan
                  analisis perilaku pasar finansial.
                </p>
              </div>

              {/* Thumb-Zone CTA Button */}
              <div className="pt-2 sm:pt-4 max-w-md mx-auto">
                <Button
                  size="lg"
                  onClick={handleEnterExperiment}
                  className="w-full h-12 sm:h-13 px-6 sm:px-8 text-xs sm:text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-xl shadow-primary/25 gap-2 active:scale-95 transition-all touch-manipulation cursor-pointer"
                >
                  <span>Mulai Eksperimen Simulasi Investasi</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {/* ── Hero Info Banner ── */}
            <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 backdrop-blur-md p-3.5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Brain className="size-4" />
                  </div>
                  <h1 className="text-[clamp(13.5px,3.8vw,18px)] font-black tracking-tight text-foreground truncate">
                    Kuesioner Profil Keputusan
                  </h1>
                </div>

                <span className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Lock className="size-3" /> Data Konfidensial
                </span>
              </div>

              <p className="text-[11.5px] sm:text-xs text-muted-foreground leading-relaxed text-pretty">
                Mohon berikan respon yang paling mencerminkan diri Anda pada setiap butir pernyataan di
                bawah ini. Seluruh isian murni untuk keperluan riset dan dirahasiakan sepenuhnya.
              </p>

              {/* Step Navigation Pill */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div
                  className={cn(
                    "p-2.5 rounded-2xl border transition-all text-left",
                    currentStep === 1
                      ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/20"
                      : "border-border/60 bg-muted/20 opacity-70"
                  )}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Bagian 1</span>
                    {currentStep === 2 && <CheckCircle2 className="size-3 text-emerald-500" />}
                  </div>
                  <div className="text-xs sm:text-sm font-black text-foreground mt-0.5 truncate">
                    Loss Aversion (LA)
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {laQuestions.length} Butir Pertanyaan
                  </div>
                </div>

                <div
                  className={cn(
                    "p-2.5 rounded-2xl border transition-all text-left",
                    currentStep === 2
                      ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/20"
                      : "border-border/60 bg-muted/20 opacity-70"
                  )}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Bagian 2
                  </div>
                  <div className="text-xs sm:text-sm font-black text-foreground mt-0.5 truncate">
                    Emotional Intelligence (EI)
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {eiQuestions.length} Butir Pertanyaan
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-bold gap-2">
                  <span className="text-foreground truncate">
                    {currentStep === 1 ? "Bagian 1: Loss Aversion" : "Bagian 2: Emotional Intelligence"}
                  </span>
                  <span className="font-mono text-primary shrink-0 text-[11px] sm:text-xs">
                    {answeredInCurrentStep}/{totalInCurrentStep} Terisi ({Math.round(currentStepProgress)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${currentStepProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── Question Cards List ── */}
            <div className="space-y-3 sm:space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: currentStep === 1 ? -12 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: currentStep === 1 ? 12 : -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 sm:space-y-3.5"
                >
                  {currentQuestions.map((q) => {
                    const selectedValue = answers[q.id];
                    const isAnswered = selectedValue !== undefined;

                    return (
                      <Card
                        key={q.id}
                        className={cn(
                          "rounded-2xl sm:rounded-3xl border transition-all p-3.5 sm:p-5 space-y-3 shadow-2xs",
                          isAnswered
                            ? "border-primary/40 bg-card shadow-xs ring-1 ring-primary/10"
                            : "border-border/80 bg-card/70 hover:border-border"
                        )}
                      >
                        {/* Question Text */}
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <span
                            className={cn(
                              "size-6 sm:size-7 rounded-lg sm:rounded-xl flex items-center justify-center text-[11px] sm:text-xs font-mono font-black shrink-0 transition-colors shadow-2xs mt-0.5",
                              isAnswered
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground border border-border"
                            )}
                          >
                            {q.orderNumber}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] sm:text-sm font-semibold text-foreground leading-relaxed text-pretty">
                              {q.questionText}
                            </p>
                          </div>
                        </div>

                        {/* Likert Scale (5 Options) */}
                        <div className="space-y-1.5 pt-0.5">
                          <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center">
                            {LIKERT_OPTIONS.map((opt) => {
                              const isSelected = selectedValue === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleSelectAnswer(q.id, opt.value)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all min-h-[48px] sm:min-h-[58px] active:scale-95 select-none touch-manipulation cursor-pointer",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30 font-bold"
                                      : "border-border/70 bg-muted/40 hover:bg-muted/80 text-foreground"
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
                                      "text-[8.5px] sm:text-[10px] font-semibold leading-tight mt-1 block truncate max-w-full px-0.5 tracking-tight",
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

                          {/* Scale range label on mobile */}
                          <div className="flex items-center justify-between text-[9.5px] text-muted-foreground font-medium px-1 sm:hidden">
                            <span>1 = Sangat Tidak Setuju</span>
                            <span>5 = Sangat Setuju</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Navigation Actions (Thumb Zone) ── */}
            <div className="sticky bottom-3 z-30 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-background/95 backdrop-blur-xl p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-2 sm:gap-3">
                {currentStep === 2 ? (
                  <Button
                    variant="outline"
                    onClick={handlePrevStep}
                    className="h-10 sm:h-11 px-3 sm:px-4 text-xs font-bold rounded-xl sm:rounded-2xl border-border hover:bg-muted gap-1.5 shrink-0"
                  >
                    <ArrowLeft className="size-3.5 sm:size-4" />
                    <span className="hidden xs:inline">Kembali</span>
                    <span className="xs:hidden">Balik</span>
                  </Button>
                ) : (
                  <div className="text-[11px] sm:text-xs text-muted-foreground px-2 font-medium">
                    {answeredInCurrentStep < totalInCurrentStep ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Sisa {totalInCurrentStep - answeredInCurrentStep} butir
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 inline" /> Siap Lanjut
                      </span>
                    )}
                  </div>
                )}

                {currentStep === 1 ? (
                  <Button
                    onClick={handleNextStep}
                    disabled={!isCurrentStepComplete}
                    className={cn(
                      "h-10 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl gap-1.5 sm:gap-2 ml-auto shadow-lg transition-transform active:scale-95 shrink-0",
                      isCurrentStepComplete
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                        : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                    )}
                  >
                    <span>Lanjut ke Bagian 2 (EI)</span>
                    <ArrowRight className="size-3.5 sm:size-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!isCurrentStepComplete || submitting}
                    className={cn(
                      "h-10 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl gap-1.5 sm:gap-2 ml-auto shadow-lg transition-transform active:scale-95 shrink-0",
                      isCurrentStepComplete && !submitting
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden xs:inline">Kirim & Selesaikan</span>
                        <span className="xs:hidden">Kirim Jawaban</span>
                        <CheckCircle2 className="size-3.5 sm:size-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
