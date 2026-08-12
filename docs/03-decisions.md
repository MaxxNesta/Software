# Open decisions

Choices that are cheap now and expensive once there is live client data.
Each carries a recommendation; none are final.

---

## D1 — Purchase price variance treatment

**Question.** When the supplier's invoice price differs from the receipt
price, where does the difference go?

**Options.**

- *Variance account* — post the whole difference to Purchase Price Variance.
  Simple, one rule, adequate for most trading companies.
- *Inventory revaluation* — revalue stock still on hand, expense only the
  portion already sold. More accurate, materially more work, and it means
  posting into prior periods when receipts and invoices straddle a month-end.

**Recommendation.** Variance account for v1.

**Needs.** Accountant sign-off. This is the single most important question to
put to a Myanmar auditor, because changing it later means re-posting history.

---

## D2 — Inventory valuation method

**Question.** Weighted average, FIFO, or per-item choice?

**Recommendation.** Weighted average, system-wide, for v1. It is what local
practice assumes, it is far simpler under multi-currency, and per-item choice
multiplies the test surface.

**Watch.** FIFO becomes necessary for expiry-tracked goods (pharma, food),
which are real target segments. The valuation layer should be pluggable even
if only one implementation ships.

---

## D3 — Settlement vs trade discount

**Question.** Confirmed treatment: trade discount nets into the line and posts
nothing; settlement discount posts to its own account.

**Recommendation.** As above — this is standard practice.

**Needs.** Confirmation that it matches how Myanmar distributors actually book
the discounts they give, which are often negotiated per-invoice at payment
time rather than agreed in advance.

---

## D4 — FOC reason codes

**Question.** Free-of-charge goods post to expense rather than COGS, but which
expense? Candidates seen in local practice: promotion, sample, office use,
damaged/written off, staff.

**Recommendation.** A reason-code table on the delivery line, each code mapping
to its own expense account. Configurable per client.

**Needs.** The actual list your clients use. This is worth asking directly —
it is a small feature that will feel like the software understands their
business.

---

## D5 — Exchange rate sourcing

**Question.** Which rate, captured how? CBM reference rate and market rate
diverge, and companies routinely book at a contract rate that matches neither.

**Recommendation.** Store rate *and* rate-source on every transaction, with a
rate-type table (official / market / contract). Do not assume a single daily
rate.

**Needs.** How your clients actually decide the rate they book at. This is
Myanmar-specific and it is a place where getting it right is visibly better
than the alternatives.

---

## D6 — Technology stack

**Question.** Not yet decided. Deliberately deferred until the data model
exists.

**Constraints already known.**

- Unreliable connectivity and power — offline capability matters eventually,
  which rules out designs that assume a live connection
- Sanctions limit payment and cloud provider options
- Clients distrust cloud and cannot run servers well; deployment model is an
  open question in itself
- Data-entry staff are fast on keyboard-driven desktop software. A
  mouse-driven web UI will feel like a downgrade unless keyboard navigation
  is taken seriously from the start

**Needs.** Team size and existing stack familiarity. Also worth a serious look
at extending ERPNext rather than writing a ledger from zero — the honest
comparison hasn't been done yet.

---

## D7 — Burmese text migration

**Question.** Incumbent data appears to be stored in a legacy ASCII-mapped
font encoding (Win Innwa family), not Unicode.

**Recommendation.** Build a legacy-to-Unicode converter as an import tool.
"We convert your existing data" is a sales conversation, not a technical one,
and it is a concrete wedge against every incumbent.

**Needs.** A sample data export from a real client to confirm which encoding
is actually in the database, rather than only in the printed manual.
