<div align="center">
  <h1>📈 Trading Simulation & Experimental Platform</h1>
  <p>A full-stack real-time trading simulator designed for economic and behavioral experiments.</p>
</div>

---

## 📖 Overview
**Trading Simulation** is a specialized web application built to facilitate interactive stock market experiments. It features a custom **Socket.io** matching engine that executes real-time buy/sell (Bid/Ask) orders, an admin dashboard to control session variables (interventions, timers, market phases), and a responsive participant dashboard for executing trades.

This project is tailored for academic research, behavioral finance studies, and real-time market simulations where precise control over experimental rounds and data collection is required.

---

## 🚀 Tech Stack

### Frontend
- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Animation:** [Framer Motion](https://www.framer.com/motion/) & [tw-animate-css](https://github.com/your-username/tw-animate-css)
- **UI Components:** [Shadcn UI](https://ui.shadcn.com/) & [Base UI](https://base-ui.com/)
- **Notifications:** [Sonner](https://sonner.emilkowal.ski/)

### Backend & Database
- **Server:** Node.js (Custom Server via `server.ts`)
- **Real-Time Communication:** [Socket.io](https://socket.io/)
- **Database:** PostgreSQL
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Data Export:** [ExcelJS](https://github.com/exceljs/exceljs) & Archiver

---

## 🏗️ Folder Structure

```text
trading-simulasi/
├── drizzle/                  # Drizzle ORM migration outputs
├── scripts/                  # Utility scripts
├── src/
│   ├── app/                  # Next.js App Router (Pages & API routes)
│   │   ├── admin/            # Admin control panel (Resume & Trading Monitor)
│   │   ├── api/              # REST Endpoints (Data Export, Auth, etc.)
│   │   └── dashboard/        # Participant/Respondent dashboard
│   ├── components/           # Reusable UI Components
│   │   ├── admin/            # Admin-specific components (Scheduler Board)
│   │   ├── layout/           # Global layouts (Sidebar, Header)
│   │   ├── trading/          # Order book, charts, portfolio UI
│   │   └── ui/               # Core Shadcn UI elements
│   ├── db/                   # Database logic
│   │   ├── schema.ts         # Drizzle schema definitions
│   │   ├── index.ts          # DB connection configuration
│   │   └── seed.ts           # Seeder scripts
│   └── lib/                  # Utilities (Socket config, Auth context, Market Rules)
├── server.ts                 # Custom Node.js WebSockets Server (Matching Engine)
├── drizzle.config.ts         # Drizzle ORM configuration
└── package.json              # Project dependencies & scripts
```

---

## ✨ Core Features

- **Live Matching Engine:** Real-time central limit order book (CLOB) that matches Bids and Asks securely in the backend.
- **State Machine / Scheduler:** Admin-controlled phases (`PRE_MARKET`, `TRADING`, `IDLE`) with automatic countdowns and session transitions.
- **Experimental Interventions:** Dynamic injection of visual or informational interventions directly into the respondent's UI during specific rounds.
- **Auto Rejection Limits (ARA/ARB):** Built-in market rules to validate price boundaries and tick sizes.
- **Live Monitoring:** Real-time dashboard for the Admin to monitor active participants, trading volume, and spread.
- **Data Export:** One-click generation of comprehensive `.xlsx` logs containing trade history, bids/asks logs, and portfolio valuations for academic analysis.

---

## 🛠️ Installation & Setup

Follow these steps to run the simulation locally or on a server.

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
Create a `.env` file in the root directory based on the following structure:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/trading_db
# Add other secrets here if necessary
```

### 5. Database Setup (Drizzle ORM)
Push the database schema and seed the initial mock data (Stocks, Users, Rounds).
```bash
# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

### 6. Run the Application (Development)
Because the app relies heavily on WebSockets, you must use the custom server script:
```bash
npm run dev:server
```
*The app will be available at `http://localhost:3000`.*

---

## 🌐 Deployment (VPS / Production)

To deploy the application to a production server (VPS):

1. **Build the Next.js App:**
   ```bash
   npm run build
   ```
2. **Start the Production Server with PM2:**
   Install PM2 globally if you haven't: `npm install -g pm2`.
   ```bash
   # Run via the tsx runner (or compile server.ts to pure JS first)
   pm2 start "npx tsx server.ts" --name trading-app
   ```

---

## 📝 License
This project is proprietary and built for specific academic/experimental research. Please contact the repository owner regarding distribution and usage rights.
