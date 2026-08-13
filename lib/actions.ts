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
  let returnTo: string | null = null;

  try {
    const co = await companyId();

    const segment = str(fd, "segment").toUpperCase();
    const name = str(fd, "name");
    const parentId = str(fd, "parent_id") || null;
    returnTo = str(fd, "return_to") || null;

    if (!segment) return { error: "Code segment is required" };
    if (!name) return { error: "Name is required" };

    // The full code is the parent chain plus this segment, composed by
    // trigger. Two siblings sharing a segment would compose to the same
    // code, so check the composed value rather than the segment alone.
    const [composed] = await sql`
      select fn_compose_group_code(${parentId}::uuid, ${segment}) as code`;

    const dup = await sql`
      select name from item_group where company_id = ${co} and code = ${composed.code}`;
    if (dup.length) {
      return { error: `Code ${composed.code} is already used by ${dup[0].name}` };
    }

    await sql`
      insert into item_group (company_id, parent_id, segment, code, name, name_my)
      values (${co}, ${parentId}, ${segment}, ${composed.code}, ${name},
              ${str(fd, "name_my") || null})`;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/items/categories");
  revalidatePath("/items/new");
  redirect(returnTo || "/items/categories");
}

/**
 * Inserts a new category directly above an existing one: the new category
 * takes the target's place in the tree, and the target moves underneath it.
 * The whole branch below the target comes along, since it hangs off the
 * target rather than off its parent.
 */
