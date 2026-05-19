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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="border-white/5 bg-zinc-900">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-emerald-500/10">
              <ShieldCheck className="size-5 text-emerald-500" />
            </div>
            <CardTitle className="text-base">Akses Responden</CardTitle>
            <CardDescription className="text-xs">Masukkan kredensial Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Nama / NIM</label>
                <Input
                  placeholder="Masukkan nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  disabled={loading}
                  className="focus-visible:ring-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Password</label>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="focus-visible:ring-emerald-500"
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
    </div>
  );
}
