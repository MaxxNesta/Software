import Link from "next/link";
import { createItem, getFormData } from "@/lib/actions";
import { SimpleForm } from "@/components/simple-form";

type Group = { id: string; code: string; name: string; parent_id: string | null };

/** Full ancestry, so two same-named categories under different parents are distinguishable. */
function pathOf(groups: Group[], g: Group): string {
  const parts = [g.name];
  let cur = g;
  while (cur.parent_id) {
    const parent = groups.find((x) => x.id === cur.parent_id);
    if (!parent) break;
    parts.unshift(parent.name);
    cur = parent;
  }
  return parts.join(" → ");
}

/** Depth-first, so the dropdown reads in tree order rather than by code. */
function ordered(groups: Group[], parentId: string | null = null): Group[] {
  return groups
    .filter((g) => g.parent_id === parentId)
    .flatMap((g) => [g, ...ordered(groups, g.id)]);
}

export default async function NewItem() {
  const { groups, uoms } = await getFormData();
  const all = groups as unknown as Group[];
  const tree = ordered(all);

  if (groups.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Master data</span>
          <h1>New item</h1>
        </div>
        <div className="alert">
          No categories exist yet. <Link href="/items/categories" style={{ textDecoration: "underline" }}>Add a category first.</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>New item</h1>
        <span className="page-sub">
          Stocked items move through the inventory ledger on every purchase and
          sale. Services and charges are invoiced but never stocked.
        </span>
      </div>

      <SimpleForm action={createItem} submitLabel="Save item">
        <div className="card">
          <div className="card-head"><h2>Identity</h2></div>
          <div className="card-body">
            <div className="row">
              <div className="field">
                <label htmlFor="code">Code</label>
                <input id="code" name="code" type="text" placeholder="BEV-004" required />
              </div>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" placeholder="Lemon Soda 330ml" required />
              </div>
              <div className="field">
                <label htmlFor="name_my">Name (Burmese)</label>
                <input id="name_my" name="name_my" type="text" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Classification</h2></div>
          <div className="card-body">
            <div className="row">
              <div className="field">
                <label htmlFor="item_group_id">Category</label>
                <select id="item_group_id" name="item_group_id" required defaultValue="">
                  <option value="">Choose…</option>
                  {tree.map((g) => (
                    <option key={g.id} value={g.id}>
                      {pathOf(all, g)} ({g.code})
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Pick the deepest one that fits. Posting rules set on a parent
                  cover every category beneath it.
                </span>
              </div>
              <div className="field">
                <label htmlFor="base_uom_id">Base unit</label>
                <select id="base_uom_id" name="base_uom_id" required defaultValue={uoms[0]?.id ?? ""}>
                  {uoms.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.code} · {u.name}
                    </option>
                  ))}
                </select>
                <span className="hint">Stock is always stored in this unit</span>
              </div>
              <div className="field">
                <label htmlFor="sale_price">Sale price</label>
                <input id="sale_price" name="sale_price" type="number" min="0" step="any" />
                <span className="hint">Optional, in MMK — fills in on invoices</span>
              </div>
            </div>

            <label className="check" htmlFor="is_stocked" style={{ marginTop: "1rem" }}>
              <input id="is_stocked" name="is_stocked" type="checkbox" defaultChecked />
              Stocked — this item moves through inventory
            </label>
          </div>
        </div>
      </SimpleForm>
    </>
  );
}
