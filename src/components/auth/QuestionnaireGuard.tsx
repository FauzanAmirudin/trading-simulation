"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function QuestionnaireGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role === "admin") return false;
      }
    } catch {
      // ignore
    }
    return true;
  });

  const [isAllowed, setIsAllowed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role === "admin") return true;
      }
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    // Admins always bypass questionnaire instantly
    if (user.role === "admin") {
      setIsAllowed(true);
      setChecking(false);
      return;
    }

    let isMounted = true;

    async function checkStatus() {
      try {
        // 1. Check initial questionnaire (biodata + LA + EI)
        const res = await fetch(`/api/questionnaire/status?userId=${user?.id}`);
        const data = await res.json();

        if (!data.success || !data.isCompleted) {
          if (pathname !== "/questionnaire") {
            router.push("/questionnaire");
            return;
          }
          if (isMounted) {
            setIsAllowed(true);
            setChecking(false);
          }
          return;
        }

        // 2. Check evaluation questionnaire status (Periode 3 Sesi 4 selesai)
        const evalRes = await fetch(`/api/evaluation/status?userId=${user?.id}`);
        const evalData = await evalRes.json();

        if (evalData.success && evalData.isSimulationEnded && !evalData.isCompleted) {
          // Simulation ended but respondent hasn't filled evaluation: FORCE TO EVALUATION
          if (pathname !== "/questionnaire/evaluation") {
            router.push("/questionnaire/evaluation");
            return;
          }
        }

        if (isMounted) {
          setIsAllowed(true);
          setChecking(false);
        }
      } catch (err) {
        console.error("Error checking questionnaire guard status:", err);
        if (isMounted) {
          setIsAllowed(true);
          setChecking(false);
        }
      }
    }

    checkStatus();

    // 3. Listen for real-time simulation completion (Periode 3 Sesi 4 ends)
    const socket = getSocket();

    const handleKickToEvaluation = () => {
      toast.info(
        "Sesi simulasi perdagangan saham telah selesai! Mengalihkan ke evaluasi akhir...",
        { duration: 4000 }
      );
      if (pathname !== "/questionnaire/evaluation") {
        router.push("/questionnaire/evaluation");
      }
    };

    const handleSimulationFinished = () => {
      handleKickToEvaluation();
    };

    const handleSessionCompleted = (data: {
      periodNumber: number;
      sessionIdx?: number;
      sessionNumber?: number;
    }) => {
      if (data.periodNumber === 3 && (data.sessionIdx === 3 || data.sessionNumber === 4)) {
        handleKickToEvaluation();
      }
    };

    socket.on("simulation-finished", handleSimulationFinished);
    socket.on("session-completed", handleSessionCompleted);

    return () => {
      isMounted = false;
      socket.off("simulation-finished", handleSimulationFinished);
      socket.off("session-completed", handleSessionCompleted);
    };
  }, [hydrated, user, pathname, router]);

  if (!hydrated || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2.5 text-muted-foreground text-xs">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span>Memverifikasi status akses responden...</span>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
