import { sql } from "./db";

export type Company = { id: string; code: string; name: string; name_my: string | null; base_currency: string };

export async function getCompany(): Promise<Company | null> {
  const rows = await sql<Company[]>`
    select id, code, name, name_my, base_currency from company order by created_at limit 1`;
  return rows[0] ?? null;
}

export async function getKpis(companyId: string) {
  const [stock] = await sql`
    select coalesce(sum(value_on_hand), 0) as value, coalesce(sum(qty_on_hand), 0) as qty
      from v_stock_on_hand where company_id = ${companyId}`;

  const [ar] = await sql`
    select coalesce(sum(outstanding), 0) as total, count(*)::int as n
      from v_open_item where company_id = ${companyId} and doc_type = 'SALES_INVOICE'`;

  const [ap] = await sql`
    select coalesce(sum(outstanding), 0) as total, count(*)::int as n
      from v_open_item where company_id = ${companyId} and doc_type = 'PURCHASE_INVOICE'`;

  // v_grir_balance groups by whichever document posted to GR/IR clearing —
  // a goods receipt still waiting on its bill, or a bill that arrived before
  // the goods did. Split by doc_type: lumping both under one "receipts, not
  // invoiced" number is wrong whenever the second case exists.
  const grirRows = await sql`
    select d.doc_type, coalesce(sum(g.balance), 0) as total, count(*)::int as n
      from v_grir_balance g
      join document d on d.id = g.document_id
     where g.company_id = ${companyId}
     group by d.doc_type`;
  const grirRow = (t: string) => {
    const r = grirRows.find((x: any) => x.doc_type === t);
    return { total: Number(r?.total ?? 0), n: Number(r?.n ?? 0) };
  };
  const grirReceipts = grirRow("GOODS_RECEIPT");
  const grirInvoices = grirRow("PURCHASE_INVOICE");
  const grir = { total: grirReceipts.total + grirInvoices.total, n: grirReceipts.n + grirInvoices.n };

  const [cash] = await sql`
    select coalesce(sum(jl.base_amount), 0) as total
      from journal_line jl
      join account a on a.id = jl.account_id
     where jl.company_id = ${companyId} and a.code in ('1110', '1120')`;

  const [overdue] = await sql`
    select coalesce(sum(outstanding), 0) as total, count(*)::int as n
      from v_open_item
     where company_id = ${companyId} and doc_type = 'SALES_INVOICE'
       and aging_bucket <> 'CURRENT'`;

  return { stock, ar, ap, grir, grirReceipts, grirInvoices, cash, overdue };
}

/**
 * Counts of open commitments, for the dashboard's "action required" summary
 * — how many orders/receipts are still waiting on something, not the line-
 * level detail getOpenSalesOrders/getOpenPurchaseOrders/getPendingDeliveries
 * return for the fulfilment forms themselves.
 */
export async function getActionItems(companyId: string) {
  const [so] = await sql`
    select count(distinct o.id)::int as n
      from document o
      join document_line ol on ol.document_id = o.id
      left join (
        select dl.source_line_id, sum(dl.base_qty) as delivered_qty
          from document_line dl join document dd on dd.id = dl.document_id
         where dd.doc_type = 'DELIVERY' and dd.status = 'POSTED'
         group by dl.source_line_id
      ) d on d.source_line_id = ol.id
     where o.company_id = ${companyId} and o.doc_type = 'SALES_ORDER' and o.status = 'POSTED'
       and (ol.base_qty - coalesce(d.delivered_qty, 0)) > 0.0001`;

  const [po] = await sql`
    select count(distinct o.id)::int as n
      from document o
      join document_line ol on ol.document_id = o.id
      left join (
        select dl.source_line_id, sum(dl.base_qty) as received_qty
          from document_line dl join document dd on dd.id = dl.document_id
         where dd.doc_type = 'GOODS_RECEIPT' and dd.status = 'POSTED'
         group by dl.source_line_id
      ) r on r.source_line_id = ol.id
     where o.company_id = ${companyId} and o.doc_type = 'PURCHASE_ORDER' and o.status = 'POSTED'
       and (ol.base_qty - coalesce(r.received_qty, 0)) > 0.0001`;

  const [pd] = await sql`
    select count(*)::int as n
      from document inv
     where inv.company_id = ${companyId} and inv.doc_type = 'SALES_INVOICE'
       and inv.to_deliver and inv.status = 'POSTED'
       and not exists (
         select 1 from document dd where dd.source_document_id = inv.id and dd.doc_type = 'DELIVERY'
       )`;

  return {
    salesOrdersOpen: so.n as number,
    purchaseOrdersOpen: po.n as number,
    pendingDeliveryInvoices: pd.n as number,
  };
}

