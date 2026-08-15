import { getFormData, createPurchaseInvoice } from "@/lib/actions";
import { allCategories } from "@/lib/tree";
import { sql } from "@/lib/db";
import { InvoiceForm } from "@/components/invoice-form";

export default async function NewPurchaseInvoice() {
  const { suppliers, items, locations, uoms, cashAccounts } = await getFormData();
  const [co] = await sql`select id from company order by created_at limit 1`;
  const categories = await allCategories(co.id);
  const today = new Date().toISOString().slice(0, 10);

  // Items are deliberately not required: a product can be created from the
  // voucher itself. A category is, since nothing unclassified may enter stock.
  if (suppliers.length === 0 || categories.length === 0 || locations.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Purchases</span>
          <h1>New purchase invoice</h1>
        </div>
        <div className="alert">
          {suppliers.length === 0 && <div>No suppliers yet — add one first.</div>}
          {categories.length === 0 && (
            <div>
              No categories yet — add one first, so new items have somewhere to file.
            </div>
          )}
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
        categories={categories}
        uoms={uoms as never}
        today={today}
        cashAccounts={cashAccounts as never}
      />
    </>
  );
}
