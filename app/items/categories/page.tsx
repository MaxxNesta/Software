import Link from "next/link";
import { sql } from "@/lib/db";
import { createCategory } from "@/lib/actions";
import { allCategories, childrenOf, levelCounts, branchIds } from "@/lib/tree";
import { AddCategoryForm } from "@/components/level-form";

export default async function CategoriesRoot() {
  const [co] = await sql`select id from company order by created_at limit 1`;
  if (!co) return <div className="empty">No company found.</div>;

  const nodes = await allCategories(co.id);
  const counts = await levelCounts(co.id);
  const roots = childrenOf(nodes, null);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Categories</h1>
        <span className="page-sub">
          The top of your product tree. Open one to add categories inside it,
          then keep going until you reach the products themselves.
        </span>
      </div>

      <AddCategoryForm
        action={createCategory}
        parentId={null}
        returnTo="/items/categories"
        label="Category"
        codeHint="01"
        nameHint="Stationary"
      />

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Categories</h2>
            <span className="page-sub">{roots.length}</span>
          </div>

          {roots.length === 0 ? (
            <div className="empty">
              Nothing yet. Add a category &mdash; the broadest grouping you
              use, like Food &amp; Drink or Household.
            </div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th>
                    <th className="r">Inside</th><th className="r">Items</th><th />
                  </tr>
                </thead>
                <tbody>
                  {roots.map((g) => {
                    const total = branchIds(nodes, g.id)
                      .reduce((s, id) => s + counts.itemsIn(id), 0);
                    return (
                      <tr key={g.id} className="link">
                        <td className="code">
                          <Link href={`/items/categories/${g.id}`} style={{ color: "var(--dr)" }}>
                            {g.code}
                          </Link>
                        </td>
                        <td className="wrap">
                          <Link href={`/items/categories/${g.id}`}>{g.name}</Link>
                          {g.name_my && (
                            <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{g.name_my}</div>
                          )}
                        </td>
                        <td className="r">{counts.childrenOf(g.id) || ""}</td>
                        <td className="r">{total || ""}</td>
                        <td>
                          <Link href={`/items/categories/${g.id}`} className="btn ghost tiny">Open &rarr;</Link>
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
