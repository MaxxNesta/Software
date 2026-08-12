import { money, qty } from "@/lib/db";
import { getCompany, getItems } from "@/lib/queries";

export default async function Items() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const items = await getItems(company.id);
  const totalValue = items.reduce((s: number, i: any) => s + Number(i.value_on_hand), 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Items &amp; stock</h1>
        <span className="page-sub">
          Quantities are derived by summing the stock ledger — there is no stored
          on-hand column that could drift.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Items</h2>
            <span className="page-sub">{items.length} items</span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Group</th><th>Unit</th>
                  <th className="r">On hand</th><th className="r">Sale price</th><th className="r">Stock value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.id}>
                    <td className="code">{i.code}</td>
                    <td className="wrap">
                      {i.name}
                      {i.name_my && <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{i.name_my}</div>}
                    </td>
                    <td>{i.group_name}</td>
                    <td className="code">{i.uom_code}</td>
                    <td className="r">{qty(i.qty_on_hand)}</td>
                    <td className="r">{i.sale_price ? money(i.sale_price) : "—"}</td>
                    <td className="r">{money(i.value_on_hand)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={6}>Total stock value</td><td className="r">{money(totalValue)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
