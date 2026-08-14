"use client";

import { useRouter } from "next/navigation";

type Account = { id: string; code: string; name: string };

/** Switches which account the detail report is showing. */
export function AccountPicker({
  accounts,
  selectedId,
  basePath,
}: {
  accounts: Account[];
  selectedId: string;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <div className="row" style={{ maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="acct">Account</label>
        <select
          id="acct"
          value={selectedId}
          onChange={(e) => router.push(`${basePath}?account=${e.target.value}`)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
