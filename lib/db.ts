import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  return postgres(url, {
    // Serverless: keep the pool small and let idle connections go.
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
    onnotice: () => {},
    transform: { undefined: null },
  });
}

// Reuse across hot reloads in development.
export const sql = global.__sql ?? connect();
if (process.env.NODE_ENV !== "production") global.__sql = sql;

export function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function qty(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
