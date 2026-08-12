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

  const totalDebit = rows.reduce((s: number, r: any) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s: number, r: any) => s + Number(r.credit), 0);
  const balanced = health.trialBalance === 0;

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
          Read from the ledger, never from the documents. Financial year 2026-27.
        </span>
      </div>

      <section>
        <div className="card">
          <div className="card-head">
            <h2>All accounts with a balance</h2>
            <span className={`pill ${balanced ? "ok" : "overdue"}`}>
              {balanced ? "Balanced" : `Out by ${money(health.trialBalance)}`}
            </span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th><th>Name</th>
                  <th className="r">Debit</th><th className="r">Credit</th><th className="r">Balance</th>
                </tr>
              </thead>
              {grouped.map((g) => (
                <tbody key={g.type}>
                  <tr>
                    <td colSpan={5} style={{ background: "var(--line-soft)" }}>
                      <span className="eyebrow">{g.type.toLowerCase()}</span>
                    </td>
                  </tr>
                  {g.rows.map((r: any) => (
                    <tr key={r.code}>
                      <td className="code">{r.code}</td>
                      <td className="wrap">{r.name}</td>
                      <td className="r dr">{Number(r.debit) ? money(r.debit) : ""}</td>
                      <td className="r cr">{Number(r.credit) ? money(r.credit) : ""}</td>
                      <td className="r">{money(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="r dr">{money(totalDebit)}</td>
                  <td className="r cr">{money(totalCredit)}</td>
                  <td className="r">{money(health.trialBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
