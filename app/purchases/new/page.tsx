import { getFormData, createPurchaseInvoice } from "@/lib/actions";
import { InvoiceForm } from "@/components/invoice-form";

export default async function NewPurchaseInvoice() {
  const { suppliers, items, locations } = await getFormData();
  const today = new Date().toISOString().slice(0, 10);

  if (suppliers.length === 0 || items.length === 0 || locations.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Purchases</span>
          <h1>New purchase invoice</h1>
        </div>
        <div className="alert">
          {suppliers.length === 0 && <div>No suppliers yet — add one first.</div>}
          {items.length === 0 && <div>No items yet — add a category and an item first.</div>}
          {locations.length === 0 && <div>No stock location is set up.</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Purchases</span>
        <h1>New purchase invoice</h1>
        <span className="page-sub">
          Stock arrives at the price paid and the supplier balance opens. The
          moving-average cost of each item is recalculated from this receipt.
        </span>
      </div>

      <InvoiceForm
        kind="purchase"
        action={createPurchaseInvoice}
        partners={suppliers as never}
        items={items as never}
        locations={locations as never}
        today={today}
      />
    </>
  );
}
