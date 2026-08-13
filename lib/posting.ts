import type { TransactionSql } from "postgres";
import { sql } from "./db";

// The posting engine.
//
// A document describes what happened. This turns that into journal entries
// and stock movements, resolving every GL account from the item group, the
// partner, and the posting rules — never from anything the caller passed in.
//
// Everything for one document happens in a single transaction. If the ledger
// would not balance, or stock would go negative, or the period is closed, the
// whole thing rolls back and no document exists.

export type InvoiceLine = {
  itemId: string;
  qty: number;
  unitPrice: number;
  focReasonId?: string | null;
};

export type InvoiceInput = {
  companyId: string;
  partnerId: string;
  locationId: string;
  docDate: string;
  dueDate: string | null;
  memo?: string | null;
  reference?: string | null;
  lines: InvoiceLine[];
};

export type SalesInvoiceInput = InvoiceInput & {
  salesmanId?: string | null;
  paymentType?: "CASH" | "CREDIT";

  /** Goods leave later. A warehouse flag — the posting is identical either way. */
  toDeliver?: boolean;

  /** Taken at the counter. Creates a receipt document allocated to this invoice. */
  cashIn?: number;
  cashAccountId?: string | null;
};

type JournalLine = {
  accountId: string;
  amount: number; // positive debit, negative credit
  partnerId?: string | null;
  locationId?: string | null;
};

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** Collapses journal lines that hit the same account, dropping any that net to zero. */
function consolidate(lines: JournalLine[]): JournalLine[] {
  const byKey = new Map<string, JournalLine>();

  for (const l of lines) {
    const key = `${l.accountId}|${l.partnerId ?? ""}|${l.locationId ?? ""}`;
    const existing = byKey.get(key);
    if (existing) existing.amount = round4(existing.amount + l.amount);
    else byKey.set(key, { ...l, amount: round4(l.amount) });
  }

  return [...byKey.values()].filter((l) => l.amount !== 0);
}

async function writeJournal(
  tx: TransactionSql,
  companyId: string,
  entryDate: string,
  sourceType: string,
  sourceId: string,
  memo: string,
  lines: JournalLine[]
): Promise<string> {
  const consolidated = consolidate(lines);

  const total = round4(consolidated.reduce((s, l) => s + l.amount, 0));
  if (total !== 0) {
    // The database would reject this anyway; failing here gives a better message.
    throw new Error(`Posting does not balance — debits and credits differ by ${total}`);
  }

  const fyRows = await tx`select fn_fiscal_year_for(${companyId}, ${entryDate}::date) as fy`;
  const fiscalYear = fyRows[0]?.fy ?? null;
  if (!fiscalYear) {
    throw new Error(`No fiscal year covers ${entryDate}. Set one up before posting.`);
  }

  const noRows = await tx`
    select fn_next_document_no(${companyId}, 'JOURNAL', ${fiscalYear}::uuid) as no`;

  const [entry] = await tx`
    insert into journal_entry
      (company_id, entry_no, entry_date, fiscal_period_id, source_type, source_id, memo)
    values
      (${companyId}, ${noRows[0].no}, ${entryDate}::date, null,
       ${sourceType}, ${sourceId}, ${memo})
    returning id`;

  let lineNo = 0;
  for (const l of consolidated) {
    lineNo++;
    await tx`
      insert into journal_line
        (company_id, journal_entry_id, line_no, account_id, currency,
         amount, exchange_rate, base_amount, partner_id, location_id)
      values
        (${companyId}, ${entry.id}, ${lineNo}, ${l.accountId}, 'MMK',
         ${l.amount}, 1, ${l.amount}, ${l.partnerId ?? null}, ${l.locationId ?? null})`;
  }

  return entry.id;
}

/**
 * Sales invoice: revenue is recognised, the customer owes money, stock leaves
 * at its moving-average cost, and that cost becomes COGS.
 *
 *   Dr Accounts Receivable / Cr Sales Revenue
 *   Dr Cost of Goods Sold  / Cr Inventory
 *
 * Free-of-charge lines move stock but post the cost to an expense account
 * instead of COGS, and raise no revenue and no receivable.
 */
