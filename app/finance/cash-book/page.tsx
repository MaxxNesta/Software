import Link from "next/link";
import { getFinanceData, createCashVoucher } from "@/lib/actions";
import { VoucherForm } from "@/components/voucher-form";

export default async function NewCashVoucher() {
  const { accounts, cashAccounts, bankAccounts, locations } = await getFinanceData();
  const today = new Date().toISOString().slice(0, 10);
  const money = cashAccounts;

  if (cashAccounts.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Cash &amp; Bank</span>
          <h1>New cash voucher</h1>
        </div>
        <div className="alert">No cash account is set up. Mark one in the chart of accounts as a till.</div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Cash &amp; Bank</span>
        <h1>New cash voucher</h1>
        <span className="page-sub">
          Money in and out of the till. Pick the account it went to or came from, and the entry posts both sides.{" "}
          <Link href="/finance/cash-detail" style={{ color: "var(--dr)" }}>View the cash book</Link>
        </span>
      </div>

      <VoucherForm
        kind="cash"
        action={createCashVoucher}
        accounts={accounts as never}
        locations={locations as never}
        moneyAccounts={money as never}
        today={today}
        nextNo="CV-"
      />
    </>
  );
}
