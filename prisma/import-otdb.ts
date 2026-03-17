/**
 * Imports questions from the Open Trivia Database (https://opentdb.com)
 * into your venue's question bank.
 *
 * Usage:
 *   npx tsx prisma/import-otdb.ts
 *
 * Options (env vars):
 *   OTDB_AMOUNT   — questions per API call, max 50 (default: 50)
 *   OTDB_BATCHES  — how many API calls to make (default: 10  → 500 questions total)
 *   VENUE_ID      — defaults to "seed-venue-01"
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// OTDB returns HTML-encoded strings — decode them
function decode(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Map OTDB difficulty to points
function toPoints(difficulty: string): number {
  if (difficulty === "hard") return 20;
  if (difficulty === "medium") return 15;
  return 10;
}

interface OtdbResult {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface OtdbResponse {
  response_code: number;
  results: OtdbResult[];
}

async function fetchBatch(amount: number, token?: string): Promise<OtdbResult[]> {
  const url = new URL("https://opentdb.com/api.php");
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("type", "multiple"); // always 4-option MCQ
  if (token) url.searchParams.set("token", token);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OTDB HTTP error: ${res.status}`);
  const data = (await res.json()) as OtdbResponse;

  if (data.response_code === 4) {
    console.log("Token exhausted all available questions.");
    return [];
  }
  if (data.response_code !== 0) {
    throw new Error(`OTDB response_code: ${data.response_code}`);
  }
  return data.results;
}

async function getSessionToken(): Promise<string> {
  const res = await fetch("https://opentdb.com/api_token.php?command=request");
  const data = await res.json() as { token: string };
  return data.token;
}

async function main() {
  const AMOUNT = Math.min(50, parseInt(process.env.OTDB_AMOUNT ?? "50"));
  const BATCHES = parseInt(process.env.OTDB_BATCHES ?? "10");
  const VENUE_ID = process.env.VENUE_ID ?? "seed-venue-01";

  console.log(`Importing up to ${AMOUNT * BATCHES} questions for venue ${VENUE_ID}...`);

  // Verify venue exists
  const venue = await prisma.venue.findUnique({ where: { id: VENUE_ID } });
  if (!venue) {
    console.error(`Venue "${VENUE_ID}" not found. Run "npm run db:seed" first.`);
    process.exit(1);
  }

  // Get a session token so we don't get duplicate questions across batches
  const token = await getSessionToken();

  let total = 0;
  let skipped = 0;

  for (let batch = 0; batch < BATCHES; batch++) {
    console.log(`  Fetching batch ${batch + 1}/${BATCHES}...`);

    let results: OtdbResult[];
    try {
      results = await fetchBatch(AMOUNT, token);
    } catch (err) {
      console.error(`  Batch ${batch + 1} failed:`, err);
      break;
    }

    if (results.length === 0) break;

    for (const r of results) {
      const questionText = decode(r.question);
      const correctAnswer = decode(r.correct_answer);
      const incorrectAnswers = r.incorrect_answers.map(decode);
      const options = shuffle([correctAnswer, ...incorrectAnswers]);
      const category = decode(r.category);
      const points = toPoints(r.difficulty);

      // Skip if this exact question already exists for this venue
      const existing = await prisma.question.findFirst({
        where: { venueId: VENUE_ID, questionText },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.question.create({
        data: { venueId: VENUE_ID, questionText, options, correctAnswer, category, points },
      });
      total++;
    }

    // OTDB rate limit: 1 request per 5 seconds
    if (batch < BATCHES - 1) {
      await new Promise((r) => setTimeout(r, 5500));
    }
  }

  console.log(`\nDone! Imported ${total} questions, skipped ${skipped} duplicates.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