// The invariants, run live. Every one of these should come back clean.
export async function getHealth(companyId: string) {
  const unbalanced = await sql`
    select * from v_check_unbalanced_entries where company_id = ${companyId}`;
  const inventory = await sql`
    select * from v_check_inventory_reconciliation where company_id = ${companyId}`;
  const [tb] = await sql`
    select coalesce(sum(balance), 0) as total from v_trial_balance where company_id = ${companyId}`;

  return {
    unbalanced: unbalanced.length,
    inventoryBreaks: inventory.length,
    trialBalance: Number(tb?.total ?? 0),
  };
}

export async function getAging(companyId: string) {
  return sql`
    select aging_bucket,
           count(*)::int          as invoices,
           sum(outstanding)       as total
      from v_open_item
     where company_id = ${companyId} and doc_type = 'SALES_INVOICE'
     group by aging_bucket
     order by case aging_bucket
       when 'CURRENT' then 0 when '1-30' then 1 when '31-60' then 2
       when '61-90' then 3 else 4 end`;
}

/**
 * Every invoice of one type, posted or not, for a management list screen —
 * distinct from getOpenItems, which only returns what is still owed.
 * Posted rows come from v_invoice_status (paid, outstanding, payment_status,
 * days_overdue all precomputed there); draft/cancelled/reversed rows carry
 * zero paid/outstanding, since neither ever had a ledger effect, but their
 * gross_total is still shown for reference. Nothing in the app leaves an
 * invoice in those states today, so this half of the union returns nothing
 * in practice -- it is here so the list stays correct if that changes.
 */
export async function getInvoiceList(companyId: string, docType: "SALES_INVOICE" | "PURCHASE_INVOICE") {
  return sql`
    select document_id, doc_no, posting_date, due_date,
           partner_id, partner_code, partner_name,
           gross_total, paid, outstanding, 'POSTED' as doc_status,
           payment_status, days_overdue
      from v_invoice_status
     where company_id = ${companyId} and doc_type = ${docType}

     union all

     select d.id as document_id, d.doc_no, d.posting_date, d.due_date,
            d.partner_id, p.code as partner_code, p.name as partner_name,
            d.gross_total, 0::numeric as paid, 0::numeric as outstanding,
            d.status as doc_status, null as payment_status, null::int as days_overdue
       from document d
       join business_partner p on p.id = d.partner_id
      where d.company_id = ${companyId} and d.doc_type = ${docType} and d.status <> 'POSTED'

     order by posting_date desc, doc_no desc`;
}

/** What each customer/supplier owes or is owed, for a per-partner rollup. */
export async function getPartnerBalances(companyId: string, docType: "SALES_INVOICE" | "PURCHASE_INVOICE") {
  return sql`
    select partner_id, partner_code, partner_name,
           open_invoices, invoiced, paid, outstanding, overdue, due_soon, credit_limit
      from v_partner_balance
     where company_id = ${companyId} and doc_type = ${docType}
     order by outstanding desc`;
}

export async function getOpenItems(companyId: string, docType: string) {
  return sql`
    select document_id, doc_no, partner_name, posting_date, due_date,
           gross_total, allocated, outstanding, aging_bucket, days_overdue
      from v_open_item
     where company_id = ${companyId} and doc_type = ${docType}
     order by due_date nulls last`;
}

export async function getDocuments(companyId: string, docType?: string, openGrirOnly?: boolean) {
  return sql`
    select d.id, d.doc_type, d.doc_no, d.doc_date, d.posting_date, d.due_date,
           d.status, d.gross_total, d.currency,
           p.name  as partner_name,
           l.code  as location_code,
           src.doc_no as source_doc_no,
           je.entry_no
      from document d
      left join business_partner p  on p.id = d.partner_id
      left join location         l  on l.id = d.location_id
      left join document        src on src.id = d.source_document_id
      left join journal_entry   je  on je.id = d.journal_entry_id
     where d.company_id = ${companyId}
       ${docType ? sql`and d.doc_type = ${docType}` : sql``}
       ${openGrirOnly ? sql`and exists (select 1 from v_grir_balance g where g.document_id = d.id)` : sql``}
     order by d.posting_date desc, d.doc_no desc`;
}

