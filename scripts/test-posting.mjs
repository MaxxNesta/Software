// Exercises the posting engine against the active database and rolls nothing
// back — it posts real documents, then verifies stock moved, the journal
// balanced, and every invariant still holds.
//
//   node scripts/test-posting.mjs
//
// Run against a scratch database, not one with data you care about.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL && existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
  }
}

const { postSalesInvoice, postPurchaseInvoice } = await import("../lib/posting.ts");

const url = process.env.DATABASE_URL;
const local = url.includes("localhost") || url.includes("127.0.0.1");
const pooled = url.includes("-pooler.") || url.includes("pgbouncer=true");
const sql = postgres(url, { ssl: local ? false : "require", prepare: !pooled, onnotice: () => {}, max: 1 });

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const n = (v) => Number(v ?? 0);

try {
  const [co] = await sql`select id, name from company order by created_at limit 1`;
  const [cust] = await sql`
    select id, code from business_partner where company_id = ${co.id} and is_customer order by code limit 1`;
  const [supp] = await sql`
    select id, code from business_partner where company_id = ${co.id} and is_supplier order by code limit 1`;
  const [loc] = await sql`
    select id, code from location where company_id = ${co.id} and is_stock_location order by code limit 1`;
  const [item] = await sql`
    select id, code, name from item where company_id = ${co.id} and is_stocked order by code limit 1`;

  console.log(`\n  ${co.name}  ·  item ${item.code}  ·  ${loc.code}\n`);

  // Two different scopes, deliberately. Availability is checked per location
  // (you cannot ship what is in another warehouse), but valuation is
  // company-wide (a transfer must not restate the cost of unsold stock).
  const before = await sql`
    select coalesce(fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}), 0) as loc_qty,
           coalesce(fn_qty_on_hand(${co.id}, ${item.id}), 0)           as co_qty,
           coalesce(fn_moving_average_cost(${co.id}, ${item.id}), 0)   as cost`;
  const qty0 = n(before[0].loc_qty);
  const coQty0 = n(before[0].co_qty);
  const cost0 = n(before[0].cost);
  console.log(`  starting: ${qty0} at ${loc.code}, ${coQty0} company-wide, average cost ${cost0}\n`);

  const today = new Date().toISOString().slice(0, 10);

  // ---- PURCHASE: stock in, payable up -----------------------------------

  const buyQty = 100;
  const buyPrice = cost0 > 0 ? Math.round(cost0 * 1.2) : 1000;

  const pi = await postPurchaseInvoice({
    companyId: co.id, partnerId: supp.id, locationId: loc.id,
    docDate: today, dueDate: null, memo: "posting engine test",
    lines: [{ itemId: item.id, qty: buyQty, unitPrice: buyPrice }],
  });
  console.log(`  posted ${pi.docNo}  ${buyQty} @ ${buyPrice}`);

  const afterBuy = await sql`
    select coalesce(fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}), 0) as qty,
           coalesce(fn_moving_average_cost(${co.id}, ${item.id}), 0) as cost`;
  const qty1 = n(afterBuy[0].qty);
  const cost1 = n(afterBuy[0].cost);

  check("purchase increases stock", qty1 === qty0 + buyQty, `${qty0} -> ${qty1}`);

  // Company-wide, since that is the scope the valuation runs at.
  const expectedAvg = (coQty0 * cost0 + buyQty * buyPrice) / (coQty0 + buyQty);
  check("moving average recalculated company-wide", Math.abs(cost1 - expectedAvg) < 1,
    `${cost1.toFixed(2)} vs expected ${expectedAvg.toFixed(2)}`);

  const piJournal = await sql`
    select account_code, debit, credit from v_journal_line
     where source_id = ${pi.id} order by line_no`;
  check("purchase posted a journal entry", piJournal.length >= 2, `${piJournal.length} lines`);
  check("purchase entry balances",
    Math.abs(piJournal.reduce((s, l) => s + n(l.debit) - n(l.credit), 0)) < 0.0001);
  check("purchase debits inventory", piJournal.some((l) => n(l.debit) > 0 && l.account_code === "1300"));
  check("purchase credits payables", piJournal.some((l) => n(l.credit) > 0 && l.account_code === "2100"));

  const [ap] = await sql`
    select outstanding from v_open_item where document_id = ${pi.id}`;
  check("purchase opens a payable", n(ap?.outstanding) === buyQty * buyPrice,
    `${n(ap?.outstanding)}`);

  // ---- SALE: stock out, receivable up, COGS at moving average -----------

  const sellQty = 40;
  const sellPrice = Math.round(cost1 * 1.5);

  const si = await postSalesInvoice({
    companyId: co.id, partnerId: cust.id, locationId: loc.id,
    docDate: today, dueDate: null, memo: "posting engine test",
    lines: [{ itemId: item.id, qty: sellQty, unitPrice: sellPrice }],
  });
  console.log(`\n  posted ${si.docNo}  ${sellQty} @ ${sellPrice}`);

  const afterSell = await sql`
    select coalesce(fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}), 0) as qty`;
  check("sale reduces stock", n(afterSell[0].qty) === qty1 - sellQty,
    `${qty1} -> ${n(afterSell[0].qty)}`);

  const siJournal = await sql`
    select account_code, debit, credit from v_journal_line
     where source_id = ${si.id} order by line_no`;
  check("sale entry balances",
    Math.abs(siJournal.reduce((s, l) => s + n(l.debit) - n(l.credit), 0)) < 0.0001);
  check("sale debits receivables", siJournal.some((l) => n(l.debit) > 0 && l.account_code === "1200"));
  check("sale credits revenue", siJournal.some((l) => n(l.credit) > 0 && l.account_code === "4100"));
  check("sale debits COGS", siJournal.some((l) => n(l.debit) > 0 && l.account_code === "5100"));
  check("sale credits inventory", siJournal.some((l) => n(l.credit) > 0 && l.account_code === "1300"));

  const cogsLine = siJournal.find((l) => l.account_code === "5100");
  check("COGS uses moving average, not sale price",
    Math.abs(n(cogsLine?.debit) - sellQty * cost1) < 1,
    `${n(cogsLine?.debit)} vs ${(sellQty * cost1).toFixed(2)}`);

  const revLine = siJournal.find((l) => l.account_code === "4100");
  check("revenue is the sale price", Math.abs(n(revLine?.credit) - sellQty * sellPrice) < 0.01);

  // ---- Overselling must be refused -------------------------------------

  let refused = false;
  try {
    await postSalesInvoice({
      companyId: co.id, partnerId: cust.id, locationId: loc.id,
      docDate: today, dueDate: null,
      lines: [{ itemId: item.id, qty: 9_999_999, unitPrice: 1 }],
    });
  } catch {
    refused = true;
  }
  check("selling more than on hand is refused", refused);

  // ---- Invariants still hold -------------------------------------------

  console.log("");
  const [tb] = await sql`select coalesce(sum(balance),0) as v from v_trial_balance`;
  check("trial balance still nets to zero", Math.abs(n(tb.v)) < 0.0001, `${n(tb.v)}`);

  const unbal = await sql`select 1 from v_check_unbalanced_entries`;
  check("no unbalanced entries", unbal.length === 0);

  const invRecon = await sql`select 1 from v_check_inventory_reconciliation`;
  check("inventory still reconciles to the stock ledger", invRecon.length === 0);

  console.log(failures === 0 ? "\n  all posting tests pass\n" : `\n  ${failures} test(s) failed\n`);
} catch (err) {
  console.error(`\n  error: ${err.message}\n`);
  failures++;
} finally {
  await sql.end();
}

process.exit(failures === 0 ? 0 : 1);
