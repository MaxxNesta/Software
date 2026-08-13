// Proves a cleared database can still take data entry end to end: create a
// category, an item, a customer and a supplier, then buy and sell.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = readFileSync(join(root, ".env"), "utf8")
    .match(/DATABASE_URL\s*=\s*(.+)/)[1].trim();
}
const { postSalesInvoice, postPurchaseInvoice } = await import("../lib/posting.ts");

const url = process.env.DATABASE_URL;
const local = url.includes("127.0.0.1") || url.includes("localhost");
const sql = postgres(url, { ssl: local ? false : "require",
  prepare: !url.includes("-pooler."), onnotice: () => {}, max: 1 });

let bad = 0;
const check = (l, ok, d = "") => { if (!ok) bad++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${d ? "  " + d : ""}`); };
const n = (v) => Number(v ?? 0);

try {
  const [co] = await sql`select id from company limit 1`;
  const [loc] = await sql`select id from location where is_stock_location order by code limit 1`;
  const [uom] = await sql`select id from uom order by code limit 1`;
  const today = new Date().toISOString().slice(0, 10);

  check("database is empty", n((await sql`select count(*) as c from document`)[0].c) === 0);

  // Parent category, then a child under it — the depth the UI now allows.
  const [parent] = await sql`
    insert into item_group (company_id, code, name) values (${co.id}, 'TEST', 'Test Category')
    returning id`;
  const [child] = await sql`
    insert into item_group (company_id, parent_id, code, name)
    values (${co.id}, ${parent.id}, 'TEST-SUB', 'Test Sub Category') returning id`;
  check("nested category created", Boolean(child.id));

  const [item] = await sql`
    insert into item (company_id, item_group_id, code, name, base_uom_id)
    values (${co.id}, ${child.id}, 'TEST-001', 'Test Product', ${uom.id}) returning id`;

  const [cust] = await sql`
    insert into business_partner (company_id, code, name, is_customer, payment_terms_days)
    values (${co.id}, 'TC-01', 'Test Customer', true, 30) returning id`;
  const [supp] = await sql`
    insert into business_partner (company_id, code, name, is_supplier)
    values (${co.id}, 'TS-01', 'Test Supplier', true) returning id`;
  check("partners created", Boolean(cust.id && supp.id));

  const pi = await postPurchaseInvoice({
    companyId: co.id, partnerId: supp.id, locationId: loc.id,
    docDate: today, dueDate: null,
    lines: [{ itemId: item.id, qty: 50, unitPrice: 2000 }],
  });
  check("purchase posts on a cleared database", Boolean(pi.docNo), pi.docNo);
  check("numbering restarted at 1", pi.docNo.endsWith("000001"), pi.docNo);
  check("stock arrived",
    n((await sql`select fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}) as q`)[0].q) === 50);

  const si = await postSalesInvoice({
    companyId: co.id, partnerId: cust.id, locationId: loc.id,
    docDate: today, dueDate: null,
    lines: [{ itemId: item.id, qty: 20, unitPrice: 3000 }],
  });
  check("sale posts", Boolean(si.docNo), si.docNo);
  check("stock reduced to 30",
    n((await sql`select fn_qty_on_hand(${co.id}, ${item.id}, ${loc.id}) as q`)[0].q) === 30);

  const j = await sql`select account_code, debit, credit from v_journal_line where source_id = ${si.id}`;
  check("account determination still resolves", j.length === 4, `${j.length} journal lines`);

  const [tb] = await sql`select coalesce(sum(balance),0) as v from v_trial_balance`;
  check("trial balance nets to zero", Math.abs(n(tb.v)) < 0.0001);
  check("inventory reconciles",
    (await sql`select 1 from v_check_inventory_reconciliation`).length === 0);

  console.log(bad === 0 ? "\n  a cleared database is fully usable\n" : `\n  ${bad} failed\n`);
} catch (e) {
  console.error(`\n  error: ${e.message}\n`); bad++;
} finally { await sql.end(); }
process.exit(bad === 0 ? 0 : 1);
