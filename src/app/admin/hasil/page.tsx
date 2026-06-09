"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Trophy, DownloadCloud, Users, DollarSign, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type HasilRow = {
  rank: number;
  userId: number;
  nama: string;
  kas: number;
  nilaiPortofolio: number;
  totalKekayaan: number;
  initialCapital: number;
  pnlAmount: number;
  pnlPercent: number;
  jumlahTransaksi: number;
};

type HasilData = {
  top5: HasilRow[];
  all: HasilRow[];
  lastUpdated: string;
};

export default function AdminHasilPage() {
  const { user, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<HasilData | null>(null);

  const fetchHasil = () => {
    setLoading(true);
    fetch(`/api/admin/hasil`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData(resData);
        } else {
          toast.error(resData.error);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading admin hasil:", err);
        setLoading(false);
        toast.error("Gagal mengambil data ranking.");
      });
  };

  useEffect(() => {
    if (!hydrated || !user) return;
    fetchHasil();
  }, [hydrated, user]);

  const handleDownloadExcel = async () => {
    try {
      setExporting(true);
      toast.info("Menyiapkan file Excel, mohon tunggu...");
      const res = await fetch(`/api/admin/export-hasil`);
      
      if (!res.ok) {
        throw new Error("Gagal mengunduh data");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `Ranking_Kekayaan_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mengunduh Ranking Kekayaan!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor data");
    } finally {
      setExporting(false);
    }
  };

  if (!hydrated || !user) return null;

  const totalRespondents = data?.all.length || 0;
  const avgKekayaan = totalRespondents > 0 ? (data?.all.reduce((acc, curr) => acc + curr.totalKekayaan, 0) || 0) / totalRespondents : 0;
  const totalKekayaanSeluruh = data?.all.reduce((acc, curr) => acc + curr.totalKekayaan, 0) || 0;
  const avgPnlPercent = totalRespondents > 0 ? (data?.all.reduce((acc, curr) => acc + curr.pnlPercent, 0) || 0) / totalRespondents : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" /> Ranking Kekayaan Responden
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Peringkat kekayaan bersih (NAV) real-time berdasarkan harga saham terakhir
            {data && <span className="ml-2 font-mono text-[10px] bg-muted px-2 py-0.5 rounded-full border border-border">Update: {new Date(data.lastUpdated).toLocaleTimeString('id-ID')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-foreground"
            onClick={fetchHasil}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            onClick={handleDownloadExcel}
            disabled={exporting || loading}
          >
            <DownloadCloud className="size-4" />
            {exporting ? "Mengekspor..." : "Export Excel"}
          </Button>
        </div>
      </div>



      {/* Top 5 Podium */}
      {data && data.top5.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
            <Trophy className="size-4 text-amber-500" /> Top 5 Leaderboard
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {data.top5.map((user, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;
              
              let badgeColor = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
              if (isFirst) badgeColor = "bg-amber-100 text-amber-700 border-amber-300 shadow-amber-500/20 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-400";
              else if (isSecond) badgeColor = "bg-slate-200 text-slate-700 border-slate-300 shadow-slate-500/20 dark:bg-slate-500/20 dark:border-slate-500/30 dark:text-slate-300";
              else if (isThird) badgeColor = "bg-orange-100 text-orange-800 border-orange-300 shadow-orange-500/20 dark:bg-orange-500/20 dark:border-orange-500/30 dark:text-orange-400";

              return (
                <Card key={user.userId} className={cn("relative overflow-hidden border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md", isFirst && "ring-1 ring-amber-500/50 md:-translate-y-2 md:hover:-translate-y-3", isSecond && "md:-translate-y-1 md:hover:-translate-y-2")}>
                  {isFirst && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />}
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className={cn("flex size-10 items-center justify-center rounded-full border mb-3 font-bold text-lg shadow-sm", badgeColor)}>
                      {idx + 1}
                    </div>
                    <h3 className="font-semibold text-foreground truncate w-full" title={user.nama}>{user.nama}</h3>
                    <div className="mt-4 space-y-1 w-full">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Total Kekayaan</div>
                      <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">Rp {(user.totalKekayaan / 1000000).toFixed(2)}M</div>
                    </div>
                    <div className="mt-3 w-full bg-muted rounded p-2 border border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground font-medium">P&L:</span>
                        <span className={cn("text-xs font-mono font-bold", user.pnlPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {user.pnlPercent > 0 ? '+' : ''}{user.pnlPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Table */}
      <Card className="border-border bg-card shadow-sm dark:shadow-none">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Users className="size-4 text-emerald-600 dark:text-emerald-500" />
            Detail Peringkat Seluruh Responden
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full bg-muted" />
              <Skeleton className="h-10 w-full bg-muted" />
              <Skeleton className="h-10 w-full bg-muted" />
            </div>
          ) : !data || data.all.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="size-8 mb-2 text-muted-foreground/50" />
              <p className="text-xs">Belum ada data responden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead className="text-xs text-muted-foreground w-[80px] text-center font-bold">Rank</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-bold">Nama Responden</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right font-bold">Sisa Kas</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right font-bold">Nilai Portofolio</TableHead>
                    <TableHead className="text-xs text-foreground text-right font-bold bg-muted">Total NAV</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right font-bold">P&L (Rp)</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right font-bold">P&L (%)</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-center font-bold">Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.all.map((user) => (
                    <TableRow key={user.userId} className="border-border hover:bg-muted/50 transition-colors">
                      <TableCell className="text-center">
                        <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold", 
                          user.rank === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                          user.rank === 2 ? "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" :
                          user.rank === 3 ? "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {user.rank}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-foreground font-medium">{user.nama}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground text-right">
                        Rp {user.kas.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground text-right">
                        Rp {user.nilaiPortofolio.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-emerald-600 dark:text-emerald-400 text-right font-bold bg-muted/30">
                        Rp {user.totalKekayaan.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className={cn("font-mono text-xs text-right font-medium", user.pnlAmount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        {user.pnlAmount > 0 ? '+' : ''}Rp {user.pnlAmount.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className={cn("font-mono text-xs text-right font-bold", user.pnlPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        {user.pnlPercent > 0 ? '+' : ''}{user.pnlPercent.toFixed(2)}%
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground text-center">
                        {user.jumlahTransaksi}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
