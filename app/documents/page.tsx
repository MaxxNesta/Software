import Link from "next/link";
import { money, shortDate } from "@/lib/db";
import { getCompany, getDocuments } from "@/lib/queries";

const TYPES = [
  ["", "All"],
  ["PURCHASE_ORDER", "Purchase orders"],
  ["GOODS_RECEIPT", "Goods receipts"],
  ["PURCHASE_INVOICE", "Purchase invoices"],
  ["PURCHASE_RETURN", "Purchase returns"],
  ["SUPPLIER_PAYMENT", "Supplier payments"],
  ["SALES_ORDER", "Sales orders"],
  ["DELIVERY", "Deliveries"],
  ["SALES_INVOICE", "Sales invoices"],
  ["SALES_RETURN", "Sales returns"],
  ["CUSTOMER_RECEIPT", "Customer receipts"],
  ["STOCK_ADJUSTMENT", "Stock adjustments"],
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const docs = await getDocuments(company.id, type || undefined);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Transactions</span>
        <h1>Documents</h1>
        <span className="page-sub">
          Every document links back to what it came from and forward to what it produced.
        </span>
      </div>

      <div className="flow">
        {TYPES.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/documents?type=${value}` : "/documents"}
            className={`flow-node ${(type ?? "") === value ? "here" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>{TYPES.find(([v]) => v === (type ?? ""))?.[1] ?? "All"}</h2>
            <span className="page-sub">{docs.length} document{docs.length === 1 ? "" : "s"}</span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th><th>Type</th><th>Partner</th><th>Date</th><th>Due</th>
                  <th>From</th><th>Posting</th><th className="r">Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d: any) => (
                  <tr key={d.id} className="link">
                    <td className="code">
                      <Link href={`/documents/${d.id}`} style={{ color: "var(--dr)" }}>{d.doc_no ?? "draft"}</Link>
                    </td>
                    <td className="m">{d.doc_type.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="wrap">{d.partner_name ?? "—"}</td>
                    <td className="code">{shortDate(d.posting_date)}</td>
                    <td className="code">{d.due_date ? shortDate(d.due_date) : "—"}</td>
                    <td className="code">{d.source_doc_no ?? "—"}</td>
                    <td className="code">{d.entry_no ?? "—"}</td>
                    <td className="r">{money(d.gross_total)}</td>
                    <td><span className={`pill ${d.status.toLowerCase()}`}>{d.status}</span></td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={9} className="empty">No documents</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
