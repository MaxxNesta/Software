import Link from "next/link";
import { money, shortDate } from "@/lib/db";
import { getCompany, getDocuments } from "@/lib/queries";
import { DataTable } from "@/components/data-table";

const toTime = (v: unknown) => (v ? new Date(v as string).getTime() : 0);

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
          <DataTable
            rows={docs as any[]}
            rowKey={(d) => d.id}
            emptyLabel="No documents"
            searchPlaceholder="Search documents…"
            defaultSort={{ key: "posting_date", dir: "desc" }}
            columns={[
              { key: "doc_no", label: "Document", sortable: true },
              { key: "doc_type", label: "Type", sortable: true },
              { key: "partner_name", label: "Partner", sortable: true },
              { key: "posting_date", label: "Date", sortable: true },
              { key: "due_date", label: "Due", sortable: true },
              { key: "source_doc_no", label: "From" },
              { key: "entry_no", label: "Posting" },
              { key: "gross_total", label: "Amount", sortable: true, align: "r" },
              { key: "status", label: "Status", sortable: true },
            ]}
            getSearchText={(d) =>
              [d.doc_no, d.doc_type, d.partner_name, d.source_doc_no, d.entry_no, d.status]
                .filter(Boolean).join(" ")
            }
            getSortValue={(d, key) => {
              switch (key) {
                case "posting_date": return toTime(d.posting_date);
                case "due_date": return toTime(d.due_date);
                case "gross_total": return Number(d.gross_total);
                default: return (d as any)[key] ?? "";
              }
            }}
            renderRow={(d: any) => (
              <tr className="link">
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
            )}
          />
        </div>
      </section>
    </>
  );
}
