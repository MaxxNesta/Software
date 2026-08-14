import Link from "next/link";
import { money, qty } from "@/lib/db";
import { getCompany, getItems } from "@/lib/queries";

type Row = {
  id: string; code: string; name: string; name_my: string | null;
  item_group_id: string; group_name: string; parent_group_name: string | null;
  uom_code: string; qty_on_hand: string; value_on_hand: string; is_stocked: boolean;
};

export default async function Stock() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const items = (await getItems(company.id)) as unknown as Row[];
  const stocked = items.filter((i) => i.is_stocked);
  const totalValue = stocked.reduce((s, i) => s + Number(i.value_on_hand), 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Stock</h1>
        <span className="page-sub">
          On-hand quantity and value, summed live from the stock ledger &mdash;
          there is no stored on-hand column that could drift.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>On hand</h2>
            <span className="page-sub">{stocked.length} stocked items</span>
          </div>

          {stocked.length === 0 ? (
            <div className="empty">
              No stocked items yet.{" "}
              <Link href="/items" style={{ color: "var(--dr)" }}>Add an item</Link>
            </div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Category</th><th>Unit</th>
                    <th className="r">On hand</th><th className="r">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stocked.map((i) => (
                    <tr key={i.id}>
                      <td className="code">
                        <Link href={`/items/categories/${i.item_group_id}`} style={{ color: "var(--dr)" }}>
                          {i.code}
                        </Link>
                      </td>
                      <td className="wrap">
                        {i.name}
                        {i.name_my && (
                          <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{i.name_my}</div>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>
                        {i.parent_group_name ? `${i.parent_group_name} / ${i.group_name}` : i.group_name}
                      </td>
                      <td className="code">{i.uom_code}</td>
                      <td className="r">{qty(i.qty_on_hand)}</td>
                      <td className="r">{money(i.value_on_hand)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Total stock value</td>
                    <td className="r">{money(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
