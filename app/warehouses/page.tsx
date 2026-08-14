import { getCompany, getLocations } from "@/lib/queries";
import { createLocation, updateLocation, deleteLocation, deactivateLocation } from "@/lib/actions";
import { AddLocationForm } from "@/components/location-form";
import { LocationRow } from "@/components/location-row";

export default async function Warehouses() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const locations = (await getLocations(company.id)) as unknown as Array<{
    id: string; code: string; name: string; name_my: string | null;
    parent_id: string | null; parent_name: string | null;
    is_stock_location: boolean; is_active: boolean;
  }>;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Master data</span>
        <h1>Warehouses</h1>
        <span className="page-sub">
          Branches and the warehouses inside them. Only a location marked
          &ldquo;holds stock&rdquo; can receive or issue inventory.
        </span>
      </div>

      <AddLocationForm action={createLocation} locations={locations} />

      <section>
        <div className="card">
          <div className="card-head">
            <h2>Warehouses</h2>
            <span className="page-sub">{locations.length}</span>
          </div>

          {locations.length === 0 ? (
            <div className="empty">None yet. Add your first warehouse above.</div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Branch</th><th>Type</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l) => (
                    <LocationRow
                      key={l.id}
                      location={l}
                      locations={locations}
                      updateAction={updateLocation}
                      deleteAction={deleteLocation}
                      deactivateAction={deactivateLocation}
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
