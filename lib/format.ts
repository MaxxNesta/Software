// Pure display formatting. Deliberately free of any database import, so a
// script, a test or a client component can format a number or a timestamp
// without opening a connection.

export function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function qty(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Timestamps are rendered in the company's zone, not the server's. Vercel
 * runs in UTC and Myanmar is UTC+06:30, so without this anything recorded
 * before half past six in the morning shows as the previous day.
 *
 * Held as a module constant rather than threaded through every call site.
 * Companies operating in another zone set company.timezone, and this becomes
 * the fallback rather than the answer.
 */
export const DISPLAY_TZ = process.env.DISPLAY_TZ ?? "Asia/Yangon";

/** A plain accounting date: no time, no zone conversion. */
export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";

  // A date-only value from Postgres arrives as midnight UTC. Converting it to
  // a zone behind or ahead would shift the calendar day, so read the parts
  // directly rather than localising something that was never a moment.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
    });
  }

  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** A real moment — date and time of day, in the company's zone. */
export function dateTime(d: Date | string | null | undefined, tz = DISPLAY_TZ): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: tz,
  });
}

/** Time of day only, for rows already grouped under a date. */
export function timeOfDay(d: Date | string | null | undefined, tz = DISPLAY_TZ): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });
}

// ------------------------------------------------------- invoice status --

/**
 * A single status per invoice for a list screen, in priority order: a
 * document that never posted (or was undone) says so before anything about
 * payment is relevant; among posted invoices, fully paid wins, then overdue
 * (unpaid past its due date) beats merely partial, and an invoice with
 * nothing paid and not yet due is just "Posted".
 *
 * Draft and Cancelled exist because document.status allows them, not
 * because anything in this app currently leaves an invoice in either state
 * — every posting function commits within one transaction. Included so the
 * list is correct the day a draft-save or cancel flow is added, rather than
 * silently dropping those rows.
 */
export type InvoiceDisplayStatus =
  | "DRAFT" | "CANCELLED" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" | "OPEN";

export function invoiceDisplayStatus(row: {
  docStatus: string;
  paymentStatus: string | null;
  outstanding: number | string;
  daysOverdue: number | null;
}): InvoiceDisplayStatus {
  if (row.docStatus === "DRAFT") return "DRAFT";
  if (row.docStatus !== "POSTED") return "CANCELLED"; // CANCELLED or REVERSED
  if (row.paymentStatus === "PAID") return "PAID";
  if (Number(row.outstanding) > 0 && row.daysOverdue !== null && row.daysOverdue > 0) return "OVERDUE";
  if (row.paymentStatus === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "OPEN";
}

export const INVOICE_STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  DRAFT: "Draft",
  CANCELLED: "Cancelled",
  PAID: "Paid",
  OVERDUE: "Overdue",
  PARTIALLY_PAID: "Partially Paid",
  OPEN: "Posted",
};

/** One of the .pill.* tones already used across the app — no new palette. */
export const INVOICE_STATUS_PILL: Record<InvoiceDisplayStatus, string> = {
  DRAFT: "draft",
  CANCELLED: "draft",
  PAID: "ok",
  OVERDUE: "overdue",
  PARTIALLY_PAID: "warn",
  OPEN: "posted",
};
