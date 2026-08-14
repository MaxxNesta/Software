import Link from "next/link";
import { money, qty } from "@/lib/db";
import { getCompany, getItems, getReservedQty, getIncomingQty } from "@/lib/queries";

type Row = {
  id: string; code: string; name: string; name_my: string | null;
  item_group_id: string; group_name: string; parent_group_name: string | null;
  uom_code: string; qty_on_hand: string; value_on_hand: string; is_stocked: boolean;
};

export default async function Stock() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const [items, reserved, incoming] = await Promise.all([
    getItems(company.id) as unknown as Promise<Row[]>,
    getReservedQty(company.id) as unknown as Promise<Array<{ item_id: string; reserved_qty: string }>>,
    getIncomingQty(company.id) as unknown as Promise<Array<{ item_id: string; incoming_qty: string }>>,
  ]);

  const reservedOf = (id: string) => Number(reserved.find((r) => r.item_id === id)?.reserved_qty ?? 0);
  const incomingOf = (id: string) => Number(incoming.find((r) => r.item_id === id)?.incoming_qty ?? 0);

  const stocked = items.filter((i) => i.is_stocked);
  const totalValue = stocked.reduce((s, i) => s + Number(i.value_on_hand), 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Stock</h1>
        <span className="page-sub">
          On hand is summed live from the stock ledger — nothing here is a
          stored column that could drift. Reserved and Incoming come from
          open orders and unfulfilled deliveries; Available and Projected are
          both derived, never stored.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Stock position</h2>
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
                    <th className="r">On hand</th>
                    <th className="r">Reserved</th>
                    <th className="r">Available</th>
                    <th className="r">Incoming</th>
                    <th className="r">Projected</th>
                    <th className="r">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stocked.map((i) => {
                    const onHand = Number(i.qty_on_hand);
                    const res = reservedOf(i.id);
                    const inc = incomingOf(i.id);
                    const available = onHand - res;
                    const projected = available + inc;
                    return (
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
                        <td className="r">{qty(String(onHand))}</td>
                        <td className="r" style={{ color: res > 0 ? "var(--warn)" : undefined }}>
                          {res > 0 ? qty(String(res)) : "—"}
                        </td>
                        <td className="r" style={{ fontWeight: 600 }}>
                          {qty(String(available))}
                        </td>
                        <td className="r" style={{ color: inc > 0 ? "var(--ok)" : undefined }}>
                          {inc > 0 ? qty(String(inc)) : "—"}
                        </td>
                        <td className="r">{qty(String(projected))}</td>
                        <td className="r">{money(i.value_on_hand)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={9}>Total stock value</td>
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