export async function postSalesInvoice(input: SalesInvoiceInput) {
  if (input.lines.length === 0) throw new Error("An invoice needs at least one line");

  const cashIn = round4(input.cashIn ?? 0);
  if (cashIn > 0 && !input.cashAccountId) {
    throw new Error("Choose which cash or bank account the money went into");
  }

  return sql.begin(async (tx) => {
    const { companyId, partnerId, locationId, docDate, dueDate } = input;

    const fyRows = await tx`select fn_fiscal_year_for(${companyId}, ${docDate}::date) as fy`;
    const fiscalYear = fyRows[0]?.fy ?? null;
    if (!fiscalYear) throw new Error(`No fiscal year covers ${docDate}`);

    const noRows = await tx`
      select fn_next_document_no(${companyId}, 'SALES_INVOICE', ${fiscalYear}::uuid) as no`;
    const docNo = noRows[0].no;

    const netTotal = round4(
      input.lines.reduce((s, l) => s + (l.focReasonId ? 0 : l.qty * l.unitPrice), 0)
    );

    const [doc] = await tx`
      insert into document
        (company_id, doc_type, doc_no, fiscal_year_id, doc_date, posting_date, due_date,
         partner_id, location_id, currency, exchange_rate, status,
         net_total, tax_total, gross_total, memo, posted_at,
         payment_type, salesman_id, reference, to_deliver)
      values
        (${companyId}, 'SALES_INVOICE', ${docNo}, ${fiscalYear}, ${docDate}::date,
         ${docDate}::date, ${dueDate}, ${partnerId}, ${locationId}, 'MMK', 1, 'POSTED',
         ${netTotal}, 0, ${netTotal}, ${input.memo ?? null}, now(),
         ${input.paymentType ?? "CREDIT"}, ${input.salesmanId ?? null},
         ${input.reference ?? null}, ${input.toDeliver ?? false})
      returning id`;

    const journal: JournalLine[] = [];
    let lineNo = 0;

    for (const line of input.lines) {
      lineNo++;

      const [item] = await tx`
        select id, code, name, is_stocked, base_uom_id from item where id = ${line.itemId}`;
      if (!item) throw new Error("Item not found");

      const net = line.focReasonId ? 0 : round4(line.qty * line.unitPrice);

      await tx`
        insert into document_line
          (company_id, document_id, line_no, item_id, location_id,
           entered_qty, entered_uom_id, base_qty, unit_price,
           net_amount, tax_amount, gross_amount, foc_reason_id)
        values
          (${companyId}, ${doc.id}, ${lineNo}, ${line.itemId}, ${locationId},
           ${line.qty}, ${item.base_uom_id}, ${line.qty},
           ${line.focReasonId ? 0 : line.unitPrice},
           ${net}, 0, ${net}, ${line.focReasonId ?? null})`;

      if (!item.is_stocked) {
        // A service line: revenue only, nothing leaves the warehouse.
        if (net !== 0) {
          const revenue = await tx`
            select fn_resolve_account_for_item(${companyId}, 'REVENUE', ${line.itemId}) as a`;
          journal.push({ accountId: revenue[0].a, amount: -net });
        }
        continue;
      }

      // Cost is the moving average at this moment, frozen onto the movement.
      // Recomputing it later would silently restate closed periods.
      const costRows = await tx`
        select fn_moving_average_cost(${companyId}, ${line.itemId}) as cost,
               fn_qty_on_hand(${companyId}, ${line.itemId}, ${locationId}) as on_hand`;

      const unitCost = Number(costRows[0].cost);
      const onHand = Number(costRows[0].on_hand);

      if (onHand < line.qty) {
        throw new Error(
          `Not enough ${item.code} (${item.name}) at this location — ` +
            `${onHand} on hand, ${line.qty} requested`
        );
      }

      const totalCost = round4(unitCost * line.qty);

      await tx`
        insert into stock_movement
          (company_id, item_id, location_id, movement_date, qty,
           unit_cost, total_cost, document_id)
        values
          (${companyId}, ${line.itemId}, ${locationId}, ${docDate}::date,
           ${-line.qty}, ${unitCost}, ${-totalCost}, ${doc.id})`;

      const inventory = await tx`
        select fn_resolve_account_for_item(${companyId}, 'INVENTORY', ${line.itemId}) as a`;
      journal.push({ accountId: inventory[0].a, amount: -totalCost, locationId });

      if (line.focReasonId) {
        const [foc] = await tx`select account_id from foc_reason where id = ${line.focReasonId}`;
        journal.push({ accountId: foc.account_id, amount: totalCost, locationId });
      } else {
        const cogs = await tx`
          select fn_resolve_account_for_item(${companyId}, 'COGS', ${line.itemId}) as a`;
        journal.push({ accountId: cogs[0].a, amount: totalCost, locationId });

        const revenue = await tx`
          select fn_resolve_account_for_item(${companyId}, 'REVENUE', ${line.itemId}) as a`;
        journal.push({ accountId: revenue[0].a, amount: -net });
      }
    }

    if (netTotal !== 0) {
      const ar = await tx`
        select fn_resolve_control_account(${companyId}, 'AR_CONTROL', ${partnerId}) as a`;
      journal.push({ accountId: ar[0].a, amount: netTotal, partnerId });
    }

    const entryId = await writeJournal(
      tx, companyId, docDate, "SALES_INVOICE", doc.id, `${docNo} sales invoice`, journal
    );

    await tx`update document set journal_entry_id = ${entryId} where id = ${doc.id}`;

    // Money taken at the counter becomes a real receipt document allocated to
    // this invoice, rather than a number on the invoice header. That is what
    // keeps the receivable an open item: a part payment leaves the balance
    // attached to this specific invoice instead of vanishing into a total.
    let receiptNo: string | null = null;

    if (cashIn > 0) {
      if (cashIn > netTotal) {
        throw new Error(
          `Cash in (${cashIn}) is more than the invoice total (${netTotal})`
        );
      }

      const rcNoRows = await tx`
        select fn_next_document_no(${companyId}, 'CUSTOMER_RECEIPT', ${fiscalYear}::uuid) as no`;
      receiptNo = rcNoRows[0].no;

      const [receipt] = await tx`
        insert into document
          (company_id, doc_type, doc_no, fiscal_year_id, doc_date, posting_date,
           partner_id, location_id, currency, exchange_rate, status,
           net_total, tax_total, gross_total, memo, posted_at,
           source_document_id, payment_type, salesman_id)
        values
          (${companyId}, 'CUSTOMER_RECEIPT', ${receiptNo}, ${fiscalYear}, ${docDate}::date,
           ${docDate}::date, ${partnerId}, ${locationId}, 'MMK', 1, 'POSTED',
           ${cashIn}, 0, ${cashIn}, ${`Cash received against ${docNo}`}, now(),
           ${doc.id}, 'CASH', ${input.salesmanId ?? null})
        returning id`;

      await tx`
        insert into payment_allocation
          (company_id, payment_id, invoice_id, amount, base_amount)
        values (${companyId}, ${receipt.id}, ${doc.id}, ${cashIn}, ${cashIn})`;

      const ar = await tx`
        select fn_resolve_control_account(${companyId}, 'AR_CONTROL', ${partnerId}) as a`;

      const receiptEntry = await writeJournal(
        tx, companyId, docDate, "CUSTOMER_RECEIPT", receipt.id,
        `${receiptNo} against ${docNo}`,
        [
          { accountId: input.cashAccountId as string, amount: cashIn },
          { accountId: ar[0].a, amount: -cashIn, partnerId },
        ]
      );

      await tx`update document set journal_entry_id = ${receiptEntry} where id = ${receipt.id}`;
    }

    return { id: doc.id as string, docNo: docNo as string, receiptNo };
  });
}

