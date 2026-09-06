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
  const [checking, setChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.push("/login");
      return;
    }

    // Admins always bypass questionnaire
    if (user.role === "admin") {
      setIsAllowed(true);
      setChecking(false);
      return;
    }

    // Respondent check
    async function checkStatus() {
      try {
        const res = await fetch(`/api/questionnaire/status?userId=${user?.id}`);
        const data = await res.json();

        if (data.success && data.isCompleted) {
          setIsAllowed(true);
        } else {
          // If questionnaire is not completed, redirect to questionnaire page
          if (pathname !== "/questionnaire") {
            router.push("/questionnaire");
            return;
          }
          setIsAllowed(true);
        }
      } catch (err) {
        console.error("Error checking questionnaire guard status:", err);
        // Fallback: allow to avoid infinite blocking in case of temporary network glitches
        setIsAllowed(true);
      } finally {
        setChecking(false);
      }
    }

    checkStatus();
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
