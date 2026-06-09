"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ScrollText, DownloadCloud, Users, BarChart3, DollarSign, Activity } from "lucide-react";
import { toast } from "sonner";

type TransactionItem = {
  id: number;
  time: string;
  buyer: string;
  seller: string;
  stock: string;
  harga: number;
  jumlah: number;
  total: number;
  intervention: string;
  roundId: number;
};

type RoundInfo = {
  id: number;
  roundNumber: number;
  status: string;
};

export default function AdminResumePage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingOrderBook, setExportingOrderBook] = useState(false);
  const [data, setData] = useState({
    participantsCount: 0,
    totalTransactionsCount: 0,
    totalVolume: 0,
    avgTransactionValue: 0,
    transactions: [] as TransactionItem[],
  });



  // 1. Fetch admin resume stats whenever selected date changes
  useEffect(() => {
    if (!hydrated || !user) return;
    setLoading(true);
    const dateQuery = selectedDate ? `?date=${selectedDate}` : "";
    fetch(`/api/resume/admin${dateQuery}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData({
            participantsCount: resData.participantsCount,
            totalTransactionsCount: resData.totalTransactionsCount,
            totalVolume: resData.totalVolume,
            avgTransactionValue: resData.avgTransactionValue,
            transactions: resData.transactions,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading admin resume data:", err);
        setLoading(false);
      });
  }, [hydrated, user, selectedDate]);

  const handleDownloadExcel = async () => {
    try {
      setExporting(true);
      toast.info("Menyiapkan file Excel, mohon tunggu...");
      const dateQuery = selectedDate ? `?date=${selectedDate}` : "";
      const res = await fetch(`/api/admin/export-excel${dateQuery}`);
      
      if (!res.ok) {
        throw new Error("Gagal mengunduh data");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedDate ? `Laporan_Trading_${selectedDate}.xlsx` : `Laporan_Trading_All.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mengunduh data Excel!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor data");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadOrderBook = async () => {
    try {
      setExportingOrderBook(true);
      toast.info("Menyiapkan file Excel Order Book, mohon tunggu...");
      const dateQuery = selectedDate ? `?date=${selectedDate}` : "";
      const res = await fetch(`/api/admin/export-orderbook${dateQuery}`);
      
      if (!res.ok) {
        throw new Error("Gagal mengunduh data order book");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedDate ? `Laporan_OrderBook_${selectedDate}.xlsx` : `Laporan_OrderBook_All.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Berhasil mengunduh data Order Book Excel!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor data order book");
    } finally {
      setExportingOrderBook(false);
    }
  };

  if (!hydrated || !user) return null;

  if (loading && data.transactions.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Resume Admin</h1>
          <p className="text-sm text-muted-foreground">Ringkasan transaksi pasar dan aktivitas trading secara real-time</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Filter Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
            onClick={handleDownloadExcel}
            disabled={exporting || exportingOrderBook}
          >
            <DownloadCloud className="size-4" />
            {exporting ? "Mengekspor..." : "Download Excel"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500/20 text-blue-600 dark:text-blue-400 gap-2 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20"
            onClick={handleDownloadOrderBook}
            disabled={exporting || exportingOrderBook}
          >
            <DownloadCloud className="size-4" />
            {exportingOrderBook ? "Mengekspor..." : "Download Order Book"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card shadow-sm border-t-2 border-t-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all dark:shadow-none dark:border-t-border">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-500/10 p-2.5">
              <Users className="size-5 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Peserta</div>
              <div className="font-mono text-lg font-bold text-foreground">{data.participantsCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-sm border-t-2 border-t-blue-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all dark:shadow-none dark:border-t-border">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-100 dark:bg-blue-500/10 p-2.5">
              <BarChart3 className="size-5 text-blue-600 dark:text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Transaksi</div>
              <div className="font-mono text-lg font-bold text-foreground">{data.totalTransactionsCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-sm border-t-2 border-t-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all dark:shadow-none dark:border-t-border">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-500/10 p-2.5">
              <DollarSign className="size-5 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Volume</div>
              <div className="font-mono text-lg font-bold text-foreground">
                Rp {data.totalVolume.toLocaleString("id-ID")}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-sm border-t-2 border-t-violet-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all dark:shadow-none dark:border-t-border">
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="rounded-full bg-violet-100 dark:bg-violet-500/10 p-2.5">
              <Activity className="size-5 text-violet-600 dark:text-violet-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Rerata Nilai</div>
              <div className="font-mono text-lg font-bold text-foreground">
                Rp {data.avgTransactionValue.toLocaleString("id-ID")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Table */}
      <Card className="border-border bg-card shadow-sm border-t-2 border-t-indigo-500/50 hover:shadow-md transition-all dark:shadow-none dark:border-t-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <ScrollText className="size-4 text-emerald-600 dark:text-emerald-500" />
            Riwayat Transaksi Pasar (Real-time)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full bg-muted" />
              <Skeleton className="h-8 w-full bg-muted" />
              <Skeleton className="h-8 w-full bg-muted" />
            </div>
          ) : data.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScrollText className="size-8 mb-2 text-muted-foreground/50" />
              <p className="text-xs">Belum ada transaksi di pasar saat ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs text-muted-foreground w-[100px]">Waktu</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Pembeli</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Penjual</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-center">Saham</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right">Harga</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right">Lot</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-right">Total Nilai</TableHead>
                    <TableHead className="text-xs text-muted-foreground text-center">Intervensi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-border hover:bg-indigo-50/50 dark:hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{tx.time}</TableCell>
                      <TableCell className="text-xs text-foreground font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-500"></span>
                          {tx.buyer}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-rose-500"></span>
                          {tx.seller}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-bold text-center">
                        <span className="bg-muted px-2 py-0.5 rounded border border-border">
                          {tx.stock}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground text-right">
                        Rp {tx.harga.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground text-right font-semibold">
                        {tx.jumlah}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                        Rp {tx.total.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${
                            tx.intervention === "NONE"
                              ? "bg-muted text-muted-foreground border border-border"
                              : tx.intervention === "FLOOD"
                              ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                              : "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                          }`}
                        >
                          {tx.intervention}
                        </span>
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
