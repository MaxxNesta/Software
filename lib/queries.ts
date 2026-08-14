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

  const [grir] = await sql`
    select coalesce(sum(balance), 0) as total, count(*)::int as n
      from v_grir_balance where company_id = ${companyId}`;

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

  return { stock, ar, ap, grir, cash, overdue };
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

export async function getOpenItems(companyId: string, docType: string) {
  return sql`
    select document_id, doc_no, partner_name, posting_date, due_date,
           gross_total, allocated, outstanding, aging_bucket, days_overdue
      from v_open_item
     where company_id = ${companyId} and doc_type = ${docType}
     order by due_date nulls last`;
}

export async function getDocuments(companyId: string, docType?: string) {
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
     order by d.posting_date desc, d.doc_no desc`;
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
    select bp.id, bp.code, bp.name, bp.name_my, bp.is_customer, bp.is_supplier,
           bp.township, bp.payment_terms_days,
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
    select i.id, i.code, i.name, i.name_my, i.item_group_id, i.brand_id, i.is_stocked,
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
