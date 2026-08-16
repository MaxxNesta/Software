import Link from "next/link";
import { getCompany, getPartners } from "@/lib/queries";
import { updatePartner, deactivatePartner, deletePartner } from "@/lib/actions";
import { PartnerRow } from "@/components/partner-row";
import { DataTable, type DataRow } from "@/components/data-table";

export default async function Partners() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const partners = (await getPartners(company.id)) as any[];

  const rows: DataRow[] = partners.map((p) => ({
    key: p.id,
    searchText: [p.code, p.name, p.name_my, p.township].filter(Boolean).join(" "),
    sort: {
      code: p.code,
      name: p.name,
      role: `${p.is_customer ? "Customer" : ""} ${p.is_supplier ? "Supplier" : ""}`.trim(),
      township: p.township ?? "",
      payment_terms_days: Number(p.payment_terms_days),
      outstanding: Number(p.outstanding),
      is_active: p.is_active ? 1 : 0,
    },
    node: (
      <PartnerRow
        partner={p}
        updateAction={updatePartner}
        deactivateAction={deactivatePartner}
        deleteAction={deletePartner}
      />
    ),
  }));

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Business partners</h1>
        <span className="page-sub">
          One table with roles rather than separate customer and supplier lists —
          here the same company is routinely both.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Partners</h2>
            <span className="actions">
              <span className="page-sub">{partners.length} records</span>
              <Link href="/partners/new" className="btn">New partner</Link>
            </span>
          </div>
          <DataTable
            rows={rows}
            emptyLabel="No partners yet"
            searchPlaceholder="Search partners…"
            defaultSort={{ key: "code", dir: "asc" }}
            columns={[
              { key: "code", label: "Code", sortable: true },
              { key: "name", label: "Name", sortable: true },
              { key: "role", label: "Role", sortable: true },
              { key: "township", label: "Township", sortable: true },
              { key: "payment_terms_days", label: "Terms", sortable: true, align: "r" },
              { key: "outstanding", label: "Outstanding", sortable: true, align: "r" },
              { key: "is_active", label: "Status", sortable: true },
              { key: "actions", label: "" },
            ]}
          />
        </div>
      </section>
    </>
  );
}
