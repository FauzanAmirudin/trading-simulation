"use client";

import { useState, useEffect } from "react";
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
  Send,
  Activity,
  Users,
  Timer,
  Megaphone,
  Database,
} from "lucide-react";
import { toast } from "sonner";

const TOTAL_SESSIONS = 6;

const MOCK_TRANSACTIONS = [
  { id: 1, user: "A-01", saham: "BBCA", tipe: "BID", harga: 10200, jumlah: 5, waktu: "10:00:15" },
  { id: 2, user: "A-02", saham: "BBRI", tipe: "ASK", harga: 5700, jumlah: 3, waktu: "10:00:22" },
  { id: 3, user: "A-03", saham: "TLKM", tipe: "BID", harga: 4000, jumlah: 2, waktu: "10:01:05" },
];

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string[]>(
    Array(TOTAL_SESSIONS).fill("pending")
  );
  const [newsText, setNewsText] = useState("");
  const [newsHistory, setNewsHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!user) router.push("/login");
    else if (user.role !== "admin") router.push("/dashboard");
  }, [user, router]);

  if (!user || user.role !== "admin") return null;

  const toggleSession = (idx: number) => {
    const status = sessionStatus[idx];
    if (status === "pending" || status === "closed") {
      const next = [...sessionStatus];
      next[idx] = "active";
      setSessionStatus(next);
      setActiveSession(idx);
      toast.success(`Sesi ${idx + 1} dimulai`);
    } else if (status === "active") {
      const next = [...sessionStatus];
      next[idx] = "closed";
      setSessionStatus(next);
      setActiveSession(null);
      toast.success(`Sesi ${idx + 1} dihentikan`);
    }
  };

  const sendNews = () => {
    if (!newsText.trim()) return;
    setNewsHistory((h) => [newsText.trim(), ...h]);
    toast.success("Berita terkirim ke semua responden");
    setNewsText("");
  };

  const sessions = [
    { icon: Play, label: "Putaran 1" },
    { icon: Play, label: "Putaran 2" },
    { icon: Play, label: "Putaran 3" },
    { icon: Play, label: "Putaran 4" },
    { icon: Play, label: "Putaran 5" },
    { icon: Play, label: "Putaran 6" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold tracking-tight">
          Panel Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Kontrol sesi perdagangan, kirim berita, dan pantau aktivitas
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Session Controller */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Timer className="size-5 text-muted-foreground" />
                <CardTitle>Kontrol Sesi</CardTitle>
              </div>
              <CardDescription>
                Mulai / hentikan 6 putaran sesi perdagangan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((s, i) => {
                  const status = sessionStatus[i];
                  const isActive = status === "active";
                  const isClosed = status === "closed";
                  return (
                    <Card key={i} size="sm">
                      <CardHeader>
                        <CardTitle>{s.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                              isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                                : isClosed
                                  ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                isActive
                                  ? "bg-emerald-500 animate-pulse"
                                  : isClosed
                                    ? "bg-gray-400"
                                    : "bg-blue-500"
                              }`}
                            />
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={isActive ? "destructive" : "default"}
                          className="w-full gap-1"
                          onClick={() => toggleSession(i)}
                        >
                          {isActive ? (
                            <>
                              <Square className="size-3" /> Hentikan
                            </>
                          ) : (
                            <>
                              <Play className="size-3" /> Mulai
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Data Monitor */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-muted-foreground" />
                <CardTitle>Monitor Transaksi</CardTitle>
              </div>
              <CardDescription>
                Data transaksi responden secara langsung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Saham</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TRANSACTIONS.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.user}</TableCell>
                      <TableCell className="font-medium">{t.saham}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            t.tipe === "BID"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                          }`}
                        >
                          {t.tipe}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">
                        Rp {t.harga.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell>{t.jumlah}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.waktu}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* News Trigger */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-muted-foreground" />
                <CardTitle>News Trigger</CardTitle>
              </div>
              <CardDescription>
                Kirim berita / running text ke responden
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Tulis berita..."
                value={newsText}
                onChange={(e) => setNewsText(e.target.value)}
              />
              <Button
                className="w-full gap-2"
                onClick={sendNews}
                disabled={!newsText.trim()}
              >
                <Send className="size-4" />
                Kirim Berita
              </Button>
            </CardContent>
          </Card>

          {/* News History */}
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Berita</CardTitle>
            </CardHeader>
            <CardContent>
              {newsHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada berita terkirim
                </p>
              ) : (
                <div className="space-y-2">
                  {newsHistory.map((n, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-muted/30 p-2 text-sm"
                    >
                      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Megaphone className="size-3" />
                        Terkirim
                      </div>
                      {n}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Statistik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  Responden Aktif
                </div>
                <span className="font-bold">0</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="size-4 text-muted-foreground" />
                  Total Transaksi
                </div>
                <span className="font-bold">{MOCK_TRANSACTIONS.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="size-4 text-muted-foreground" />
                  Sesi Aktif
                </div>
                <span className="font-bold">
                  {sessionStatus.filter((s) => s === "active").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
