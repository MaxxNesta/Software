import { sql } from "@/lib/db";
import { createCategory, getFormData } from "@/lib/actions";
import { SimpleForm } from "@/components/simple-form";

type Group = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
};

/** Depth-first walk, so any number of levels renders in order. */
function flatten(groups: Group[], parentId: string | null = null, depth = 0): Array<Group & { depth: number }> {
  return groups
    .filter((g) => g.parent_id === parentId)
    .flatMap((g) => [{ ...g, depth }, ...flatten(groups, g.id, depth + 1)]);
}

export default async function Categories() {
  const { groups } = await getFormData();

  const counts = await sql`
    select item_group_id, count(*)::int as n from item group by item_group_id`;
  const countFor = (id: string) => counts.find((c: any) => c.item_group_id === id)?.n ?? 0;

  const tree = flatten(groups as unknown as Group[]);
  const maxDepth = tree.reduce((m, g) => Math.max(m, g.depth), 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Categories</h1>
        <span className="page-sub">
          Nest as deep as you need — any category can be the parent of another.
          The category an item sits in decides which inventory, COGS, and revenue
          accounts its postings land in, and a rule set on a parent covers every
          child unless the child overrides it.
        </span>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <h2>Tree</h2>
            <span className="page-sub">
              {tree.length} categories, {maxDepth + 1} level{maxDepth === 0 ? "" : "s"} deep
            </span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th className="r">Items</th></tr>
              </thead>
              <tbody>
                {tree.map((g) => (
                  <tr key={g.id}>
                    <td className="code" style={{ paddingLeft: `${1 + g.depth * 1.4}rem`, color: g.depth === 0 ? undefined : "var(--muted)" }}>
                      {g.depth > 0 && <span style={{ color: "var(--ghost)" }}>└ </span>}
                      {g.code}
                    </td>
                    <td className="wrap" style={{ fontWeight: g.depth === 0 ? 500 : 400 }}>{g.name}</td>
                    <td className="r">{countFor(g.id) || ""}</td>
                  </tr>
                ))}
                {tree.length === 0 && (
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
                  <option value="">None — top level</option>
                  {tree.map((g) => (
                    <option key={g.id} value={g.id}>
                      {"  ".repeat(g.depth)}
                      {g.depth > 0 ? "└ " : ""}
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Any category can be a parent. Pick one to nest a level deeper.
                </span>
              </div>
              <div className="field">
                <label htmlFor="code">Code</label>
                <input id="code" name="code" type="text" placeholder="BEV-SOFT-COLA" required />
              </div>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" placeholder="Cola" required />
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
