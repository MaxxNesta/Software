import Link from "next/link";
import { money } from "@/lib/db";
import { getCompany, getItems } from "@/lib/queries";
import { DataTable } from "@/components/data-table";

type Row = {
  id: string; code: string; name: string; name_my: string | null;
  item_group_id: string; group_name: string; parent_group_name: string | null;
  brand_name: string | null; is_stocked: boolean;
  uom_code: string; sale_price: string | null;
};

export default async function Items() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const items = (await getItems(company.id)) as unknown as Row[];

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Items</h1>
        <span className="page-sub">
          Every product and service in the catalogue. Filed under a category
          (and sub category, if it has one), with an optional brand.
        </span>
      </div>

      <div className="actions">
        <Link href="/items/categories" className="btn ghost">Manage categories</Link>
        <Link href="/items/brands" className="btn ghost">Manage brands</Link>
        <Link href="/items/new" className="btn">+ Item</Link>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Catalogue</h2>
            <span className="page-sub">{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <div className="empty">
              Nothing yet. Start with a category, then add products inside it.{" "}
              <Link href="/items/categories" style={{ color: "var(--dr)" }}>Add a category</Link>
            </div>
          ) : (
            <DataTable
              rows={items}
              rowKey={(i) => i.id}
              emptyLabel="No items"
              searchPlaceholder="Search items…"
              defaultSort={{ key: "code", dir: "asc" }}
              columns={[
                { key: "code", label: "Code", sortable: true },
                { key: "name", label: "Name", sortable: true },
                { key: "group_name", label: "Category", sortable: true },
                { key: "brand_name", label: "Brand", sortable: true },
                { key: "uom_code", label: "Unit", sortable: true },
                { key: "sale_price", label: "Sale price", sortable: true, align: "r" },
              ]}
              getSearchText={(i) =>
                [i.code, i.name, i.name_my, i.group_name, i.parent_group_name, i.brand_name, i.uom_code]
                  .filter(Boolean).join(" ")
              }
              getSortValue={(i, key) => {
                switch (key) {
                  case "sale_price": return Number(i.sale_price ?? 0);
                  case "group_name": return i.parent_group_name ? `${i.parent_group_name} / ${i.group_name}` : i.group_name;
                  default: return (i as any)[key] ?? "";
                }
              }}
              renderRow={(i) => (
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
                    {!i.is_stocked && <> <span className="pill">service</span></>}
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {i.parent_group_name ? `${i.parent_group_name} / ${i.group_name}` : i.group_name}
                  </td>
                  <td style={{ color: "var(--muted)" }}>{i.brand_name ?? "—"}</td>
                  <td className="code">{i.uom_code}</td>
                  <td className="r">{i.sale_price ? money(i.sale_price) : "—"}</td>
                </tr>
              )}
            />
          )}
        </div>
      </section>
    </>
  );
}
