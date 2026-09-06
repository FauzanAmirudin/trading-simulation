"use client";

import { Suspense, useState, useEffect, useRef, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Timer, ArrowDownToLine, ArrowUpFromLine,
  DollarSign, ArrowLeft, Building2, Zap, AlertTriangle, TrendingDown as TrendingDownIcon,
  CheckCircle2, Edit3, SkipForward, Sparkles, X, ChevronRight, ChevronLeft, Info, ShieldCheck,
  PauseCircle, Minus, Plus, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { InterventionType, SubSessionPhase, getPhaseLabel, getInterventionLabel } from "@/lib/experimental-matrix";
import { PriceInput, TickSizeBadge } from "@/components/ui/price-input";
import { getAutoRejectionLimits, isValidTickSize, getTickSize, snapToTickSize } from "@/lib/market-rules";
import RunningText from "@/components/trading/RunningText";

type Stock = {
  id: number;
  kodeSaham: string;
  namaSaham: string;
  basePrice: number | string;
};
type Order = { id: number; userId: number; harga: number; jumlah: number };
type PricePoint = { time: string; price: number };

const stockMeta: Record<string, { sektor: string; deskripsi: string }> = {
  BBCA: { sektor: "Perbankan", deskripsi: "Bank swasta terbesar di Indonesia dengan fundamental kuat dan jaringan luas." },
  BBRI: { sektor: "Perbankan", deskripsi: "Bank pelat merah terbesar, fokus utama pada segmen UMKM." },
  BMRI: { sektor: "Perbankan", deskripsi: "Bank BUMN dengan jangkauan korporasi dan ritel nasional." },
  BBNI: { sektor: "Perbankan", deskripsi: "Bank BUMN tertua dengan layanan wholesale dan ritel." },
  BRIS: { sektor: "Perbankan", deskripsi: "Bank syariah terbesar di Indonesia dengan pertumbuhan pesat." },
  UNVR: { sektor: "Consumer Goods", deskripsi: "Produsen produk kebutuhan sehari-hari yang melekat di masyarakat." },
  ICBP: { sektor: "Consumer Goods", deskripsi: "Induk usaha makanan dan minuman olahan bermerek terkemuka." },
  INDF: { sektor: "Consumer Goods", deskripsi: "Konglomerasi pangan terintegrasi dari hulu ke hilir." },
  KLBF: { sektor: "Farmasi", deskripsi: "Produsen obat-obatan, suplemen, dan produk kesehatan terbesar." },
  MYOR: { sektor: "Consumer Goods", deskripsi: "Produsen biskuit, permen, kopi, dan makanan ringan." },
  TLKM: { sektor: "Telekomunikasi", deskripsi: "Operator telekomunikasi dan infrastruktur digital terbesar." },
  EXCL: { sektor: "Telekomunikasi", deskripsi: "Operator seluler dengan fokus layanan data broadband." },
  ISAT: { sektor: "Telekomunikasi", deskripsi: "Operator telekomunikasi digital terintegrasi." },
  JSMR: { sektor: "Infrastruktur", deskripsi: "Pengelola dan operator jalan tol terpanjang di Indonesia." },
  ADRO: { sektor: "Energi", deskripsi: "Perusahaan tambang batu bara dan energi terkemuka." },
  PTBA: { sektor: "Energi", deskripsi: "BUMN tambang batu bara dengan produksi skala besar." },
  ITMG: { sektor: "Energi", deskripsi: "Produsen dan eksportir batu bara termal global." },
  ANTM: { sektor: "Pertambangan", deskripsi: "BUMN pertambangan multikomoditas (nikel, emas, bauksit)." },
  MDKA: { sektor: "Pertambangan", deskripsi: "Perusahaan tambang emas dan mineral tembaga." },
  PGAS: { sektor: "Energi", deskripsi: "BUMN distribusi dan transmisi gas bumi nasional." },
  MEDC: { sektor: "Energi", deskripsi: "Perusahaan minyak dan gas bumi terintegrasi." },
  ASII: { sektor: "Otomotif", deskripsi: "Konglomerasi otomotif, alat berat, dan jasa keuangan." },
  UNTR: { sektor: "Otomotif", deskripsi: "Distributor alat berat dan kontraktor pertambangan." },
  CTRA: { sektor: "Properti", deskripsi: "Pengembang properti residensial dan komersial." },
  PWON: { sektor: "Properti", deskripsi: "Pengembang kawasan terpadu dan pusat perbelanjaan." },
  BSDE: { sektor: "Properti", deskripsi: "Pengembang kawasan kota mandiri berskala besar." },
  SMGR: { sektor: "Infrastruktur", deskripsi: "BUMN produsen semen terbesar di Indonesia." },
  INTP: { sektor: "Infrastruktur", deskripsi: "Produsen semen dengan kapasitas produksi nasional." },
  ACES: { sektor: "Ritel", deskripsi: "Peritel perlengkapan rumah, furnitur, dan gaya hidup." },
  MAPI: { sektor: "Ritel", deskripsi: "Peritel fashion dan gaya hidup dengan banyak merek global." },
  GOTO: { sektor: "Teknologi", deskripsi: "Platform digital dan ekosistem on-demand terbesar." },
  BIRD: { sektor: "Transportasi", deskripsi: "Perusahaan taksi dan mobilitas darat terkemuka." },
  ASSA: { sektor: "Transportasi", deskripsi: "Penyedia jasa logistik, rental, dan transportasi." },
  SIDO: { sektor: "Farmasi", deskripsi: "Produsen jamu dan obat tradisional modern." },
  KAEF: { sektor: "Farmasi", deskripsi: "BUMN farmasi dengan produk obat dan alat kesehatan." },
  SMBR: { sektor: "Infrastruktur", deskripsi: "Produsen semen untuk pasar regional Sumatra." },
};

const sektorWarna: Record<string, string> = {
  Perbankan: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
  "Consumer Goods": "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
  Farmasi: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
  Telekomunikasi: "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20",
  Infrastruktur: "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
  Energi: "bg-yellow-100 dark:bg-yellow-600/10 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-600/20",
  Pertambangan: "bg-stone-100 dark:bg-stone-500/10 text-stone-700 dark:text-stone-400 border-stone-200 dark:border-stone-500/20",
  Otomotif: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
  Properti: "bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20",
  Ritel: "bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-500/20",
  Teknologi: "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
  Transportasi: "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20",
};

function getMeta(kode: string) {
  return stockMeta[kode] ?? { sektor: "Lainnya", deskripsi: "Saham perusahaan terkemuka di bidangnya." };
}

// Optimasi 7: React.memo mencegah render ulang setiap timer tick & dukungan mode kompak untuk single-screen
const PriceChart = memo(function PriceChart({ data, isUp, compact = false }: { data: PricePoint[]; isUp: boolean; compact?: boolean }) {
  const w = 600, h = compact ? 120 : 220;
  const pad = compact 
    ? { top: 8, right: 12, bottom: 16, left: 58 } 
    : { top: 16, right: 16, bottom: 28, left: 72 };

  let chartData = data;
  if (data.length === 1 && !isNaN(data[0].price)) {
    chartData = [
      { time: "Pra-Buka", price: data[0].price },
      { time: "Mulai Sesi", price: data[0].price }
    ];
  }

  if (chartData.length < 2 || chartData.some(d => isNaN(d.price))) {
    return <div className={cn("flex items-center justify-center text-muted-foreground text-xs", compact ? "h-20" : "h-56")}>Memuat data...</div>;
  }

  const prices = chartData.map(d => d.price);
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const min = Math.min(dataMin - 10, dataMin * 0.995);
  const max = Math.max(dataMax + 10, dataMax * 1.005);
  const range = max - min || 1;
  const xS = (i: number) => pad.left + (i / (chartData.length - 1)) * (w - pad.left - pad.right);
  const yS = (v: number) => pad.top + ((max - v) / range) * (h - pad.top - pad.bottom);
  const pathD = chartData.map((d, i) => `${i === 0 ? "M" : "L"} ${xS(i)} ${yS(d.price)}`).join(" ");
  const areaD = `${pathD} L ${xS(chartData.length - 1)} ${yS(min)} L ${xS(0)} ${yS(min)} Z`;
  const color = isUp ? "#10b981" : "#ef4444";
  
  const tickCount = compact ? 2 : 4;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) yTicks.push(min + (range * i) / tickCount);
  
  const xInt = Math.max(1, Math.floor(chartData.length / (compact ? 4 : 6)));
  const xLab = chartData.filter((_, i) => i % xInt === 0 || i === chartData.length - 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.25} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient></defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} y1={yS(v)} x2={w - pad.right} y2={yS(v)} stroke="#27272a" strokeWidth={1} />
          <text x={pad.left - 6} y={yS(v) + 3} textAnchor="end" fill="#71717a" fontSize={compact ? 8.5 : 10}>
            {v.toLocaleString("id-ID")}
          </text>
        </g>
      ))}
      <path d={areaD} fill="url(#cg)" style={{ transition: "all 0.5s ease-in-out" }} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={compact ? 1.8 : 2} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.5s ease-in-out" }} />
      {/* Live Pulsing Price Indicator Dot */}
      <g>
        <circle cx={xS(chartData.length - 1)} cy={yS(chartData[chartData.length - 1].price)} r={compact ? 3.5 : 4} fill={color} style={{ transition: "all 0.5s ease-in-out" }} />
        <circle cx={xS(chartData.length - 1)} cy={yS(chartData[chartData.length - 1].price)} r={compact ? 8 : 10} fill={color} opacity={0.4} className="animate-ping" style={{ transition: "all 0.5s ease-in-out" }} />
      </g>
      {xLab.map((d, i) => (
        <text key={i} x={xS(chartData.indexOf(d))} y={h - (compact ? 3 : 6)} textAnchor="middle" fill="#71717a" fontSize={compact ? 8.5 : 10}>
          {d.time}
        </text>
      ))}
    </svg>
  );
// Optimasi 7: penutup memo
});

function TradingPageFallback() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48 bg-muted" />
      <div className="flex gap-4"><Skeleton className="h-96 w-full bg-muted" /></div>
    </div>
  );
}

export default function TradingPageWrapper() {
  return (
    <Suspense fallback={<TradingPageFallback />}>
      <TradingPageContent />
    </Suspense>
  );
}

