import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create venue
  const passwordHash = await bcrypt.hash(process.env.HOST_PASSWORD ?? "trivia123", 10);
  const venue = await prisma.venue.upsert({
    where: { id: "seed-venue-01" },
    update: { hostPasswordHash: passwordHash },
    create: {
      id: "seed-venue-01",
      name: "The Trivia Bar",
      address: "123 Main St",
      contactEmail: "host@triviabar.com",
      hostPasswordHash: passwordHash,
    },
  });
  console.log(`Venue: ${venue.name}`);

  // Create 8 tables
  for (let i = 1; i <= 8; i++) {
    await prisma.table.upsert({
      where: { venueId_tableNumber: { venueId: venue.id, tableNumber: i } },
      update: {},
      create: { venueId: venue.id, tableNumber: i },
    });
  }
  console.log("Tables: 1–8 created");

  // Create sample questions
  const questions = [
    // Science
    { questionText: "What is the chemical symbol for gold?", options: ["Au", "Ag", "Fe", "Cu"], correctAnswer: "Au", category: "Science", points: 10 },
    { questionText: "How many bones are in the adult human body?", options: ["206", "196", "216", "186"], correctAnswer: "206", category: "Science", points: 10 },
    { questionText: "What planet is known as the Red Planet?", options: ["Mars", "Jupiter", "Venus", "Saturn"], correctAnswer: "Mars", category: "Science", points: 10 },
    { questionText: "What is the speed of light in km/s?", options: ["300,000", "150,000", "450,000", "250,000"], correctAnswer: "300,000", category: "Science", points: 15 },
    // History
    { questionText: "In what year did World War II end?", options: ["1945", "1944", "1946", "1943"], correctAnswer: "1945", category: "History", points: 10 },
    { questionText: "Who was the first President of the United States?", options: ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"], correctAnswer: "George Washington", category: "History", points: 10 },
    { questionText: "The Great Wall of China was primarily built during which dynasty?", options: ["Ming", "Qin", "Han", "Tang"], correctAnswer: "Ming", category: "History", points: 15 },
    // Pop Culture
    { questionText: "What movie features the quote 'I'll be back'?", options: ["The Terminator", "Predator", "Total Recall", "RoboCop"], correctAnswer: "The Terminator", category: "Pop Culture", points: 10 },
    { questionText: "Which band released the album 'Dark Side of the Moon'?", options: ["Pink Floyd", "Led Zeppelin", "The Beatles", "The Rolling Stones"], correctAnswer: "Pink Floyd", category: "Pop Culture", points: 10 },
    { questionText: "What is the best-selling video game of all time?", options: ["Minecraft", "Tetris", "GTA V", "Wii Sports"], correctAnswer: "Minecraft", category: "Pop Culture", points: 10 },
    // Geography
    { questionText: "What is the capital of Australia?", options: ["Canberra", "Sydney", "Melbourne", "Brisbane"], correctAnswer: "Canberra", category: "Geography", points: 10 },
    { questionText: "Which country has the most natural lakes?", options: ["Canada", "Russia", "USA", "Finland"], correctAnswer: "Canada", category: "Geography", points: 15 },
    { questionText: "What is the longest river in the world?", options: ["Nile", "Amazon", "Yangtze", "Mississippi"], correctAnswer: "Nile", category: "Geography", points: 10 },
    // Sports
    { questionText: "How many players are on a basketball team on the court?", options: ["5", "6", "7", "4"], correctAnswer: "5", category: "Sports", points: 10 },
    { questionText: "In what year were the first modern Olympic Games held?", options: ["1896", "1900", "1892", "1904"], correctAnswer: "1896", category: "Sports", points: 10 },
    // Math
    { questionText: "What is the square root of 144?", options: ["12", "14", "11", "13"], correctAnswer: "12", category: "Math", points: 10 },
    { questionText: "What is π (pi) rounded to 2 decimal places?", options: ["3.14", "3.16", "3.12", "3.18"], correctAnswer: "3.14", category: "Math", points: 10 },
    // Food & Drink
    { questionText: "What country does pizza originate from?", options: ["Italy", "Greece", "France", "Spain"], correctAnswer: "Italy", category: "Food", points: 10 },
    { questionText: "How many shots of espresso are in a standard cappuccino?", options: ["1", "2", "3", "4"], correctAnswer: "1", category: "Food", points: 15 },
    { questionText: "What is the main ingredient in guacamole?", options: ["Avocado", "Tomato", "Lime", "Onion"], correctAnswer: "Avocado", category: "Food", points: 10 },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: { ...q, venueId: venue.id },
    });
  }
  console.log(`Questions: ${questions.length} created`);

  console.log("\nSeed complete!");
  console.log(`\nHost login password: ${process.env.HOST_PASSWORD ?? "trivia123"}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
