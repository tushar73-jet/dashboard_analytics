import { neon } from "@neondatabase/serverless";

/**
 * Create a SQL query function using the Neon serverless driver.
 * This uses HTTP-based queries — no persistent connection needed.
 * Perfect for serverless functions on Vercel.
 */
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

/**
 * Helper to parse date range from query params.
 * Returns a SQL-friendly interval string.
 */
export function parseDaysParam(days: string | null): number {
  const parsed = parseInt(days || "30", 10);
  if ([30, 60, 90].includes(parsed)) return parsed;
  return 30; // default
}

/**
 * Map day-of-week number to name.
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Map media type to a human-friendly label.
 */
export const MEDIA_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Single Image",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};