/**
 * Sales invoices and deliveries a customer return can be posted against, so
 * the return can be costed at what those units actually sold for instead of
 * an estimate. Only what a return could plausibly reference — posted,
 * customer-facing, stock-moving document types.
 */
export async function getReturnableSales(companyId: string) {
  return sql`
    select d.id, d.doc_type, d.doc_no, d.doc_date, d.partner_id
      from document d
     where d.company_id = ${companyId}
       and d.doc_type in ('SALES_INVOICE', 'DELIVERY')
       and d.status = 'POSTED'
     order by d.doc_date desc, d.doc_no desc
     limit 500`;
}

/**
 * Goods receipts a purchase invoice can match against — only the ones
 * still sitting unresolved in GR/IR clearing (v_grir_balance), each with
 * its own lines so the invoice form can pre-fill and compare quantities.
 */
export async function getOpenGoodsReceipts(companyId: string) {
  return sql`
    select d.id, d.doc_no, d.doc_date, d.partner_id,
           coalesce(json_agg(json_build_object(
             'itemId', dl.item_id, 'itemCode', i.code, 'itemName', i.name,
             'qty', dl.base_qty, 'unitPrice', dl.unit_price
           ) order by dl.line_no), '[]') as lines
      from document d
      join v_grir_balance g on g.document_id = d.id and g.company_id = d.company_id
      join document_line dl on dl.document_id = d.id
      join item i on i.id = dl.item_id
     where d.company_id = ${companyId} and d.doc_type = 'GOODS_RECEIPT' and d.status = 'POSTED'
     group by d.id, d.doc_no, d.doc_date, d.partner_id
     order by d.doc_date desc, d.doc_no desc
     limit 200`;
}

/**
 * Purchase invoices a goods receipt can match against — the mirror of
 * getOpenGoodsReceipts, for when the bill arrived before the goods did.
 */
export async function getOpenPurchaseInvoices(companyId: string) {
  return sql`
    select d.id, d.doc_no, d.doc_date, d.partner_id,
           coalesce(json_agg(json_build_object(
             'itemId', dl.item_id, 'itemCode', i.code, 'itemName', i.name,
             'qty', dl.base_qty, 'unitPrice', dl.unit_price
           ) order by dl.line_no), '[]') as lines
      from document d
      join v_grir_balance g on g.document_id = d.id and g.company_id = d.company_id
      join document_line dl on dl.document_id = d.id
      join item i on i.id = dl.item_id
     where d.company_id = ${companyId} and d.doc_type = 'PURCHASE_INVOICE' and d.status = 'POSTED'
     group by d.id, d.doc_no, d.doc_date, d.partner_id
     order by d.doc_date desc, d.doc_no desc
     limit 200`;
}

export async function getDocument(id: string) {
  const [doc] = await sql`
    select d.*, p.name as partner_name, p.code as partner_code,
           l.code as location_code, l.name as location_name,
           src.doc_no as source_doc_no, src.id as source_id,
           je.entry_no,
           sm.name as salesman_name, sm.code as salesman_code
      from document d
      left join business_partner p  on p.id = d.partner_id
      left join location         l  on l.id = d.location_id
      left join document        src on src.id = d.source_document_id
      left join journal_entry   je  on je.id = d.journal_entry_id
      left join salesman        sm  on sm.id = d.salesman_id
     where d.id = ${id}`;
  return doc ?? null;
}

export async function getDocumentLines(id: string) {
  return sql`
    select dl.*, i.code as item_code, i.name as item_name,
           u.code as uom_code, f.name as foc_reason
      from document_line dl
      left join item i on i.id = dl.item_id
      left join uom  u on u.id = dl.entered_uom_id
      left join foc_reason f on f.id = dl.foc_reason_id
     where dl.document_id = ${id}
     order by dl.line_no`;
}

