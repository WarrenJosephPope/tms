"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";

// ─── Commodity Types Section ───────────────────────────────────────────────

function CommodityTypesManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalog/commodity-types");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.commodityTypes);
    } catch (e) {
      toast.error(e.message || "Failed to load commodity types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/catalog/commodity-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      toast.success("Commodity type added");
    } catch (e) {
      toast.error(e.message || "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(item) {
    try {
      const res = await fetch(`/api/admin/catalog/commodity-types/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
    } catch (e) {
      toast.error(e.message || "Failed to update");
    }
  }

  async function handleSaveEdit(item) {
    if (!editName.trim() || editName.trim() === item.name) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/catalog/commodity-types/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? data : i)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      toast.success("Updated");
    } catch (e) {
      toast.error(e.message || "Failed to update");
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This will remove it from company allotments too.`)) return;
    try {
      const res = await fetch(`/api/admin/catalog/commodity-types/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e.message || "Failed to delete");
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Commodity Types</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Types shippers can select when posting a load.
          </p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
          {items.filter((i) => i.is_active).length} active
        </span>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="e.g. FMCG Goods, Steel Coils, Chemicals…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={adding}
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"
        >
          <Plus size={14} />
          Add
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No commodity types yet.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              {editingId === item.id ? (
                <>
                  <input
                    className="input flex-1 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(item);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(item)}
                    className="p-1.5 rounded text-green-600 hover:bg-green-50"
                    title="Save"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded text-slate-400 hover:bg-slate-100"
                    title="Cancel"
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`flex-1 text-sm ${item.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}
                  >
                    {item.name}
                  </span>
                  <button
                    onClick={() => handleToggle(item)}
                    className={`p-1.5 rounded ${item.is_active ? "text-brand-600 hover:bg-brand-50" : "text-slate-400 hover:bg-slate-100"}`}
                    title={item.is_active ? "Deactivate" : "Activate"}
                  >
                    {item.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditingId(item.id); setEditName(item.name); }}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Edit name"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Vehicle Types Section ─────────────────────────────────────────────────

function VehicleTypesManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalog/vehicle-types");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.vehicleTypes);
    } catch (e) {
      toast.error(e.message || "Failed to load vehicle types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleToggle(item) {
    try {
      const res = await fetch(`/api/admin/catalog/vehicle-types/${item.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => prev.map((i) => (i.key === item.key ? data : i)));
    } catch (e) {
      toast.error(e.message || "Failed to update");
    }
  }

  async function handleSaveEdit(item) {
    if (!editLabel.trim() || editLabel.trim() === item.label) {
      setEditingKey(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/catalog/vehicle-types/${item.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) =>
        prev.map((i) => (i.key === item.key ? data : i)).sort((a, b) => a.label.localeCompare(b.label))
      );
      setEditingKey(null);
      toast.success("Label updated");
    } catch (e) {
      toast.error(e.message || "Failed to update");
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Vehicle Types</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Toggle visibility and customise display labels. Keys are fixed to match DB enum values.
          </p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
          {items.filter((i) => i.is_active).length} active
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-2.5">
              <code className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded w-36 shrink-0">
                {item.key}
              </code>
              {editingKey === item.key ? (
                <>
                  <input
                    className="input flex-1 py-1 text-sm"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(item);
                      if (e.key === "Escape") setEditingKey(null);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(item)}
                    className="p-1.5 rounded text-green-600 hover:bg-green-50"
                    title="Save"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="p-1.5 rounded text-slate-400 hover:bg-slate-100"
                    title="Cancel"
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`flex-1 text-sm ${item.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}
                  >
                    {item.label}
                  </span>
                  <button
                    onClick={() => handleToggle(item)}
                    className={`p-1.5 rounded ${item.is_active ? "text-brand-600 hover:bg-brand-50" : "text-slate-400 hover:bg-slate-100"}`}
                    title={item.is_active ? "Deactivate" : "Activate"}
                  >
                    {item.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditingKey(item.key); setEditLabel(item.label); }}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Edit label"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Type Catalog</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage the global list of commodity and vehicle types. Use the Companies page to allot
          specific types to each company.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CommodityTypesManager />
        <VehicleTypesManager />
      </div>
    </div>
  );
}
