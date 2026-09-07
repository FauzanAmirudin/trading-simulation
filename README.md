<div align="center">
  <h1>📈 Trading Simulation & Experimental Platform</h1>
  <p>A full-stack real-time stock trading simulation and behavioral economics experimental research platform.</p>
</div>

---

## 📖 Overview
**Trading Simulation** is an interactive web platform designed for economic, financial, and behavioral experiments. It features a custom **Socket.io** matching engine that executes real-time buy/sell (Bid/Ask) orders, an administrative experimental control dashboard (matrix period scheduling, interventions, countdown timers, market phases, live monitoring), and a mobile-first responsive participant dashboard for executing simulated trades and completing psychological profiling questionnaires.

---

## 🚀 Tech Stack

### Frontend
- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/) & [tw-animate-css](https://github.com/your-username/tw-animate-css)
- **UI Components:** [Shadcn UI](https://ui.shadcn.com/) & [Base UI](https://base-ui.com/)
- **Notifications & Feedback:** [Sonner](https://sonner.emilkowal.ski/)

### Backend & Database
- **Custom Real-Time Server:** Node.js + [Socket.io](https://socket.io/) (`server.ts`)
- **Database:** PostgreSQL (15+)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit
- **Data Export & Reporting:** [ExcelJS](https://github.com/exceljs/exceljs) & Archiver (Multi-sheet Excel reports & ZIP archives)
- **Containerization:** Docker & Docker Compose (Multi-stage build)

---

## 🏗️ Project Structure

```text
trading-simulasi/
├── drizzle/                  # Drizzle ORM migration outputs
├── public/                   # Static assets & public icons
├── src/
│   ├── app/                  # Next.js App Router (Pages & API routes)
│   │   ├── admin/            # Admin control panel (Scheduler, Results, Resume, Questionnaire Profiles)
│   │   ├── api/              # REST Endpoints (Data Export, Auth, Profiling, Results, etc.)
│   │   ├── dashboard/        # Participant/Respondent dashboard (Trading Terminal & Portfolio)
│   │   ├── login/            # Authentication page (Admin & Responden)
│   │   └── questionnaire/    # Psychological profiling instrument (LA & EI)
│   ├── components/           # Reusable UI Components
│   │   ├── admin/            # Admin scheduler board, modals, export filters, reset dialogs
│   │   ├── auth/             # Questionnaire guard & idle session timeout
│   │   ├── layout/           # Global layouts (Sidebar, Header, Mobile Bottom Nav)
│   │   ├── trading/          # Order book, candlestick charts, portfolio valuation
│   │   └── ui/               # Core Shadcn UI primitives
│   ├── db/                   # Database configuration, schema definitions & seeders
│   │   ├── schema.ts         # Drizzle schema (Users, Stocks, Rounds, Orders, Profiles, etc.)
│   │   ├── init.ts           # Unified idempotent database initializer
│   │   ├── seed.ts           # 36 Stocks & Admin account seeder
│   │   ├── seed-users.ts     # 30 Mass respondent accounts seeder
│   │   ├── create-users.ts   # Personal named respondent accounts (Andi, Budi, Citra, Doni)
│   │   └── seed-questionnaire.ts # 30 Psychological instrument questions (15 LA & 15 EI)
│   └── lib/                  # Utilities (Socket client, Auth context, Market rules, Idle timeout)
├── server.ts                 # Custom Node.js WebSockets Server (Central Limit Order Book matching engine)
├── Dockerfile                # Multi-stage production Docker build configuration
├── docker-compose.yml        # Docker Compose service orchestration (App + PostgreSQL + pgAdmin)
├── .env.example              # Environment variables template
├── drizzle.config.ts         # Drizzle ORM configuration
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration & path aliases
└── package.json              # Project dependencies & scripts
```

---

## ✨ Core Features

1. **Central Limit Order Book (CLOB) Matching Engine:**
   - Real-time order matching with Price-Time priority at 750ms interval.
   - Live WebSocket updates for Order Book bids/asks depth, trade executions, and cash/portfolio updates.
2. **Multi-Period Experimental State Machine:**
   - 3 Experimental Periods with pre-configured session matrices.
   - Market phases: `PRE_MARKET` (price prediction & auction practice), `TRADING` (active continuous trading), and `COOLDOWN`.
   - Experimental interventions: `BERITA_BAIK` (Good News), `BERITA_BURUK` (Bad News), `NONE`.
3. **Pre-Market Practice Trading:**
   - Participants can input initial opening price predictions.
   - Practice placing BID & ASK orders to observe the auction order book live without deducting real cash or stock balances.
4. **Psychological Profiling (LA & EI):**
   - 30 questionnaire items assessing Loss Aversion (LA) and Emotional Intelligence (EI).
   - Dynamic 9-group profiling matrix (A to I) with automated categorization.
5. **Real-Time Leaderboard & Results (`/admin/hasil`):**
   - Real-time Net Asset Value (NAV), cash balance, portfolio valuation, PnL %, and transaction count updates.
   - Deterministic ranking from highest total wealth to lowest.
6. **Advanced Data Export & Reporting:**
   - Comprehensive multi-sheet Excel files (`.xlsx`) with date filtering and ZIP archiving for transactions, order book logs, and respondent profiles.

---

## 🛠️ Installation & Setup (Local Development)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [PostgreSQL](https://www.postgresql.org/) database (Local or Cloud)

### 2. Clone Repository
```bash
git clone https://github.com/FauzanAmirudin/trading-simulation.git
cd trading-simulation
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Variables
Copy the template `.env.example` to `.env`:
```bash
cp .env.example .env
```
Adjust the `DATABASE_URL` in `.env` to match your local PostgreSQL credentials:
```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/trading_simulasi
```

### 5. Database Setup & Seeding
Push the schema and seed all initial data (36 stocks, Admin, 34 respondents, 30 questionnaires, and portfolios):
```bash
# Push schema to database
npm run db:push

# Inisialisasi & seed seluruh database otomatis
npm run db:init
```

### 6. Run the Application
Because the app relies on the custom WebSockets server for real-time order matching:
```bash
npm run dev:server
```
*The app will be available at `http://localhost:3000`.*

---

## 🐳 Docker Deployment (Production Server)

### 1. Configure `.env` on Server
Create `.env` in the project root:
```env
PORT=3000
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
POSTGRES_DB=trading_simulasi
DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/trading_simulasi
PGADMIN_EMAIL=admin@trading.com
PGADMIN_PASSWORD=admin
```

### 2. Build & Launch Containers
```bash
# Build & start all containers in background
docker compose up -d --build

# Inspect real-time application logs
docker compose logs -f app
```

The app container automatically applies Drizzle schema migrations, executes `src/db/init.ts` idempotent seeding, and starts the Socket.io matching engine server on port 3000.

---

## 👤 Default Accounts

| Role | Username | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Admin** | `Admin` | `admin` | Akses penuh ke panel kontrol eksperimen, scheduler, dan laporan hasil |
| **Responden Massal** | `responden1` s/d `responden30` | `password123` | Akun peserta eksperimen (Saldo: Rp 100.000.000 + 10 lot per saham) |
| **Responden Personal** | `Andi`, `Budi`, `Citra`, `Doni` | `password` | Akun peserta personal (Saldo: Rp 100.000.000 + 10 lot per saham) |

---

## 📝 License
This project is proprietary and built for academic and behavioral economic research. Please contact the repository owner regarding distribution and usage rights.