export async function getJournalForDocument(journalEntryId: string | null) {
  if (!journalEntryId) return [];
  return sql`
    select line_no, account_code, account_name, account_type,
           debit, credit, currency, memo
      from v_journal_line
     where journal_entry_id = ${journalEntryId}
     order by line_no`;
}

export async function getDownstream(documentId: string) {
  return sql`
    select id, doc_type, doc_no, posting_date, status, gross_total
      from document where source_document_id = ${documentId}
     order by posting_date`;
}

/** What's still unpaid on an invoice — 0 for anything that isn't one. */
export async function getDocumentOutstanding(documentId: string): Promise<number> {
  const [row] = await sql`select outstanding from v_open_item where document_id = ${documentId}`;
  return row ? Number(row.outstanding) : 0;
}

/**
 * Every document connected to this one via source_document_id, either
 * direction — the real documents behind a chain diagram like
 * PO → GR → PI → Payment, so the detail page can link each stage to
 * whatever actually exists instead of just labelling the stage names.
 * Expands outward a few hops at a time until nothing new turns up.
 */
export async function getChainDocuments(documentId: string) {
  const seen = new Map<string, { id: string; doc_type: string; doc_no: string; source_document_id: string | null }>();
  let frontier = [documentId];

  for (let hop = 0; hop < 4 && frontier.length > 0; hop++) {
    const rows = await sql`
      select id, doc_type, doc_no, source_document_id
        from document
       where id = any(${frontier}) or source_document_id = any(${frontier})`;
    const next: string[] = [];
    for (const r of rows as any[]) {
      if (!seen.has(r.id)) {
        seen.set(r.id, r);
        next.push(r.id);
      }
    }
    frontier = next;
  }

  return [...seen.values()];
}

/**
 * The payment that settled this invoice, if any — payments allocate against
 * invoices via payment_allocation, not source_document_id, so they sit
 * outside the chain getChainDocuments walks and need their own lookup.
 */
export async function getSettlingPayment(invoiceId: string) {
  const [row] = await sql`
    select d.id, d.doc_type, d.doc_no
      from payment_allocation pa
      join document d on d.id = pa.payment_id
     where pa.invoice_id = ${invoiceId}
     order by d.posting_date desc
     limit 1`;
  return row ?? null;
}

export async function getStock(companyId: string) {
  return sql`
    select item_code, item_name, location_code,
           qty_on_hand, value_on_hand,
           case when qty_on_hand <> 0
                then value_on_hand / qty_on_hand else 0 end as unit_cost
      from v_stock_on_hand
     where company_id = ${companyId}
     order by item_code`;
}

export async function getPartners(companyId: string) {
  return sql`
    select bp.id, bp.code, bp.name, bp.name_my, bp.company_name,
           bp.is_customer, bp.is_supplier, bp.is_active,
           bp.township, bp.address, bp.phone,
           bp.payment_terms_days, bp.credit_limit,
           coalesce(oi.outstanding, 0) as outstanding
      from business_partner bp
      left join (
            select partner_id, sum(outstanding) as outstanding
              from v_open_item group by partner_id
      ) oi on oi.partner_id = bp.id
     where bp.company_id = ${companyId}
     order by bp.code`;
}

export async function getItems(companyId: string) {
  return sql`
    select i.id, i.code, i.name, i.name_my, i.item_group_id, i.brand_id,
           i.base_uom_id, i.is_stocked, i.is_active,
           g.name as group_name, g.parent_id as group_parent_id,
           pg.name as parent_group_name,
           b.name as brand_name,
           u.code as uom_code,
           coalesce(s.qty, 0) as qty_on_hand, coalesce(s.val, 0) as value_on_hand,
           pr.price as sale_price
      from item i
      join item_group g on g.id = i.item_group_id
      left join item_group pg on pg.id = g.parent_id
      left join brand b on b.id = i.brand_id
      join uom u on u.id = i.base_uom_id
      left join (
            select item_id, sum(qty_on_hand) as qty, sum(value_on_hand) as val
              from v_stock_on_hand group by item_id
      ) s on s.item_id = i.id
      left join item_price pr on pr.item_id = i.id
     where i.company_id = ${companyId}
     order by i.code`;
}

// ------------------------------------------------------ chart of accounts --

/**
 * The whole chart, with everything the admin screen needs to know before it
 * lets someone change an account: whether the posting engine resolves it by
 * role, whether a determination rule points at it, whether anything has been
 * posted to it, and whether it has children. All four are reasons to refuse
 * a delete or a deactivation.
 */
