import Link from "next/link";
import { money, qty } from "@/lib/db";
import { getCompany, getItems, getReservedQty, getIncomingQty } from "@/lib/queries";
import { DataTable, type DataRow } from "@/components/data-table";

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

  const stocked = items.filter((i) => i.is_stocked).map((i) => {
    const onHand = Number(i.qty_on_hand);
    const reservedQty = reservedOf(i.id);
    const incomingQty = incomingOf(i.id);
    const available = onHand - reservedQty;
    const projected = available + incomingQty;
    return { ...i, onHand, reservedQty, incomingQty, available, projected };
  });
  const totalValue = stocked.reduce((s, i) => s + Number(i.value_on_hand), 0);

  const rows: DataRow[] = stocked.map((i) => ({
    key: i.id,
    searchText: [i.code, i.name, i.name_my, i.group_name, i.parent_group_name].filter(Boolean).join(" "),
    sort: {
      code: i.code,
      name: i.name,
      group_name: i.parent_group_name ? `${i.parent_group_name} / ${i.group_name}` : i.group_name,
      uom_code: i.uom_code,
      onHand: i.onHand,
      reservedQty: i.reservedQty,
      available: i.available,
      incomingQty: i.incomingQty,
      projected: i.projected,
      value_on_hand: Number(i.value_on_hand),
    },
    node: (
      <tr>
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
        <td className="r">{qty(String(i.onHand))}</td>
        <td className="r" style={{ color: i.reservedQty > 0 ? "var(--warn)" : undefined }}>
          {i.reservedQty > 0 ? qty(String(i.reservedQty)) : "—"}
        </td>
        <td className="r" style={{ fontWeight: 600 }}>
          {qty(String(i.available))}
        </td>
        <td className="r" style={{ color: i.incomingQty > 0 ? "var(--ok)" : undefined }}>
          {i.incomingQty > 0 ? qty(String(i.incomingQty)) : "—"}
        </td>
        <td className="r">{qty(String(i.projected))}</td>
        <td className="r">{money(i.value_on_hand)}</td>
      </tr>
    ),
  }));

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
            <DataTable
              rows={rows}
              emptyLabel="No stocked items"
              searchPlaceholder="Search stock…"
              defaultSort={{ key: "code", dir: "asc" }}
              columns={[
                { key: "code", label: "Code", sortable: true },
                { key: "name", label: "Name", sortable: true },
                { key: "group_name", label: "Category", sortable: true },
                { key: "uom_code", label: "Unit", sortable: true },
                { key: "onHand", label: "On hand", sortable: true, align: "r" },
                { key: "reservedQty", label: "Reserved", sortable: true, align: "r" },
                { key: "available", label: "Available", sortable: true, align: "r" },
                { key: "incomingQty", label: "Incoming", sortable: true, align: "r" },
                { key: "projected", label: "Projected", sortable: true, align: "r" },
                { key: "value_on_hand", label: "Value", sortable: true, align: "r" },
              ]}
              footer={
                <tr>
                  <td colSpan={9}>Total stock value</td>
                  <td className="r">{money(totalValue)}</td>
                </tr>
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