/**
 * Purchase invoice: stock arrives at the price paid, and the supplier is owed.
 *
 *   Dr Inventory / Cr Accounts Payable
 *
 * The receipt and the bill are one event here, so this posts straight to
 * payables rather than through GR/IR clearing.
 */
export async function postPurchaseInvoice(input: InvoiceInput) {
  if (input.lines.length === 0) throw new Error("An invoice needs at least one line");

  return sql.begin(async (tx) => {
    const { companyId, partnerId, locationId, docDate, dueDate } = input;

    const fyRows = await tx`select fn_fiscal_year_for(${companyId}, ${docDate}::date) as fy`;
    const fiscalYear = fyRows[0]?.fy ?? null;
    if (!fiscalYear) throw new Error(`No fiscal year covers ${docDate}`);

    const noRows = await tx`
      select fn_next_document_no(${companyId}, 'PURCHASE_INVOICE', ${fiscalYear}::uuid) as no`;
    const docNo = noRows[0].no;

    const netTotal = round4(input.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));

    const [doc] = await tx`
      insert into document
        (company_id, doc_type, doc_no, fiscal_year_id, doc_date, posting_date, due_date,
         partner_id, location_id, currency, exchange_rate, status,
         net_total, tax_total, gross_total, memo, posted_at)
      values
        (${companyId}, 'PURCHASE_INVOICE', ${docNo}, ${fiscalYear}, ${docDate}::date,
         ${docDate}::date, ${dueDate}, ${partnerId}, ${locationId}, 'MMK', 1, 'POSTED',
         ${netTotal}, 0, ${netTotal}, ${input.memo ?? null}, now())
      returning id`;

    const journal: JournalLine[] = [];
    let lineNo = 0;

    for (const line of input.lines) {
      lineNo++;

      const [item] = await tx`
        select id, code, is_stocked, base_uom_id from item where id = ${line.itemId}`;
      if (!item) throw new Error("Item not found");

      const net = round4(line.qty * line.unitPrice);

      await tx`
        insert into document_line
          (company_id, document_id, line_no, item_id, location_id,
           entered_qty, entered_uom_id, base_qty, unit_price,
           net_amount, tax_amount, gross_amount)
        values
          (${companyId}, ${doc.id}, ${lineNo}, ${line.itemId}, ${locationId},
           ${line.qty}, ${item.base_uom_id}, ${line.qty}, ${line.unitPrice},
           ${net}, 0, ${net})`;

      if (item.is_stocked) {
        await tx`
          insert into stock_movement
            (company_id, item_id, location_id, movement_date, qty,
             unit_cost, total_cost, document_id)
          values
            (${companyId}, ${line.itemId}, ${locationId}, ${docDate}::date,
             ${line.qty}, ${line.unitPrice}, ${net}, ${doc.id})`;

        const inventory = await tx`
          select fn_resolve_account_for_item(${companyId}, 'INVENTORY', ${line.itemId}) as a`;
        journal.push({ accountId: inventory[0].a, amount: net, locationId });
      } else {
        // A service or charge line goes straight to expense via its item group.
        const cogs = await tx`
          select fn_resolve_account_for_item(${companyId}, 'COGS', ${line.itemId}) as a`;
        journal.push({ accountId: cogs[0].a, amount: net, locationId });
      }
    }

    const ap = await tx`
      select fn_resolve_control_account(${companyId}, 'AP_CONTROL', ${partnerId}) as a`;
    journal.push({ accountId: ap[0].a, amount: -netTotal, partnerId });

    const entryId = await writeJournal(
      tx, companyId, docDate, "PURCHASE_INVOICE", doc.id, `${docNo} purchase invoice`, journal
    );

    await tx`update document set journal_entry_id = ${entryId} where id = ${doc.id}`;

    return { id: doc.id as string, docNo: docNo as string };
  });
}

