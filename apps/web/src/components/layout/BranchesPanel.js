"use client";

import { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import toast from "react-hot-toast";
import { GitBranch, Plus, X, MapPin, ToggleLeft, ToggleRight, Loader2, Pencil, Check } from "lucide-react";
import PlacesAutocomplete from "@/components/loads/PlacesAutocomplete";

/**
 * BranchesPanel
 *
 * Reusable panel for creating and managing company branches.
 *
 * Props:
 *  apiBase    {string}   — API prefix, e.g. "/api/company/branches"
 *                          or "/api/admin/companies/<id>/branches"
 *  canToggle  {boolean}  — Whether to show the active/inactive toggle (admin only). Default false.
 */
export default function BranchesPanel({ apiBase, canToggle = false }) {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create-form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", pincode: "", lat: null, lng: null });

  // Inline rename state: { [branchId]: draftName }
  const [renaming, setRenaming] = useState({});
  const [savingRename, setSavingRename] = useState({});

  // Toggle loading state per branch
  const [toggling, setToggling] = useState({});

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBranches(Array.isArray(json) ? json : []);
    } catch (e) {
      toast.error(e.message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  // ── Create ─────────────────────────────────────────────────────────────────
  function handleAddressChange({ address, city, state, pincode, lat, lng }) {
    setForm((prev) => ({ ...prev, address, city, state, pincode, lat, lng }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Branch name is required"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          form.name.trim(),
          address_line1: form.address || null,
          city:          form.city    || null,
          state:         form.state   || null,
          pincode:       form.pincode || null,
          lat:           form.lat,
          lng:           form.lng,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Branch created");
      setBranches((prev) => [...prev, json]);
      setShowForm(false);
      setForm({ name: "", address: "", city: "", state: "", pincode: "", lat: null, lng: null });
    } catch (e) {
      toast.error(e.message || "Failed to create branch");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function handleToggle(branch) {
    setToggling((prev) => ({ ...prev, [branch.id]: true }));
    const newActive = !branch.is_active;
    try {
      const res = await fetch(`${apiBase}/${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, is_active: newActive } : b)));
      toast.success(newActive ? "Branch activated" : "Branch deactivated");
    } catch (e) {
      toast.error(e.message || "Failed to update branch");
    } finally {
      setToggling((prev) => ({ ...prev, [branch.id]: false }));
    }
  }

  // ── Rename ─────────────────────────────────────────────────────────────────
  function startRename(branch) {
    setRenaming((prev) => ({ ...prev, [branch.id]: branch.name }));
  }

  function cancelRename(branchId) {
    setRenaming((prev) => { const n = { ...prev }; delete n[branchId]; return n; });
  }

  async function commitRename(branchId) {
    const newName = renaming[branchId]?.trim();
    if (!newName) { toast.error("Name cannot be empty"); return; }

    setSavingRename((prev) => ({ ...prev, [branchId]: true }));
    try {
      const res = await fetch(`${apiBase}/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBranches((prev) => prev.map((b) => (b.id === branchId ? { ...b, name: newName } : b)));
      cancelRename(branchId);
      toast.success("Branch renamed");
    } catch (e) {
      toast.error(e.message || "Failed to rename branch");
    } finally {
      setSavingRename((prev) => { const n = { ...prev }; delete n[branchId]; return n; });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const active   = branches.filter((b) => b.is_active);
  const inactive = branches.filter((b) => !b.is_active);

  return (
    <>
      {/* Load Google Maps only when the create form is open */}
      {showForm && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=beta`}
          onLoad={() => setMapsLoaded(true)}
          strategy="lazyOnload"
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Branches</h2>
            {!loading && (
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-medium">
                {canToggle
                  ? `${active.length} active${inactive.length > 0 ? ` · ${inactive.length} inactive` : ""}`
                  : `${branches.length} branch${branches.length !== 1 ? "es" : ""}`}
              </span>
            )}
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Branch
            </button>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <div className="border border-brand-200 rounded-xl bg-brand-50/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">New Branch</p>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm({ name: "", address: "", city: "", state: "", pincode: "", lat: null, lng: null }); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">Branch Name *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Mumbai HQ, Delhi Office…"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label">Address</label>
                <PlacesAutocomplete
                  key="new-branch-ac"
                  value={form.address}
                  mapsLoaded={mapsLoaded}
                  placeholder="Start typing the branch address…"
                  onChange={handleAddressChange}
                />
                {(form.city || form.state) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {form.city && (
                      <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5 font-medium">{form.city}</span>
                    )}
                    {form.state && (
                      <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5 font-medium">{form.state}</span>
                    )}
                    {form.pincode && (
                      <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5 font-mono">{form.pincode}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm({ name: "", address: "", city: "", state: "", pincode: "", lat: null, lng: null }); }}
                  className="btn-secondary text-sm"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Branch list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading branches…
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No branches yet. Add one to get started.
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {[...active, ...inactive].map((branch) => {
              const isRenaming = branch.id in renaming;
              const isToggling = toggling[branch.id];
              const isSavingName = savingRename[branch.id];
              return (
                <div key={branch.id} className="py-3 flex items-start gap-3">
                  {/* Icon */}
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${branch.is_active ? "bg-brand-50" : "bg-slate-100"}`}>
                    <GitBranch size={15} className={branch.is_active ? "text-brand-600" : "text-slate-400"} />
                  </div>

                  {/* Name + address */}
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input text-sm py-1 h-8"
                          value={renaming[branch.id]}
                          onChange={(e) =>
                            setRenaming((prev) => ({ ...prev, [branch.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(branch.id);
                            if (e.key === "Escape") cancelRename(branch.id);
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => commitRename(branch.id)}
                          disabled={isSavingName}
                          className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="Save"
                        >
                          {isSavingName ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={() => cancelRename(branch.id)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold ${branch.is_active ? "text-slate-900" : "text-slate-400"}`}>
                          {branch.name}
                        </span>
                        <button
                          onClick={() => startRename(branch)}
                          className="p-0.5 rounded text-slate-300 hover:text-slate-500 transition-colors"
                          title="Rename"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}

                    {(branch.city || branch.address_line1) && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                        <MapPin size={11} />
                        <span className="truncate">
                          {[branch.address_line1, branch.city, branch.state].filter(Boolean).join(", ")}
                          {branch.pincode ? ` – ${branch.pincode}` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Active badge + toggle (admin only) */}
                  {canToggle ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${branch.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {branch.is_active ? "Active" : "Inactive"}
                      </span>
                      <button
                        onClick={() => handleToggle(branch)}
                        disabled={isToggling}
                        className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                        title={branch.is_active ? "Deactivate" : "Activate"}
                      >
                        {isToggling ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : branch.is_active ? (
                          <ToggleRight size={20} className="text-brand-600" />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
