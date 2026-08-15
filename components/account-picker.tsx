"use client";

import { useRouter } from "next/navigation";

type Option = { id: string; code: string; name: string };

/** Switches which account (or item, or anything code+name) a detail report is showing. */
export function AccountPicker({
  accounts,
  selectedId,
  basePath,
  paramName = "account",
  label = "Account",
}: {
  accounts: Option[];
  selectedId: string;
  basePath: string;
  paramName?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <div className="row" style={{ maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="acct">{label}</label>
        <select
          id="acct"
          value={selectedId}
          onChange={(e) => router.push(`${basePath}?${paramName}=${e.target.value}`)}
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
