import { getFormData, createSalesInvoice } from "@/lib/actions";
import { SalesVoucher } from "@/components/sales-voucher";

export default async function NewSalesInvoice() {
  const d = await getFormData();
  const today = new Date().toISOString().slice(0, 10);

  if (d.customers.length === 0 || d.items.length === 0 || d.locations.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Sales</span>
          <h1>Sales voucher</h1>
        </div>
        <div className="alert">
          {d.customers.length === 0 && <div>No customers yet — add one first.</div>}
          {d.items.length === 0 && <div>No items yet — add a category and an item first.</div>}
          {d.locations.length === 0 && <div>No stock location is set up.</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Sales</span>
        <h1>Sales voucher</h1>
        <span className="page-sub">
          Stock leaves at its moving-average cost, revenue is recognised, and the
          balance opens against this invoice.
        </span>
      </div>

      <SalesVoucher
        action={createSalesInvoice}
        customers={d.customers as never}
        items={d.items as never}
        locations={d.locations as never}
        salesmen={d.salesmen as never}
        cashAccounts={d.cashAccounts as never}
        promotions={d.promotions as never}
        openInvoices={d.openInvoices as never}
        nextInvoiceNo={d.nextInvoiceNo}
        today={today}
      />
    </>
  );
}