export async function insertCategoryAbove(_prev: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const co = await companyId();

    const targetId = str(fd, "target_id");
    const segment = str(fd, "segment").toUpperCase();
    const name = str(fd, "name");

    if (!targetId) return { error: "Choose which category to lift" };
    if (!segment) return { error: "Code segment is required" };
    if (!name) return { error: "Name is required" };

    await sql.begin(async (tx) => {
      const [target] = await tx`
        select id, parent_id from item_group
         where id = ${targetId} and company_id = ${co}`;
      if (!target) throw new Error("That category no longer exists");

      const [composed] = await tx`
        select fn_compose_group_code(${target.parent_id}::uuid, ${segment}) as code`;

      const [created] = await tx`
        insert into item_group (company_id, parent_id, segment, code, name, name_my)
        values (${co}, ${target.parent_id}, ${segment}, ${composed.code}, ${name},
                ${str(fd, "name_my") || null})
        returning id`;

      await tx`
        update item_group set parent_id = ${created.id} where id = ${target.id}`;
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/items/categories");
  revalidatePath("/items/new");
  redirect("/items/categories");
}

/** Re-parents a category. Refuses moves that would make the tree cyclic. */
export async function moveCategory(_prev: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const co = await companyId();

    const id = str(fd, "id");
    const newParent = str(fd, "new_parent_id") || null;

    if (!id) return { error: "Choose a category to move" };
    if (id === newParent) return { error: "A category cannot sit under itself" };

    if (newParent) {
      // Moving a category under one of its own descendants would detach the
      // branch from the tree entirely and loop forever when walking it.
      const cycle = await sql`
        with recursive descendants as (
          select id from item_group where id = ${id} and company_id = ${co}
          union all
          select g.id from item_group g join descendants d on g.parent_id = d.id
        )
        select 1 from descendants where id = ${newParent}`;
      if (cycle.length) {
        return { error: "That would put the category inside its own branch" };
      }
    }

    await sql`
      update item_group set parent_id = ${newParent}
       where id = ${id} and company_id = ${co}`;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/items/categories");
  revalidatePath("/items/new");
  redirect("/items/categories");
}

export async function createItem(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let returnTo: string | null = null;

  try {
    const co = await companyId();
    returnTo = str(fd, "return_to") || null;

    const serial = str(fd, "serial").toUpperCase();
    const name = str(fd, "name");
    const groupId = str(fd, "item_group_id");
    const uomId = str(fd, "base_uom_id");
    const salePrice = num(fd, "sale_price");

    if (!serial) return { error: "Serial is required" };
    if (!name) return { error: "Name is required" };
    if (!groupId) return { error: "Choose a category" };
    if (!uomId) return { error: "Choose a unit" };

    const [grp] = await sql`
      select code from item_group where id = ${groupId} and company_id = ${co}`;
    if (!grp) return { error: "That category no longer exists" };

    const fullCode = `${grp.code}${serial}`;
    const dup = await sql`
      select name from item where company_id = ${co} and code = ${fullCode}`;
    if (dup.length) {
      return { error: `Code ${fullCode} is already used by ${dup[0].name}` };
    }

    await sql.begin(async (tx) => {
      const [item] = await tx`
        insert into item
          (company_id, item_group_id, serial, code, name, name_my, base_uom_id, is_stocked)
        values
          (${co}, ${groupId}, ${serial}, ${fullCode}, ${name}, ${str(fd, "name_my") || null},
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
  revalidatePath("/items/categories");
  redirect(returnTo || "/items");
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

    const paymentType = str(fd, "payment_type") === "CASH" ? "CASH" : "CREDIT";
    const cashIn = num(fd, "cash_in");

    const result = await postSalesInvoice({
      companyId: co,
      partnerId: str(fd, "partner_id"),
      locationId: str(fd, "location_id"),
      docDate: str(fd, "doc_date"),
      dueDate: str(fd, "due_date") || null,
      memo: str(fd, "memo") || null,
      reference: str(fd, "reference") || null,
      salesmanId: str(fd, "salesman_id") || null,
      paymentType,
      toDeliver: fd.get("to_deliver") !== null,
      cashIn,
      cashAccountId: str(fd, "cash_account_id") || null,
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
      reference: str(fd, "reference") || null,
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

  const [
    customers, suppliers, items, locations, groups, uoms,
    salesmen, promotions, cashAccounts, focReasons, openInvoices, nextNo,
  ] = await Promise.all([
    sql`select id, code, name, payment_terms_days from business_partner
         where company_id = ${co} and is_customer and is_active order by code`,
    sql`select id, code, name, payment_terms_days from business_partner
         where company_id = ${co} and is_supplier and is_active order by code`,
    sql`select i.id, i.code, i.name, i.is_stocked, i.item_group_id,
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
    sql`select g.id, g.code, g.name, g.name_my, g.parent_id, p.name as parent_name
           from item_group g
           left join item_group p on p.id = g.parent_id
          where g.company_id = ${co} order by g.code`,
    sql`select id, code, name from uom where company_id = ${co} order by code`,

    sql`select id, code, name, name_my, commission_pct from salesman
         where company_id = ${co} and is_active order by code`,

    sql`select p.id, p.code, p.name, p.discount_pct, p.buy_qty, p.free_qty,
                p.valid_from, p.valid_to, p.item_id, p.item_group_id,
                i.code as item_code, g.name as group_name
           from promotion p
           left join item i on i.id = p.item_id
           left join item_group g on g.id = p.item_group_id
          where p.company_id = ${co} and p.is_active
            and p.valid_from <= current_date
            and (p.valid_to is null or p.valid_to >= current_date)
          order by p.code`,

    sql`select id, code, name from account
         where company_id = ${co} and is_cash_account and is_active order by code`,

    sql`select id, code, name from foc_reason where company_id = ${co} order by code`,

    sql`select document_id, doc_no, partner_id, posting_date, due_date,
                gross_total, outstanding, aging_bucket
           from v_open_item
          where company_id = ${co} and doc_type = 'SALES_INVOICE'
          order by posting_date desc`,

    // Shown on the voucher before posting. The real number is taken under a
    // row lock at posting time, so this is a preview and may move if someone
    // else posts first.
    sql`select coalesce(prefix, 'SI-') || lpad(coalesce(next_value, 1)::text,
                coalesce(padding, 6), '0') as no
           from number_series
          where company_id = ${co} and document_type = 'SALES_INVOICE'
          limit 1`,
  ]);

  return {
    customers, suppliers, items, locations, groups, uoms,
    salesmen, promotions, cashAccounts, focReasons, openInvoices,
    nextInvoiceNo: (nextNo[0]?.no as string) ?? "SI-000001",
  };
}
