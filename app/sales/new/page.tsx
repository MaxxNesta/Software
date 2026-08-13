import { getFormData, createSalesInvoice } from "@/lib/actions";
import { InvoiceForm } from "@/components/invoice-form";

export default async function NewSalesInvoice() {
  const { customers, items, locations } = await getFormData();
  const today = new Date().toISOString().slice(0, 10);

  if (customers.length === 0 || items.length === 0 || locations.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Sales</span>
          <h1>New sales invoice</h1>
        </div>
        <div className="alert">
          {customers.length === 0 && <div>No customers yet — add one first.</div>}
          {items.length === 0 && <div>No items yet — add a category and an item first.</div>}
          {locations.length === 0 && <div>No stock location is set up.</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Sales</span>
        <h1>New sales invoice</h1>
        <span className="page-sub">
          Stock leaves at its moving-average cost, revenue is recognised, and the
          customer&rsquo;s balance opens against this invoice.
        </span>
      </div>

      <InvoiceForm
        kind="sales"
        action={createSalesInvoice}
        partners={customers as never}
        items={items as never}
        locations={locations as never}
        today={today}
      />
    </>
  );
}
