"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function ToastInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toastParam = searchParams.get("toast");

  const [message, setMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!toastParam) return;

    setMessage(toastParam);
    setLeaving(false);

    // Strip the param immediately so a refresh or back-navigation doesn't
    // replay the same toast — it already did its job once.
    const params = new URLSearchParams(searchParams);
    params.delete("toast");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    const startLeaving = setTimeout(() => setLeaving(true), 3200);
    const clear = setTimeout(() => setMessage(null), 3550);
    return () => {
      clearTimeout(startLeaving);
      clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastParam]);

  if (!message) return null;

  return (
    <div className="toast-wrap">
      <div className="toast" data-leaving={leaving}>
        <span className="toast-icon">✓</span>
        <span>{message}</span>
      </div>
    </div>
  );
}

/** A brief confirmation after an action redirects — "posted", "created",
 *  "received" — so the user isn't left guessing whether it worked. */
export function Toast() {
  return (
    <Suspense fallback={null}>
      <ToastInner />
    </Suspense>
  );
}
