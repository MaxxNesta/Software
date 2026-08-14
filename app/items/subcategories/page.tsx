import Link from "next/link";
import { sql } from "@/lib/db";
import { allCategories, subcategories, levelCounts, branchIds } from "@/lib/tree";

export default async function Subcategories() {
  const [co] = await sql`select id from company order by created_at limit 1`;
  if (!co) return <div className="empty">No company found.</div>;

  const nodes = await allCategories(co.id);
  const counts = await levelCounts(co.id);
  const subs = subcategories(nodes);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Sub categories</h1>
        <span className="page-sub">
          Every sub category across the whole catalogue, in one flat list —
          the tree view groups them by category; this jumps straight to any of
          them.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Sub categories</h2>
            <span className="page-sub">{subs.length}</span>
          </div>

          {subs.length === 0 ? (
            <div className="empty">
              None yet. Open a category and add a sub category inside it.{" "}
              <Link href="/items/categories" style={{ color: "var(--dr)" }}>Go to categories</Link>
            </div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Category</th>
                    <th className="r">Items</th><th />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const parent = nodes.find((n) => n.id === s.parent_id);
                    const total = branchIds(nodes, s.id)
                      .reduce((sum, id) => sum + counts.itemsIn(id), 0);
                    return (
                      <tr key={s.id} className="link">
                        <td className="code">
                          <Link href={`/items/categories/${s.id}`} style={{ color: "var(--dr)" }}>
                            {s.code}
                          </Link>
                        </td>
                        <td className="wrap">
                          <Link href={`/items/categories/${s.id}`}>{s.name}</Link>
                          {s.name_my && (
                            <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{s.name_my}</div>
                          )}
                        </td>
                        <td className="wrap" style={{ color: "var(--muted)" }}>
                          {parent?.name ?? "—"}
                        </td>
                        <td className="r">{total || ""}</td>
                        <td>
                          <Link href={`/items/categories/${s.id}`} className="btn ghost tiny">Open &rarr;</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
