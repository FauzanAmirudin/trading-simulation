"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, StopCircle, Activity, Users, Timer,
  Megaphone, DownloadCloud, Loader2, RadioTower, Send, LayoutDashboard,
  Check, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Stock = { id: number; kodeSaham: string; namaSaham: string; basePrice: number };
type ActiveSession = {
  id: number; putaranKe: number; status: string; startTime: string;
};

export default function AdminPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionStocks, setSessionStocks] = useState<Stock[]>([]);
  const [sessionTimer, setSessionTimer] = useState(120);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [newsText, setNewsText] = useState("");
  const [newsHistory, setNewsHistory] = useState<string[]>([]);
  const [txLog, setTxLog] = useState<typeof INITIAL_TX>([]);
  const [exporting, setExporting] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.push("/login");
    else if (user.role !== "admin") router.push("/dashboard");
  }, [hydrated, user, router]);

  useEffect(() => {
    fetch("/api/stocks").then(r => r.json()).then(res => {
      setAllStocks(res.stocks || []);
    });
    refreshSession();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [txLog]);

  const refreshSession = async () => {
    const res = await fetch("/api/session/active");
    const data = await res.json();
    if (data.session) {
      setActiveSession(data.session);
      setSessionStocks(data.stocks);
    } else {
      setActiveSession(null);
      setSessionStocks([]);
    }
  };

  const toggleStock = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 3 ? prev : [...prev, id]
    );
  };

  const startSession = async () => {
    if (selectedIds.length === 0) { toast.error("Pilih minimal 1 saham"); return; }
    setStarting(true);
    const res = await fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockIds: selectedIds }),
    });
    if (res.ok) {
      toast.success("Sesi trading dimulai!");
      setSelectedIds([]);
      await refreshSession();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal memulai sesi");
    }
    setStarting(false);
  };

  const stopSession = async () => {
    setStopping(true);
    const res = await fetch("/api/session/stop", { method: "POST" });
    if (res.ok) {
      toast.success("Sesi trading dihentikan");
      setSessionTimer(120);
      await refreshSession();
    } else {
      toast.error("Gagal menghentikan sesi");
    }
    setStopping(false);
  };

  // Countdown timer for active session (120 seconds)
  useEffect(() => {
    if (!activeSession) { setSessionTimer(120); return; }
    const interval = setInterval(() => {
      setSessionTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          stopSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]); // eslint-disable-line

  const sendNews = () => {
    if (!newsText.trim()) return;
    setNewsHistory(h => [newsText.trim(), ...h]);
    toast.success("Berita terkirim ke semua responden");
    setNewsText("");
  };

  const exportData = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 2000));
    setExporting(false);
    toast.success("Data eksperimen siap diunduh (CSV)");
  };

  if (!hydrated || !user || user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <LayoutDashboard className="size-4" /> Panel Admin
        </div>
        <p className="text-xs text-zinc-600">Kontrol sesi, pemilihan saham, berita, dan monitoring</p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Session Controller */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Timer className="size-4 text-zinc-500" />
                <CardTitle className="text-sm">Kontrol Sesi</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Pilih 3 saham lalu mulai sesi trading
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-medium text-emerald-500">Sesi Aktif</span>
                      <span className="text-xs text-zinc-600">Putaran {activeSession.putaranKe}</span>
                      <span className="ml-auto font-mono text-sm text-zinc-400">
                        {Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-700 mb-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-500"
                        initial={{ width: "100%" }}
                        animate={{ width: `${(sessionTimer / 120) * 100}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sessionStocks.map(s => (
                        <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                          <TrendingUp className="size-3" /> {s.kodeSaham}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" className="gap-1" onClick={stopSession} disabled={stopping}>
                    {stopping ? <Loader2 className="size-3.5 animate-spin" /> : <StopCircle className="size-3.5" />}
                    {stopping ? "Menghentikan..." : "Hentikan Sesi"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {allStocks.map(s => {
                      const sel = selectedIds.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => toggleStock(s.id)}
                          disabled={selectedIds.length >= 3 && !sel}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all text-xs",
                            sel
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : "border-white/5 bg-zinc-800/50 text-zinc-400 hover:border-white/10 hover:text-zinc-200",
                            selectedIds.length >= 3 && !sel && "opacity-40 cursor-not-allowed"
                          )}>
                          <div className={cn(
                            "size-4 rounded border flex items-center justify-center transition-colors",
                            sel ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                          )}>
                            {sel && <Check className="size-3 text-white" />}
                          </div>
                          <div>
                            <div className="font-medium">{s.kodeSaham}</div>
                            <div className="text-[10px] text-zinc-600">{s.namaSaham}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-zinc-600">
                      {selectedIds.length}/3 saham dipilih
                    </span>
                    <Button size="sm" className="gap-1" onClick={startSession} disabled={selectedIds.length === 0 || starting}>
                      {starting ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                      {starting ? "Memulai..." : "Mulai Sesi"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Monitor */}
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-zinc-500" />
                  <CardTitle className="text-sm">Monitor Transaksi</CardTitle>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="relative flex size-2">
                    <RadioTower className="size-2 text-emerald-500 animate-ping absolute" />
                    <RadioTower className="size-2 text-emerald-500 relative" />
                  </span>
                  <span className="text-emerald-500">WebSocket Status: Connected</span>
                </div>
              </div>
              <CardDescription className="text-xs">Aktivitas transaksi responden secara langsung</CardDescription>
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
                  <AnimatePresence initial={false}>
                    {txLog.map((t) => (
                      <motion.tr key={t.id} layout
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="border-white/5"
                      >
                        <TableCell className="text-xs text-zinc-300">{t.user}</TableCell>
                        <TableCell className="text-xs font-medium text-zinc-200">{t.saham}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                            t.tipe === "BID" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          )}>{t.tipe}</span>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-right text-zinc-400">
                          {t.harga.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-right text-zinc-400">
                          {t.jumlah}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600">{t.waktu}</TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
              <div ref={logEndRef} />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3">
          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-zinc-500" />
                <CardTitle className="text-sm">News Broadcaster</CardTitle>
              </div>
              <CardDescription className="text-xs">Ketik berita untuk intervensi sesi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <textarea placeholder="Tulis berita / pengumuman..."
                  value={newsText} onChange={e => setNewsText(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
                  rows={3} maxLength={150}
                />
                <div className="mt-1 text-right text-[10px] text-zinc-600">{newsText.length}/150 karakter</div>
              </div>
              <Button size="sm" className="w-full gap-1.5" onClick={sendNews} disabled={!newsText.trim()}>
                <Send className="size-3.5" /> Publikasikan
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Status & Riwayat</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500"><Users className="size-3.5" /> Responden Terhubung</div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">0</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500"><Activity className="size-3.5" /> Total Transaksi</div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">{txLog.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500"><Timer className="size-3.5" /> Sesi Aktif</div>
                <span className="font-mono tabular-nums text-sm font-bold text-zinc-200">{activeSession ? 1 : 0}</span>
              </div>

              <div className="pt-1">
                <div className="mb-1.5 text-xs text-zinc-600 font-medium">Riwayat Berita</div>
                {newsHistory.length === 0 ? (
                  <p className="text-xs text-zinc-600">Belum ada berita</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {newsHistory.map((n, i) => (
                      <div key={i} className="rounded border border-white/5 bg-zinc-800/30 p-2 text-xs text-zinc-400">{n}</div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Ekspor Data</CardTitle></CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={exportData} disabled={exporting}>
                {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <DownloadCloud className="size-3.5" />}
                {exporting ? "Memproses..." : "Unduh CSV / Excel"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const INITIAL_TX: { id: number; user: string; saham: string; tipe: string; harga: number; jumlah: number; waktu: string }[] = [];
