"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { postSalesInvoice, postPurchaseInvoice, type InvoiceLine } from "./posting";

export type ActionResult = { error: string } | { ok: true };

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function num(fd: FormData, key: string): number {
  const v = Number(fd.get(key));
  return Number.isFinite(v) ? v : 0;
}

async function companyId(): Promise<string> {
  const [c] = await sql`select id from company order by created_at limit 1`;
  if (!c) throw new Error("No company is set up");
  return c.id;
}

// --------------------------------------------------------------- partners --

export async function createPartner(_prev: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const co = await companyId();

    const code = str(fd, "code").toUpperCase();
    const name = str(fd, "name");
    const isCustomer = fd.get("is_customer") === "on";
    const isSupplier = fd.get("is_supplier") === "on";

    if (!code) return { error: "Code is required" };
    if (!name) return { error: "Name is required" };
    if (!isCustomer && !isSupplier) return { error: "Choose customer, supplier, or both" };

    const dup = await sql`
      select 1 from business_partner where company_id = ${co} and code = ${code}`;
    if (dup.length) return { error: `Code ${code} is already used` };

    await sql`
      insert into business_partner
        (company_id, code, name, name_my, company_name, is_customer, is_supplier,
         township, address, phone, payment_terms_days, credit_limit)
      values
        (${co}, ${code}, ${name}, ${str(fd, "name_my") || null},
         ${str(fd, "company_name") || null}, ${isCustomer}, ${isSupplier},
         ${str(fd, "township") || null}, ${str(fd, "address") || null},
         ${str(fd, "phone") || null}, ${num(fd, "payment_terms_days")},
         ${fd.get("credit_limit") ? num(fd, "credit_limit") : null})`;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/partners");
  redirect("/partners");
}

// ------------------------------------------------------ categories & items --

export async function createCategory(_prev: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const co = await companyId();

    const code = str(fd, "code").toUpperCase();
    const name = str(fd, "name");
    const parentId = str(fd, "parent_id") || null;

    if (!code) return { error: "Code is required" };
    if (!name) return { error: "Name is required" };

    const dup = await sql`
      select 1 from item_group where company_id = ${co} and code = ${code}`;
    if (dup.length) return { error: `Code ${code} is already used` };

    await sql`
      insert into item_group (company_id, parent_id, code, name, name_my)
      values (${co}, ${parentId}, ${code}, ${name}, ${str(fd, "name_my") || null})`;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/items/categories");
  redirect("/items/categories");
}

export async function createItem(_prev: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const co = await companyId();

    const code = str(fd, "code").toUpperCase();
    const name = str(fd, "name");
    const groupId = str(fd, "item_group_id");
    const uomId = str(fd, "base_uom_id");
    const salePrice = num(fd, "sale_price");

    if (!code) return { error: "Code is required" };
    if (!name) return { error: "Name is required" };
    if (!groupId) return { error: "Choose a category" };
    if (!uomId) return { error: "Choose a unit" };

    const dup = await sql`select 1 from item where company_id = ${co} and code = ${code}`;
    if (dup.length) return { error: `Code ${code} is already used` };

    await sql.begin(async (tx) => {
      const [item] = await tx`
        insert into item
          (company_id, item_group_id, code, name, name_my, base_uom_id, is_stocked)
        values
          (${co}, ${groupId}, ${code}, ${name}, ${str(fd, "name_my") || null},
           ${uomId}, ${fd.get("is_stocked") !== null})
        returning id`;

      if (salePrice > 0) {
        const [level] = await tx`
          select id from price_level where company_id = ${co} order by sort_order limit 1`;
        if (level) {
          await tx`
            insert into item_price
              (company_id, item_id, price_level_id, uom_id, currency, price)
            values (${co}, ${item.id}, ${level.id}, ${uomId}, 'MMK', ${salePrice})`;
        }
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/items");
  redirect("/items");
}

// --------------------------------------------------------------- invoices --

function parseLines(fd: FormData): InvoiceLine[] {
  const raw = String(fd.get("lines") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not read the invoice lines");
  }
  if (!Array.isArray(parsed)) throw new Error("Could not read the invoice lines");

  return parsed
    .map((l: any) => ({
      itemId: String(l.itemId ?? ""),
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice),
      focReasonId: l.focReasonId || null,
    }))
    .filter((l) => l.itemId && l.qty > 0);
}

export async function createSalesInvoice(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let docId: string;

  try {
    const co = await companyId();
    const lines = parseLines(fd);

    if (lines.length === 0) return { error: "Add at least one line with a quantity" };
    if (!str(fd, "partner_id")) return { error: "Choose a customer" };
    if (!str(fd, "location_id")) return { error: "Choose a warehouse" };

    const result = await postSalesInvoice({
      companyId: co,
      partnerId: str(fd, "partner_id"),
      locationId: str(fd, "location_id"),
      docDate: str(fd, "doc_date"),
      dueDate: str(fd, "due_date") || null,
      memo: str(fd, "memo") || null,
      lines,
    });

    docId = result.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/");
  revalidatePath("/documents");
  revalidatePath("/receivables");
  revalidatePath("/ledger");
  revalidatePath("/items");
  redirect(`/documents/${docId}`);
}

export async function createPurchaseInvoice(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let docId: string;

  try {
    const co = await companyId();
    const lines = parseLines(fd);

    if (lines.length === 0) return { error: "Add at least one line with a quantity" };
    if (!str(fd, "partner_id")) return { error: "Choose a supplier" };
    if (!str(fd, "location_id")) return { error: "Choose a warehouse" };

    const result = await postPurchaseInvoice({
      companyId: co,
      partnerId: str(fd, "partner_id"),
      locationId: str(fd, "location_id"),
      docDate: str(fd, "doc_date"),
      dueDate: str(fd, "due_date") || null,
      memo: str(fd, "memo") || null,
      lines,
    });

    docId = result.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/");
  revalidatePath("/documents");
  revalidatePath("/payables");
  revalidatePath("/ledger");
  revalidatePath("/items");
  redirect(`/documents/${docId}`);
}

// ------------------------------------------------------------- form lookups --

export async function getFormData() {
  const co = await companyId();

  const [customers, suppliers, items, locations, groups, uoms] = await Promise.all([
    sql`select id, code, name, payment_terms_days from business_partner
         where company_id = ${co} and is_customer and is_active order by code`,
    sql`select id, code, name, payment_terms_days from business_partner
         where company_id = ${co} and is_supplier and is_active order by code`,
    sql`select i.id, i.code, i.name, i.is_stocked,
                coalesce(s.qty, 0) as on_hand,
                coalesce(p.price, 0) as sale_price,
                coalesce(fn_moving_average_cost(${co}, i.id), 0) as avg_cost
           from item i
           left join (select item_id, sum(qty_on_hand) as qty
                        from v_stock_on_hand group by item_id) s on s.item_id = i.id
           left join item_price p on p.item_id = i.id
          where i.company_id = ${co} and i.is_active
          order by i.code`,
    sql`select id, code, name from location
         where company_id = ${co} and is_stock_location and is_active order by code`,
    sql`select g.id, g.code, g.name, g.parent_id, p.name as parent_name
           from item_group g
           left join item_group p on p.id = g.parent_id
          where g.company_id = ${co} order by g.code`,
    sql`select id, code, name from uom where company_id = ${co} order by code`,
  ]);

  return { customers, suppliers, items, locations, groups, uoms };
}
