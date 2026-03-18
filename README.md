# Trivia Wizards- Intro to Software Engineering Project

A real-time, kiosk-based bar trivia game with three interfaces: a host control panel, player kiosks at each table, and a read-only TV display.

## Tech Stack

- **Next.js 16** (App Router, full-stack)
- **Prisma 7** + **Supabase PostgreSQL**
- **Socket.io** for real-time game sync
- **Tailwind CSS** for styling
- **iron-session** for host authentication

## Interfaces

| Interface | URL | Description |
|-----------|-----|-------------|
| Host Panel | `/dashboard` | Create sessions, manage rounds, control game flow |
| Player Kiosk | `/kiosk` | Teams register and submit answers |
| TV Display | `/display/[sessionId]` | Read-only leaderboard and question display |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the root with the following:

```env
DATABASE_URL="your-supabase-session-pooler-url"
DATABASE_URL_UNPOOLED="your-supabase-transaction-pooler-url"
HOST_PASSWORD="your-host-password"
SESSION_SECRET="32-char-secret"
JWT_SECRET="32-char-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Run database migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 4. (Optional) Import questions from Open Trivia Database

```bash
npm run db:import-otdb
```

This imports 500 multiple-choice questions across categories like Science, History, Sports, Geography, and Entertainment.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed venue, tables, and sample questions |
| `npm run db:import-otdb` | Import 500 questions from Open Trivia Database |
| `npm run db:studio` | Open Prisma Studio |

## Game Flow

1. Host creates a session and adds rounds with questions
2. Teams register at `/kiosk` and are assigned to a table
3. Host starts the game, then starts rounds one at a time
4. For each round, host asks questions one by one — a countdown timer runs server-side
5. Teams submit answers on their kiosk before time expires
6. Host reveals the correct answer after each question; scores update in real time
7. After all rounds, host ends the game — a podium screen shows 1st, 2nd, and 3rd place on both the host panel and the TV display

## Sound Effects

All sound effects are synthesized via the Web Audio API (no audio files required). Sounds play on:

- Countdown ticks (urgent tone for last 5 seconds)
- Timer expired
- Round start / end
- Question revealed
- Answer correct / wrong (kiosk)
- Answer locked in (kiosk)
- New team joined (host)
- Game over fanfare

## Deployment (Render)

- **Build Command:** `npm install; npm run build`
- **Start Command:** `npm run start`
- Add all `.env` variables in the Render dashboard under Environment
- Prisma client is generated automatically during build (`prisma generate && next build`)