// =========================================================================
// Settling invoices
// =========================================================================
//
// Paying does not touch the invoice. The invoice is a record of what was
// agreed and never changes; a payment is its own document, allocated against
// the invoices it settles. Outstanding is then derived, which is what makes
// "partially paid" answerable and aging trustworthy.

export type Allocation = { invoiceId: string; amount: number };

export type SettlementInput = {
  companyId: string;
  partnerId: string;
  docDate: string;
  cashAccountId: string;
  allocations: Allocation[];
  memo?: string | null;
  reference?: string | null;
};

async function postSettlement(
  input: SettlementInput,
  kind: "SUPPLIER_PAYMENT" | "CUSTOMER_RECEIPT"
) {
  const lines = input.allocations.filter((a) => a.amount > 0);
  if (lines.length === 0) throw new Error("Enter an amount against at least one invoice");
  if (!input.cashAccountId) throw new Error("Choose which cash or bank account to use");

  const total = round4(lines.reduce((s, a) => s + a.amount, 0));
  const isPayment = kind === "SUPPLIER_PAYMENT";
  const controlRole = isPayment ? "AP_CONTROL" : "AR_CONTROL";

  return sql.begin(async (tx) => {
    const { companyId, partnerId, docDate } = input;

    const fyRows = await tx`select fn_fiscal_year_for(${companyId}, ${docDate}::date) as fy`;
    const fiscalYear = fyRows[0]?.fy ?? null;
    if (!fiscalYear) throw new Error(`No fiscal year covers ${docDate}`);

    // Check each invoice still owes what is being applied. Two people paying
    // the same bill at once would otherwise both succeed.
    for (const a of lines) {
      const [inv] = await tx`
        select d.doc_no, d.partner_id, d.gross_total,
               coalesce((select sum(amount) from payment_allocation
                          where invoice_id = d.id), 0) as allocated
          from document d
         where d.id = ${a.invoiceId} and d.company_id = ${companyId}
         for update of d`;

      if (!inv) throw new Error("That invoice no longer exists");
      if (inv.partner_id !== partnerId) {
        throw new Error(`Invoice ${inv.doc_no} belongs to a different partner`);
      }

      const outstanding = round4(Number(inv.gross_total) - Number(inv.allocated));
      if (a.amount > outstanding) {
        throw new Error(
          `${inv.doc_no} only has ${outstanding} outstanding; ${a.amount} was applied`
        );
      }
    }

    const noRows = await tx`
      select fn_next_document_no(${companyId}, ${kind}, ${fiscalYear}::uuid) as no`;
    const docNo = noRows[0].no;

    const [doc] = await tx`
      insert into document
        (company_id, doc_type, doc_no, fiscal_year_id, doc_date, posting_date,
         partner_id, currency, exchange_rate, status,
         net_total, tax_total, gross_total, memo, reference, payment_type, posted_at)
      values
        (${companyId}, ${kind}, ${docNo}, ${fiscalYear}, ${docDate}::date, ${docDate}::date,
         ${partnerId}, 'MMK', 1, 'POSTED',
         ${total}, 0, ${total}, ${input.memo ?? null}, ${input.reference ?? null},
         'CASH', now())
      returning id`;

    for (const a of lines) {
      await tx`
        insert into payment_allocation
          (company_id, payment_id, invoice_id, amount, base_amount)
        values (${companyId}, ${doc.id}, ${a.invoiceId}, ${a.amount}, ${a.amount})`;
    }

    const control = await tx`
      select fn_resolve_control_account(${companyId}, ${controlRole}, ${partnerId}) as a`;

    const journal: JournalLine[] = isPayment
      ? [
          { accountId: control[0].a, amount: total, partnerId },
          { accountId: input.cashAccountId, amount: -total },
        ]
      : [
          { accountId: input.cashAccountId, amount: total },
          { accountId: control[0].a, amount: -total, partnerId },
        ];

    const entryId = await writeJournal(
      tx, companyId, docDate, kind, doc.id,
      `${docNo} settling ${lines.length} invoice${lines.length === 1 ? "" : "s"}`,
      journal
    );

    await tx`update document set journal_entry_id = ${entryId} where id = ${doc.id}`;

    return { id: doc.id as string, docNo: docNo as string, total };
  });
}

/** Dr Accounts Payable / Cr Bank. */
export async function postSupplierPayment(input: SettlementInput) {
  return postSettlement(input, "SUPPLIER_PAYMENT");
}

/** Dr Bank / Cr Accounts Receivable. */
export async function postCustomerReceipt(input: SettlementInput) {
  return postSettlement(input, "CUSTOMER_RECEIPT");
}
