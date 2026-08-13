import { sql } from "@/lib/db";
import { createCategory, getFormData } from "@/lib/actions";
import { SimpleForm } from "@/components/simple-form";

export default async function Categories() {
  const { groups } = await getFormData();

  const counts = await sql`
    select item_group_id, count(*)::int as n from item group by item_group_id`;
  const countFor = (id: string) =>
    counts.find((c: any) => c.item_group_id === id)?.n ?? 0;

  const roots = groups.filter((g: any) => !g.parent_id);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Categories</h1>
        <span className="page-sub">
          Category, then sub category, then the product itself. The category an
          item sits in decides which inventory, COGS, and revenue accounts its
          postings land in.
        </span>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head"><h2>Existing</h2></div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th className="r">Items</th></tr>
              </thead>
              <tbody>
                {roots.map((root: any) => {
                  const children = groups.filter((g: any) => g.parent_id === root.id);
                  return [
                    <tr key={root.id}>
                      <td className="code">{root.code}</td>
                      <td style={{ fontWeight: 500 }}>{root.name}</td>
                      <td className="r">{countFor(root.id) || ""}</td>
                    </tr>,
                    ...children.map((c: any) => (
                      <tr key={c.id}>
                        <td className="code" style={{ paddingLeft: "2rem", color: "var(--muted)" }}>
                          {c.code}
                        </td>
                        <td style={{ paddingLeft: "2rem" }}>{c.name}</td>
                        <td className="r">{countFor(c.id) || ""}</td>
                      </tr>
                    )),
                  ];
                })}
                {roots.length === 0 && (
                  <tr><td colSpan={3} className="empty">No categories yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Add a category</h2></div>
          <div className="card-body">
            <SimpleForm action={createCategory} submitLabel="Save category">
              <div className="field">
                <label htmlFor="parent_id">Parent</label>
                <select id="parent_id" name="parent_id" defaultValue="">
                  <option value="">None — this is a top-level category</option>
                  {roots.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.code} · {g.name}
                    </option>
                  ))}
                </select>
                <span className="hint">Pick a parent to create a sub category</span>
              </div>
              <div className="field">
                <label htmlFor="code">Code</label>
                <input id="code" name="code" type="text" placeholder="BEV-SOFT" required />
              </div>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" placeholder="Soft drinks" required />
              </div>
              <div className="field">
                <label htmlFor="name_my">Name (Burmese)</label>
                <input id="name_my" name="name_my" type="text" />
              </div>
            </SimpleForm>
          </div>
        </div>
      </div>
    </>
  );
}
