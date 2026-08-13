import { money } from "@/lib/db";
import { getCompany, getTrialBalance, getHealth } from "@/lib/queries";

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"];

export default async function Ledger() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const [rows, health] = await Promise.all([
    getTrialBalance(company.id),
    getHealth(company.id),
  ]);

  const sum = (k: string) => rows.reduce((s: number, r: any) => s + Number(r[k]), 0);
  const closingDr = sum("closing_debit");
  const closingCr = sum("closing_credit");
  const balanced = Math.abs(closingDr - closingCr) < 0.0001 && health.trialBalance === 0;

  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    rows: rows.filter((r: any) => r.account_type === t),
  })).filter((g) => g.rows.length > 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Overview</span>
        <h1>Trial balance</h1>
        <span className="page-sub">
          Read from the ledger, never from the documents. Each account&rsquo;s closing
          balance sits on the side it naturally falls, and the two columns agreeing
          is what makes the report a check rather than a list.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>All accounts with a balance</h2>
            <span className={`pill ${balanced ? "ok" : "overdue"}`}>
              {balanced ? "Balanced" : `Out by ${money(closingDr - closingCr)}`}
            </span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th><th>Name</th>
                  <th className="r">Debit</th><th className="r">Credit</th>
                  <th className="r">Closing Dr</th><th className="r">Closing Cr</th>
                </tr>
              </thead>
              {grouped.map((g) => (
                <tbody key={g.type}>
                  <tr>
                    <td colSpan={6} style={{ background: "var(--line-soft)" }}>
                      <span className="eyebrow">{g.type.toLowerCase()}</span>
                    </td>
                  </tr>
                  {g.rows.map((r: any) => {
                    // A balance on the opposite side to the account type is worth
                    // seeing — an asset in credit usually means an overdraft or a
                    // posting error.
                    const abnormal =
                      (r.debit_normal && Number(r.closing_credit) > 0) ||
                      (!r.debit_normal && Number(r.closing_debit) > 0);

                    return (
                      <tr key={r.code}>
                        <td className="code">{r.code}</td>
                        <td className="wrap">
                          {r.name}
                          {abnormal && <> <span className="pill warn">unusual side</span></>}
                        </td>
                        <td className="r dr">
                          {Number(r.debit_movement) ? money(r.debit_movement) : ""}
                        </td>
                        <td className="r cr">
                          {Number(r.credit_movement) ? money(r.credit_movement) : ""}
                        </td>
                        <td className="r dr" style={{ fontWeight: 500 }}>
                          {Number(r.closing_debit) ? money(r.closing_debit) : ""}
                        </td>
                        <td className="r cr" style={{ fontWeight: 500 }}>
                          {Number(r.closing_credit) ? money(r.closing_credit) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="r dr">{money(sum("debit_movement"))}</td>
                  <td className="r cr">{money(sum("credit_movement"))}</td>
                  <td className="r dr">{money(closingDr)}</td>
                  <td className="r cr">{money(closingCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