export async function getChartOfAccounts(companyId: string) {
  return sql`
    select a.id, a.code, a.name, a.name_my, a.account_type, a.parent_id,
           a.is_postable, a.is_control, a.is_active, a.currency,
           a.is_cash_account, a.is_bank_account,
           coalesce(sa.roles, array[]::text[])  as system_roles,
           coalesce(ad.roles, array[]::text[])  as rule_roles,
           coalesce(jl.n, 0)::int               as posting_count,
           coalesce(kids.n, 0)::int             as child_count
      from account a
      left join (
        select account_id, array_agg(role order by role) as roles
          from system_account where company_id = ${companyId} group by account_id
      ) sa on sa.account_id = a.id
      left join (
        select account_id, array_agg(distinct role order by role) as roles
          from account_determination where company_id = ${companyId} group by account_id
      ) ad on ad.account_id = a.id
      left join (
        select account_id, count(*) as n
          from journal_line where company_id = ${companyId} group by account_id
      ) jl on jl.account_id = a.id
      left join (
        select parent_id, count(*) as n
          from account where company_id = ${companyId} and parent_id is not null
         group by parent_id
      ) kids on kids.parent_id = a.id
     where a.company_id = ${companyId}
     order by a.code`;
}

// --------------------------------------------------- orders & fulfilment --

/** Open sales order lines — ordered less delivered so far, only where that's still positive. */
/**
 * Every order of one type, at whatever stage of fulfilment, for a
 * management list -- distinct from getOpenSalesOrders/getOpenPurchaseOrders,
 * which return only the still-open lines a delivery/receipt worklist needs.
 * ordered_qty and fulfilled_qty are summed once per order here (rather than
 * left per line) so orderDisplayStatus can classify the whole document.
 */
export async function getOrderList(
  companyId: string,
  docType: "SALES_ORDER" | "PURCHASE_ORDER"
) {
  const fulfilmentType = docType === "SALES_ORDER" ? "DELIVERY" : "GOODS_RECEIPT";

  return sql`
    select o.id as document_id, o.doc_no, o.posting_date, o.due_date,
           o.partner_id, p.code as partner_code, p.name as partner_name,
           o.gross_total, o.status as doc_status,
           coalesce(sum(ol.base_qty), 0)      as ordered_qty,
           coalesce(sum(fl.line_fulfilled), 0) as fulfilled_qty
      from document o
      join business_partner p on p.id = o.partner_id
      left join document_line ol on ol.document_id = o.id
      left join (
            select dl.source_line_id, sum(dl.base_qty) as line_fulfilled
              from document_line dl
              join document dd on dd.id = dl.document_id
             where dd.company_id = ${companyId} and dd.doc_type = ${fulfilmentType} and dd.status = 'POSTED'
             group by dl.source_line_id
      ) fl on fl.source_line_id = ol.id
     where o.company_id = ${companyId} and o.doc_type = ${docType}
     group by o.id, o.doc_no, o.posting_date, o.due_date,
              o.partner_id, p.code, p.name, o.gross_total, o.status
     order by o.posting_date desc, o.doc_no desc`;
}

export async function getOpenSalesOrders(companyId: string) {
  return sql`
    select o.id as order_id, o.doc_no as order_no, o.partner_id, p.name as partner_name,
           o.location_id,
           ol.id as line_id, ol.item_id, i.code as item_code, i.name as item_name,
           ol.base_qty as ordered_qty,
           coalesce(d.delivered_qty, 0) as delivered_qty,
           ol.base_qty - coalesce(d.delivered_qty, 0) as remaining_qty
      from document o
      join document_line ol on ol.document_id = o.id
      join item i on i.id = ol.item_id
      join business_partner p on p.id = o.partner_id
      left join (
        select dl.source_line_id, sum(dl.base_qty) as delivered_qty
          from document_line dl join document dd on dd.id = dl.document_id
         where dd.doc_type = 'DELIVERY' and dd.status = 'POSTED'
         group by dl.source_line_id
      ) d on d.source_line_id = ol.id
     where o.company_id = ${companyId} and o.doc_type = 'SALES_ORDER' and o.status = 'POSTED'
       and (ol.base_qty - coalesce(d.delivered_qty, 0)) > 0
     order by o.doc_no, ol.line_no`;
}

