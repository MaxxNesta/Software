import { sql } from "@/lib/db";
import { createCategory, getFormData } from "@/lib/actions";
import { CategoryManager } from "@/components/category-manager";

export default async function Categories() {
  const { groups } = await getFormData();

  const counts = await sql`
    select item_group_id, count(*)::int as n from item group by item_group_id`;

  const withCounts = (groups as any[]).map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    name_my: g.name_my ?? null,
    parent_id: g.parent_id,
    items: counts.find((c: any) => c.item_group_id === g.id)?.n ?? 0,
  }));

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Categories</h1>
        <span className="page-sub">
          Start with a parent category, then nest as deep as you need. The category
          an item sits in decides which inventory, cost and revenue accounts its
          postings land in, and a rule set on a parent covers everything beneath it.
        </span>
      </div>

      <CategoryManager groups={withCounts} action={createCategory} />
    </>
  );
}
