import Link from "next/link";
import { money, shortDate } from "@/lib/db";
import { getCompany, getOpenItems } from "@/lib/queries";

export default async function Receivables() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const items = await getOpenItems(company.id, "SALES_INVOICE");
  const total = items.reduce((s: number, i: any) => s + Number(i.outstanding), 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Transactions</span>
        <h1>Receivables</h1>
        <span className="page-sub">
          Open items, not a running balance — each amount stays attached to the invoice
          it came from, which is what makes the aging trustworthy.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Open invoices</h2>
            <span className="page-sub">{items.length} outstanding</span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th><th>Customer</th><th>Posted</th><th>Due</th>
                  <th className="r">Invoiced</th><th className="r">Paid</th>
                  <th className="r">Outstanding</th><th>Age</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.document_id} className="link">
                    <td className="code">
                      <Link href={`/documents/${i.document_id}`} style={{ color: "var(--dr)" }}>{i.doc_no}</Link>
                    </td>
                    <td className="wrap">{i.partner_name}</td>
                    <td className="code">{shortDate(i.posting_date)}</td>
                    <td className="code">{i.due_date ? shortDate(i.due_date) : "—"}</td>
                    <td className="r">{money(i.gross_total)}</td>
                    <td className="r">{money(i.allocated)}</td>
                    <td className="r">{money(i.outstanding)}</td>
                    <td>
                      <span className={`pill ${i.aging_bucket === "CURRENT" ? "ok" : "overdue"}`}>
                        {i.aging_bucket === "CURRENT" ? "Current" : `${i.days_overdue}d`}
                      </span>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="empty">Nothing outstanding</td></tr>}
              </tbody>
              <tfoot>
                <tr><td colSpan={6}>Total outstanding</td><td className="r">{money(total)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
