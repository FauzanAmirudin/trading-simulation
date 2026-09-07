"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function QuestionnaireGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Optimistic initial evaluation to eliminate delay when returning to dashboard
  const [checking, setChecking] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role === "admin") return false;
        const cachedQs = sessionStorage.getItem(`simulasi_qs_done_${u?.id}`);
        if (cachedQs === "true") return false;
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
        const cachedQs = sessionStorage.getItem(`simulasi_qs_done_${u?.id}`);
        if (cachedQs === "true") return true;
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

    // Check fast session cache first
    try {
      const cached = sessionStorage.getItem(`simulasi_qs_done_${user.id}`);
      if (cached === "true") {
        setIsAllowed(true);
        setChecking(false);
        return;
      }
    } catch {
      // ignore
    }

    let isMounted = true;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/questionnaire/status?userId=${user?.id}`);
        const data = await res.json();

        if (data.success && data.isCompleted) {
          try {
            sessionStorage.setItem(`simulasi_qs_done_${user?.id}`, "true");
          } catch {
            // ignore
          }
          if (isMounted) {
            setIsAllowed(true);
            setChecking(false);
          }
        } else {
          // If questionnaire is not completed, redirect to questionnaire page
          if (pathname !== "/questionnaire") {
            router.push("/questionnaire");
            return;
          }
          if (isMounted) {
            setIsAllowed(true);
            setChecking(false);
          }
        }
      } catch (err) {
        console.error("Error checking questionnaire guard status:", err);
        // Fallback: allow to avoid infinite blocking in case of network glitch
        if (isMounted) {
          setIsAllowed(true);
          setChecking(false);
        }
      }
    }

    checkStatus();

    return () => {
      isMounted = false;
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

