import Link from "next/link";
import { money, qty, shortDate } from "@/lib/db";
import { getCompany, getItems, getStockMovements } from "@/lib/queries";
import { AccountPicker } from "@/components/account-picker";

const label = (t: string) => t.replace(/_/g, " ").toLowerCase();

export default async function StockMovements({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const allItems = (await getItems(company.id)) as unknown as Array<{
    id: string; code: string; name: string; is_stocked: boolean;
  }>;
  const items = allItems.filter((i) => i.is_stocked);
  const selected = items.find((i) => i.id === item) ?? items[0];

  const rows = selected ? await getStockMovements(company.id, selected.id) : [];

  let balance = 0;
  const withBalance = (rows as any[]).map((r) => {
    balance += Number(r.qty);
    return { ...r, balance };
  });

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Inventory</span>
        <h1>Stock movements</h1>
        <span className="page-sub">
          Every receipt, delivery, transfer, and adjustment against one item,
          in order, with a running balance — a stock card. Nothing here is
          stored separately; it&rsquo;s the same append-only ledger the Stock
          page sums.
        </span>
      </div>

      {items.length === 0 ? (
        <div className="empty">No stocked items yet.</div>
      ) : (
        <>
          <AccountPicker
            accounts={items}
            selectedId={selected!.id}
            basePath="/inventory/movements"
            paramName="item"
            label="Item"
          />

          <section>
            <div className="card">
              <div className="card-head">
                <h2>{selected!.code} &middot; {selected!.name}</h2>
                <span className="page-sub">
                  {withBalance.length} movement{withBalance.length === 1 ? "" : "s"} &middot; on hand {qty(String(balance))}
                </span>
              </div>

              {withBalance.length === 0 ? (
                <div className="empty">Nothing has moved on this item yet.</div>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th><th>Document</th><th>Location</th><th>Batch</th>
                        <th className="r">In</th><th className="r">Out</th>
                        <th className="r">Unit cost</th><th className="r">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withBalance.map((r) => (
                        <tr key={r.id}>
                          <td className="code">{shortDate(r.movement_date)}</td>
                          <td className="code">
                            {r.document_id ? (
                              <Link href={`/documents/${r.document_id}`} style={{ color: "var(--dr)" }}>
                                {r.doc_no ?? label(r.doc_type)}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="code">{r.location_code}</td>
                          <td className="code">{r.batch_no ?? "—"}</td>
                          <td className="r">{Number(r.qty) > 0 ? qty(r.qty) : ""}</td>
                          <td className="r">{Number(r.qty) < 0 ? qty(String(-Number(r.qty))) : ""}</td>
                          <td className="r">{money(r.unit_cost)}</td>
                          <td className="r">{qty(String(r.balance))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