/** Open purchase order lines — ordered less received so far. */
export async function getOpenPurchaseOrders(companyId: string) {
  return sql`
    select o.id as order_id, o.doc_no as order_no, o.partner_id, p.name as partner_name,
           o.location_id,
           ol.id as line_id, ol.item_id, i.code as item_code, i.name as item_name,
           ol.unit_price as expected_price,
           ol.base_qty as ordered_qty,
           coalesce(r.received_qty, 0) as received_qty,
           ol.base_qty - coalesce(r.received_qty, 0) as remaining_qty
      from document o
      join document_line ol on ol.document_id = o.id
      join item i on i.id = ol.item_id
      join business_partner p on p.id = o.partner_id
      left join (
        select dl.source_line_id, sum(dl.base_qty) as received_qty
          from document_line dl join document dd on dd.id = dl.document_id
         where dd.doc_type = 'GOODS_RECEIPT' and dd.status = 'POSTED'
         group by dl.source_line_id
      ) r on r.source_line_id = ol.id
     where o.company_id = ${companyId} and o.doc_type = 'PURCHASE_ORDER' and o.status = 'POSTED'
       and (ol.base_qty - coalesce(r.received_qty, 0)) > 0
     order by o.doc_no, ol.line_no`;
}

/** Sales invoices marked "to deliver" that no delivery has fulfilled yet. */
export async function getPendingDeliveries(companyId: string) {
  return sql`
    select inv.id, inv.doc_no, inv.doc_date, p.name as partner_name,
           count(il.id)::int as lines, sum(il.base_qty)::numeric as total_qty
      from document inv
      join document_line il on il.document_id = inv.id
      join business_partner p on p.id = inv.partner_id
     where inv.company_id = ${companyId} and inv.doc_type = 'SALES_INVOICE'
       and inv.to_deliver and inv.status = 'POSTED'
       and not exists (
         select 1 from document dd where dd.source_document_id = inv.id and dd.doc_type = 'DELIVERY'
       )
     group by inv.id, inv.doc_no, inv.doc_date, p.name
     order by inv.doc_date`;
}

/**
 * Reserved and incoming quantity per item, for the stock position — demand
 * committed but not yet delivered (sales orders and to-deliver invoices),
 * and supply committed but not yet received (purchase orders).
 */
/** Every movement of one item, oldest first — a stock card. */
export async function getStockMovements(companyId: string, itemId: string) {
  return sql`
    select sm.id, sm.movement_date, sm.qty, sm.unit_cost, sm.total_cost,
           sm.batch_no, sm.expiry_date, sm.created_at,
           d.doc_no, d.doc_type, d.id as document_id,
           l.code as location_code
      from stock_movement sm
      left join document d on d.id = sm.document_id
      join location l on l.id = sm.location_id
     where sm.company_id = ${companyId} and sm.item_id = ${itemId}
     order by sm.movement_date, sm.created_at`;
}

export async function getReservedQty(companyId: string) {
  return sql`
    with so_remaining as (
      select ol.item_id, sum(ol.base_qty - coalesce(d.delivered_qty, 0)) as qty
        from document o
        join document_line ol on ol.document_id = o.id
        left join (
          select dl.source_line_id, sum(dl.base_qty) as delivered_qty
            from document_line dl join document dd on dd.id = dl.document_id
           where dd.doc_type = 'DELIVERY' and dd.status = 'POSTED'
           group by dl.source_line_id
        ) d on d.source_line_id = ol.id
       where o.company_id = ${companyId} and o.doc_type = 'SALES_ORDER' and o.status = 'POSTED'
       group by ol.item_id
      having sum(ol.base_qty - coalesce(d.delivered_qty, 0)) > 0
    ),
    invoice_pending as (
      select il.item_id, sum(il.base_qty) as qty
        from document inv
        join document_line il on il.document_id = inv.id
       where inv.company_id = ${companyId} and inv.doc_type = 'SALES_INVOICE'
         and inv.to_deliver and inv.status = 'POSTED'
         and not exists (
           select 1 from document dd where dd.source_document_id = inv.id and dd.doc_type = 'DELIVERY'
         )
       group by il.item_id
    )
    select item_id, sum(qty) as reserved_qty
      from (select * from so_remaining union all select * from invoice_pending) x
     group by item_id`;
}

