import Link from "next/link";
import { money } from "@/lib/db";
import { getCompany, getPartners } from "@/lib/queries";

export default async function Partners() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const partners = await getPartners(company.id);

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
              <Link href="/partners/new"><button type="button">New partner</button></Link>
            </span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Role</th><th>Township</th>
                  <th className="r">Terms</th><th className="r">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p: any) => (
                  <tr key={p.id}>
                    <td className="code">{p.code}</td>
                    <td className="wrap">
                      {p.name}
                      {p.name_my && <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{p.name_my}</div>}
                    </td>
                    <td>
                      {p.is_customer && <span className="pill ok">Customer</span>}
                      {p.is_customer && p.is_supplier && " "}
                      {p.is_supplier && <span className="pill warn">Supplier</span>}
                    </td>
                    <td>{p.township ?? "—"}</td>
                    <td className="r">{p.payment_terms_days}d</td>
                    <td className="r">{Number(p.outstanding) ? money(p.outstanding) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
