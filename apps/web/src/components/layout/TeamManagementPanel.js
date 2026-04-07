"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { UserPlus, ShieldOff, ShieldCheck, Loader2, Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";

const ALLOWED_ROLES = {
  shipper: [
    { value: "operations_manager", label: "Operations Manager" },
    { value: "viewer", label: "Viewer" },
  ],
  transporter: [
    { value: "fleet_manager", label: "Fleet Manager" },
    { value: "driver", label: "Driver" },
  ],
};

function roleLabelFormatted(user) {
  const raw = user.shipper_role ?? user.transporter_role ?? "—";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TeamManagementPanel({ userType }) {
  const searchParams = useSearchParams();
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banningId, setBanningId] = useState(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", role: "" });

  const [search, setSearch]           = useState("");
  const [roleFilter, setRoleFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]               = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json.users);
    } catch (e) {
      toast.error(e.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const allRoles = ALLOWED_ROLES[userType] ?? [];

  const filtered = users.filter((u) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !u.full_name?.toLowerCase().includes(q) &&
        !u.phone?.toLowerCase().includes(q) &&
        !u.email?.toLowerCase().includes(q)
      ) return false;
    }
    if (roleFilter) {
      const raw = u.shipper_role ?? u.transporter_role ?? "";
      if (raw !== roleFilter) return false;
    }
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "suspended" && u.is_active) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated  = filtered.slice((page - 1) * limit, page * limit);

  function handleFilter(setter) {
    return (val) => { setter(val); setPage(1); };
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/company/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Team member added");
      setShowForm(false);
      setForm({ full_name: "", phone: "", email: "", role: "" });
      await fetchUsers();
    } catch (e) {
      toast.error(e.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBanToggle(user) {
    const action = user.is_active ? "ban" : "unban";
    setBanningId(user.id);
    try {
      const res = await fetch(`/api/company/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(action === "ban" ? "User suspended" : "User reinstated");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: json.is_active } : u))
      );
    } catch (e) {
      toast.error(e.message || "Failed to update user");
    } finally {
      setBanningId(null);
    }
  }

  const roles = ALLOWED_ROLES[userType] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your company&apos;s users and access.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={16} />
          {showForm ? "Cancel" : "Add Team Member"}
        </button>
      </div>

      {/* Create user form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="card space-y-4"
        >
          <h2 className="font-semibold text-slate-900">New Team Member</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input
                className="input"
                placeholder="Rajesh Kumar"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Mobile Number *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-surface-border bg-slate-50 text-slate-500 text-sm">
                  +91
                </span>
                <input
                  className="input rounded-l-none"
                  placeholder="9876543210"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input
                className="input"
                type="email"
                placeholder="rajesh@company.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Role *</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                required
              >
                <option value="">— Select role —</option>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ full_name: "", phone: "", email: "", role: "" }); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : "Add Member"}
            </button>
          </div>
        </form>
      )}

      {/* Team list */}
      <div className="card space-y-4">
        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, phone…"
              className="pl-8 pr-3 py-1.5 w-full rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: "", label: "All Roles" }, ...allRoles, { value: "account_owner", label: "Owner" }].map((r) => (
              <button
                key={r.value || "all"}
                onClick={() => handleFilter(setRoleFilter)(r.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  roleFilter === r.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[{ value: "", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }].map((s) => (
              <button
                key={s.value || "all-status"}
                onClick={() => handleFilter(setStatusFilter)(s.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading team…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">{users.length === 0 ? "No team members yet. Add your first member above." : "No members match your filters."}</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Phone</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {paginated.map((u) => {
                  const isOwner =
                    u.shipper_role === "account_owner" ||
                    u.transporter_role === "account_owner";
                  return (
                    <tr key={u.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">
                          {u.full_name}
                          {isOwner && (
                            <span className="ml-2 text-xs bg-brand-50 text-brand-600 rounded-full px-2 py-0.5">
                              You
                            </span>
                          )}
                        </div>
                        {u.email && <div className="text-xs text-slate-400">{u.email}</div>}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{u.phone}</td>
                      <td className="py-3 pr-4">
                        <span className="capitalize text-slate-600">{roleLabelFormatted(u)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        {u.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {!isOwner && (
                          <button
                            onClick={() => handleBanToggle(u)}
                            disabled={banningId === u.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                              u.is_active
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}
                          >
                            {banningId === u.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : u.is_active ? (
                              <ShieldOff size={12} />
                            ) : (
                              <ShieldCheck size={12} />
                            )}
                            {u.is_active ? "Suspend" : "Reinstate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
