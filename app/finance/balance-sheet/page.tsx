import { money } from "@/lib/db";
import { getCompany, getBalanceSheet } from "@/lib/queries";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function BalanceSheet({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const { asOf: asOfParam } = await searchParams;
  const asOf = asOfParam || today();

  const { rows, netIncome } = await getBalanceSheet(company.id, asOf);
  const typed = rows as unknown as Array<{
    id: string; code: string; name: string; account_type: "ASSET" | "LIABILITY" | "EQUITY"; amount: string;
  }>;

  const sumOf = (type: string) =>
    typed.filter((r) => r.account_type === type).reduce((s, r) => s + Number(r.amount), 0);
  const assets = sumOf("ASSET");
  const liabilities = sumOf("LIABILITY");
  const equity = sumOf("EQUITY") + netIncome;
  const balanced = Math.abs(assets - (liabilities + equity)) < 0.0001;

  const section = (type: "ASSET" | "LIABILITY" | "EQUITY", label: string) => {
    const items = typed.filter((r) => r.account_type === type);
    return (
      <tbody key={type}>
        <tr><td colSpan={2} style={{ background: "var(--line-soft)" }}><span className="eyebrow">{label}</span></td></tr>
        {items.map((r) => (
          <tr key={r.id}>
            <td className="wrap"><span className="code">{r.code}</span> {r.name}</td>
            <td className="r">{money(r.amount)}</td>
          </tr>
        ))}
        {type === "EQUITY" && netIncome !== 0 && (
          <tr>
            <td className="wrap" style={{ color: "var(--muted)" }}>Retained earnings (current, unclosed)</td>
            <td className="r">{money(netIncome)}</td>
          </tr>
        )}
      </tbody>
    );
  };

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Reports</span>
        <h1>Balance sheet</h1>
        <span className="page-sub">
          A snapshot, not a period. Revenue and expense are never closed to
          equity here, so their running net through the date below is folded
          into retained earnings — otherwise the two sides wouldn&rsquo;t match.
        </span>
      </div>

      <form className="row" style={{ marginBottom: "1rem", alignItems: "flex-end" }}>
        <div className="field">
          <label htmlFor="asOf">As of</label>
          <input id="asOf" name="asOf" type="date" defaultValue={asOf} />
        </div>
        <div className="actions"><button type="submit">Update</button></div>
      </form>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Statement</h2>
            <span className={`pill ${balanced ? "ok" : "overdue"}`}>
              {balanced ? "Balanced" : `Out by ${money(assets - (liabilities + equity))}`}
            </span>
          </div>
          <div className="tablewrap">
            <table>
              {section("ASSET", "Assets")}
              <tbody>
                <tr><td>Total assets</td><td className="r" style={{ fontWeight: 700 }}>{money(assets)}</td></tr>
              </tbody>
              {section("LIABILITY", "Liabilities")}
              <tbody>
                <tr><td>Total liabilities</td><td className="r" style={{ fontWeight: 600 }}>{money(liabilities)}</td></tr>
              </tbody>
              {section("EQUITY", "Equity")}
              <tfoot>
                <tr><td>Total equity</td><td className="r" style={{ fontWeight: 600 }}>{money(equity)}</td></tr>
                <tr><td>Total liabilities and equity</td><td className="r" style={{ fontWeight: 700 }}>{money(liabilities + equity)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