export async function getIncomingQty(companyId: string) {
  return sql`
    select ol.item_id, sum(ol.base_qty - coalesce(r.received_qty, 0)) as incoming_qty
      from document o
      join document_line ol on ol.document_id = o.id
      left join (
        select dl.source_line_id, sum(dl.base_qty) as received_qty
          from document_line dl join document dd on dd.id = dl.document_id
         where dd.doc_type = 'GOODS_RECEIPT' and dd.status = 'POSTED'
         group by dl.source_line_id
      ) r on r.source_line_id = ol.id
     where o.company_id = ${companyId} and o.doc_type = 'PURCHASE_ORDER' and o.status = 'POSTED'
     group by ol.item_id
    having sum(ol.base_qty - coalesce(r.received_qty, 0)) > 0`;
}

export async function getBrands(companyId: string) {
  return sql`
    select id, code, name, name_my, is_active
      from brand
     where company_id = ${companyId}
     order by name`;
}

export async function getLocations(companyId: string) {
  return sql`
    select l.id, l.code, l.name, l.name_my, l.parent_id, l.is_stock_location, l.is_active,
           p.name as parent_name
      from location l
      left join location p on p.id = l.parent_id
     where l.company_id = ${companyId}
     order by l.code`;
}

// -------------------------------------------------------- three statements --

/**
 * Revenue less COGS less expense, for a date range. `amount` is always
 * shown natural-positive per account — revenue's credit balance and an
 * expense's debit balance both read as a plain positive number, and the
 * three section totals combine with plain subtraction.
 */
export async function getIncomeStatement(companyId: string, from: string, to: string) {
  return sql`
    select a.id, a.code, a.name, a.account_type,
           case when fn_is_debit_normal(a.account_type)
                then sum(jl.base_amount) else -sum(jl.base_amount) end as amount
      from journal_line jl
      join journal_entry je on je.id = jl.journal_entry_id
      join account a on a.id = jl.account_id
     where jl.company_id = ${companyId}
       and a.account_type in ('REVENUE', 'COGS', 'EXPENSE')
       and je.entry_date between ${from}::date and ${to}::date
     group by a.id, a.code, a.name, a.account_type
    having sum(jl.base_amount) <> 0
     order by a.account_type, a.code`;
}

/**
 * Asset/liability/equity balances as of a date, cumulative from inception —
 * a balance sheet is a snapshot, not a period. Revenue/COGS/expense accounts
 * are never closed to equity here, so their cumulative net (through asOf)
 * is folded in as a "Retained earnings" line — without it Assets would not
 * equal Liabilities + Equity.
 */
export async function getBalanceSheet(companyId: string, asOf: string) {
  const [rows, netIncomeRows] = await Promise.all([
    sql`
      select a.id, a.code, a.name, a.account_type,
             case when fn_is_debit_normal(a.account_type)
                  then sum(jl.base_amount) else -sum(jl.base_amount) end as amount
        from journal_line jl
        join journal_entry je on je.id = jl.journal_entry_id
        join account a on a.id = jl.account_id
       where jl.company_id = ${companyId}
         and a.account_type in ('ASSET', 'LIABILITY', 'EQUITY')
         and je.entry_date <= ${asOf}::date
       group by a.id, a.code, a.name, a.account_type
      having sum(jl.base_amount) <> 0
       order by a.account_type, a.code`,
    sql`
      select coalesce(-sum(jl.base_amount), 0) as net_income
        from journal_line jl
        join journal_entry je on je.id = jl.journal_entry_id
        join account a on a.id = jl.account_id
       where jl.company_id = ${companyId}
         and a.account_type in ('REVENUE', 'COGS', 'EXPENSE')
         and je.entry_date <= ${asOf}::date`,
  ]);

  return { rows, netIncome: Number(netIncomeRows[0]?.net_income ?? 0) };
}

/**
 * Direct-method cash flow: every cash/bank-touching journal line, attributed
 * to a category by the OTHER side of its entry rather than the cash side
 * itself — decomposing per contra line handles multi-line vouchers
 * correctly, and excluding cash-to-cash contra lines drops internal
 * transfers, which are not a real inflow or outflow.
 */
