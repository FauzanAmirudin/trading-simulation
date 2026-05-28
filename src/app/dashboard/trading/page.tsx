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
} from "lucide-react";
import { toast } from "sonner";
import { InterventionType, SubSessionPhase, getPhaseLabel, getInterventionLabel } from "@/lib/experimental-matrix";
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
  Perbankan: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Consumer Goods": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Farmasi: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Telekomunikasi: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Infrastruktur: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Energi: "bg-yellow-600/10 text-yellow-500 border-yellow-600/20",
  Pertambangan: "bg-stone-500/10 text-stone-400 border-stone-500/20",
  Otomotif: "bg-red-500/10 text-red-400 border-red-500/20",
  Properti: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Ritel: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Teknologi: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Transportasi: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

function getMeta(kode: string) {
  return stockMeta[kode] ?? { sektor: "Lainnya", deskripsi: "Saham perusahaan terkemuka di bidangnya." };
}

// Optimasi 7: React.memo mencegah render ulang setiap timer tick
const PriceChart = memo(function PriceChart({ data, isUp }: { data: PricePoint[]; isUp: boolean }) {
  const w = 600, h = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 72 };

  let chartData = data;
  if (data.length === 1 && !isNaN(data[0].price)) {
    chartData = [
      { time: "Pra-Buka", price: data[0].price },
      { time: "Mulai Sesi", price: data[0].price }
    ];
  }

  if (chartData.length < 2 || chartData.some(d => isNaN(d.price))) {
    return <div className="flex items-center justify-center h-56 text-zinc-600 text-xs">Memuat data...</div>;
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
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) yTicks.push(min + (range * i) / 4);
  const xInt = Math.max(1, Math.floor(chartData.length / 6));
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
          <text x={pad.left - 8} y={yS(v) + 4} textAnchor="end" fill="#71717a" fontSize={10}>
            {v.toLocaleString("id-ID")}
          </text>
        </g>
      ))}
      <path d={areaD} fill="url(#cg)" style={{ transition: "all 0.5s ease-in-out" }} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.5s ease-in-out" }} />
      {/* Live Pulsing Price Indicator Dot */}
      <g>
        <circle cx={xS(chartData.length - 1)} cy={yS(chartData[chartData.length - 1].price)} r={4} fill={color} style={{ transition: "all 0.5s ease-in-out" }} />
        <circle cx={xS(chartData.length - 1)} cy={yS(chartData[chartData.length - 1].price)} r={10} fill={color} opacity={0.4} className="animate-ping" style={{ transition: "all 0.5s ease-in-out" }} />
      </g>
      {xLab.map((d, i) => (
        <text key={i} x={xS(chartData.indexOf(d))} y={h - 6} textAnchor="middle" fill="#71717a" fontSize={10}>
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
      <Skeleton className="h-8 w-48 bg-zinc-800" />
      <div className="flex gap-4"><Skeleton className="h-96 w-full bg-zinc-800" /></div>
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
  const [loading, setLoading] = useState(true);
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
  // Running text (shown during PRE_MARKET interventions)
  const [runningText, setRunningText] = useState<{ active: boolean; type: InterventionType; title: string; content: string }>({
    active: false, type: "NONE", title: "", content: "",
  });
  // Cooldown state
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownReason, setCooldownReason] = useState<string>("");

  // Refs to access the latest state in socket event listeners without re-subscribing
  const selectedIdRef = useRef<number | null>(null);
  const openingPricesRef = useRef<Record<number, number>>({});
  const lastPricesRef = useRef<Record<number, number>>({});

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    openingPricesRef.current = openingPrices;
  }, [openingPrices]);

  useEffect(() => {
    lastPricesRef.current = lastPrices;
  }, [lastPrices]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push("/login"); return; }
    // Initial state is determined by socket 'scheduler-state' event, not HTTP.
    // Just mark loading as done — the socket handler will set stocks/session.
    setLoading(false);
  }, [user, router]); // eslint-disable-line

  // ── Global socket: handles round/session events regardless of which stock is selected ──
  useEffect(() => {
    if (!user || !hydrated) return;
    const socket = getSocket();

    const onConnect = () => {
      socket.emit("authenticate", { userId: user.id });
      socket.emit("get-portfolio", { userId: user.id });
    };
    if (socket.connected) onConnect(); else socket.on("connect", onConnect);

    socket.on("round-started", (data: { roundNumber: number; period: number; stocks: Stock[] }) => {
      setRoundNumber(data.roundNumber);
      setPeriod(data.period);
      setSessionActive(true);
      setStocks(data.stocks);
    });

    socket.on("sub-session-started", (data: {
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
      // Optimasi 4: Mulai client-side countdown
      isRunningRef.current = true;
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      let remaining = data.duration;
      localTimerRef.current = setInterval(() => {
        if (!isRunningRef.current) return;
        remaining = Math.max(0, remaining - 1);
        setSessionTimer(remaining);
        if (remaining <= 0 && localTimerRef.current) {
          clearInterval(localTimerRef.current);
          localTimerRef.current = null;
        }
      }, 1000);
      if (data.phase === "PRE_MARKET") {
        setShowPredictionUI(true);
        setPredictionInput({});
      } else {
        setShowPredictionUI(false);
      }
      if (data.phase === "TRADING") {
        setRunningText(prev => ({ ...prev, active: false }));
      }
    });

    socket.on("sub-session-ended", (data: { roundNumber: number; sessionNumber: number }) => {
      if (data.sessionNumber === 1) {
        // PRE_OPENING ended — wait for sub-session-started (TRADING) event
      }
    });

    socket.on("timer-tick", (data: { roundNumber: number; sessionNumber: number; timeLeft: number }) => {
      // Optimasi 4: Server hanya sync setiap 10 detik — update local timer dengan nilai server
      setSessionTimer(data.timeLeft);
    });

    socket.on("opening-prices-calculated", (data: { roundNumber: number; prices: { stockId: number; price: number }[] }) => {
      const prices: Record<number, number> = {};
      data.prices.forEach(p => { prices[p.stockId] = p.price; });
      setOpeningPrices(prices);
      setLastPrices(prev => {
        const newPrices = { ...prev };
        data.prices.forEach(p => {
          newPrices[p.stockId] = p.price;
        });
        return newPrices;
      });
    });

    socket.on("round-ended", () => {
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
      // Optimasi 4: Stop client-side countdown
      isRunningRef.current = false;
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    });

    socket.on("cooldown-started", (data: { duration: number; reason: string }) => {
      setCooldownActive(true);
      setCooldownReason(data.reason === "between-sessions" ? "antar sesi" : "antar ronde");
      setPhase("COOLDOWN");
      setSessionTimer(data.duration);
      // Optimasi 4: Mulai client-side countdown untuk cooldown juga
      isRunningRef.current = true;
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      let remaining = data.duration;
      localTimerRef.current = setInterval(() => {
        if (!isRunningRef.current) return;
        remaining = Math.max(0, remaining - 1);
        setSessionTimer(remaining);
        if (remaining <= 0 && localTimerRef.current) {
          clearInterval(localTimerRef.current);
          localTimerRef.current = null;
        }
      }, 1000);
      setRunningText(prev => ({ ...prev, active: false }));
    });

    socket.on("intervention-ended", () => {
      setRunningText(prev => ({ ...prev, active: false }));
    });

    socket.on("period-ended", () => {
      setSessionActive(false);
      setRoundNumber(null);
      setPhase("IDLE");
      setSubSession(null);
      setStocks([]);
      setStock(null);
      setSelectedId(null);
      setRunningText(prev => ({ ...prev, active: false }));
      setCooldownActive(false);
      toast.success("Periode selesai!");
    });

    socket.on("experiment-ended", () => {
      toast.success("Eksperimen selesai! Terima kasih.");
    });

    socket.on("intervention-triggered", (data: {
      type: InterventionType;
      title: string;
      content: string;
    }) => {
      setActiveIntervention(data.type);
      setInterventionContent({ title: data.title, content: data.content });
      // Show running text ticker (only in PRE_MARKET)
      if (data.type !== "NONE") {
        setRunningText({ active: true, type: data.type, title: data.title, content: data.content });
      }
    });

    socket.on("scheduler-state", (data: any) => {
      // Single source of truth for session state on connect/reconnect
      if (data.activePeriod !== null && data.stocks && data.stocks.length > 0 && data.currentPhase !== "IDLE") {
        // Active session — populate UI
        setRoundNumber(data.activeRound);
        setSessionActive(true);
        setStocks(data.stocks);
        setPhase(data.phase || "PENDING");
        setSubSession(data.activeSubSession);
        setSessionTimer(data.timeLeft || 0);
        if (data.currentIntervention && data.currentIntervention !== "NONE") {
          setActiveIntervention(data.currentIntervention);
          setRunningText({
            active: true,
            type: data.currentIntervention,
            title: data.interventionTitle || "",
            content: data.interventionContent || "",
          });
        } else {
          setActiveIntervention("NONE");
          setRunningText(prev => ({ ...prev, active: false }));
        }
      } else {
        // No active session — ensure page is cleared
        setSessionActive(false);
        setStocks([]);
        setRoundNumber(null);
        setPhase("IDLE");
        setSubSession(null);
        setRunningText({ active: false, type: "NONE", title: "", content: "" });
      }
    });

    // Real-time portfolios map & trade monitoring
    socket.on("portfolio-data", (data: { portfolio: { stockId: number; jumlahLot: number }[] }) => {
      const initialMap: Record<number, number> = {};
      data.portfolio.forEach(p => {
        initialMap[p.stockId] = p.jumlahLot;
      });
      setPortfoliosMap(initialMap);
    });

    socket.on("portfolio-update", (data: { userId: number; stockId: number; jumlahLot: number }) => {
      setPortfoliosMap(prev => ({
        ...prev,
        [data.stockId]: data.jumlahLot
      }));
    });

    socket.on("trade-executed", (data: { stockId: number; price: number; quantity: number; timestamp?: string }) => {
      setLastPrices(prev => ({
        ...prev,
        [data.stockId]: data.price
      }));

      // Append trade to chart price history if it matches selected stock
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
    });

    socket.emit("get-scheduler-state");
    socket.emit("get-portfolio", { userId: user.id });

    return () => {
      socket.off("connect", onConnect);
      socket.off("round-started");
      socket.off("sub-session-started");
      socket.off("sub-session-ended");
      socket.off("timer-tick");
      socket.off("opening-prices-calculated");
      socket.off("round-ended");
      socket.off("experiment-ended");
      socket.off("intervention-triggered");
      socket.off("intervention-ended");
      socket.off("cooldown-started");
      socket.off("period-ended");
      socket.off("scheduler-state");
      socket.off("portfolio-data");
      socket.off("portfolio-update");
      socket.off("trade-executed");
    };
  }, [user, hydrated]); // eslint-disable-line

  useEffect(() => {
    if (!stocks.length || !stockParam) return;
    const found = stocks.find(s => s.id === Number(stockParam));
    if (found) { setStock(found); setSelectedId(found.id); }
  }, [stockParam, stocks]);

  const stockId = stock?.id;
  const baseStockPrice = stock ? Number(stock.basePrice || (stock as any).hargaDasar || 1000) : null;
  const openingPrice = stockId ? openingPrices[stockId] : undefined;

  // Initialize price when a stock is selected
  useEffect(() => {
    if (!stockId || baseStockPrice === null) return;
    const base = openingPrice || baseStockPrice || 1000;
    setCurrentPrice(base);
    setPriceHistory([{ time: "Pra-Buka", price: base }]);
    setPriceChange(0);
  }, [stockId, baseStockPrice, openingPrice]);

  // ── Stock-specific socket: join-stock room + order book/balance/portfolio ──
  useEffect(() => {
    if (!user || !stock) return;
    const socket = getSocket();

    // Join this stock's room for real-time updates + fetch initial stock portfolio + trade history
    if (socket.connected) {
      socket.emit("join-stock", stock.kodeSaham);
      socket.emit("get-stock-portfolio", { userId: user.id, stockId: stock.id });
      socket.emit("get-trade-history", { stockId: stock.id });
    } else {
      socket.once("connect", () => {
        socket.emit("join-stock", stock.kodeSaham);
        socket.emit("get-stock-portfolio", { userId: user.id, stockId: stock.id });
        socket.emit("get-trade-history", { stockId: stock.id });
      });
    }

    socket.on("order-book-update", (data: { stockId: number; bids: Order[]; asks: Order[] }) => {
      if (data.stockId === stock.id) { setBids(data.bids); setAsks(data.asks); }
    });

    socket.on("balance-update", (data: { userId: number; balance: number }) => {
      if (data.userId === user.id) setBalance(data.balance);
    });

    // Optimasi 8: hanya update portfolio saham yang sedang dipilih (portfoliosMap sudah dihandle useEffect global)
    socket.on("portfolio-update", (data: { userId: number; stockId: number; jumlahLot: number }) => {
      if (data.stockId === stock.id) setPortfolio({ lot: data.jumlahLot });
    });

    socket.on("trade-history", (data: { stockId: number; trades: { time: string; price: number }[] }) => {
      if (data.stockId === stock.id) {
        const base = openingPrice || baseStockPrice || 1000;
        if (data.trades.length === 0) {
          setPriceHistory([{ time: "Pra-Buka", price: base }]);
          setCurrentPrice(base);
          setPriceChange(0);
        } else {
          setPriceHistory([{ time: "Pra-Buka", price: base }, ...data.trades]);
          const lastPrice = data.trades[data.trades.length - 1].price;
          setCurrentPrice(lastPrice);
          setPriceChange(((lastPrice - base) / base) * 100);
        }
      }
    });

    socket.on("prediction-saved", () => {
      toast.success("Prediksi tersimpan");
    });

    return () => {
      socket.off("order-book-update");
      socket.off("balance-update");
      socket.off("portfolio-update");
      socket.off("trade-history");
      socket.off("prediction-saved");
    };
  }, [user, stock, openingPrice, baseStockPrice]);

  const handlePlaceOrder = useCallback(() => {
    if (!user || !stock) return;
    const price = parseInt(orderPrice);
    const lot = parseInt(orderLot);
    if (!price || !lot) { toast.error("Isi harga dan jumlah"); return; }
    const socket = getSocket();
    socket.emit("place-order", { stockId: stock.id, tipe: orderType, harga: price, jumlah: lot, userId: user.id });
    socket.once("order-placed", () => {
      toast.success(`Order ${orderType}: ${lot} lot @ Rp ${price.toLocaleString("id-ID")}`);
      setOrderPrice(""); setOrderLot("");
    });
    socket.once("order-error", (data: { message: string }) => toast.error(data.message));
  }, [user, stock, orderType, orderPrice, orderLot]);

  const handleSubmitPrediction = useCallback((stockId: number) => {
    if (!user) return;
    const price = parseInt(predictionInput[stockId]);
    if (!price) { toast.error("Masukkan harga prediksi"); return; }
    const socket = getSocket();
    socket.emit("submit-prediction", { stockId, predictedPrice: price, userId: user.id });
    socket.once("prediction-saved", () => {
      toast.success("Prediksi tersimpan");
    });
    socket.once("prediction-error", (data: { message: string }) => toast.error(data.message));
  }, [user, predictionInput]);

  const selectStock = (s: Stock) => {
    setSelectedId(s.id);
    setStock(s);
    setBids([]);
    setAsks([]);
    setPortfolio(null);
    router.replace(`/dashboard/trading?stock=${s.id}`);
  };

  if (!hydrated) return null;
  if (!user) return null;

  const isUp = priceChange >= 0;
  const maxBid = Math.max(...bids.map(o => o.jumlah), 1);
  const maxAsk = Math.max(...asks.map(o => o.jumlah), 1);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── NAV Floating Header Calculations ──
  const totalStockValue = Object.entries(portfoliosMap).reduce((sum, [sIdStr, lot]) => {
    const sId = Number(sIdStr);
    const price = lastPrices[sId] || 1000;
    return sum + (lot * 100 * price);
  }, 0);

  const netAssetValue = balance + totalStockValue;
  const modalAwal = 100_000_000;
  const floatingPnL = ((netAssetValue - modalAwal) / modalAwal) * 100;

  return (
    <div className="p-4 sm:p-6 space-y-4 relative">
      {/* Running Text Ticker — shown during PRE_MARKET interventions */}
      <RunningText
        active={runningText.active}
        type={runningText.type}
        title={runningText.title}
        content={runningText.content}
      />

      {/* Cooldown overlay banner */}
      {cooldownActive && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/60 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-sky-400" />
            <div>
              <div className="text-xs font-semibold text-sky-300">Jeda ({cooldownReason})</div>
              <div className="text-[10px] text-sky-500">Perdagangan akan dilanjutkan setelah waktu jeda selesai</div>
            </div>
          </div>
          <div className="font-mono text-lg font-bold text-sky-300">
            {Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, "0")}
          </div>
        </div>
      )}

      {/* Dynamic Floating NAV Header */}
      {sessionActive && (
        <div className="sticky top-0 z-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 backdrop-blur-md bg-zinc-950/80 border-b border-white/5 shadow-md flex flex-wrap items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Riset Portfolio Live</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
            <div>
              <div className="text-[9px] text-zinc-500 uppercase">Kas Tersedia</div>
              <div className="font-mono text-xs sm:text-sm font-bold text-zinc-200">
                Rp {balance.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="h-6 w-px bg-zinc-800 hidden sm:block" />
            <div>
              <div className="text-[9px] text-zinc-500 uppercase">Nilai Portofolio</div>
              <div className="font-mono text-xs sm:text-sm font-bold text-zinc-300">
                Rp {totalStockValue.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="h-6 w-px bg-zinc-800 hidden sm:block" />
            <div>
              <div className="text-[9px] text-zinc-500 uppercase">Total Aset (NAV)</div>
              <div className="font-mono text-xs sm:text-sm font-bold text-emerald-400">
                Rp {netAssetValue.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="h-6 w-px bg-zinc-800" />
            <div>
              <div className="text-[9px] text-zinc-500 uppercase">Profit / Loss</div>
              <div className={cn(
                "font-mono text-xs sm:text-sm font-bold flex items-center gap-1",
                floatingPnL >= 0 ? "text-emerald-500" : "text-rose-500"
              )}>
                {floatingPnL >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {floatingPnL >= 0 ? "+" : ""}{floatingPnL.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {stock ? (
            <button onClick={() => { setStock(null); setSelectedId(null); router.replace("/dashboard/trading"); }}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <ArrowLeft className="size-3.5" />
              Semua Saham
            </button>
          ) : null}
          <h1 className="text-lg font-semibold text-zinc-200">
            {stock ? (stock as any).kodeSaham || (stock as any).kode || "Trading" : "Trading"}
          </h1>
          {stock && (
            <span className="hidden sm:inline text-xs text-zinc-600">{(stock as any).namaSaham || (stock as any).nama}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Round + Session indicator */}
          {roundNumber && (
            <div className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1">
              <span className="text-[10px] font-medium text-zinc-400">R{roundNumber}</span>
              {subSession && (
                <>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[10px] font-medium text-emerald-400">Sesi {subSession}</span>
                </>
              )}
            </div>
          )}
          {/* Phase badge */}
          {phase && phase !== "IDLE" && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              {getPhaseLabel(phase)}
            </span>
          )}
          {stock && (
            <span className="text-xs text-zinc-600 font-mono hidden sm:block">
              Rp {currentPrice.toLocaleString("id-ID")}
            </span>
          )}
          <div className="flex items-center gap-1.5 font-mono text-sm text-zinc-400">
            <Timer className="size-3.5 text-emerald-500" />
            {Math.floor(sessionTimer / 60)}:{String(sessionTimer % 60).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* PRE_OPENING: Prediction Input UI */}
      {showPredictionUI && stocks.length > 0 && (
        <Card className="border-white/5 bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Pra Pembukaan — Masukkan Prediksi Harga
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-500">Prediksi harga Equilibrium untuk setiap saham sebelum sesi trading dimulai.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stocks.map(s => (
                <div key={s.id} className="rounded-lg border border-white/5 bg-zinc-800/50 p-3">
                  <div className="text-xs font-medium text-zinc-300 mb-2">{(s as any).kodeSaham || (s as any).kode} — {(s as any).namaSaham || (s as any).nama}</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Harga prediksi"
                      value={predictionInput[s.id] || ""}
                      onChange={e => setPredictionInput(prev => ({ ...prev, [s.id]: e.target.value }))}
                      className="text-xs font-mono flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 px-3"
                      onClick={() => handleSubmitPrediction(s.id)}
                    >
                      Kirim
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!sessionActive ? (
        /* ── Empty State ── */
        <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
          <Timer className="size-12 mb-4 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-500">Belum Ada Sesi Aktif</p>
          <p className="text-xs text-zinc-700 mt-1">Tunggu admin memulai eksperimen</p>
        </div>
      ) : !stock ? (
        /* ── Stock Cards Grid ── */
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="size-4 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              Pilih Saham untuk Trading
            </span>
            <span className="text-[10px] text-zinc-700 ml-auto">{stocks.length} saham dalam sesi ini</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {stocks.map(s => {
              const safeKode = (s as any).kodeSaham || (s as any).kode || "N/A";
              const safeNama = (s as any).namaSaham || (s as any).nama || "Tidak ada data";
              const meta = getMeta(safeKode);
              const warna = sektorWarna[meta.sektor] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
              return (
                <button key={s.id} onClick={() => selectStock(s)}
                  className="group relative text-left rounded-xl border border-white/5 bg-zinc-900/50 p-4 transition-all hover:border-emerald-500/30 hover:bg-zinc-900 hover:shadow-lg hover:shadow-emerald-500/5 active:scale-[0.98]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-zinc-200 group-hover:text-emerald-500 transition-colors">
                        {safeKode}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{safeNama}</div>
                    </div>
                    <div className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium border", warna)}>
                      {meta.sektor}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mb-3 line-clamp-2">
                    {meta.deskripsi}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] text-zinc-600">Harga Dasar</span>
                    <span className="font-mono text-xs font-semibold text-zinc-300">
                      Rp {Number(s.basePrice).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/0 group-hover:ring-emerald-500/20 transition-all pointer-events-none" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Trading Interface ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-mono text-2xl font-bold text-zinc-200">
                Rp {currentPrice.toLocaleString("id-ID")}
              </div>
              <div className={`font-mono text-sm flex items-center gap-1 ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                {isUp ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {priceChange.toFixed(2)}%
              </div>
            </div>
          </div>

          <Card className="border-white/5 bg-zinc-900">
            <CardHeader className="pb-2"><CardTitle className="text-[10px] text-zinc-500 uppercase tracking-wider">{stock.kodeSaham} — {stock.namaSaham}</CardTitle></CardHeader>
            <CardContent><div className="h-48 sm:h-56"><PriceChart data={priceHistory} isUp={isUp} /></div></CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <Card className="border-white/5 bg-zinc-900 h-full">
                <CardHeader className="pb-3"><CardTitle className="text-xs">Order Book</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 divide-x divide-white/5">
                    <div className="p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                        <TrendingUp className="size-3" /> BID
                      </div>
                      <div className="space-y-0.5">
                        {bids.length === 0 ? <p className="text-xs text-zinc-600 py-4 text-center">Belum ada bid</p>
                          : [...bids].sort((a, b) => b.harga - a.harga).slice(0, 8).map(o => (
                            <div key={o.id} className="relative flex items-center justify-between rounded px-2 py-1.5 text-xs overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{ width: `${(o.jumlah / maxBid) * 100}%` }} />
                              <span className="relative font-mono font-medium text-zinc-200">{o.harga.toLocaleString("id-ID")}</span>
                              <span className="relative text-zinc-500">{o.jumlah}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-rose-500">
                        <TrendingDown className="size-3" /> ASK
                      </div>
                      <div className="space-y-0.5">
                        {asks.length === 0 ? <p className="text-xs text-zinc-600 py-4 text-center">Belum ada ask</p>
                          : [...asks].sort((a, b) => a.harga - b.harga).slice(0, 8).map(o => (
                            <div key={o.id} className="relative flex items-center justify-between rounded px-2 py-1.5 text-xs overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-rose-500/10" style={{ width: `${(o.jumlah / maxAsk) * 100}%` }} />
                              <span className="relative font-mono font-medium text-zinc-200">{o.harga.toLocaleString("id-ID")}</span>
                              <span className="relative text-zinc-500">{o.jumlah}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <Card className="border-white/5 bg-zinc-900">
                <CardHeader className="pb-3"><CardTitle className="text-xs">Buat Order</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex rounded-lg border border-white/5 p-0.5 bg-zinc-800">
                    <button onClick={() => setOrderType("BID")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${orderType === "BID" ? "bg-emerald-500/20 text-emerald-500" : "text-zinc-500 hover:text-zinc-300"}`}>
                      <ArrowDownToLine className="size-3.5" /> Beli
                    </button>
                    <button onClick={() => setOrderType("ASK")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${orderType === "ASK" ? "bg-rose-500/20 text-rose-500" : "text-zinc-500 hover:text-zinc-300"}`}>
                      <ArrowUpFromLine className="size-3.5" /> Jual
                    </button>
                  </div>
                  {portfolio && portfolio.lot > 0 && (
                    <div className="text-[11px] text-zinc-400 flex justify-between items-center bg-zinc-800/30 px-2 py-1 rounded">
                      <span>Kepemilikan Anda:</span>
                      <span className="text-emerald-400 font-mono font-bold">{portfolio.lot} lot</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input type="number" placeholder="Harga" value={orderPrice} onChange={e => setOrderPrice(e.target.value)} className="text-xs" />
                    <Input type="number" placeholder="Jumlah (Lot)" value={orderLot} onChange={e => setOrderLot(e.target.value)} className="text-xs" />
                  </div>
                  <Button size="sm" className={`w-full gap-1 ${orderType === "BID" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`} onClick={handlePlaceOrder}>
                    {orderType === "BID" ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}
                    {orderType === "BID" ? "Pasang BID" : "Pasang ASK"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-zinc-900">
                <CardHeader className="pb-3"><CardTitle className="text-xs">Portofolio</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-zinc-800/50 p-3 mb-2">
                    <div className="text-[10px] text-zinc-500 mb-0.5">Sisa Kas</div>
                    <div className="font-mono text-base font-bold text-emerald-500">Rp {balance.toLocaleString("id-ID")}</div>
                  </div>
                  {portfolio ? (
                    <div className="rounded-lg bg-zinc-800/50 p-3">
                      <div className="text-[10px] text-zinc-500 mb-0.5">{stock.kodeSaham}</div>
                      <div className="font-mono text-base font-bold text-zinc-200">{portfolio.lot} lot</div>
                      <div className="font-mono text-xs text-zinc-500">Rp {(portfolio.lot * 100 * currentPrice).toLocaleString("id-ID")}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 text-zinc-600">
                      <DollarSign className="size-5 mb-1 text-zinc-700" />
                      <p className="text-[10px]">Belum punya {stock.kodeSaham}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
