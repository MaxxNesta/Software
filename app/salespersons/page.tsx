import { getCompany, getSalesmen, getLocations } from "@/lib/queries";
import { createSalesman, updateSalesman, deleteSalesman, deactivateSalesman } from "@/lib/actions";
import { AddSalesmanForm } from "@/components/salesman-form";
import { SalesmanRow } from "@/components/salesman-row";

export default async function Salespersons() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const [salesmen, locations] = (await Promise.all([
    getSalesmen(company.id),
    getLocations(company.id),
  ])) as unknown as [
    Array<{
      id: string; code: string; name: string; name_my: string | null;
      phone: string | null; location_id: string | null; location_name: string | null;
      commission_pct: string; is_active: boolean;
    }>,
    Array<{ id: string; code: string; name: string }>,
  ];

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Salespersons</h1>
        <span className="page-sub">
          Staff who get credited on a sale. Commission is reported on here,
          not paid automatically &mdash; paying it out is a payroll matter.
        </span>
      </div>

      <AddSalesmanForm action={createSalesman} locations={locations} />

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Salespersons</h2>
            <span className="page-sub">{salesmen.length}</span>
          </div>

          {salesmen.length === 0 ? (
            <div className="empty">None yet. Add your first salesperson above.</div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Phone</th><th>Branch</th>
                    <th className="r">Commission</th><th />
                  </tr>
                </thead>
                <tbody>
                  {salesmen.map((s) => (
                    <SalesmanRow
                      key={s.id}
                      salesman={s}
                      locations={locations}
                      updateAction={updateSalesman}
                      deleteAction={deleteSalesman}
                      deactivateAction={deactivateSalesman}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
