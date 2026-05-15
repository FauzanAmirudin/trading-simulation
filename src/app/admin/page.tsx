"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  Play,
  Square,
  Rocket,
  Activity,
  Users,
  Timer,
  Megaphone,
  Download,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

const TOTAL_SESSIONS = 6;

const MOCK_TX = [
  { id: 1, user: "R-01", saham: "BBCA", tipe: "BID", harga: 10200, jumlah: 5, waktu: "10:00:15" },
  { id: 2, user: "R-02", saham: "BBRI", tipe: "ASK", harga: 5700, jumlah: 3, waktu: "10:00:22" },
  { id: 3, user: "R-03", saham: "TLKM", tipe: "BID", harga: 4000, jumlah: 2, waktu: "10:01:05" },
  { id: 4, user: "R-04", saham: "BBCA", tipe: "ASK", harga: 10350, jumlah: 4, waktu: "10:01:30" },
  { id: 5, user: "R-05", saham: "BBRI", tipe: "BID", harga: 5600, jumlah: 1, waktu: "10:02:10" },
];

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessionStatus, setSessionStatus] = useState<string[]>(
    Array(TOTAL_SESSIONS).fill("pending")
  );
  const [newsText, setNewsText] = useState("");
  const [newsHistory, setNewsHistory] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) router.push("/login");
    else if (user.role !== "admin") router.push("/dashboard");
  }, [user, router]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [MOCK_TX]);

  if (!user || user.role !== "admin") return null;

  const toggleSession = (idx: number) => {
    const status = sessionStatus[idx];
    if (status === "pending" || status === "closed") {
      const next = [...sessionStatus];
      next[idx] = "active";
      setSessionStatus(next);
      toast.success(`Sesi ${idx + 1} dimulai`);
    } else if (status === "active") {
      const next = [...sessionStatus];
      next[idx] = "closed";
      setSessionStatus(next);
      toast.success(`Sesi ${idx + 1} dihentikan`);
    }
  };

  const sendNews = () => {
    if (!newsText.trim()) return;
    setNewsHistory((h) => [newsText.trim(), ...h]);
    toast.success("Berita terkirim ke semua responden");
    setNewsText("");
  };

  const exportData = () => {
    toast.success("Data eksperimen siap diunduh (CSV)");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <h1 className="text-sm font-medium text-zinc-300">Panel Admin</h1>
        <p className="text-xs text-zinc-600">Kontrol sesi, berita, dan monitoring</p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left + Center: Session + Monitor */}
        <div className="space-y-4 lg:col-span-2">
          {/* Session Controller */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Timer className="size-4 text-zinc-500" />
                <CardTitle className="text-sm">Kontrol Sesi</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Mulai / hentikan 6 putaran perdagangan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: TOTAL_SESSIONS }).map((_, i) => {
                  const status = sessionStatus[i];
                  const isActive = status === "active";
                  const isClosed = status === "closed";
                  return (
                    <Card key={i} size="sm" className="border-white/5 bg-zinc-800/50">
                      <CardHeader className="px-3 py-2">
                        <CardTitle className="text-xs">Putaran {i + 1}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive ? "bg-emerald-500 animate-pulse" : isClosed ? "bg-zinc-600" : "bg-zinc-600"
                            }`}
                          />
                          <span className="text-xs text-zinc-500">
                            {isActive ? "Aktif" : isClosed ? "Selesai" : "Menunggu"}
                          </span>
                        </div>
                        <Button
                          size="xs"
                          variant={isActive ? "destructive" : "default"}
                          className="w-full gap-1"
                          onClick={() => toggleSession(i)}
                        >
                          {isActive ? (
                            <><Square className="size-3" /> Stop</>
                          ) : (
                            <><Play className="size-3" /> Start</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Live Monitor */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-zinc-500" />
                <CardTitle className="text-sm">Monitor Transaksi</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Aktivitas transaksi responden secara langsung
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-xs text-zinc-500">User</TableHead>
                    <TableHead className="text-xs text-zinc-500">Saham</TableHead>
                    <TableHead className="text-xs text-zinc-500">Tipe</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Harga</TableHead>
                    <TableHead className="text-xs text-zinc-500 text-right">Lot</TableHead>
                    <TableHead className="text-xs text-zinc-500">Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TX.map((t) => (
                    <TableRow key={t.id} className="border-white/5">
                      <TableCell className="text-xs text-zinc-300">{t.user}</TableCell>
                      <TableCell className="text-xs font-medium text-zinc-200">{t.saham}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                            t.tipe === "BID"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-rose-500/10 text-rose-500"
                          }`}
                        >
                          {t.tipe}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-xs text-right text-zinc-400">
                        {t.harga.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-xs text-right text-zinc-400">
                        {t.jumlah}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">{t.waktu}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div ref={logEndRef} />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3">
          {/* News Broadcaster */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-zinc-500" />
                <CardTitle className="text-sm">News Broadcaster</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Ketik berita untuk intervensi sesi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                placeholder="Tulis berita / pengumuman..."
                value={newsText}
                onChange={(e) => setNewsText(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
                rows={3}
              />
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={sendNews}
                disabled={!newsText.trim()}
              >
                <Rocket className="size-3.5" />
                Publikasikan
              </Button>
            </CardContent>
          </Card>

          {/* News History + Stats */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status & Riwayat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Users className="size-3.5" /> Responden Terhubung
                </div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">0</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Activity className="size-3.5" /> Total Transaksi
                </div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">{MOCK_TX.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Timer className="size-3.5" /> Sesi Aktif
                </div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">
                  {sessionStatus.filter((s) => s === "active").length}
                </span>
              </div>

              <div className="pt-1">
                <div className="mb-1.5 text-xs text-zinc-600 font-medium">Riwayat Berita</div>
                {newsHistory.length === 0 ? (
                  <p className="text-xs text-zinc-600">Belum ada berita</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {newsHistory.map((n, i) => (
                      <div key={i} className="rounded border border-white/5 bg-zinc-800/30 p-2 text-xs text-zinc-400">
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ekspor Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportData}>
                <Download className="size-3.5" />
                Unduh CSV / Excel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
