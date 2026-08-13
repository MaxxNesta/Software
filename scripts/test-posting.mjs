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

  // ---- Cash sale: part payment taken at the counter ---------------------

  const [salesman] = await sql`
    select id, code from salesman where company_id = ${co.id} order by code limit 1`;
  const [cashAcct] = await sql`
    select id, code from account where company_id = ${co.id} and is_cash_account order by code limit 1`;

  const cashQty = 10;
  const cashPrice = 2000;
  const cashTotal = cashQty * cashPrice;
  const paidNow = cashTotal / 2;

  const cs = await postSalesInvoice({
    companyId: co.id, partnerId: cust.id, locationId: loc.id,
    docDate: today, dueDate: null, reference: "PO-9981",
    salesmanId: salesman.id, paymentType: "CASH", toDeliver: true,
    cashIn: paidNow, cashAccountId: cashAcct.id,
    lines: [{ itemId: item.id, qty: cashQty, unitPrice: cashPrice }],
  });
  console.log(`\n  posted ${cs.docNo} with receipt ${cs.receiptNo}  (${paidNow} of ${cashTotal})`);

  check("cash in creates a receipt document", Boolean(cs.receiptNo));

  const [rc] = await sql`
    select d.id, d.doc_no, d.gross_total, d.source_document_id
      from document d where d.doc_no = ${cs.receiptNo} and d.doc_type = 'CUSTOMER_RECEIPT'`;
  check("receipt is linked back to the invoice", rc?.source_document_id === cs.id);
  check("receipt is for the cash taken", n(rc?.gross_total) === paidNow);

  const rcJournal = await sql`
    select account_code, debit, credit from v_journal_line where source_id = ${rc.id}`;
  check("receipt debits cash", rcJournal.some((l) => n(l.debit) === paidNow && l.account_code === cashAcct.code));
  check("receipt credits receivables", rcJournal.some((l) => n(l.credit) === paidNow && l.account_code === "1200"));

  const [openAfter] = await sql`
    select outstanding, gross_total from v_open_item where document_id = ${cs.id}`;
  check("invoice stays open for the unpaid half",
    n(openAfter?.outstanding) === cashTotal - paidNow,
    `${n(openAfter?.outstanding)} of ${n(openAfter?.gross_total)}`);

  const [voucher] = await sql`
    select payment_type, reference, to_deliver, salesman_id from document where id = ${cs.id}`;
  check("voucher fields stored",
    voucher.payment_type === "CASH" && voucher.reference === "PO-9981" &&
    voucher.to_deliver === true && voucher.salesman_id === salesman.id);

  const pending = await sql`
    select 1 from v_pending_delivery where document_id = ${cs.id}`;
  check("to-deliver appears on the warehouse worklist", pending.length === 1);

  // ---- Buy 10 get 1 free ------------------------------------------------
  // 11 units leave the warehouse. Revenue is recognised on the 10 that were
  // paid for. The cost of all 11 leaves inventory, but the free one lands in
  // promotion expense rather than COGS, so a giveaway shows up as a
  // promotional cost instead of silently eroding gross margin.

  const [foc] = await sql`
    select id from foc_reason where company_id = ${co.id} and code = 'PROMOTION'`;

  const focBefore = n(
    (await sql`select fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}) as q`)[0].q
  );
  const focCost = n(
    (await sql`select fn_moving_average_cost(${co.id}, ${item.id}) as c`)[0].c
  );

  const promo = await postSalesInvoice({
    companyId: co.id, partnerId: cust.id, locationId: loc.id,
    docDate: today, dueDate: null, memo: "buy 10 get 1",
    lines: [
      { itemId: item.id, qty: 10, unitPrice: 1000 },
      { itemId: item.id, qty: 1, unitPrice: 0, focReasonId: foc.id },
    ],
  });

  const focAfter = n(
    (await sql`select fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}) as q`)[0].q
  );
  console.log(`\n  posted ${promo.docNo}  10 sold + 1 free`);

  check("11 units leave stock, not 10", focBefore - focAfter === 11,
    `${focBefore} -> ${focAfter}`);

  const pj = await sql`
    select account_code, debit, credit from v_journal_line
     where source_id = ${promo.id} order by line_no`;

  const rev11 = pj.find((l) => l.account_code === "4100");
  const cogs11 = pj.find((l) => l.account_code === "5100");
  const promoExp = pj.find((l) => l.account_code === "6100");
  const inv11 = pj.find((l) => l.account_code === "1300");

  check("revenue only on the 10 paid for", n(rev11?.credit) === 10_000,
    `${n(rev11?.credit)}`);
  check("COGS covers 10 units", Math.abs(n(cogs11?.debit) - 10 * focCost) < 1,
    `${n(cogs11?.debit).toFixed(2)} vs ${(10 * focCost).toFixed(2)}`);
  check("free unit hits promotion expense, not COGS",
    Math.abs(n(promoExp?.debit) - focCost) < 1,
    `${n(promoExp?.debit).toFixed(2)} vs ${focCost.toFixed(2)}`);
  check("inventory credited for all 11", Math.abs(n(inv11?.credit) - 11 * focCost) < 1,
    `${n(inv11?.credit).toFixed(2)} vs ${(11 * focCost).toFixed(2)}`);
  check("receivable is only the 10 sold",
    n((await sql`select outstanding from v_open_item where document_id = ${promo.id}`)[0]?.outstanding) === 10_000);

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
