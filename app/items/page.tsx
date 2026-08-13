import Link from "next/link";
import { sql, money, qty } from "@/lib/db";
import { getCompany, getItems } from "@/lib/queries";
import { allCategories, childrenOf, type Node } from "@/lib/tree";

type Item = {
  id: string; code: string; name: string; name_my: string | null;
  item_group_id: string; is_stocked: boolean; uom_code: string;
  qty_on_hand: string; value_on_hand: string; sale_price: string | null;
};

export default async function Items() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const [items, nodes] = await Promise.all([
    getItems(company.id) as unknown as Promise<Item[]>,
    allCategories(company.id),
  ]);

  const itemsIn = (groupId: string) => items.filter((i) => i.item_group_id === groupId);

  /** Items in this category and everything beneath it. */
  function branchItems(groupId: string): Item[] {
    const kids = childrenOf(nodes, groupId);
    return [...itemsIn(groupId), ...kids.flatMap((k) => branchItems(k.id))];
  }

  const totalValue = items.reduce((s, i) => s + Number(i.value_on_hand), 0);

  /**
   * Categories first, then the items filed directly in them, indenting as it
   * descends — so the page reads the way the catalogue is actually built:
   * parent category, category, then the products.
   */
  function renderLevel(parentId: string | null, depth: number): React.ReactNode[] {
    const rows: React.ReactNode[] = [];

    for (const g of childrenOf(nodes, parentId)) {
      const branch = branchItems(g.id);
      const value = branch.reduce((s, i) => s + Number(i.value_on_hand), 0);

      rows.push(
        <tr key={g.id} style={{ background: depth === 0 ? "var(--line-soft)" : undefined }}>
          <td className="code" style={{ paddingLeft: `${1 + depth * 1.5}rem`, fontWeight: 500 }}>
            {depth > 0 && <span style={{ color: "var(--ghost)" }}>└ </span>}
            <Link href={`/items/categories/${g.id}`} style={{ color: "var(--dr)" }}>{g.code}</Link>
          </td>
          <td className="wrap" style={{ fontWeight: depth === 0 ? 600 : 500 }}>
            {g.name}
            {g.name_my && (
              <div style={{ color: "var(--muted)", fontSize: "0.82rem", fontWeight: 400 }}>
                {g.name_my}
              </div>
            )}
          </td>
          <td className="code" style={{ color: "var(--muted)" }}>
            {branch.length > 0 ? `${branch.length} item${branch.length === 1 ? "" : "s"}` : ""}
          </td>
          <td />
          <td />
          <td className="r" style={{ color: "var(--muted)" }}>{value ? money(value) : ""}</td>
        </tr>
      );

      // Products filed directly here, one level deeper than their category.
      for (const i of itemsIn(g.id)) {
        rows.push(
          <tr key={i.id}>
            <td className="code" style={{ paddingLeft: `${1 + (depth + 1) * 1.5}rem` }}>
              {i.code}
            </td>
            <td className="wrap">
              {i.name}
              {i.name_my && (
                <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{i.name_my}</div>
              )}
              {!i.is_stocked && <> <span className="pill">service</span></>}
            </td>
            <td className="code">{i.uom_code}</td>
            <td className="r">{i.is_stocked ? qty(i.qty_on_hand) : "—"}</td>
            <td className="r">{i.sale_price ? money(i.sale_price) : "—"}</td>
            <td className="r">{money(i.value_on_hand)}</td>
          </tr>
        );
      }

      rows.push(...renderLevel(g.id, depth + 1));
    }

    return rows;
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Categories &amp; items</h1>
        <span className="page-sub">
          Parent category, then category, then the products inside it. Quantities
          are summed from the stock ledger &mdash; there is no stored on-hand
          column that could drift.
        </span>
      </div>

      <div className="actions">
        <Link href="/items/categories"><button type="button" className="ghost">Manage categories</button></Link>
        <Link href="/items/new"><button type="button">+ Item</button></Link>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Catalogue</h2>
            <span className="page-sub">
              {nodes.length} categor{nodes.length === 1 ? "y" : "ies"}, {items.length} item
              {items.length === 1 ? "" : "s"}
            </span>
          </div>

          {nodes.length === 0 ? (
            <div className="empty">
              Nothing yet. Start with a parent category, then add products inside it.{" "}
              <Link href="/items/categories" style={{ color: "var(--dr)" }}>Add a category</Link>
            </div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Unit</th>
                    <th className="r">On hand</th><th className="r">Sale price</th>
                    <th className="r">Stock value</th>
                  </tr>
                </thead>
                <tbody>{renderLevel(null, 0)}</tbody>
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
