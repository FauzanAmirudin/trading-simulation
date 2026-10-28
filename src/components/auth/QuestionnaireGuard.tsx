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
        if (u?.id && sessionStorage.getItem(`simulasi_qs_done_${u.id}`) === "true") {
          return false;
        }
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
        if (u?.id && sessionStorage.getItem(`simulasi_qs_done_${u.id}`) === "true") {
          return true;
        }
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
        if (!user?.id) {
          if (isMounted) {
            setIsAllowed(true);
            setChecking(false);
          }
          return;
        }

        // 1. Check initial questionnaire (biodata + LA + EI) with cache-busting
        const res = await fetch(`/api/questionnaire/status?userId=${encodeURIComponent(user.id)}&_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            Accept: "application/json",
          },
        });

        const isJson = res.headers.get("content-type")?.includes("application/json");

        if (!res.ok || !isJson) {
          console.warn(
            `[QuestionnaireGuard] Status check returned HTTP ${res.status} (${res.headers.get("content-type") || "unknown"}). Handling gracefully.`
          );

          // If server returned non-200 or non-JSON (e.g. 404 or temporary error),
          // verify if local session was already completed
          const wasCompleted =
            typeof window !== "undefined" &&
            sessionStorage.getItem(`simulasi_qs_done_${user.id}`) === "true";

          if (!wasCompleted && pathname !== "/questionnaire") {
            router.push("/questionnaire");
            return;
          }

          if (isMounted) {
            setIsAllowed(true);
            setChecking(false);
          }
          return;
        }

        const data = await res.json();

        if (data.success && data.isCompleted) {
          try {
            sessionStorage.setItem(`simulasi_qs_done_${user.id}`, "true");
          } catch {}
        } else {
          // If server says not completed, verify if local session was just completed
          const wasRecentlyCompleted =
            typeof window !== "undefined" &&
            sessionStorage.getItem(`simulasi_qs_done_${user.id}`) === "true";

          if (!wasRecentlyCompleted) {
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
        }

        // 2. Check evaluation questionnaire status (Periode 3 Sesi 4 selesai)
        const evalRes = await fetch(`/api/evaluation/status?userId=${encodeURIComponent(user.id)}&_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            Accept: "application/json",
          },
        });

        const isEvalJson = evalRes.headers.get("content-type")?.includes("application/json");

        if (evalRes.ok && isEvalJson) {
          const evalData = await evalRes.json();

          if (evalData.success && evalData.isCompleted) {
            try {
              sessionStorage.setItem(`simulasi_eval_done_${user.id}`, "true");
            } catch {}
          } else {
            const evalDoneLocally =
              typeof window !== "undefined" &&
              sessionStorage.getItem(`simulasi_eval_done_${user.id}`) === "true";

            if (evalData.success && evalData.isSimulationEnded && !evalData.isCompleted && !evalDoneLocally) {
              // Simulation ended but respondent hasn't filled evaluation: FORCE TO EVALUATION
              if (pathname !== "/questionnaire/evaluation") {
                router.push("/questionnaire/evaluation");
                return;
              }
            }
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
      const evalDone =
        typeof window !== "undefined" &&
        sessionStorage.getItem(`simulasi_eval_done_${user?.id}`) === "true";
      if (evalDone) return;

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
