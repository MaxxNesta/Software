import { getFinanceData, createBankVoucher } from "@/lib/actions";
import { VoucherForm } from "@/components/voucher-form";

export default async function BankBook() {
  const { accounts, cashAccounts, bankAccounts, locations } = await getFinanceData();
  const today = new Date().toISOString().slice(0, 10);
  const money = bankAccounts;

  if (bankAccounts.length === 0) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Cash &amp; Bank</span>
          <h1>Bank</h1>
        </div>
        <div className="alert">No bank account is set up in the chart of accounts.</div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Cash &amp; Bank</span>
        <h1>Bank</h1>
        <span className="page-sub">Money in and out of a bank account. Same as the cash book, against a bank rather than the till.</span>
      </div>

      <VoucherForm
        kind="bank"
        action={createBankVoucher}
        accounts={accounts as never}
        locations={locations as never}
        moneyAccounts={money as never}
        today={today}
        nextNo="BV-"
      />
    </>
  );
}