function TradingPageContent() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stockParam = searchParams.get("stock");

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);
  const [orderType, setOrderType] = useState<"BID" | "ASK">("BID");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderLot, setOrderLot] = useState("");
  const [balance, setBalance] = useState(100_000_000);
  const [portfolio, setPortfolio] = useState<{ lot: number } | null>(null);
  const [sessionTimer, setSessionTimer] = useState(120);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Optimasi 4: Ref untuk client-side countdown agar tidak perlu server tick setiap detik
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  // Real-time portfolios map (stockId -> lot) and last prices (stockId -> lastPrice)
  const [portfoliosMap, setPortfoliosMap] = useState<Record<number, number>>({});
  const [basePricesMap, setBasePricesMap] = useState<Record<number, number>>({});
  const [lastPrices, setLastPrices] = useState<Record<number, number>>({});
  // Initialize lastPrices when stocks list updates

  // Initialize lastPrices when stocks list updates
  useEffect(() => {
    if (stocks.length > 0) {
      setLastPrices(prev => {
        const newPrices = { ...prev };
        stocks.forEach(s => {
          if (newPrices[s.id] === undefined) {
            newPrices[s.id] = Number(s.basePrice) || 1000;
          }
        });
        return newPrices;
      });
    }
  }, [stocks]);

  // New experimental state
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [period, setPeriod] = useState<number | null>(null);
  const [subSession, setSubSession] = useState<number | null>(null);
  const [phase, setPhase] = useState<SubSessionPhase>("IDLE");
  const [openingPrices, setOpeningPrices] = useState<Record<number, number>>({});
  const [activeIntervention, setActiveIntervention] = useState<InterventionType>("NONE");
  const [predictionInput, setPredictionInput] = useState<Record<number, string>>({});
  const [showPredictionUI, setShowPredictionUI] = useState(false);
  const [interventionContent, setInterventionContent] = useState<{ title: string; content: string } | null>(null);
  
  // Step-by-step prediction modal state
  const [predictionsSubmitted, setPredictionsSubmitted] = useState<Record<number, number>>({});
  const [ordersPlacedMap, setOrdersPlacedMap] = useState<Record<number, boolean>>({});
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [mobileTradingModalTab, setMobileTradingModalTab] = useState<"order" | "market">("order");
  const [activeModalStockId, setActiveModalStockId] = useState<number | null>(null);
  const [skippedStockIds, setSkippedStockIds] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const [runningText, setRunningText] = useState<{ active: boolean; type: InterventionType; title: string; content: string }>({
    active: false, type: "NONE", title: "", content: "",
  });
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownReason, setCooldownReason] = useState<string>("");

  const selectedIdRef = useRef<number | null>(null);
  const openingPricesRef = useRef<Record<number, number>>({});
  const lastPricesRef = useRef<Record<number, number>>({});

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { openingPricesRef.current = openingPrices; }, [openingPrices]);
  useEffect(() => { lastPricesRef.current = lastPrices; }, [lastPrices]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push("/login"); return; }
    setLoading(false);
  }, [user, router]); 

  useEffect(() => {
    if (!user || !hydrated) return;
    const socket = getSocket();

    const onConnect = () => {
      socket.emit("authenticate", { userId: user.id });
      socket.emit("get-portfolio", { userId: user.id });
    };
    if (socket.connected) onConnect(); else socket.on("connect", onConnect);

    const onAuthSuccess = (data: { user: { saldo: number } }) => { setBalance(data.user.saldo); };
    const onRoundStarted = (data: { roundNumber: number; period: number; stocks: Stock[] }) => {
      setRoundNumber(data.roundNumber);
      setPeriod(data.period);
      setSessionActive(true);
      setStocks(data.stocks);
      setStock(null);
      setSelectedId(null);
      setPredictionsSubmitted({});
      setOrdersPlacedMap({});
      setSkippedStockIds([]);
      setIsPaused(false);
      setIsPredictionModalOpen(false);
      setIsOrderModalOpen(false);
      if (data.stocks.length > 0) setActiveModalStockId(data.stocks[0].id);
    };
    const onSubSessionStarted = (data: {
      roundNumber: number;
      sessionNumber: number;
      phase: SubSessionPhase;
      duration: number;
      intervention: InterventionType;
    }) => {
      setSubSession(data.sessionNumber);
      setPhase(data.phase);
      setSessionTimer(data.duration);
      setActiveIntervention(data.intervention);
      setCooldownActive(false);
      setIsPaused(false);
      setStock(null);
      setSelectedId(null);
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      if (data.phase === "PRE_MARKET") {
        setShowPredictionUI(true);
        setIsPredictionModalOpen(false);
        setIsOrderModalOpen(false);
      } else if (data.phase === "TRADING") {
        setShowPredictionUI(false);
        setIsPredictionModalOpen(false);
        setIsOrderModalOpen(false);
        setOrdersPlacedMap({});
      } else {
        setShowPredictionUI(false);
        setIsPredictionModalOpen(false);
        setIsOrderModalOpen(false);
      }
    };
    const onTimerTick = (data: { timeLeft: number }) => { setSessionTimer(data.timeLeft); };
    const onExperimentPaused = (data?: { timeLeft?: number }) => {
      setIsPaused(true);
      if (data?.timeLeft !== undefined) setSessionTimer(data.timeLeft);
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      toast.info("Sesi perdagangan ditangguhkan sementara oleh Admin.");
    };
    const onExperimentResumed = (data?: { timeLeft?: number }) => {
      setIsPaused(false);
      if (data?.timeLeft !== undefined) setSessionTimer(data.timeLeft);
      toast.success("Sesi perdagangan dilanjutkan kembali.");
    };
    const onRoundEnded = () => {
      setSessionActive(false);
      setRoundNumber(null);
      setPhase("IDLE");
      setSubSession(null);
      setStocks([]);
      setStock(null);
      setSelectedId(null);
      setOpeningPrices({});
      setPriceHistory([]);
      setCurrentPrice(0);
      setRunningText(prev => ({ ...prev, active: false }));
      setCooldownActive(false);
      setIsPredictionModalOpen(false);
      setIsPaused(false);
      setPredictionsSubmitted({});
      setSkippedStockIds([]);
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
    const onCooldownStarted = (data: { duration: number; reason: string }) => {
      setCooldownActive(true);
      setCooldownReason(data.reason === "between-sessions" ? "antar sesi" : "antar ronde");
      setPhase("COOLDOWN");
      setSessionTimer(data.duration);
      setIsPredictionModalOpen(false);
      setIsPaused(false);
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      setRunningText(prev => ({ ...prev, active: false }));
    };
    const onInterventionEnded = () => { setRunningText(prev => ({ ...prev, active: false })); };
    const onPeriodEnded = () => {
      setSessionActive(false);
      setRoundNumber(null);
      setPhase("IDLE");
      setSubSession(null);
      setStocks([]);
      setStock(null);
      setSelectedId(null);
      setRunningText(prev => ({ ...prev, active: false }));
      setCooldownActive(false);
      setIsPredictionModalOpen(false);
      setIsPaused(false);
      toast.success("Periode selesai!");
    };
    const onExperimentEnded = () => { toast.success("Eksperimen selesai! Terima kasih."); };
    const onInterventionTriggered = (data: {
      roundNumber?: number;
      sessionNumber?: number;
      type: InterventionType;
      title?: string;
      content: { title?: string; content?: string } | string;
      duration?: number;
    }) => {
      setActiveIntervention(data.type);
      const title = typeof data.content === "object" ? (data.content?.title || data.title || "") : (data.title || "");
      const content = typeof data.content === "object" ? (data.content?.content || "") : (typeof data.content === "string" ? data.content : "");
      setInterventionContent({ title, content });
      if (data.type && data.type !== "NONE") {
        setRunningText({
          active: true,
          type: data.type,
          title: title || (data.type === "BERITA_BAIK" ? "Berita Baik" : "Berita Buruk"),
          content: content,
        });
      }
    };
    const onSchedulerState = (data: {
      status: string;
      currentRound: number;
      currentPeriod: number;
      currentSubSession: number;
      phase: SubSessionPhase;
      timeLeft: number;
      activeIntervention: InterventionType;
      stocks: Stock[];
      portfolios: Record<number, number>;
      cooldownActive: boolean;
      cooldownReason: string;
      isPaused?: boolean;
      interventionTitle?: string;
      interventionContent?: string;
    }) => {
      setRoundNumber(data.currentRound);
      setPeriod(data.currentPeriod);
      setSubSession(data.currentSubSession);
      setPhase(data.phase);
      setSessionTimer(data.timeLeft);
      setActiveIntervention(data.activeIntervention);
      setSessionActive(data.status === "RUNNING");
      setCooldownActive(data.cooldownActive);
      setCooldownReason(data.cooldownReason === "between-sessions" ? "antar sesi" : "antar ronde");
      setIsPaused(data.isPaused ?? false);
      if (data.stocks && data.stocks.length > 0) setStocks(data.stocks);
      if (data.phase === "PRE_MARKET") {
        setShowPredictionUI(true);
      } else {
        setShowPredictionUI(false);
        setIsPredictionModalOpen(false);
      }
      if (data.activeIntervention && data.activeIntervention !== "NONE") {
        const title = data.interventionTitle || (data.activeIntervention === "BERITA_BAIK" ? "Berita Baik" : "Berita Buruk");
        const content = data.interventionContent || "";
        if (content || title) {
          setRunningText({
            active: true,
            type: data.activeIntervention,
            title,
            content,
          });
        }
      } else {
        setRunningText(prev => ({ ...prev, active: false }));
      }
    };

    const onPortfolioInitial = (data: { portfolio: { stockId: number; jumlahLot: number; basePrice?: number | string }[] }) => {
      const initialMap: Record<number, number> = {};
      const baseMap: Record<number, number> = {};
      data.portfolio.forEach(p => {
        initialMap[p.stockId] = p.jumlahLot;
        if (p.basePrice) baseMap[p.stockId] = Number(p.basePrice);
      });
      setPortfoliosMap(initialMap);
      setBasePricesMap(baseMap);
    };
    const onPortfolioUpdate = (data: { userId: number; stockId: number; jumlahLot: number }) => {
      setPortfoliosMap(prev => ({ ...prev, [data.stockId]: data.jumlahLot }));
    };
    const onTradeExecuted = (data: { stockId: number; price: number; quantity: number; timestamp?: string }) => {
      setLastPrices(prev => ({ ...prev, [data.stockId]: data.price }));
      if (selectedIdRef.current && data.stockId === selectedIdRef.current) {
        const t = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setCurrentPrice(data.price);
        setPriceHistory(prev => {
          const base = openingPricesRef.current[data.stockId] || lastPricesRef.current[data.stockId] || 1000;
          const hasPraBuka = prev.length > 0 && prev[0].time === "Pra-Buka";
          const basePoint = hasPraBuka ? prev[0] : { time: "Pra-Buka", price: base };
          const otherPoints = hasPraBuka ? prev.slice(1) : prev;
          const upd = [basePoint, ...otherPoints, { time: t, price: data.price }];
          setPriceChange(((data.price - base) / base) * 100);
          return upd;
        });
      }
    };

    const onOrderBookUpdateGlobal = (data: { stockId: number; bids: Order[]; asks: Order[] }) => {
      if (selectedIdRef.current && data.stockId === selectedIdRef.current) {
        setBids(data.bids || []);
        setAsks(data.asks || []);
      }
    };

    socket.on("auth-success", onAuthSuccess);
    socket.on("round-started", onRoundStarted);
    socket.on("sub-session-started", onSubSessionStarted);
    socket.on("timer-tick", onTimerTick);
    socket.on("experiment-paused", onExperimentPaused);
    socket.on("experiment-resumed", onExperimentResumed);
    socket.on("round-ended", onRoundEnded);
    socket.on("cooldown-started", onCooldownStarted);
    socket.on("intervention-ended", onInterventionEnded);
    socket.on("period-ended", onPeriodEnded);
    socket.on("experiment-ended", onExperimentEnded);
    socket.on("intervention-triggered", onInterventionTriggered);
    socket.on("scheduler-state", onSchedulerState);
    socket.on("portfolio-initial", onPortfolioInitial);
    socket.on("portfolio-update", onPortfolioUpdate);
    socket.on("trade-executed", onTradeExecuted);
    socket.on("order-book-update", onOrderBookUpdateGlobal);
    socket.on("orderbook-snapshot", onOrderBookUpdateGlobal);

    return () => {
      socket.off("auth-success", onAuthSuccess);
      socket.off("round-started", onRoundStarted);
      socket.off("sub-session-started", onSubSessionStarted);
      socket.off("timer-tick", onTimerTick);
      socket.off("experiment-paused", onExperimentPaused);
      socket.off("experiment-resumed", onExperimentResumed);
      socket.off("round-ended", onRoundEnded);
      socket.off("cooldown-started", onCooldownStarted);
      socket.off("intervention-ended", onInterventionEnded);
      socket.off("period-ended", onPeriodEnded);
      socket.off("experiment-ended", onExperimentEnded);
      socket.off("intervention-triggered", onInterventionTriggered);
      socket.off("scheduler-state", onSchedulerState);
      socket.off("portfolio-initial", onPortfolioInitial);
      socket.off("portfolio-update", onPortfolioUpdate);
      socket.off("trade-executed", onTradeExecuted);
      socket.off("order-book-update", onOrderBookUpdateGlobal);
      socket.off("orderbook-snapshot", onOrderBookUpdateGlobal);
    };
  }, [user, hydrated]);

  useEffect(() => {
    if (phase === "PRE_MARKET" && stocks.length > 0) {
      if (activeModalStockId === null || !stocks.some(s => s.id === activeModalStockId)) {
        const firstUnsubmitted = stocks.find(s => predictionsSubmitted[s.id] === undefined) || stocks[0];
        setActiveModalStockId(firstUnsubmitted.id);
      }
    }
  }, [phase, stocks, predictionsSubmitted, activeModalStockId]);

  useEffect(() => {
    if (phase === "IDLE" || !sessionActive || isPaused) {
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      return;
    }
    localTimerRef.current = setInterval(() => {
      setSessionTimer(prev => {
        if (prev <= 1) { if (localTimerRef.current) clearInterval(localTimerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; } };
  }, [phase, sessionActive, isPaused]);

  const stockId = stock?.id;
  useEffect(() => {
    if (!user || !stockId) return;
    const socket = getSocket();

    // Instant zero-lag baseline price initialization with valid BEI tick snap
    const rawBase = openingPrices[stockId] || lastPrices[stockId] || (stock ? Number(stock.basePrice) : 1000);
    const initialBase = snapToTickSize(rawBase);
    setCurrentPrice(initialBase);
    setPriceHistory([{ time: "Pra-Buka", price: initialBase }]);

    const onOrderbookSnapshot = (data: { bids?: Order[]; asks?: Order[]; stockId?: number }) => {
      if (!data.stockId || data.stockId === stockId) {
        if (data.bids) setBids(data.bids);
        if (data.asks) setAsks(data.asks);
      }
    };
    const onPriceHistorySnapshot = (data: { history: { timestamp: string; price: number }[] }) => {
      const formatted = data.history.map(h => ({
        time: new Date(h.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        price: h.price,
      }));
      const base = initialBase;
      const withPraBuka = [{ time: "Pra-Buka", price: base }, ...formatted];
      setPriceHistory(withPraBuka);
      if (formatted.length > 0) {
        const last = formatted[formatted.length - 1].price;
        setCurrentPrice(last);
        setPriceChange(((last - base) / base) * 100);
      } else {
        setCurrentPrice(base);
        setPriceChange(0);
      }
    };
    const onPortfolio = (data: { portfolio: { stockId: number; lot: number }[] }) => {
      const found = data.portfolio.find(p => p.stockId === stockId);
      setPortfolio(found ? { lot: found.lot } : { lot: 0 });
    };

    socket.emit("get-orderbook", { stockId });
    socket.emit("get-price-history", { stockId });
    socket.emit("get-portfolio", { userId: user.id });

    socket.on("orderbook-snapshot", onOrderbookSnapshot);
    socket.on("order-book-update", onOrderbookSnapshot);
    socket.on("price-history-snapshot", onPriceHistorySnapshot);
    socket.on("portfolio", onPortfolio);

    return () => {
      socket.off("orderbook-snapshot", onOrderbookSnapshot);
      socket.off("order-book-update", onOrderbookSnapshot);
      socket.off("price-history-snapshot", onPriceHistorySnapshot);
      socket.off("portfolio", onPortfolio);
    };
  }, [user, stockId]);

  const handleCloseOrderModal = useCallback(() => {
    setIsOrderModalOpen(false);
    setStock(null);
    setSelectedId(null);
    setOrderPrice("");
    setOrderLot("");
    router.replace("/dashboard/trading");
  }, [router]);

  const selectStock = useCallback((s: Stock) => {
    setSelectedId(s.id);
    setStock(s);
    setBids([]);
    setAsks([]);
    setPortfolio(null);
    const rawBase = openingPrices[s.id] || lastPrices[s.id] || Number(s.basePrice) || 1000;
    const base = snapToTickSize(rawBase);
    setCurrentPrice(base);
    setPriceChange(0);
    setPriceHistory([{ time: "Pra-Buka", price: base }]);
    setOrderPrice("");
    setOrderLot("");
    setIsOrderModalOpen(true);

    const socket = getSocket();
    socket.emit("get-orderbook", { stockId: s.id });
  }, [openingPrices, lastPrices]);

  const handlePlaceOrder = useCallback(() => {
    if (!user || !stock) return;
    const price = parseInt(orderPrice);
    const lot = parseInt(orderLot);
    if (!price || !lot) { toast.error("Isi harga dan jumlah"); return; }
    if (price <= 0 || lot <= 0) { toast.error("Harga dan jumlah lot tidak boleh minus atau nol"); return; }
    if (!isValidTickSize(price)) {
      const tick = getTickSize(price);
      toast.error(`Harga harus kelipatan Rp ${tick}`);
      return;
    }

    const socket = getSocket();
    socket.emit("place-order", { stockId: stock.id, tipe: orderType, harga: price, jumlah: lot, userId: user.id });
    
    socket.once("order-placed", () => {
      const curStockKode = (stock as any).kodeSaham || (stock as any).kode || "Saham";
      toast.success(`Order ${orderType === "BID" ? "Beli" : "Jual"} ${curStockKode}: ${lot} lot @ Rp ${price.toLocaleString("id-ID")}`);
      setOrderPrice(""); 
      setOrderLot("");
      
      // Request updated orderbook immediately
      socket.emit("get-orderbook", { stockId: stock.id });

      const newOrders = { ...ordersPlacedMap, [stock.id]: true };
      setOrdersPlacedMap(newOrders);

      // Cari saham berikutnya yang belum dikirimi order
      const unsubmitted = stocks.filter(s => !newOrders[s.id]);
      if (unsubmitted.length > 0) {
        const currentIdx = stocks.findIndex(s => s.id === stock.id);
        const after = currentIdx >= 0 ? stocks.slice(currentIdx + 1).filter(s => !newOrders[s.id]) : [];
        const nextTarget = after.length > 0 ? after[0] : unsubmitted[0];
        
        const nextKode = (nextTarget as any).kodeSaham || (nextTarget as any).kode;
        toast.info(`Lanjut ke ${nextKode} (${Object.keys(newOrders).length}/${stocks.length} saham diorder)`);
        selectStock(nextTarget);
      } else {
        toast.success("Semua saham telah berhasil diorder!");
        handleCloseOrderModal();
      }
    });

    socket.once("order-error", (data: { message: string }) => toast.error(data.message));
  }, [user, stock, orderType, orderPrice, orderLot, ordersPlacedMap, stocks, selectStock, handleCloseOrderModal]);

  const findNextUnsubmittedStock = useCallback((currentStockId: number, currentSubmitted: Record<number, number>, skipped: number[]) => {
    const unsubmitted = stocks.filter(s => currentSubmitted[s.id] === undefined);
    if (unsubmitted.length === 0) return null;
    const currentIndex = unsubmitted.findIndex(s => s.id === currentStockId);
    const after = currentIndex >= 0 ? unsubmitted.slice(currentIndex + 1) : unsubmitted;
    const before = currentIndex >= 0 ? unsubmitted.slice(0, currentIndex) : [];
    const notSkippedAfter = after.find(s => !skipped.includes(s.id));
    if (notSkippedAfter) return notSkippedAfter.id;
    const notSkippedBefore = before.find(s => !skipped.includes(s.id));
    if (notSkippedBefore) return notSkippedBefore.id;
    if (after.length > 0) return after[0].id;
    if (before.length > 0) return before[0].id;
    return unsubmitted[0].id;
  }, [stocks]);

  const handleSubmitPredictionAndNext = useCallback((targetStockId: number) => {
    if (!user) return;
    const price = parseInt(predictionInput[targetStockId]);
    if (!price || price <= 0) { toast.error("Masukkan harga prediksi yang valid"); return; }
    const curStock = stocks.find(s => s.id === targetStockId);
    if (curStock) {
      const baseP = Number(curStock.basePrice);
      const { upper, lower } = getAutoRejectionLimits(baseP);
      if (!isValidTickSize(price)) { toast.error(`Harga harus kelipatan Rp ${getTickSize(price)}`); return; }
      if (price > upper || price < lower) { toast.error(`Prediksi di luar rentang Rp ${lower.toLocaleString("id-ID")} – Rp ${upper.toLocaleString("id-ID")}`); return; }
    }
    const socket = getSocket();
    socket.emit("submit-prediction", { stockId: targetStockId, predictedPrice: price, userId: user.id });
    const newSubmitted = { ...predictionsSubmitted, [targetStockId]: price };
    setPredictionsSubmitted(newSubmitted);
    const newSkipped = skippedStockIds.filter(id => id !== targetStockId);
    setSkippedStockIds(newSkipped);
    toast.success(`Prediksi ${(curStock as any)?.kodeSaham || ""} tersimpan: Rp ${price.toLocaleString("id-ID")}`);
    const nextId = findNextUnsubmittedStock(targetStockId, newSubmitted, newSkipped);
    if (nextId) { setActiveModalStockId(nextId); } else { setIsPredictionModalOpen(false); toast.success("Semua prediksi saham telah lengkap!"); }
  }, [user, predictionInput, stocks, predictionsSubmitted, skippedStockIds, findNextUnsubmittedStock]);

  const handleSkipStock = useCallback((targetStockId: number) => {
    const newSkipped = skippedStockIds.includes(targetStockId) ? skippedStockIds : [...skippedStockIds, targetStockId];
    setSkippedStockIds(newSkipped);
    const nextId = findNextUnsubmittedStock(targetStockId, predictionsSubmitted, newSkipped);
    if (nextId && nextId !== targetStockId) { setActiveModalStockId(nextId); toast.info("Saham dilewati sementara."); } else { toast.info("Ini adalah saham terakhir yang belum terisi."); }
  }, [skippedStockIds, findNextUnsubmittedStock, predictionsSubmitted]);

  const handleOpenModalForStock = useCallback((sId?: number) => {
    if (sId) setActiveModalStockId(sId);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsPredictionModalOpen(true);
    }
  }, []);

  if (!hydrated || !user) return null;
  const isUp = priceChange >= 0;
  const maxBid = Math.max(...bids.map(o => o.jumlah), 1);
  const maxAsk = Math.max(...asks.map(o => o.jumlah), 1);

  const totalStockValue = Object.entries(portfoliosMap).reduce((sum, [sIdStr, lot]) => {
    const sId = Number(sIdStr);
    const price = lastPrices[sId] || openingPricesRef.current[sId] || basePricesMap[sId] || 1000;
    return sum + (lot * 100 * price);
  }, 0);
  const netAssetValue = balance + totalStockValue;
  const initialPortfolioValue = Object.values(basePricesMap).reduce((sum, price) => sum + (10 * 100 * price), 0);
  const modalAwal = 100_000_000 + initialPortfolioValue;
  const floatingPnL = modalAwal > 0 ? ((netAssetValue - modalAwal) / modalAwal) * 100 : 0;
  const activeModalStock = stocks.find(s => s.id === activeModalStockId) || stocks[0];
  const activeStockIndex = stocks.findIndex(s => s.id === activeModalStock?.id);
  const submittedCount = Object.keys(predictionsSubmitted).length;
  const currentStockIdx = stock ? stocks.findIndex(s => s.id === stock.id) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 relative pb-28 md:pb-8">
      {/* ── Cooldown Overlay ───────────────────────────────── */}
      {cooldownActive && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center gap-3">
          <AlertTriangle className="size-4.5 text-amber-500 shrink-0" />
          <div>
            <div className="font-bold text-xs text-foreground">Sesi Cooldown Aktif</div>
            <div className="text-[10.5px] text-muted-foreground">{cooldownReason || "Pasar sedang disiapkan..."}</div>
          </div>
        </div>
      )}

      {/* ── Paused Banner (Clean & Harmonized) ──────────────── */}
      {isPaused && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2.5 flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <PauseCircle className="size-4 text-amber-500 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <span className="font-bold text-xs text-amber-600 dark:text-amber-300 block truncate">Sesi Dijeda Admin</span>
              <span className="text-[10px] text-muted-foreground block truncate">Aktivitas ditangguhkan sementara</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30 shrink-0">
            PAUSED
          </span>
        </div>
      )}

      {/* ── Single-Line Mobile Sticky Portfolio Bar ─────────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-1.5 backdrop-blur-xl bg-background/85 dark:bg-zinc-950/85 border-b border-border/50 shadow-2xs transition-all">
        <div className="flex items-center justify-between gap-1.5 text-xs font-mono">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[11px] font-extrabold text-foreground truncate">
              NAV: Rp {netAssetValue.toLocaleString("id-ID")}
            </span>
            <span className={cn("text-[10px] font-bold shrink-0", floatingPnL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {floatingPnL >= 0 ? "+" : ""}{floatingPnL.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
            <span>Kas: {(balance / 1_000_000).toFixed(0)}Jt</span>
            <span>·</span>
            <span>Saham: {(totalStockValue / 1_000_000).toFixed(0)}Jt</span>
          </div>
        </div>
      </div>

      {/* ── Responsive Header Layout (Stacking on Narrow Screens) ─ */}
      <div className="space-y-1 sm:space-y-1.5">
        {/* Top meta row: Session Pills & Timer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {roundNumber && (
              <span className="px-2 py-0.5 rounded-lg bg-muted text-[10.5px] font-mono font-semibold text-muted-foreground border border-border/60">
                R{roundNumber}-S{subSession}
              </span>
            )}
            <span className={cn(
              "px-2 py-0.5 rounded-lg text-[10.5px] font-bold border",
              phase === "PRE_MARKET" 
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            )}>
              {phase === "PRE_MARKET" ? "Pra-Pembukaan" : "Perdagangan"}
            </span>
            {activeIntervention !== "NONE" && (
              <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10.5px] font-semibold border border-primary/20">
                {getInterventionLabel(activeIntervention)}
              </span>
            )}
          </div>

          {/* Deduplicated Countdown Timer Pill (Enlarged & High-Legibility) */}
          {sessionActive && (
            <div className={cn(
              "flex items-center gap-1.5 font-mono text-sm sm:text-base px-3.5 py-1 sm:py-1.5 rounded-2xl font-black border transition-all shadow-xs shrink-0 tracking-wider",
              isPaused 
                ? "text-amber-600 dark:text-amber-300 bg-amber-500/15 border-amber-500/30"
                : sessionTimer <= 10 
                  ? "text-rose-600 dark:text-rose-400 bg-rose-500/15 border-rose-500/30 ring-2 ring-rose-500/30 animate-pulse" 
                  : sessionTimer <= 30 
                    ? "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30" 
                    : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30 shadow-emerald-500/10"
            )}>
              <Timer className="size-4 sm:size-4.5 shrink-0" />
              <span>{Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, "0")}</span>
            </div>
          )}
        </div>

        {/* Bottom title row: Fluid Typography Clamp & Anti-Orphan Balanced Copy */}
        <div className="space-y-0.5">
          <h1 className="font-extrabold tracking-tight text-foreground text-[clamp(1.1rem,4.5vw,1.4rem)] leading-tight">
            {phase === "PRE_MARKET" ? "Pra-Pembukaan Pasar" : "Perdagangan Saham"}
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground text-balance leading-relaxed">
            {phase === "PRE_MARKET" 
              ? "Estimasi harga pembukaan sebelum pasar reguler dimulai."
              : "Pilih saham untuk transaksi dan pantau grafik harga live."
            }
          </p>
        </div>
      </div>

      {/* ── Running Text Intervensi (Inline directly below description on desktop OR when mobile modal is closed) ── */}
      {runningText.active && runningText.type !== "NONE" && (
        <div className={cn(
          "w-full animate-in fade-in slide-in-from-top-2 duration-300",
          (isPredictionModalOpen || isOrderModalOpen) ? "hidden md:block" : "block"
        )}>
          <RunningText
            active={runningText.active}
            type={runningText.type}
            title={runningText.title}
            content={runningText.content}
          />
        </div>
      )}

      {/* ── PHASE-BASED RENDER ─────────────────────────────── */}
      {phase === "PRE_MARKET" ? (
        <div className="space-y-4">
          {/* ══════════════════════════════════════════════════════════
              A. DESKTOP VIEW (hidden md:block): Multi-Card Workstation Grid (NO MODAL)
             ══════════════════════════════════════════════════════════ */}
          <div className="hidden md:block space-y-4">
            {/* Header Status & Progress Card */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Formulir Pra-Pembukaan Pasar
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono font-bold text-xs">
                    {submittedCount}/{stocks.length} Saham Terisi
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tentukan estimasi harga pembukaan setiap saham sebelum waktu sesi pra-pembukaan berakhir.
                </p>
              </div>

              {/* Segmented Progress Tracker */}
              <div className="w-52 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Kelengkapan Prediksi</span>
                  <span className="font-mono font-bold text-foreground">
                    {stocks.length > 0 ? Math.round((submittedCount / stocks.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 w-full">
                  {stocks.map(s => {
                    const isDone = predictionsSubmitted[s.id] !== undefined;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "h-2 flex-1 rounded-full transition-all duration-300",
                          isDone ? "bg-emerald-500" : "bg-muted/80 dark:bg-zinc-800"
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3-Column Desktop Prediction Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stocks.map((s) => {
                const baseP = Number(s.basePrice);
                const { upper, lower } = getAutoRejectionLimits(baseP);
                const safeKode = (s as any).kodeSaham || (s as any).kode || "N/A";
                const safeNama = (s as any).namaSaham || (s as any).nama || "Tidak ada data";
                const meta = getMeta(safeKode);
                const isSubmitted = predictionsSubmitted[s.id] !== undefined;
                const submittedVal = predictionsSubmitted[s.id];
                const curInputVal = predictionInput[s.id] || (isSubmitted ? String(submittedVal) : "");
                const predVal = parseInt(curInputVal) || 0;
                const isInvalid = predVal > 0 && (!isValidTickSize(predVal) || predVal > upper || predVal < lower);
                const diffPct = predVal > 0 && baseP > 0 ? ((predVal - baseP) / baseP) * 100 : 0;

                const quickChips = [
                  { label: "-5%", pct: -5 },
                  { label: "-2%", pct: -2 },
                  { label: "Sama", pct: 0 },
                  { label: "+2%", pct: 2 },
                  { label: "+5%", pct: 5 },
                ];

                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-3xl border p-4 sm:p-5 shadow-xs transition-all duration-200 flex flex-col justify-between gap-4 bg-card",
                      isSubmitted
                        ? "border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-500/[0.02]"
                        : "border-border/80 hover:border-amber-500/40"
                    )}
                  >
                    {/* Stock Header & Identity */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex min-w-[44px] h-10 px-2.5 items-center justify-center rounded-2xl bg-primary/15 text-primary font-mono font-black text-sm whitespace-nowrap border border-primary/20 shrink-0 shadow-xs">
                            {safeKode}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-foreground truncate">{safeKode}</h3>
                              <span className={cn(
                                "text-[9px] px-2 py-0.5 rounded-full border font-semibold shrink-0",
                                sektorWarna[meta.sektor] || "bg-muted text-muted-foreground border-border/60"
                              )}>
                                {meta.sektor}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{safeNama}</p>
                          </div>
                        </div>

                        {isSubmitted && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="size-3" />
                            <span>Terisi</span>
                          </span>
                        )}
                      </div>

                      {/* Price Meta Panel */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-muted/30 dark:bg-zinc-900/50 border border-border/50 text-xs">
                        <div>
                          <span className="text-[9.5px] text-muted-foreground uppercase font-semibold block">Harga Kemarin</span>
                          <span className="font-mono font-bold text-sm text-foreground">
                            Rp {baseP.toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9.5px] text-muted-foreground uppercase font-semibold block">Batas ARA / ARB</span>
                          <span className="font-mono text-xs text-muted-foreground font-semibold">
                            Rp {lower.toLocaleString("id-ID")} – {upper.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Form Controls */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>Prediksi Pembukaan (Rp):</span>
                        {predVal > 0 && (
                          <span className={cn(
                            "font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md",
                            predVal >= baseP ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          )}>
                            {predVal >= baseP ? "+" : ""}{diffPct.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      <PriceInput
                        value={curInputVal}
                        basePrice={baseP}
                        onChange={(val) => setPredictionInput(prev => ({ ...prev, [s.id]: val }))}
                        min={1}
                        max={upper}
                        className="h-10 rounded-2xl text-sm"
                      />

                      {/* Quick Percentage Chips */}
                      <div className="flex items-center gap-1 justify-between">
                        {quickChips.map(chip => {
                          const targetP = snapToTickSize(Math.round(baseP * (1 + chip.pct / 100)));
                          const isSelected = predVal === targetP;
                          return (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => setPredictionInput(prev => ({ ...prev, [s.id]: String(targetP) }))}
                              className={cn(
                                "flex-1 py-1 rounded-xl text-[10px] font-mono font-bold border transition-all active:scale-95",
                                isSelected
                                  ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                                  : "bg-muted/40 hover:bg-muted/80 text-muted-foreground border-border/60 hover:text-foreground"
                              )}
                            >
                              {chip.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <TickSizeBadge price={predVal} basePrice={baseP} />
                        <span>Kelipatan fraksi BEI</span>
                      </div>

                      {isInvalid && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                          {!isValidTickSize(predVal) ? `Harus kelipatan Rp ${predVal > 0 ? getTickSize(predVal) : 1}` : `Di luar batas (${lower.toLocaleString("id-ID")} – ${upper.toLocaleString("id-ID")})`}
                        </p>
                      )}

                      {/* Direct Inline Action Button */}
                      <Button
                        type="button"
                        onClick={() => handleSubmitPredictionAndNext(s.id)}
                        disabled={isInvalid || (!curInputVal && !isSubmitted)}
                        className={cn(
                          "w-full h-11 rounded-2xl font-bold text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                          isSubmitted
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/20"
                        )}
                      >
                        {isSubmitted ? (
                          <>
                            <CheckCircle2 className="size-4" />
                            <span>Simpan Perubahan Prediksi</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" />
                            <span>Simpan Prediksi {safeKode}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              B. MOBILE VIEW (md:hidden): Compact Cards + Centered Modal Wizard
             ══════════════════════════════════════════════════════════ */}
          <div className="md:hidden space-y-3">
            {/* Compact & Sleek Hero Card */}
            {submittedCount >= stocks.length && stocks.length > 0 ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4.5 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">Semua ({stocks.length}) Prediksi Lengkap</span>
                    <span className="text-[10px] text-muted-foreground block truncate">Bisa diedit sampai waktu habis</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleOpenModalForStock(stocks[0]?.id)}
                  className="h-7.5 px-2.5 rounded-xl text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0"
                >
                  <Edit3 className="size-3 mr-1" /> Edit
                </Button>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/80 to-muted/20 p-3.5 sm:p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                      Formulir Pra-Pembukaan
                    </span>
                    <p className="text-xs text-foreground font-semibold truncate">
                      Isi estimasi harga sebelum bel perdagangan berbunyi
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10.5px] shrink-0">
                    {submittedCount}/{stocks.length} Terisi
                  </span>
                </div>

                {/* Mini Segmented Progress Bar */}
                <div className="flex items-center gap-1.5 w-full">
                  {stocks.map((s, idx) => {
                    const isDone = predictionsSubmitted[s.id] !== undefined;
                    return (
                      <div 
                        key={s.id} 
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-all duration-300", 
                          isDone ? "bg-emerald-500" : "bg-muted/80 dark:bg-zinc-800"
                        )} 
                      />
                    );
                  })}
                </div>

                {/* CTA Trigger */}
                <Button
                  onClick={() => handleOpenModalForStock(activeModalStock?.id || stocks[0]?.id)}
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2"
                >
                  <Sparkles className="size-4" />
                  <span>{submittedCount > 0 ? "Lanjutkan Pengisian Prediksi" : "Mulai Isi Prediksi Saham"}</span>
                </Button>
              </div>
            )}

            {/* Compact Fintech Stock Cards List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Daftar Saham ({stocks.length})
                </span>
                <span className="text-[9.5px] text-muted-foreground">Tap untuk input/edit</span>
              </div>

              <div className="space-y-2">
                {stocks.map((s, idx) => {
                  const isSubmitted = predictionsSubmitted[s.id] !== undefined;
                  const submittedVal = predictionsSubmitted[s.id];
                  const baseP = Number(s.basePrice);
                  const safeKode = (s as any).kodeSaham || (s as any).kode || "N/A";
                  const safeNama = (s as any).namaSaham || (s as any).nama || "Tidak ada data";
                  const meta = getMeta(safeKode);
                  const diffPct = isSubmitted && baseP > 0 ? ((submittedVal - baseP) / baseP) * 100 : 0;

                  return (
                    <button
                      key={s.id}
                      onClick={() => handleOpenModalForStock(s.id)}
                      className={cn(
                        "group text-left w-full rounded-2xl border p-2.5 sm:p-3 transition-all duration-200 shadow-2xs active:scale-[0.985] min-h-[58px] flex items-center justify-between gap-2.5",
                        isSubmitted
                          ? "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/30"
                          : "bg-card/90 hover:bg-muted/40 border-border/80 hover:border-amber-500/50"
                      )}
                    >
                      {/* Left: Ticker Avatar & Details */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "flex size-9 items-center justify-center rounded-xl font-mono font-bold text-xs shrink-0 border transition-transform group-hover:scale-105",
                          isSubmitted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          {safeKode}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                              {safeKode}
                            </h4>
                            <span className="text-[8px] px-1.5 py-0.2 rounded-full border bg-muted/50 text-muted-foreground font-medium shrink-0">
                              {meta.sektor}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            Tutup: Rp {baseP.toLocaleString("id-ID")}
                          </div>
                        </div>
                      </div>

                      {/* Right: Submitted Value or Action Pill */}
                      <div className="text-right shrink-0 flex items-center gap-1.5">
                        {isSubmitted ? (
                          <div className="font-mono text-right">
                            <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              Rp {submittedVal.toLocaleString("id-ID")}
                            </div>
                            <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                              <CheckCircle2 className="size-2.5" />
                              <span>{diffPct >= 0 ? "+" : ""}{diffPct.toFixed(1)}%</span>
                            </div>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[10.5px] flex items-center gap-1 group-hover:bg-amber-500/20 transition-colors">
                            <Sparkles className="size-3" />
                            <span>Isi</span>
                          </span>
                        )}
                        <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Centered Dialog Focus Card (Strictly md:hidden) */}
            {isPredictionModalOpen && activeModalStock && (
              <div className="fixed inset-0 z-[80] md:hidden flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div 
                  className="fixed inset-0"
                  onClick={() => setIsPredictionModalOpen(false)}
                />
                
                <div className="relative z-10 w-full max-w-[370px] sm:max-w-[400px] flex flex-col gap-2 animate-in zoom-in-95 duration-200">
                  {/* Running text directly above prediction modal card with a small gap */}
                  {runningText.active && runningText.type !== "NONE" && (
                    <div className="w-full animate-in slide-in-from-top-2 duration-200 shadow-xl">
                      <RunningText
                        active={runningText.active}
                        type={runningText.type}
                        title={runningText.title}
                        content={runningText.content}
                      />
                    </div>
                  )}

                  {/* Modal Card Content */}
                  <div className="w-full bg-background dark:bg-zinc-950 border border-border/80 dark:border-amber-500/30 rounded-3xl p-3 sm:p-4 shadow-2xl shadow-black/50 space-y-2 overflow-hidden">
                    {/* Segmented Top Progress Bar */}
                    <div className="flex items-center gap-1 w-full">
                      {stocks.map((s, idx) => {
                        const isDone = predictionsSubmitted[s.id] !== undefined;
                        const isCur = s.id === activeModalStock.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setActiveModalStockId(s.id)}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              isCur 
                                ? "bg-amber-500 ring-2 ring-amber-500/30" 
                                : isDone 
                                  ? "bg-emerald-500" 
                                  : "bg-muted/80 dark:bg-zinc-800"
                            )}
                            title={`Saham ${(s as any).kodeSaham || (s as any).kode}`}
                          />
                        );
                      })}
                    </div>

                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-border/50 pb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-2 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[10px] shrink-0">
                          Saham {activeStockIndex + 1}/{stocks.length}
                        </span>
                        {predictionsSubmitted[activeModalStock.id] !== undefined && (
                          <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 shrink-0">
                            <CheckCircle2 className="size-2.5" /> Terisi
                          </span>
                        )}
                      </div>

                      {/* Header Right: Live Session Countdown Timer + Close Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={cn(
                          "flex items-center gap-1.5 font-mono text-xs sm:text-sm px-2.5 py-1 rounded-xl font-black border transition-all shadow-xs",
                          isPaused
                            ? "text-amber-600 dark:text-amber-300 bg-amber-500/15 border-amber-500/30"
                            : sessionTimer <= 10 
                              ? "text-rose-600 dark:text-rose-400 bg-rose-500/15 border-rose-500/30 ring-2 ring-rose-500/30 animate-pulse" 
                              : sessionTimer <= 30 
                                ? "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30" 
                                : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
                        )}>
                          <Timer className="size-3.5 shrink-0" />
                          <span>{Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, "0")}</span>
                        </div>

                        <button 
                          onClick={() => setIsPredictionModalOpen(false)} 
                          className="size-6 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Tutup modal"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stock Profile & Input */}
                    {(() => {
                      const baseP = Number(activeModalStock.basePrice);
                      const { upper, lower } = getAutoRejectionLimits(baseP);
                      const meta = getMeta((activeModalStock as any).kodeSaham || (activeModalStock as any).kode);
                      const predVal = parseInt(predictionInput[activeModalStock.id]) || predictionsSubmitted[activeModalStock.id] || 0;
                      const isInvalid = predVal > 0 && (!isValidTickSize(predVal) || predVal > upper || predVal < lower);
                      const diffPct = predVal > 0 && baseP > 0 ? ((predVal - baseP) / baseP) * 100 : 0;

                      const quickChips = [
                        { label: "-5%", pct: -5 },
                        { label: "-2%", pct: -2 },
                        { label: "Sama", pct: 0 },
                        { label: "+2%", pct: 2 },
                        { label: "+5%", pct: 5 },
                      ];

                      return (
                        <div className="space-y-2">
                          {/* Stock Card Highlight (Compact) */}
                          <div className="p-2 rounded-xl bg-muted/40 dark:bg-zinc-900/60 border border-border/60 space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="flex min-w-[42px] h-8 px-2 items-center justify-center rounded-xl bg-primary/15 text-primary font-mono font-black text-xs whitespace-nowrap border border-primary/30 shrink-0 shadow-2xs">
                                  {(activeModalStock as any).kodeSaham || (activeModalStock as any).kode}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-xs text-foreground truncate">
                                    {(activeModalStock as any).kodeSaham || (activeModalStock as any).kode}
                                  </h3>
                                  <p className="text-[9px] text-muted-foreground truncate">
                                    {(activeModalStock as any).namaSaham || (activeModalStock as any).nama}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[8px] px-1.5 py-0.2 rounded-full border bg-background font-semibold text-muted-foreground shrink-0">
                                {meta.sektor}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/40 text-[9.5px]">
                              <div>
                                <span className="text-muted-foreground text-[8px] uppercase block">Harga Kemarin</span>
                                <span className="font-mono font-bold text-[11px] text-foreground">
                                  Rp {baseP.toLocaleString("id-ID")}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-muted-foreground text-[8px] uppercase block">Batas ARA / ARB</span>
                                <span className="font-mono text-[9.5px] text-muted-foreground font-semibold">
                                  Rp {lower.toLocaleString("id-ID")} – {upper.toLocaleString("id-ID")}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Prediction Input & Stepper */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-foreground">
                              <span>Prediksi Harga Pembukaan:</span>
                              {predVal > 0 && (
                                <span className={cn("font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded", predVal >= baseP ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
                                  {predVal >= baseP ? "+" : ""}{diffPct.toFixed(2)}%
                                </span>
                              )}
                            </div>
                            
                            <PriceInput 
                              value={predictionInput[activeModalStock.id] || (predictionsSubmitted[activeModalStock.id] ? String(predictionsSubmitted[activeModalStock.id]) : "")} 
                              basePrice={baseP} 
                              onChange={val => setPredictionInput(prev => ({ ...prev, [activeModalStock.id]: val }))} 
                              min={1} 
                              max={upper} 
                              className="h-8.5 rounded-xl text-xs"
                            />

                            {/* Quick Percentage Chips */}
                            <div className="flex items-center gap-1 pt-0.5 justify-between">
                              {quickChips.map(chip => {
                                const targetP = snapToTickSize(Math.round(baseP * (1 + chip.pct / 100)));
                                const isSelected = predVal === targetP;
                                return (
                                  <button
                                    key={chip.label}
                                    type="button"
                                    onClick={() => {
                                      setPredictionInput(prev => ({ ...prev, [activeModalStock.id]: String(targetP) }));
                                    }}
                                    className={cn(
                                      "flex-1 py-0.8 rounded-lg text-[9px] font-mono font-bold border transition-all active:scale-95",
                                      isSelected 
                                        ? "bg-amber-500 text-white border-amber-500 shadow-xs" 
                                        : "bg-muted/40 hover:bg-muted/80 text-muted-foreground border-border/60 hover:text-foreground"
                                    )}
                                  >
                                    {chip.label}
                                  </button>
                                );
                              })}
                            </div>
                            
                            <div className="flex items-center justify-between text-[8.5px] text-muted-foreground font-mono">
                              <TickSizeBadge price={predVal} basePrice={baseP} />
                              <span>Kelipatan fraksi BEI</span>
                            </div>
                            {isInvalid && (
                              <p className="text-[8.5px] text-rose-600 dark:text-rose-400 font-medium">
                                {!isValidTickSize(predVal) ? `Harus kelipatan Rp ${predVal > 0 ? getTickSize(predVal) : 1}` : `Di luar batas (${lower.toLocaleString("id-ID")} – ${upper.toLocaleString("id-ID")})`}
                              </p>
                            )}
                          </div>

                          {/* Modal Action Buttons (Single Row / Compact Stack) */}
                          <div className="space-y-1 pt-0.5">
                            <Button 
                              onClick={() => handleSubmitPredictionAndNext(activeModalStock.id)} 
                              disabled={isInvalid || (!predictionInput[activeModalStock.id] && !predictionsSubmitted[activeModalStock.id])} 
                              className="w-full h-9.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-[0.98] min-h-[38px] flex items-center justify-center gap-1.5"
                            >
                              <Sparkles className="size-3.5" />
                              <span>{activeStockIndex === stocks.length - 1 && submittedCount >= stocks.length - 1 ? "Simpan & Selesaikan Prediksi" : "Simpan & Lanjut Berikutnya"}</span>
                            </Button>
                            
                            <div className="flex items-center gap-1.5">
                              <Button 
                                variant="outline" 
                                type="button" 
                                onClick={() => handleSkipStock(activeModalStock.id)} 
                                className="flex-1 h-8 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground min-h-[32px]"
                              >
                                <SkipForward className="size-3 mr-1" />
                                <span>Lewati Sementara</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                type="button" 
                                onClick={() => setIsPredictionModalOpen(false)} 
                                className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground min-h-[32px]"
                              >
                                Tutup
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── TRADING PHASE: Dual Adaptive Interface (Mobile Modal vs Desktop Full Workstation) ── */
        <div>
          {/* ══════════════════════════════════════════════════════════
              1. MOBILE VIEW (md:hidden): Compact Catalog + Centered Modal
             ══════════════════════════════════════════════════════════ */}
          <div className="md:hidden space-y-2.5 sm:space-y-3">
            {/* ── Sleek Modern Fintech Hero Card ─────────────── */}
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-emerald-500/5 p-3 sm:p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <span className="font-extrabold text-xs text-foreground block truncate">
                      Pasar Perdagangan Aktif
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Tap saham untuk transaksi live order
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px] shrink-0">
                  {stocks.length} Saham
                </span>
              </div>

              {/* 2-Column Balance Metrics */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs font-mono">
                <div className="p-2 rounded-2xl bg-muted/40 dark:bg-zinc-900/60 border border-border/60">
                  <span className="text-[8.5px] text-muted-foreground uppercase font-sans font-semibold block">
                    Kas Tersedia
                  </span>
                  <span className="font-extrabold text-foreground text-xs sm:text-sm truncate block">
                    Rp {balance.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="p-2 rounded-2xl bg-muted/40 dark:bg-zinc-900/60 border border-border/60 text-right">
                  <span className="text-[8.5px] text-muted-foreground uppercase font-sans font-semibold block">
                    Nilai Portofolio
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm truncate block">
                    Rp {totalStockValue.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Compact Fintech Stock Menu List ─────────────── */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Daftar Saham ({stocks.length})
                </span>
                <span className="text-[9px] text-muted-foreground">Pilih untuk trade</span>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                {stocks.map(s => {
                  const safeKode = (s as any).kodeSaham || (s as any).kode || "N/A";
                  const safeNama = (s as any).namaSaham || (s as any).nama || "Tidak ada data";
                  const meta = getMeta(safeKode);
                  const lastP = lastPrices[s.id] || openingPrices[s.id] || Number(s.basePrice) || 1000;
                  const openP = openingPrices[s.id] || Number(s.basePrice) || lastP;
                  const chg = openP > 0 ? ((lastP - openP) / openP) * 100 : 0;
                  const userLot = portfoliosMap[s.id] || 0;
                  const isPositive = chg >= 0;

                  return (
                    <button
                      key={s.id}
                      onClick={() => selectStock(s)}
                      className="group text-left w-full rounded-2xl border border-border/80 hover:border-emerald-500/50 bg-card/90 hover:bg-muted/30 p-2.5 sm:p-3 transition-all duration-200 shadow-2xs active:scale-[0.985] min-h-[58px] flex items-center justify-between gap-2"
                    >
                      {/* Left Ticker Avatar & Metadata */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex size-9.5 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-mono font-black text-xs shrink-0 border border-primary/20 group-hover:scale-105 transition-transform shadow-2xs">
                          {safeKode}
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                              {safeKode}
                            </h4>
                            <span className={cn(
                              "text-[8px] px-1.5 py-0.2 rounded-full border font-semibold shrink-0",
                              sektorWarna[meta.sektor] || "bg-muted text-muted-foreground border-border/60"
                            )}>
                              {meta.sektor}
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                            <span className="truncate">{safeNama}</span>
                            {userLot > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">
                                · {userLot} Lot
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Price & Trade Action CTA */}
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="font-mono text-right">
                          <div className="text-xs sm:text-sm font-extrabold text-foreground">
                            Rp {lastP.toLocaleString("id-ID")}
                          </div>
                          <div className={cn(
                            "text-[9.5px] font-bold flex items-center justify-end gap-0.5",
                            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          )}>
                            {isPositive ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                            <span>{isPositive ? "+" : ""}{chg.toFixed(1)}%</span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1 group-hover:bg-emerald-500/20 transition-all shrink-0 min-h-[34px]">
                          <Zap className="size-3 text-emerald-500 fill-emerald-500/30" />
                          <span>Trade</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Mobile Unified Full-View Trading Order Modal (Charts + Orderbook + Order Form) ── */}
            {isOrderModalOpen && stock && (
              <div className="fixed inset-0 z-[80] md:hidden flex items-center justify-center p-2 sm:p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div className="fixed inset-0" onClick={handleCloseOrderModal} />
                
                <div className="relative z-10 w-full max-w-[440px] max-h-[96vh] flex flex-col gap-1.5 animate-in zoom-in-95 duration-200">
                  {/* Running text directly above order modal card with a small gap */}
                  {runningText.active && runningText.type !== "NONE" && (
                    <div className="w-full shrink-0 animate-in slide-in-from-top-2 duration-200 shadow-xl">
                      <RunningText
                        active={runningText.active}
                        type={runningText.type}
                        title={runningText.title}
                        content={runningText.content}
                      />
                    </div>
                  )}

                  {/* Modal Card Content (Unified Single-View) */}
                  <div className={cn(
                    "w-full bg-background dark:bg-zinc-950 border rounded-3xl p-3 sm:p-4 shadow-2xl shadow-black/50 flex flex-col max-h-[88vh] overflow-hidden",
                    orderType === "BID" 
                      ? "border-emerald-500/30 dark:border-emerald-500/40 shadow-emerald-500/10" 
                      : "border-rose-500/30 dark:border-rose-500/40 shadow-rose-500/10"
                  )}>
                    {/* Segmented Top Multi-Stock Step Bar */}
                    <div className="flex items-center gap-1 w-full shrink-0 pb-1">
                      {stocks.map((s, idx) => {
                        const isCur = s.id === stock.id;
                        const isOrdered = ordersPlacedMap[s.id] === true;
                        const userLot = portfoliosMap[s.id] || 0;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectStock(s)}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              isCur 
                                ? "bg-primary ring-2 ring-primary/30" 
                                : isOrdered 
                                  ? "bg-emerald-500" 
                                  : userLot > 0 
                                    ? "bg-emerald-500/60" 
                                    : "bg-muted/80 dark:bg-zinc-800"
                            )}
                            title={`Saham ${(s as any).kodeSaham || (s as any).kode} ${isOrdered ? "(Sudah diorder)" : ""}`}
                          />
                        );
                      })}
                    </div>

                    {/* Modal Header: Stock Switcher & Live Timer */}
                    <div className="flex items-center justify-between border-b border-border/50 pb-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.2 rounded-full bg-primary/10 border border-primary/30 text-primary font-bold text-[9.5px] shrink-0">
                          {currentStockIdx + 1}/{stocks.length}
                        </span>
                        {ordersPlacedMap[stock.id] && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 shrink-0">
                            <CheckCircle2 className="size-2.5" /> Terorder
                          </span>
                        )}
                        
                        {/* Quick Chevron Stock Switcher */}
                        <div className="flex items-center gap-0.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              const prevStock = stocks[(currentStockIdx - 1 + stocks.length) % stocks.length];
                              if (prevStock) selectStock(prevStock);
                            }}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Saham Sebelumnya"
                          >
                            <ChevronLeft className="size-3.5" />
                          </button>
                          
                          <span className="font-extrabold text-xs text-foreground truncate px-0.5">
                            {stock.kodeSaham}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              const nextStock = stocks[(currentStockIdx + 1) % stocks.length];
                              if (nextStock) selectStock(nextStock);
                            }}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Saham Berikutnya"
                          >
                            <ChevronRight className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {sessionActive && (
                          <span className={cn(
                            "px-2.5 py-1 rounded-xl border font-mono font-black text-xs flex items-center gap-1.5 shadow-xs",
                            isPaused
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300"
                              : sessionTimer <= 10
                                ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse ring-2 ring-rose-500/30"
                                : sessionTimer <= 30
                                  ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          )}>
                            <Timer className="size-3.5 shrink-0" />
                            <span>{Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, "0")}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleCloseOrderModal}
                          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Tutup Modal"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Body Content (Unified Layout) */}
                    {(() => {
                      const safeKode = (stock as any).kodeSaham || (stock as any).kode || "N/A";
                      const safeNama = (stock as any).namaSaham || (stock as any).nama || "";
                      const meta = getMeta(safeKode);
                      const modalStockPrice = (currentPrice > 0 ? currentPrice : null) || lastPrices[stock.id] || openingPrices[stock.id] || Number(stock.basePrice) || 1000;
                      const openP = openingPrices[stock.id] || Number(stock.basePrice) || modalStockPrice;
                      const chg = openP > 0 ? ((modalStockPrice - openP) / openP) * 100 : 0;
                      const isPositive = chg >= 0;
                      const baseP = openingPrices[stock.id] || Number(stock?.basePrice || 0) || modalStockPrice;
                      const { upper, lower } = getAutoRejectionLimits(baseP);
                      const userOwnedLot = portfoliosMap[stock.id] || 0;

                      const pNum = parseInt(orderPrice) || 0;
                      const lotNum = parseInt(orderLot) || 0;
                      const totalEst = pNum * (lotNum * 100);
                      const isPriceInvalid = pNum > 0 && (!isValidTickSize(pNum) || pNum > upper || pNum < lower);
                      const isLotInvalid = lotNum > 0 && ((orderType === "ASK" && lotNum > userOwnedLot) || (orderType === "BID" && totalEst > balance));

                      return (
                        <div className="flex-1 overflow-y-auto space-y-2.5 py-2 pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                          {/* 1. Stock Identity & Metrics Banner */}
                          <div className="p-2.5 rounded-2xl bg-card/80 border border-border/70 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex min-w-[42px] h-8 px-2 items-center justify-center rounded-xl bg-primary/15 text-primary font-mono font-black text-xs whitespace-nowrap shrink-0 border border-primary/30 shadow-2xs">
                                  {safeKode}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs text-foreground truncate">{safeNama}</span>
                                    <span className={cn(
                                      "text-[7.5px] px-1.5 py-0.2 rounded-full border font-semibold shrink-0",
                                      sektorWarna[meta.sektor] || "bg-muted text-muted-foreground"
                                    )}>
                                      {meta.sektor}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 font-mono text-right shrink-0">
                                <span className="font-black text-xs sm:text-sm text-foreground whitespace-nowrap">
                                  Rp {modalStockPrice.toLocaleString("id-ID")}
                                </span>
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded-lg border whitespace-nowrap",
                                  isPositive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                                )}>
                                  {isPositive ? "+" : ""}{chg.toFixed(1)}%
                                </span>
                              </div>
                            </div>

                            {/* Sub-Detail: Ownership & ARA/ARB limits */}
                            <div className="flex items-center justify-between gap-1 text-[clamp(8px,2.4vw,9.5px)] font-mono text-muted-foreground pt-1 border-t border-border/40">
                              <span className="truncate">Milik: <b className="text-emerald-600 dark:text-emerald-400 font-sans">{userOwnedLot} Lot</b> ({userOwnedLot * 100} Lbr)</span>
                              <span className="shrink-0">ARA: <b className="text-foreground">{upper.toLocaleString("id-ID")}</b> · ARB: <b className="text-foreground">{lower.toLocaleString("id-ID")}</b></span>
                            </div>
                          </div>

                          {/* 2. Live Price Chart (Compact & Smooth) */}
                          <div className="p-2 rounded-2xl bg-card/80 border border-border/70">
                            <div className="flex items-center justify-between px-1 mb-1 text-[9.5px]">
                              <span className="font-bold text-foreground flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Grafik Harga Live ({stock.kodeSaham})
                              </span>
                              <span className="text-muted-foreground font-mono text-[8.5px]">
                                ARA: {upper.toLocaleString("id-ID")} · ARB: {lower.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="h-24 sm:h-28 w-full">
                              <PriceChart data={priceHistory} isUp={isPositive} compact={true} />
                            </div>
                          </div>

                          {/* 3. Order Execution Form Section */}
                          <div className="p-2.5 rounded-2xl bg-card/80 border border-border/70 space-y-2">
                            {/* BID / ASK Switcher Buttons */}
                            <div className="grid grid-cols-2 p-0.5 rounded-xl bg-muted/60 dark:bg-zinc-900 border border-border/80 text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() => setOrderType("BID")}
                                className={cn(
                                  "py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all",
                                  orderType === "BID" 
                                    ? "bg-emerald-500 text-white shadow-xs" 
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <ArrowDownToLine className="size-3.5" />
                                <span>Beli (BID)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOrderType("ASK")}
                                className={cn(
                                  "py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all",
                                  orderType === "ASK" 
                                    ? "bg-rose-500 text-white shadow-xs" 
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <ArrowUpFromLine className="size-3.5" />
                                <span>Jual (ASK)</span>
                              </button>
                            </div>

                            {/* Kas & Ownership Bar */}
                            <div className="flex items-center justify-between text-[9.5px] text-muted-foreground px-0.5 font-mono">
                              <span>
                                {orderType === "BID" 
                                  ? `Sisa Kas: Rp ${balance.toLocaleString("id-ID")} `
                                  : `Milik: ${userOwnedLot} Lot (${stock.kodeSaham})`
                                }
                              </span>
                              <span>ARA/ARB: {lower.toLocaleString("id-ID")} – {upper.toLocaleString("id-ID")}</span>
                            </div>

                            {/* 2-Column Form Grid (Harga & Lot) */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* Left: Input Harga */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9.5px]">
                                  <span className="font-bold text-foreground">Harga (Rp):</span>
                                  <span className="text-[8px] text-muted-foreground">Fraksi BEI</span>
                                </div>
                                
                                <PriceInput
                                  value={orderPrice}
                                  onChange={setOrderPrice}
                                  basePrice={baseP}
                                  min={1}
                                  placeholder="0"
                                  compact={true}
                                />

                                {/* Quick Price Chips */}
                                <div className="grid grid-cols-3 gap-1 pt-0.5 text-[9px] font-mono">
                                  <button
                                    type="button"
                                    onClick={() => setOrderPrice(String(modalStockPrice))}
                                    className="py-1 px-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 text-center font-medium active:scale-95"
                                  >
                                    Pasar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOrderPrice(String(upper))}
                                    className="py-1 px-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-center font-bold active:scale-95"
                                  >
                                    ARA
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOrderPrice(String(lower))}
                                    className="py-1 px-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-center font-bold active:scale-95"
                                  >
                                    ARB
                                  </button>
                                </div>
                              </div>

                              {/* Right: Input Lot */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9.5px]">
                                  <span className="font-bold text-foreground">Jumlah (Lot):</span>
                                  <span className="text-[8.5px] text-muted-foreground font-mono">
                                    {orderType === "BID" 
                                      ? (pNum > 0 ? `Maks: ${Math.floor(balance / (pNum * 100))}` : "") 
                                      : `Maks: ${userOwnedLot}`
                                    }
                                  </span>
                                </div>

                                <div className="flex items-center rounded-xl border border-border/80 bg-background overflow-hidden h-8.5">
                                  <button
                                    type="button"
                                    onClick={() => setOrderLot(String(Math.max(1, (parseInt(orderLot) || 2) - 1)))}
                                    className="px-2.5 h-full flex items-center justify-center hover:bg-muted text-muted-foreground active:scale-95 font-bold text-base"
                                  >
                                    -
                                  </button>
                                  <Input
                                    type="number"
                                    min="1"
                                    placeholder="0"
                                    value={orderLot}
                                    onChange={e => setOrderLot(e.target.value)}
                                    className="h-full border-0 text-center font-mono font-bold text-xs p-0 focus-visible:ring-0 shadow-none bg-transparent placeholder:text-muted-foreground/35"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setOrderLot(String((parseInt(orderLot) || 0) + 1))}
                                    className="px-2.5 h-full flex items-center justify-center hover:bg-muted text-muted-foreground active:scale-95 font-bold text-base"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Quick Lot Chips */}
                                <div className="grid grid-cols-3 gap-1 pt-0.5 text-[9px] font-mono">
                                  <button
                                    type="button"
                                    onClick={() => setOrderLot(String((lotNum || 0) + 1))}
                                    className="py-1 px-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 text-center font-medium active:scale-95"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOrderLot(String((lotNum || 0) + 5))}
                                    className="py-1 px-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 text-center font-medium active:scale-95"
                                  >
                                    +5
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (orderType === "BID") {
                                        if (pNum > 0) {
                                          const maxB = Math.floor(balance / (pNum * 100));
                                          if (maxB > 0) setOrderLot(String(maxB));
                                        }
                                      } else {
                                        if (userOwnedLot > 0) setOrderLot(String(userOwnedLot));
                                      }
                                    }}
                                    className="py-1 px-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-center font-bold active:scale-95"
                                  >
                                    Max
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Transaction Summary Single Row */}
                            <div className="px-2.5 py-1 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between text-[9.5px] font-mono">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-bold text-foreground">
                                  Rp {totalEst.toLocaleString("id-ID")}
                                </span>
                              </div>
                              {orderType === "BID" && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Sisa:</span>
                                  <span className={cn("font-semibold", balance - totalEst >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400 font-bold")}>
                                    Rp {(balance - totalEst).toLocaleString("id-ID")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Error validations */}
                            {(isPriceInvalid || isLotInvalid) && (
                              <p className="text-[9px] text-rose-600 dark:text-rose-400 font-medium px-0.5">
                                {isPriceInvalid 
                                  ? (!isValidTickSize(pNum) ? `Harga harus kelipatan Rp ${getTickSize(pNum)}` : `Di luar batas (${lower.toLocaleString("id-ID")} – ${upper.toLocaleString("id-ID")})`)
                                  : (orderType === "ASK" ? `Lot melebihi milik (${userOwnedLot} lot)` : "Saldo kas tidak cukup")
                                }
                              </p>
                            )}
                          </div>

                          {/* 4. Real-Time Auction Order Book (Placed at bottom for variable depth queue) */}
                          <div className="p-2.5 rounded-2xl bg-card/80 border border-border/70 space-y-1.5 font-mono text-[9.5px]">
                            <div className="flex items-center justify-between px-1 text-[8.5px] text-muted-foreground">
                              <span className="font-bold text-foreground flex items-center gap-1">
                                <Activity className="size-3 text-primary" />
                                Order Book Lelang Real-Time
                              </span>
                              <span>Klik harga untuk salin</span>
                            </div>

                            <div className="grid grid-cols-2 divide-x divide-border/60">
                              {/* BID List */}
                              <div className="pr-1.5 space-y-0.5">
                                <div className="text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between pb-0.5 border-b border-border/30">
                                  <span>BID (Beli)</span>
                                  <span>Lot</span>
                                </div>
                                {bids.length === 0 ? (
                                  <p className="text-[8.5px] text-muted-foreground text-center py-2">Belum ada bid</p>
                                ) : (
                                  [...bids].sort((a, b) => b.harga - a.harga).map(b => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => setOrderPrice(String(b.harga))}
                                      className="relative w-full flex items-center justify-between py-0.5 px-1 rounded hover:bg-emerald-500/15 transition-colors overflow-hidden font-mono"
                                      title="Salin harga bid"
                                    >
                                      <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{ width: `${(b.jumlah / (maxBid || 1)) * 100}%` }} />
                                      <span className="relative font-bold text-emerald-600 dark:text-emerald-400">Rp {b.harga.toLocaleString("id-ID")}</span>
                                      <span className="relative text-foreground font-semibold">{b.jumlah}L</span>
                                    </button>
                                  ))
                                )}
                              </div>

                              {/* ASK List */}
                              <div className="pl-1.5 space-y-0.5">
                                <div className="text-[8.5px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between pb-0.5 border-b border-border/30">
                                  <span>ASK (Jual)</span>
                                  <span>Lot</span>
                                </div>
                                {asks.length === 0 ? (
                                  <p className="text-[8.5px] text-muted-foreground text-center py-2">Belum ada ask</p>
                                ) : (
                                  [...asks].sort((a, b) => a.harga - b.harga).map(a => (
                                    <button
                                      key={a.id}
                                      type="button"
                                      onClick={() => setOrderPrice(String(a.harga))}
                                      className="relative w-full flex items-center justify-between py-0.5 px-1 rounded hover:bg-rose-500/15 transition-colors overflow-hidden font-mono"
                                      title="Salin harga ask"
                                    >
                                      <div className="absolute inset-y-0 left-0 bg-rose-500/10" style={{ width: `${(a.jumlah / (maxAsk || 1)) * 100}%` }} />
                                      <span className="relative font-bold text-rose-600 dark:text-rose-400">Rp {a.harga.toLocaleString("id-ID")}</span>
                                      <span className="relative text-foreground font-semibold">{a.jumlah}L</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bottom CTA Action Bar (Shrink-0) */}
                    {(() => {
                      const baseP = openingPrices[stock.id] || Number(stock?.basePrice || 0) || currentPrice;
                      const { upper, lower } = getAutoRejectionLimits(baseP);
                      const pNum = parseInt(orderPrice) || 0;
                      const lotNum = parseInt(orderLot) || 0;
                      const totalEst = pNum * (lotNum * 100);
                      const isPriceInvalid = pNum > 0 && (!isValidTickSize(pNum) || pNum > upper || pNum < lower);
                      const userOwnedLot = portfoliosMap[stock.id] || 0;
                      const isLotInvalid = lotNum > 0 && ((orderType === "ASK" && lotNum > userOwnedLot) || (orderType === "BID" && totalEst > balance));

                      return (
                        <div className="flex items-center gap-2 pt-1.5 border-t border-border/40 shrink-0">
                          <Button
                            onClick={handlePlaceOrder}
                            disabled={isPriceInvalid || isLotInvalid || lotNum <= 0 || pNum <= 0}
                            className={cn(
                              "flex-1 h-10 sm:h-11 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] min-h-[42px] flex items-center justify-center gap-1.5",
                              orderType === "BID"
                                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/20"
                                : "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-rose-500/20"
                            )}
                          >
                            <Sparkles className="size-3.5" />
                            <span>
                              {(() => {
                                const remainingCount = stocks.filter(s => !ordersPlacedMap[s.id] && s.id !== stock.id).length;
                                const isLastUnordered = remainingCount === 0;
                                const lotText = lotNum > 0 ? ` · ${lotNum}L` : "";
                                if (isLastUnordered) {
                                  return orderType === "BID" ? `Kirim Beli & Selesai${lotText}` : `Kirim Jual & Selesai${lotText}`;
                                }
                                return orderType === "BID" ? `Kirim Beli & Lanjut ›${lotText}` : `Kirim Jual & Lanjut ›${lotText}`;
                              })()}
                            </span>
                          </Button>

                          {(() => {
                            const nextStock = stocks[(currentStockIdx + 1) % stocks.length];
                            return (
                              <Button
                                variant="outline"
                                type="button"
                                onClick={() => {
                                  if (nextStock) selectStock(nextStock);
                                }}
                                className="h-10 sm:h-11 px-3 rounded-2xl text-xs font-semibold text-muted-foreground hover:text-foreground min-h-[42px] shrink-0 active:scale-95"
                                title="Lewati ke Saham Berikutnya"
                              >
                                <SkipForward className="size-3.5 mr-1" />
                                <span>Lewati ›</span>
                              </Button>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════
              2. DESKTOP VIEW (hidden md:block): Modern Minimalist Workstation or Catalog
             ══════════════════════════════════════════════════════════ */}
          <div className="hidden md:block space-y-4">
            {!stock ? (
              /* A. DESKTOP STOCK CATALOG (DAFTAR SAHAM PERDAGANGAN) */
              <div className="space-y-4">
                {/* Desktop Summary Hero Banner */}
                <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-emerald-500/5 p-5 shadow-xs flex items-center justify-between gap-6">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex size-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-3 bg-emerald-500" />
                      </span>
                      <span className="font-extrabold text-base text-foreground">
                        Pasar Perdagangan Aktif
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                        {stocks.length} Saham Tersedia
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pilih saham di bawah untuk membuka terminal perdagangan, memantau grafik harga real-time, dan mengirimkan order lelang (BID / ASK).
                    </p>
                  </div>

                  {/* Right Financial Balance Cards */}
                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 min-w-[170px]">
                      <span className="text-[10px] uppercase font-sans font-semibold text-muted-foreground block">
                        Kas Tersedia
                      </span>
                      <span className="font-extrabold text-base text-foreground truncate block">
                        Rp {balance.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 min-w-[170px] text-right">
                      <span className="text-[10px] uppercase font-sans font-semibold text-muted-foreground block">
                        Nilai Portofolio
                      </span>
                      <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400 truncate block">
                        Rp {totalStockValue.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section Title */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">Daftar Saham Perdagangan ({stocks.length})</h3>
                    <span className="text-xs text-muted-foreground">· Klik kartu atau tombol untuk masuk ke terminal transaksi</span>
                  </div>
                </div>

                {/* 3-Column Desktop Stock Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stocks.map(s => {
                    const safeKode = (s as any).kodeSaham || (s as any).kode || "N/A";
                    const safeNama = (s as any).namaSaham || (s as any).nama || "Tidak ada data";
                    const meta = getMeta(safeKode);
                    const lastP = lastPrices[s.id] || openingPrices[s.id] || Number(s.basePrice) || 1000;
                    const openP = openingPrices[s.id] || Number(s.basePrice) || lastP;
                    const chg = openP > 0 ? ((lastP - openP) / openP) * 100 : 0;
                    const userLot = portfoliosMap[s.id] || 0;
                    const isPositive = chg >= 0;
                    const isOrdered = ordersPlacedMap[s.id] === true;
                    const baseP = openingPrices[s.id] || Number(s.basePrice) || lastP;
                    const { upper, lower } = getAutoRejectionLimits(baseP);

                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "group relative rounded-3xl border border-border/80 hover:border-emerald-500/50 bg-card p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4",
                          isOrdered ? "border-emerald-500/30 bg-emerald-500/[0.02]" : ""
                        )}
                      >
                        {/* Top: Identity, Sector, Description */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-mono font-black text-sm shrink-0 border border-primary/20 group-hover:scale-105 transition-transform shadow-2xs">
                                {safeKode}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                    {safeKode}
                                  </h4>
                                  <span className={cn(
                                    "text-[8.5px] px-2 py-0.5 rounded-full border font-semibold shrink-0",
                                    sektorWarna[meta.sektor] || "bg-muted text-muted-foreground border-border/60"
                                  )}>
                                    {meta.sektor}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{safeNama}</p>
                              </div>
                            </div>

                            {isOrdered && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                <span>Diorder</span>
                              </span>
                            )}
                          </div>

                          <p className="text-[11.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {meta.deskripsi}
                          </p>
                        </div>

                        {/* Middle: Live Price, Change, ARA/ARB */}
                        <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                          <div className="flex items-center justify-between font-mono">
                            <div>
                              <span className="text-[9.5px] font-sans font-semibold text-muted-foreground uppercase block">
                                Harga Real-Time
                              </span>
                              <span className="font-black text-lg text-foreground">
                                Rp {lastP.toLocaleString("id-ID")}
                              </span>
                            </div>

                            <div className={cn(
                              "px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0",
                              isPositive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                            )}>
                              {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                              <span>{isPositive ? "+" : ""}{chg.toFixed(1)}%</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10.5px] text-muted-foreground font-mono">
                            <span>ARA: <b className="text-foreground">Rp {upper.toLocaleString("id-ID")}</b></span>
                            <span>·</span>
                            <span>ARB: <b className="text-foreground">Rp {lower.toLocaleString("id-ID")}</b></span>
                          </div>
                        </div>

                        {/* Bottom: Portfolio Info & Trade Button */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium text-[11px]">Kepemilikan:</span>
                            <span className={cn("font-mono font-bold", userLot > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                              {userLot > 0 ? `${userLot} Lot (${(userLot * 100).toLocaleString("id-ID")} Lbr)` : "0 Lot"}
                            </span>
                          </div>

                          <Button
                            onClick={() => selectStock(s)}
                            className="w-full h-11 rounded-2xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2 group-hover:shadow-lg transition-all"
                          >
                            <Zap className="size-4 fill-current" />
                            <span>Buka Terminal Transaksi {safeKode} ›</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* B. DESKTOP WORKSTATION (KEMBALI KE DAFTAR SAHAM & 12-COL GRID) */
              (() => {
                const activeStock = stock;
                const safeKode = (activeStock as any).kodeSaham || (activeStock as any).kode || "N/A";
                const safeNama = (activeStock as any).namaSaham || (activeStock as any).nama || "";
                const meta = getMeta(safeKode);
                const activeStockPrice = (currentPrice > 0 ? currentPrice : null) || lastPrices[activeStock.id] || openingPrices[activeStock.id] || Number(activeStock.basePrice) || 1000;
                const openP = openingPrices[activeStock.id] || Number(activeStock.basePrice) || activeStockPrice;
                const chg = openP > 0 ? ((activeStockPrice - openP) / openP) * 100 : 0;
                const isPositive = chg >= 0;
                const userLot = portfoliosMap[activeStock.id] || 0;
                const baseP = openingPrices[activeStock.id] || Number(activeStock.basePrice) || activeStockPrice;
                const { upper, lower } = getAutoRejectionLimits(baseP);

                const pNum = parseInt(orderPrice) || 0;
                const lotNum = parseInt(orderLot) || 0;
                const totalEst = pNum * (lotNum * 100);
                const isPriceInvalid = pNum > 0 && (!isValidTickSize(pNum) || pNum > upper || pNum < lower);
                const isLotInvalid = lotNum > 0 && ((orderType === "ASK" && lotNum > userLot) || (orderType === "BID" && totalEst > balance));

                return (
                  <div className="space-y-4">
                    {/* Top Navigation & Stock Switcher Bar */}
                    <div className="flex items-center justify-between gap-3 p-1.5 rounded-2xl bg-card/80 border border-border/70 backdrop-blur-md shadow-2xs">
                      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 max-w-[70%]">
                        {/* Back to Catalog Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStock(null);
                            setSelectedId(null);
                          }}
                          className="h-8 px-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center gap-1.5 shrink-0 border border-border/60"
                        >
                          <ChevronLeft className="size-4" />
                          <span>Daftar Saham</span>
                        </Button>

                        <div className="h-4 w-px bg-border/80 shrink-0" />

                        {stocks.map(s => {
                          const isCur = activeStock.id === s.id;
                          const sKode = (s as any).kodeSaham || (s as any).kode || "N/A";
                          const sMeta = getMeta(sKode);
                          const sLastP = lastPrices[s.id] || openingPrices[s.id] || Number(s.basePrice) || 1000;
                          const sOpenP = openingPrices[s.id] || Number(s.basePrice) || sLastP;
                          const sChg = sOpenP > 0 ? ((sLastP - sOpenP) / sOpenP) * 100 : 0;
                          const sOrdered = ordersPlacedMap[s.id] === true;
                          const sUserLot = portfoliosMap[s.id] || 0;

                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => selectStock(s)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-2 shrink-0 font-mono",
                                isCur
                                  ? "bg-primary/10 text-primary font-bold border border-primary/30 shadow-xs ring-1 ring-primary/20"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                              )}
                            >
                              <span className="font-bold">{sKode}</span>
                              <span className="text-[11px] font-sans text-foreground">Rp {sLastP.toLocaleString("id-ID")}</span>
                              <span className={cn("text-[9.5px] font-sans font-semibold", sChg >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                {sChg >= 0 ? "+" : ""}{sChg.toFixed(1)}%
                              </span>
                              {sOrdered ? (
                                <span className="size-1.5 rounded-full bg-emerald-500" title="Sudah diorder" />
                              ) : sUserLot > 0 ? (
                                <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-sans font-bold">({sUserLot}L)</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Metrics Quick Pill */}
                      <div className="flex items-center gap-3 pr-2 text-xs font-mono shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-sans text-[11px]">Kas:</span>
                          <span className="font-bold text-foreground">Rp {balance.toLocaleString("id-ID")}</span>
                        </div>
                        <span className="text-border">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground font-sans text-[11px]">Portofolio:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">Rp {totalStockValue.toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Active Stock Identity & Live Price Ribbon */}
                    <div className="flex items-center justify-between px-5 py-3.5 rounded-3xl bg-gradient-to-r from-card via-card/95 to-muted/20 border border-border/80 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-mono font-black text-sm border border-primary/25 shadow-2xs">
                          {safeKode}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="font-extrabold text-base text-foreground truncate">{safeNama}</h2>
                            <span className={cn(
                              "text-[8.5px] px-2 py-0.5 rounded-full border font-semibold",
                              sektorWarna[meta.sektor] || "bg-muted text-muted-foreground"
                            )}>
                              {meta.sektor}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-md">{meta.deskripsi}</p>
                        </div>
                      </div>

                      {/* Big Live Price Display */}
                      <div className="flex items-center gap-4 shrink-0 font-mono text-right">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans font-semibold">Harga Real-Time</div>
                          <div className="text-2xl font-black text-foreground">
                            Rp {activeStockPrice.toLocaleString("id-ID")}
                          </div>
                        </div>

                        <div className={cn(
                          "px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0",
                          isPositive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                        )}>
                          {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          <span>{isPositive ? "+" : ""}{chg.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 12-Column Main Workstation Grid: Left Chart & Orderbook (7 Col) | Right Order Hub (5 Col) */}
                    <div className="grid grid-cols-12 gap-5 items-start">
                      {/* Left Column (7/12): Live Chart & Live Orderbook */}
                      <div className="col-span-12 lg:col-span-7 space-y-4">
                        {/* Big Live Price Chart */}
                        <Card className="border-border/80 bg-card/90 shadow-xs rounded-3xl overflow-hidden">
                          <CardHeader className="py-3 px-5 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                              <CardTitle className="text-xs font-bold text-foreground">
                                Grafik Harga Live ({safeKode})
                              </CardTitle>
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                              <span>ARA: <b className="text-foreground">Rp {upper.toLocaleString("id-ID")}</b></span>
                              <span>·</span>
                              <span>ARB: <b className="text-foreground">Rp {lower.toLocaleString("id-ID")}</b></span>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="h-60 w-full">
                              <PriceChart data={priceHistory} isUp={isPositive} compact={false} />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Live Auction Order Book */}
                        <Card className="border-border/80 bg-card/90 shadow-xs rounded-3xl overflow-hidden">
                          <CardHeader className="py-3 px-5 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                              <Activity className="size-3.5 text-primary" />
                              <span>Order Book Lelang Real-Time</span>
                            </CardTitle>
                            <span className="text-[10px] text-muted-foreground">Klik harga untuk memasukkan ke formulir</span>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="grid grid-cols-2 divide-x divide-border/60">
                              {/* BID Column */}
                              <div className="p-3.5 space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1"><ArrowDownToLine className="size-3" /> Antrean Beli (BID)</span>
                                  <span>Lot</span>
                                </div>
                                <div className="space-y-1">
                                  {bids.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-6 text-center">Belum ada antrean bid</p>
                                  ) : (
                                    [...bids].sort((a, b) => b.harga - a.harga).slice(0, 7).map(b => (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setOrderPrice(String(b.harga))}
                                        className="relative w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs overflow-hidden hover:bg-emerald-500/15 transition-colors font-mono group"
                                        title="Klik untuk salin harga"
                                      >
                                        <div className="absolute inset-y-0 left-0 bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors" style={{ width: `${(b.jumlah / maxBid) * 100}%` }} />
                                        <span className="relative font-bold text-emerald-600 dark:text-emerald-400">Rp {b.harga.toLocaleString("id-ID")}</span>
                                        <span className="relative text-foreground font-semibold">{b.jumlah} L</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* ASK Column */}
                              <div className="p-3.5 space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1"><ArrowUpFromLine className="size-3" /> Antrean Jual (ASK)</span>
                                  <span>Lot</span>
                                </div>
                                <div className="space-y-1">
                                  {asks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-6 text-center">Belum ada antrean ask</p>
                                  ) : (
                                    [...asks].sort((a, b) => a.harga - b.harga).slice(0, 7).map(a => (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => setOrderPrice(String(a.harga))}
                                        className="relative w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs overflow-hidden hover:bg-rose-500/15 transition-colors font-mono group"
                                        title="Klik untuk salin harga"
                                      >
                                        <div className="absolute inset-y-0 left-0 bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors" style={{ width: `${(a.jumlah / maxAsk) * 100}%` }} />
                                        <span className="relative font-bold text-rose-600 dark:text-rose-400">Rp {a.harga.toLocaleString("id-ID")}</span>
                                        <span className="relative text-foreground font-semibold">{a.jumlah} L</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Right Column (5/12): Order Execution Panel & Portfolio */}
                      <div className="col-span-12 lg:col-span-5 space-y-4">
                        {/* Order Execution Card */}
                        <Card className={cn(
                          "border rounded-3xl bg-card/95 shadow-sm transition-all duration-300",
                          orderType === "BID" ? "border-emerald-500/30 dark:border-emerald-500/25" : "border-rose-500/30 dark:border-rose-500/25"
                        )}>
                          <CardHeader className="py-3 px-5 border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-xs font-bold flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {orderType === "BID" ? <ArrowDownToLine className="size-4 text-emerald-500" /> : <ArrowUpFromLine className="size-4 text-rose-500" />}
                                <span>Eksekusi Order ({safeKode})</span>
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-lg border border-border/50">
                                Milik: <b className="text-foreground">{userLot} Lot</b>
                              </span>
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="p-5 space-y-4">
                            {/* Segmented BID / ASK Tabs */}
                            <div className="grid grid-cols-2 p-1 rounded-2xl border border-border/80 bg-muted/50 text-xs font-bold">
                              <button
                                type="button"
                                onClick={() => setOrderType("BID")}
                                className={cn(
                                  "py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all",
                                  orderType === "BID" 
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <ArrowDownToLine className="size-3.5" />
                                <span>Beli (BID)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOrderType("ASK")}
                                className={cn(
                                  "py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all",
                                  orderType === "ASK" 
                                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" 
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <ArrowUpFromLine className="size-3.5" />
                                <span>Jual (ASK)</span>
                              </button>
                            </div>

                            {/* Order Price Section */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-foreground">Harga Order (Rp)</span>
                                <TickSizeBadge price={pNum} basePrice={baseP} />
                              </div>

                              <PriceInput
                                value={orderPrice}
                                onChange={setOrderPrice}
                                basePrice={baseP}
                                min={1}
                                placeholder="0"
                              />

                              {/* Quick Price Chips */}
                              <div className="flex items-center gap-1.5 pt-0.5 text-xs font-mono">
                                <button
                                  type="button"
                                  onClick={() => setOrderPrice(String(activeStockPrice))}
                                  className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 text-foreground font-medium"
                                >
                                  Pasar ({activeStockPrice.toLocaleString("id-ID")})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOrderPrice(String(upper))}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                >
                                  ARA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOrderPrice(String(lower))}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold"
                                >
                                  ARB
                                </button>
                              </div>
                            </div>

                            {/* Order Lot Section */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-foreground">Jumlah Lot</span>
                                <span className="text-muted-foreground font-mono text-[11px]">
                                  {orderType === "BID" 
                                    ? (pNum > 0 ? `Maks Beli: ${Math.floor(balance / (pNum * 100))} Lot` : "") 
                                    : `Maks Jual: ${userLot} Lot`
                                  }
                                </span>
                              </div>

                              <div className="flex items-center rounded-2xl border border-border/80 bg-background overflow-hidden h-10 px-1">
                                <button
                                  type="button"
                                  onClick={() => setOrderLot(String(Math.max(1, (parseInt(orderLot) || 2) - 1)))}
                                  className="size-8 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground active:scale-95 text-base font-bold"
                                >
                                  -
                                </button>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="0"
                                  value={orderLot}
                                  onChange={e => setOrderLot(e.target.value)}
                                  className="h-full border-0 text-center font-mono font-bold text-sm p-0 focus-visible:ring-0 shadow-none bg-transparent placeholder:text-muted-foreground/35"
                                />
                                <button
                                  type="button"
                                  onClick={() => setOrderLot(String((parseInt(orderLot) || 0) + 1))}
                                  className="size-8 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground active:scale-95 text-base font-bold"
                                >
                                  +
                                </button>
                              </div>

                              {/* Quick Lot Chips */}
                              <div className="flex items-center gap-1.5 pt-0.5 text-xs font-mono">
                                <button type="button" onClick={() => setOrderLot(String((lotNum || 0) + 1))} className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60">+1</button>
                                <button type="button" onClick={() => setOrderLot(String((lotNum || 0) + 5))} className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60">+5</button>
                                <button type="button" onClick={() => setOrderLot(String((lotNum || 0) + 10))} className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border/60">+10</button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (orderType === "BID") {
                                      if (pNum > 0) setOrderLot(String(Math.floor(balance / (pNum * 100))));
                                    } else {
                                      if (userLot > 0) setOrderLot(String(userLot));
                                    }
                                  }}
                                  className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold ml-auto"
                                >
                                  Maks
                                </button>
                              </div>
                            </div>

                            {/* Transaction Calculation Box */}
                            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-1.5 text-xs font-mono">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-sans">Total Nilai Order:</span>
                                <span className="font-extrabold text-foreground text-sm">Rp {totalEst.toLocaleString("id-ID")}</span>
                              </div>
                              {orderType === "BID" && (
                                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                  <span className="text-muted-foreground font-sans">Sisa Saldo Kas:</span>
                                  <span className={balance - totalEst >= 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                                    Rp {(balance - totalEst).toLocaleString("id-ID")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Error Validation Messages */}
                            {(isPriceInvalid || isLotInvalid) && (
                              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium px-1">
                                {isPriceInvalid 
                                  ? (!isValidTickSize(pNum) ? `Harga harus kelipatan Rp ${getTickSize(pNum)}` : `Harga di luar rentang ARA/ARB (${lower.toLocaleString("id-ID")} – ${upper.toLocaleString("id-ID")})`)
                                  : (orderType === "ASK" ? `Jumlah lot melebihi kepemilikan (${userLot} lot)` : "Saldo kas tidak mencukupi untuk order ini")
                                }
                              </p>
                            )}

                            {/* Primary CTA Place Order Button */}
                            <Button
                              size="lg"
                              onClick={handlePlaceOrder}
                              disabled={isPriceInvalid || isLotInvalid || lotNum <= 0 || pNum <= 0}
                              className={cn(
                                "w-full h-12 rounded-2xl text-white font-bold text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 min-h-[48px]",
                                orderType === "BID"
                                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/25"
                                  : "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-rose-500/25"
                              )}
                            >
                              <Sparkles className="size-4" />
                              <span>
                                {orderType === "BID" 
                                  ? `Kirim Order Beli (${lotNum > 0 ? `${lotNum} Lot` : "BID"})` 
                                  : `Kirim Order Jual (${lotNum > 0 ? `${lotNum} Lot` : "ASK"})`
                                }
                              </span>
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
