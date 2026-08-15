import { getCompany, getLocations } from "@/lib/queries";
import { createLocation, updateLocation, deleteLocation, deactivateLocation } from "@/lib/actions";
import { AddLocationForm } from "@/components/location-form";
import { LocationRow } from "@/components/location-row";
import { DataTable, type DataRow } from "@/components/data-table";

export default async function Warehouses() {
  const company = await getCompany();
  if (!company) return <div className="empty">No company found.</div>;

  const locations = (await getLocations(company.id)) as unknown as Array<{
    id: string; code: string; name: string; name_my: string | null;
    parent_id: string | null; parent_name: string | null;
    is_stock_location: boolean; is_active: boolean;
  }>;

  const rows: DataRow[] = locations.map((l) => ({
    key: l.id,
    searchText: [l.code, l.name, l.name_my, l.parent_name].filter(Boolean).join(" "),
    sort: {
      code: l.code,
      name: l.name,
      parent_name: l.parent_name ?? "",
      is_stock_location: l.is_stock_location ? 1 : 0,
      is_active: l.is_active ? 1 : 0,
    },
    node: (
      <LocationRow
        location={l}
        locations={locations}
        updateAction={updateLocation}
        deleteAction={deleteLocation}
        deactivateAction={deactivateLocation}
      />
    ),
  }));

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
            <DataTable
              rows={rows}
              emptyLabel="No warehouses"
              searchPlaceholder="Search warehouses…"
              defaultSort={{ key: "code", dir: "asc" }}
              columns={[
                { key: "code", label: "Code", sortable: true },
                { key: "name", label: "Name", sortable: true },
                { key: "parent_name", label: "Branch", sortable: true },
                { key: "is_stock_location", label: "Type", sortable: true },
                { key: "is_active", label: "Status", sortable: true },
                { key: "actions", label: "" },
              ]}
            />
          )}
        </div>
      </section>
    </>
  );
}
