import Link from "next/link";
import { money, shortDate } from "@/lib/db";
import { getCompany, getDocuments } from "@/lib/queries";
import { DataTable, type DataRow } from "@/components/data-table";

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
  ["STOCK_TRANSFER", "Stock transfers"],
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; open?: string }>;
}) {
  const { type, open } = await searchParams;
  const openOnly = open === "grir";
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const docs = (await getDocuments(company.id, type || undefined, openOnly)) as any[];

  const rows: DataRow[] = docs.map((d) => ({
    key: d.id,
    searchText: [d.doc_no, d.doc_type, d.partner_name, d.source_doc_no].filter(Boolean).join(" "),
    sort: {
      doc_no: d.doc_no ?? "",
      doc_type: d.doc_type,
      partner_name: d.partner_name ?? "",
      posting_date: toTime(d.posting_date),
      due_date: toTime(d.due_date),
      gross_total: Number(d.gross_total),
    },
    node: (
      <tr className="link">
        <td className="code">
          <Link href={`/documents/${d.id}`} style={{ color: "var(--dr)" }}>{d.doc_no ?? "draft"}</Link>
        </td>
        <td className="m">{d.doc_type.replace(/_/g, " ").toLowerCase()}</td>
        <td className="wrap">{d.partner_name ?? "—"}</td>
        <td className="code">{shortDate(d.posting_date)}</td>
        <td className="code">{d.due_date ? shortDate(d.due_date) : "—"}</td>
        <td className="code">{d.source_doc_no ?? "—"}</td>
        <td className="r">{money(d.gross_total)}</td>
      </tr>
    ),
  }));

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
            <h2>
              {openOnly ? "Awaiting a matching document — " : ""}
              {TYPES.find(([v]) => v === (type ?? ""))?.[1] ?? "All"}
            </h2>
            <span className="actions">
              <span className="page-sub">{docs.length} document{docs.length === 1 ? "" : "s"}</span>
              {openOnly && (
                <Link href={`/documents?type=${type}`} className="m" style={{ color: "var(--dr)" }}>
                  Show all &rarr;
                </Link>
              )}
            </span>
          </div>
          <DataTable
            rows={rows}
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
              { key: "gross_total", label: "Amount", sortable: true, align: "r" },
            ]}
          />
        </div>
      </section>
    </>
  );
}