export async function getCashFlowStatement(companyId: string, from: string, to: string) {
  const [rows, beginning, ending] = await Promise.all([
    sql`
      select
        case
          when je.source_type in ('CUSTOMER_RECEIPT', 'SALES_INVOICE') then 'Received from customers'
          when je.source_type = 'SUPPLIER_PAYMENT' then 'Paid to suppliers'
          when a2.account_type = 'REVENUE' then 'Received from customers'
          when a2.account_type = 'COGS' then 'Paid to suppliers'
          when a2.account_type = 'EXPENSE' then 'Operating expenses paid'
          when a2.account_type = 'EQUITY' then 'Owner contributions / drawings'
          when a2.account_type = 'LIABILITY' then 'Loans and other liabilities'
          when a2.account_type = 'ASSET' then 'Purchase / sale of fixed assets'
          else 'Other'
        end as category,
        case
          when je.source_type in ('CUSTOMER_RECEIPT', 'SALES_INVOICE', 'SUPPLIER_PAYMENT')
            or a2.account_type in ('REVENUE', 'COGS', 'EXPENSE') then 'operating'
          when a2.account_type = 'ASSET' then 'investing'
          when a2.account_type in ('EQUITY', 'LIABILITY') then 'financing'
          else 'operating'
        end as section,
        -sum(jl2.base_amount) as amount
        from journal_line jl_cash
        join journal_entry je on je.id = jl_cash.journal_entry_id
        join account a_cash on a_cash.id = jl_cash.account_id
        join journal_line jl2 on jl2.journal_entry_id = je.id and jl2.id <> jl_cash.id
        join account a2 on a2.id = jl2.account_id
       where jl_cash.company_id = ${companyId}
         and (a_cash.is_cash_account or a_cash.is_bank_account)
         and not (a2.is_cash_account or a2.is_bank_account)
         and je.entry_date between ${from}::date and ${to}::date
       group by category, section
       order by section, category`,
    sql`
      select coalesce(sum(jl.base_amount), 0) as balance
        from journal_line jl
        join journal_entry je on je.id = jl.journal_entry_id
        join account a on a.id = jl.account_id
       where jl.company_id = ${companyId}
         and (a.is_cash_account or a.is_bank_account)
         and je.entry_date < ${from}::date`,
    sql`
      select coalesce(sum(jl.base_amount), 0) as balance
        from journal_line jl
        join journal_entry je on je.id = jl.journal_entry_id
        join account a on a.id = jl.account_id
       where jl.company_id = ${companyId}
         and (a.is_cash_account or a.is_bank_account)
         and je.entry_date <= ${to}::date`,
  ]);

  return {
    rows,
    beginningCash: Number(beginning[0]?.balance ?? 0),
    endingCash: Number(ending[0]?.balance ?? 0),
  };
}

export async function getSalesmen(companyId: string) {
  return sql`
    select s.id, s.code, s.name, s.name_my, s.phone, s.location_id,
           s.commission_pct, s.is_active,
           l.name as location_name
      from salesman s
      left join location l on l.id = s.location_id
     where s.company_id = ${companyId}
     order by s.code`;
}

/**
 * A trial balance lists each account's closing balance on the side it
 * naturally falls, and the two columns must agree — that agreement is the
 * whole point of the report.
 *
 * Balances are stored signed (positive debit), so a liability comes back
 * negative. Presenting that raw would show Accounts Payable as -450,000
 * rather than a 450,000 credit. The split below puts each balance in the
 * right column, and an account carrying an abnormal balance — an overdrawn
 * bank, say — correctly lands on the other side rather than being hidden.
 */
export async function getTrialBalance(companyId: string) {
  return sql`
    select a.code, a.name, a.account_type,
           sum(tb.debit)   as debit_movement,
           sum(tb.credit)  as credit_movement,
           sum(tb.balance) as signed_balance,
           case when sum(tb.balance) > 0 then  sum(tb.balance) else 0 end as closing_debit,
           case when sum(tb.balance) < 0 then -sum(tb.balance) else 0 end as closing_credit,
           fn_is_debit_normal(a.account_type) as debit_normal
      from v_trial_balance tb
      join account a on a.id = tb.account_id
     where tb.company_id = ${companyId}
     group by a.code, a.name, a.account_type
    having sum(tb.balance) <> 0
     order by a.code`;
}
