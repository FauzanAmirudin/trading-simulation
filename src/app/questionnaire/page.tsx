"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Brain,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Lock,
  LogOut,
  User,
  GraduationCap,
  Briefcase,
  Wallet,
  BookOpen,
  Calendar,
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
  { value: 1, label: "Sangat Tidak Setuju", short: "STS" },
  { value: 2, label: "Tidak Setuju", short: "TS" },
  { value: 3, label: "Netral", short: "N" },
  { value: 4, label: "Setuju", short: "S" },
  { value: 5, label: "Sangat Setuju", short: "SS" },
];

export default function QuestionnairePage() {
  const { user, hydrated, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingBiodata, setSavingBiodata] = useState(false);

  // 1: Data Responden (Biodata), 2: LA, 3: EI, 4: Completed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Biodata State (8 butir dari Instrument 1 copy.docx)
  const [biodata, setBiodata] = useState({
    jenisKelamin: "",
    usia: "",
    programStudi: "",
    semester: "",
    pernahInvestasiSaham: "",
    pernahPelatihanInvestasi: "",
    sumberPenghasilan: "",
    sumberPenghasilanLainnya: "",
    jurusanSma: "",
  });

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
          // Already completed -> cache and redirect straight to dashboard
          try {
            sessionStorage.setItem(`simulasi_qs_done_${user?.id}`, "true");
          } catch {}
          router.push("/dashboard/trading");
          return;
        }

        // Pre-fill existing biodata if previously submitted
        if (statusData.biodata) {
          setBiodata({
            jenisKelamin: statusData.biodata.jenisKelamin || "",
            usia: statusData.biodata.usia ? String(statusData.biodata.usia) : "",
            programStudi: statusData.biodata.programStudi || "",
            semester: statusData.biodata.semester ? String(statusData.biodata.semester) : "",
            pernahInvestasiSaham: statusData.biodata.pernahInvestasiSaham || "",
            pernahPelatihanInvestasi: statusData.biodata.pernahPelatihanInvestasi || "",
            sumberPenghasilan: statusData.biodata.sumberPenghasilan || "",
            sumberPenghasilanLainnya: statusData.biodata.sumberPenghasilanLainnya || "",
            jurusanSma: statusData.biodata.jurusanSma || "",
          });
          if (statusData.hasBiodata && !statusData.isCompleted) {
            setCurrentStep(2);
          }
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

  // Biodata validation checks
  const isBiodataValid =
    Boolean(biodata.jenisKelamin) &&
    Boolean(biodata.usia && Number(biodata.usia) >= 10 && Number(biodata.usia) <= 100) &&
    Boolean(biodata.programStudi.trim()) &&
    Boolean(biodata.semester && Number(biodata.semester) >= 1 && Number(biodata.semester) <= 20) &&
    Boolean(biodata.pernahInvestasiSaham) &&
    Boolean(biodata.pernahPelatihanInvestasi) &&
    Boolean(biodata.sumberPenghasilan) &&
    (biodata.sumberPenghasilan !== "Lainnya" || Boolean(biodata.sumberPenghasilanLainnya.trim())) &&
    Boolean(biodata.jurusanSma);

  const biodataFilledCount = [
    Boolean(biodata.jenisKelamin),
    Boolean(biodata.usia && Number(biodata.usia) >= 10 && Number(biodata.usia) <= 100),
    Boolean(biodata.programStudi.trim()),
    Boolean(biodata.semester && Number(biodata.semester) >= 1 && Number(biodata.semester) <= 20),
    Boolean(biodata.pernahInvestasiSaham),
    Boolean(biodata.pernahPelatihanInvestasi),
    Boolean(
      biodata.sumberPenghasilan &&
        (biodata.sumberPenghasilan !== "Lainnya" || biodata.sumberPenghasilanLainnya.trim())
    ),
    Boolean(biodata.jurusanSma),
  ].filter(Boolean).length;

  // Step 2 & 3 Progress calculations
  const laAnsweredCount = laQuestions.filter((q) => answers[q.id] !== undefined).length;
  const isLaComplete = laQuestions.length > 0 && laAnsweredCount === laQuestions.length;

  const eiAnsweredCount = eiQuestions.filter((q) => answers[q.id] !== undefined).length;
  const isEiComplete = eiQuestions.length > 0 && eiAnsweredCount === eiQuestions.length;

  // Save Biodata and advance to Step 2
  const handleNextFromBiodata = async () => {
    if (!isBiodataValid) {
      toast.error("Mohon lengkapi seluruh 8 isian data responden sebelum melanjutkan.");
      return;
    }
    if (!user) return;

    setSavingBiodata(true);
    try {
      const res = await fetch("/api/questionnaire/biodata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          biodata,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Gagal menyimpan biodata responden.");
        return;
      }
      toast.success("Biodata responden berhasil disimpan!");
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error saving biodata:", err);
      toast.error("Terjadi kendala saat menyimpan biodata.");
    } finally {
      setSavingBiodata(false);
    }
  };

  // Step 2 to Step 3 handler
  const handleNextFromLa = () => {
    if (!isLaComplete) {
      toast.error(`Mohon lengkapi seluruh ${laQuestions.length} butir pertanyaan Loss Aversion.`);
      return;
    }
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final submit handler at Step 3
  const handleSubmit = async () => {
    if (!user) return;

    if (!isBiodataValid) {
      toast.error("Biodata responden belum lengkap. Silakan kembali ke Bagian 1.");
      setCurrentStep(1);
      return;
    }

    const allQuestions = [...laQuestions, ...eiQuestions];
    const unanswered = allQuestions.filter((q) => answers[q.id] === undefined);

    if (unanswered.length > 0) {
      toast.error(`Terdapat ${unanswered.length} butir pertanyaan yang belum diisi.`);
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
          biodata,
          responses: responsePayload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        try {
          sessionStorage.setItem(`simulasi_qs_done_${user.id}`, "true");
        } catch {}
        setCurrentStep(4);
        toast.success("Kuesioner profil berhasil dikirimkan!");
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
          <p className="text-xs text-muted-foreground">
            Memuat Data Responden, Instrumen Loss Aversion & Emotional Intelligence
          </p>
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
            className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 gap-1.5 rounded-xl shrink-0 cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-2.5 sm:px-6 py-3.5 sm:py-8 space-y-4 sm:space-y-6">
        {/* ── STEP 4: SUCCESS COMPLETION SCREEN ── */}
        {currentStep === 4 ? (
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
                  Terima kasih atas partisipasi Anda dalam mengisi data responden dan instrumen profil
                  keputusan psikologis. Data Anda telah tersimpan secara aman dan siap digunakan dalam
                  simulasi pasar finansial.
                </p>
              </div>

              {/* Summary Stats Chips */}
              <div className="grid grid-cols-3 gap-2 max-w-md mx-auto text-left">
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block truncate">Bagian 1</span>
                  <span className="text-xs font-black text-foreground truncate block">Data Responden</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                    ✓ 8/8 Terisi
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block truncate">Bagian 2</span>
                  <span className="text-xs font-black text-foreground truncate block">Loss Aversion</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                    ✓ 15/15 Terisi
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block truncate">Bagian 3</span>
                  <span className="text-xs font-black text-foreground truncate block">Emotional Intel</span>
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
                  Skor psikometri dan pengelompokan profil bersifat konfidensial untuk tujuan riset
                  akademis dan analisis perilaku pasar finansial.
                </p>
              </div>

              {/* CTA Button */}
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
                    Kuesioner Penelitian & Profil Responden
                  </h1>
                </div>

                <span className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Lock className="size-3" /> Wajib Diisi & Konfidensial
                </span>
              </div>

              <p className="text-[11.5px] sm:text-xs text-muted-foreground leading-relaxed text-pretty">
                Mohon lengkapi seluruh isian biodata dan butir pernyataan di bawah ini secara jujur sesuai
                dengan kondisi dan diri Anda yang sebenarnya. Seluruh data murni untuk keperluan riset akademis.
              </p>

              {/* 3-Step Navigation Pills */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Step 1 Pill */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-2xl border transition-all text-left cursor-pointer",
                    currentStep === 1
                      ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/20"
                      : "border-border/60 bg-muted/20 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Bagian 1</span>
                    {isBiodataValid && <CheckCircle2 className="size-3 text-emerald-500" />}
                  </div>
                  <div className="text-[11px] sm:text-xs font-black text-foreground mt-0.5 truncate">
                    Data Responden
                  </div>
                  <div className="text-[9.5px] sm:text-[10px] font-mono text-muted-foreground truncate">
                    8 Pertanyaan
                  </div>
                </button>

                {/* Step 2 Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (isBiodataValid) setCurrentStep(2);
                    else toast.error("Lengkapi data responden terlebih dahulu.");
                  }}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-2xl border transition-all text-left cursor-pointer",
                    currentStep === 2
                      ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/20"
                      : "border-border/60 bg-muted/20 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Bagian 2</span>
                    {isLaComplete && <CheckCircle2 className="size-3 text-emerald-500" />}
                  </div>
                  <div className="text-[11px] sm:text-xs font-black text-foreground mt-0.5 truncate">
                    Loss Aversion
                  </div>
                  <div className="text-[9.5px] sm:text-[10px] font-mono text-muted-foreground truncate">
                    {laQuestions.length} Butir Soal
                  </div>
                </button>

                {/* Step 3 Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (isBiodataValid && isLaComplete) setCurrentStep(3);
                    else toast.error("Selesaikan Bagian 1 & 2 terlebih dahulu.");
                  }}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-2xl border transition-all text-left cursor-pointer",
                    currentStep === 3
                      ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/20"
                      : "border-border/60 bg-muted/20 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Bagian 3</span>
                    {isEiComplete && <CheckCircle2 className="size-3 text-emerald-500" />}
                  </div>
                  <div className="text-[11px] sm:text-xs font-black text-foreground mt-0.5 truncate">
                    Emotional Intel
                  </div>
                  <div className="text-[9.5px] sm:text-[10px] font-mono text-muted-foreground truncate">
                    {eiQuestions.length} Butir Soal
                  </div>
                </button>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-bold gap-2">
                  <span className="text-foreground truncate">
                    {currentStep === 1 && "Bagian 1: Data Responden (Biodata)"}
                    {currentStep === 2 && "Bagian 2: Instrumen 1 — Loss Aversion (LA)"}
                    {currentStep === 3 && "Bagian 3: Instrumen 2 — Emotional Intelligence (EI)"}
                  </span>
                  <span className="font-mono text-primary shrink-0 text-[11px] sm:text-xs">
                    {currentStep === 1 && `${biodataFilledCount}/8 Terisi (${Math.round((biodataFilledCount / 8) * 100)}%)`}
                    {currentStep === 2 &&
                      `${laAnsweredCount}/${laQuestions.length} Terisi (${Math.round((laAnsweredCount / (laQuestions.length || 1)) * 100)}%)`}
                    {currentStep === 3 &&
                      `${eiAnsweredCount}/${eiQuestions.length} Terisi (${Math.round((eiAnsweredCount / (eiQuestions.length || 1)) * 100)}%)`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        currentStep === 1
                          ? (biodataFilledCount / 8) * 100
                          : currentStep === 2
                          ? (laAnsweredCount / (laQuestions.length || 1)) * 100
                          : (eiAnsweredCount / (eiQuestions.length || 1)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── STEP 1: BIODATA FORM (8 Questions from Instrument 1 copy.docx) ── */}
            {currentStep === 1 && (
              <motion.div
                key="step-biodata"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 sm:space-y-4"
              >
                {/* 1. Jenis Kelamin */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Jenis Kelamin <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Pilih jenis kelamin Anda</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
                    {["Laki-laki", "Perempuan"].map((jk) => {
                      const isSelected = biodata.jenisKelamin === jk;
                      return (
                        <button
                          key={jk}
                          type="button"
                          onClick={() => setBiodata((b) => ({ ...b, jenisKelamin: jk }))}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30"
                              : "border-border/80 bg-muted/30 hover:bg-muted/70 text-foreground"
                          )}
                        >
                          {jk}
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* 2. Usia */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Usia <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Masukkan usia Anda saat ini dalam tahun</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 max-w-xs pt-1">
                    <Input
                      type="number"
                      min={10}
                      max={100}
                      placeholder="Contoh: 21"
                      value={biodata.usia}
                      onChange={(e) => setBiodata((b) => ({ ...b, usia: e.target.value }))}
                      className="h-11 rounded-xl text-sm font-bold font-mono"
                    />
                    <span className="text-xs font-bold text-muted-foreground shrink-0">Tahun</span>
                  </div>
                </Card>

                {/* 3. Program Studi / Jurusan */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Program Studi / Jurusan Kuliah <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Tuliskan nama program studi / jurusan yang sedang Anda tempuh</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Input
                      type="text"
                      placeholder="Contoh: Manajemen, Akuntansi, Teknik Informatika, Ilmu Ekonomi..."
                      value={biodata.programStudi}
                      onChange={(e) => setBiodata((b) => ({ ...b, programStudi: e.target.value }))}
                      className="h-11 rounded-xl text-xs sm:text-sm"
                    />
                  </div>
                </Card>

                {/* 4. Semester saat ini */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Semester Saat Ini <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Pilih atau masukkan semester yang sedang berjalan</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                      const isSelected = biodata.semester === String(sem);
                      return (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => setBiodata((b) => ({ ...b, semester: String(sem) }))}
                          className={cn(
                            "py-2 px-1 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                              : "border-border/80 bg-muted/30 hover:bg-muted/70 text-foreground"
                          )}
                        >
                          Sem {sem}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 max-w-xs pt-1">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      placeholder="Atau ketik semester..."
                      value={biodata.semester}
                      onChange={(e) => setBiodata((b) => ({ ...b, semester: e.target.value }))}
                      className="h-9 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </Card>

                {/* 5. Apakah Pernah Berinvestasi di Pasar Saham? */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      5
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Apakah Anda pernah berinvestasi di pasar saham? <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Pilih Ya atau Tidak sesuai pengalaman nyata Anda</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
                    {["Ya", "Tidak"].map((opt) => {
                      const isSelected = biodata.pernahInvestasiSaham === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setBiodata((b) => ({ ...b, pernahInvestasiSaham: opt }))}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30"
                              : "border-border/80 bg-muted/30 hover:bg-muted/70 text-foreground"
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* 6. Pelatihan / Mata Kuliah Investasi */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      6
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Apakah Anda pernah mendapatkan mata kuliah atau pelatihan tentang investasi atau keuangan pribadi? <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Pilih Ya jika pernah mengikuti kuliah/seminar/workshop/pelatihan terkait</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
                    {["Ya", "Tidak"].map((opt) => {
                      const isSelected = biodata.pernahPelatihanInvestasi === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setBiodata((b) => ({ ...b, pernahPelatihanInvestasi: opt }))}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 touch-manipulation",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30"
                              : "border-border/80 bg-muted/30 hover:bg-muted/70 text-foreground"
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </Card>

                {/* 7. Sumber Penghasilan Utama */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      7
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Sumber Penghasilan Utama Anda <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Pilih sumber dana atau pemasukan utama sehari-hari</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {["Orang tua", "Beasiswa", "Pekerjaan sampingan", "Lainnya"].map((opt) => {
                      const isSelected = biodata.sumberPenghasilan === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setBiodata((b) => ({ ...b, sumberPenghasilan: opt }))}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 touch-manipulation text-center",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30"
                              : "border-border/80 bg-muted/30 hover:bg-muted/70 text-foreground"
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {biodata.sumberPenghasilan === "Lainnya" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="pt-1.5"
                    >
                      <Input
                        type="text"
                        placeholder="Sebutkan sumber penghasilan lainnya secara spesifik..."
                        value={biodata.sumberPenghasilanLainnya}
                        onChange={(e) => setBiodata((b) => ({ ...b, sumberPenghasilanLainnya: e.target.value }))}
                        className="h-10 rounded-xl text-xs sm:text-sm"
                      />
                    </motion.div>
                  )}
                </Card>

                {/* 8. Jurusan Sewaktu SMA */}
                <Card className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                      8
                    </span>
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-foreground block">
                        Jurusan Sewaktu SMA <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">Pilih jurusan pendidikan Anda saat menempuh SMA/SMK/MA</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {["IPA", "IPS", "Bahasa/lain-lain"].map((jur) => {
                      const isSelected = biodata.jurusanSma === jur;
                      return (
                        <button
                          key={jur}
                          type="button"
                          onClick={() => setBiodata((b) => ({ ...b, jurusanSma: jur }))}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 touch-manipulation text-center",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30"
                              : "border-border/80 bg-muted/30 hover:bg-muted/70 text-foreground"
                          )}
                        >
                          {jur}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 2 & 3: PSYCHOMETRIC QUESTION CARDS (LA & EI) ── */}
            {(currentStep === 2 || currentStep === 3) && (
              <div className="space-y-3 sm:space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: currentStep === 2 ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: currentStep === 2 ? 12 : -12 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 sm:space-y-3.5"
                  >
                    {(currentStep === 2 ? laQuestions : eiQuestions).map((q) => {
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
            )}

            {/* ── Navigation Actions (Thumb Zone) ── */}
            <div className="sticky bottom-3 z-30 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-background/95 backdrop-blur-xl p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-2 sm:gap-3">
                {/* Back Button */}
                {currentStep === 2 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentStep(1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-10 sm:h-11 px-3 sm:px-4 text-xs font-bold rounded-xl sm:rounded-2xl border-border hover:bg-muted gap-1.5 shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5 sm:size-4" />
                    <span className="hidden xs:inline">Biodata</span>
                    <span className="xs:hidden">Kembali</span>
                  </Button>
                )}

                {currentStep === 3 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-10 sm:h-11 px-3 sm:px-4 text-xs font-bold rounded-xl sm:rounded-2xl border-border hover:bg-muted gap-1.5 shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5 sm:size-4" />
                    <span className="hidden xs:inline">Bagian 2 (LA)</span>
                    <span className="xs:hidden">Kembali</span>
                  </Button>
                )}

                {/* Left Progress Indicator (if Step 1) */}
                {currentStep === 1 && (
                  <div className="text-[11px] sm:text-xs text-muted-foreground px-2 font-medium">
                    {biodataFilledCount < 8 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Sisa {8 - biodataFilledCount} butir biodata
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 inline" /> Siap Lanjut
                      </span>
                    )}
                  </div>
                )}

                {/* Left Progress Indicator (if Step 2 or 3) */}
                {currentStep === 2 && (
                  <div className="text-[11px] sm:text-xs text-muted-foreground px-1 font-medium">
                    {laAnsweredCount < laQuestions.length ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Sisa {laQuestions.length - laAnsweredCount} butir
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 inline" /> Siap Lanjut
                      </span>
                    )}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="text-[11px] sm:text-xs text-muted-foreground px-1 font-medium">
                    {eiAnsweredCount < eiQuestions.length ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Sisa {eiQuestions.length - eiAnsweredCount} butir
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 inline" /> Lengkap
                      </span>
                    )}
                  </div>
                )}

                {/* Next / Submit Button */}
                {currentStep === 1 && (
                  <Button
                    onClick={handleNextFromBiodata}
                    disabled={!isBiodataValid || savingBiodata}
                    className={cn(
                      "h-10 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl gap-1.5 sm:gap-2 ml-auto shadow-lg transition-transform active:scale-95 shrink-0 cursor-pointer",
                      isBiodataValid && !savingBiodata
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                        : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                    )}
                  >
                    {savingBiodata ? (
                      <>
                        <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                        <span>Menyimpan Biodata...</span>
                      </>
                    ) : (
                      <>
                        <span>Lanjut ke Bagian 2 (LA)</span>
                        <ArrowRight className="size-3.5 sm:size-4" />
                      </>
                    )}
                  </Button>
                )}

                {currentStep === 2 && (
                  <Button
                    onClick={handleNextFromLa}
                    disabled={!isLaComplete}
                    className={cn(
                      "h-10 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl gap-1.5 sm:gap-2 ml-auto shadow-lg transition-transform active:scale-95 shrink-0 cursor-pointer",
                      isLaComplete
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                        : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                    )}
                  >
                    <span>Lanjut ke Bagian 3 (EI)</span>
                    <ArrowRight className="size-3.5 sm:size-4" />
                  </Button>
                )}

                {currentStep === 3 && (
                  <Button
                    onClick={handleSubmit}
                    disabled={!isEiComplete || submitting}
                    className={cn(
                      "h-10 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl gap-1.5 sm:gap-2 ml-auto shadow-lg transition-transform active:scale-95 shrink-0 cursor-pointer",
                      isEiComplete && !submitting
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                        <span>Menyimpan Jawaban...</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden xs:inline">Kirim & Selesaikan</span>
                        <span className="xs:hidden">Kirim</span>
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
