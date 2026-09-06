"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function LoginPage() {
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !password) {
      toast.error("Nama dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Login gagal");
        return;
      }
      login(data.user);
      toast.success("Login berhasil");
      router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      toast.error("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main className="relative flex flex-1 items-center justify-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(79,70,229,0.15)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(6,182,212,0.12)_0%,transparent_60%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm relative"
      >
        <Card className="border-indigo-100/60 dark:border-border bg-white/80 backdrop-blur-xl shadow-2xl dark:shadow-none dark:bg-slate-950/50">
          <CardHeader className="text-center bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-transparent rounded-t-xl">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <CardTitle className="text-base text-foreground">Akses Responden</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Masukkan kredensial Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Nama / NIM</label>
                <Input
                  placeholder="Masukkan nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  disabled={loading}
                  className="focus-visible:ring-primary bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="focus-visible:ring-primary bg-background/50"
                />
              </div>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {loading ? "Memverifikasi..." : "Masuk"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
      </main>
      <Footer />
    </div>
  );
}
