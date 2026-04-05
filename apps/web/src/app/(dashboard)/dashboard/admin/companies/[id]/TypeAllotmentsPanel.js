"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";

export default function TypeAllotmentsPanel({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selected IDs / keys — null means "not loaded yet"
  const [selectedCommodityIds, setSelectedCommodityIds] = useState(null);
  const [selectedVehicleKeys, setSelectedVehicleKeys] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/type-allotments`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      setSelectedCommodityIds(json.allottedCommodityIds);
      setSelectedVehicleKeys(json.allottedVehicleKeys);
    } catch (e) {
      toast.error(e.message || "Failed to load allotments");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleCommodity(id) {
    setSelectedCommodityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleVehicle(key) {
    setSelectedVehicleKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/type-allotments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commodityTypeIds: selectedCommodityIds,
          vehicleTypeKeys: selectedVehicleKeys,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Allotments saved");
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>;
  if (!data) return null;

  const noSelection = selectedCommodityIds?.length === 0 && selectedVehicleKeys?.length === 0;

  return (
    <div className="space-y-6">
      {noSelection && (
        <div className="bg-blue-50 text-blue-700 text-sm rounded-lg px-4 py-3">
          No types are restricted — this company currently sees <strong>all active types</strong>.
          Check items below to restrict to specific types.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commodity types */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-800 text-sm">Commodity Types</h3>
            <button
              onClick={() =>
                setSelectedCommodityIds(
                  selectedCommodityIds?.length === data.allCommodities.length
                    ? []
                    : data.allCommodities.map((c) => c.id)
                )
              }
              className="text-xs text-brand-600 hover:underline"
            >
              {selectedCommodityIds?.length === data.allCommodities.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          {data.allCommodities.length === 0 ? (
            <p className="text-xs text-slate-400">No commodity types in catalog yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.allCommodities.map((item) => (
                <li key={item.id}>
                  <label className={`flex items-center gap-2.5 cursor-pointer group ${!item.is_active ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      className="rounded border-surface-border text-brand-500 focus:ring-brand-500"
                      checked={selectedCommodityIds?.includes(item.id) ?? false}
                      onChange={() => toggleCommodity(item.id)}
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {item.name}
                      {!item.is_active && (
                        <span className="ml-1.5 text-xs text-slate-400">(inactive)</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Vehicle types */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-800 text-sm">Vehicle Types</h3>
            <button
              onClick={() =>
                setSelectedVehicleKeys(
                  selectedVehicleKeys?.length === data.allVehicleTypes.length
                    ? []
                    : data.allVehicleTypes.map((v) => v.key)
                )
              }
              className="text-xs text-brand-600 hover:underline"
            >
              {selectedVehicleKeys?.length === data.allVehicleTypes.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          {data.allVehicleTypes.length === 0 ? (
            <p className="text-xs text-slate-400">No vehicle types in catalog yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.allVehicleTypes.map((item) => (
                <li key={item.key}>
                  <label className={`flex items-center gap-2.5 cursor-pointer group ${!item.is_active ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      className="rounded border-surface-border text-brand-500 focus:ring-brand-500"
                      checked={selectedVehicleKeys?.includes(item.key) ?? false}
                      onChange={() => toggleVehicle(item.key)}
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {item.label}
                      {!item.is_active && (
                        <span className="ml-1.5 text-xs text-slate-400">(inactive)</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary flex items-center gap-2 px-5 py-2 text-sm"
      >
        <Save size={14} />
        {saving ? "Saving…" : "Save Allotments"}
      </button>
    </div>
  );
}
