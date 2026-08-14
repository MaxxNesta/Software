import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  // Neon's pooled endpoint is PgBouncer in transaction mode, which does not
  // support prepared statements. postgres.js prepares by default, so every
  // query would fail against a pooled URL unless this is turned off.
  const isPooled = url.includes("-pooler.") || url.includes("pgbouncer=true");

  return postgres(url, {
    // A single connection serialises everything: a page firing six queries
    // through Promise.all would wait for six sequential round trips rather
    // than one. Pooled endpoints sit behind PgBouncer and handle far more
    // than this, so the small pool only ever cost latency.
    max: isPooled ? 8 : process.env.VERCEL ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: isLocal ? false : "require",
    prepare: !isPooled,
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
