"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { UserPlus, ShieldOff, ShieldCheck, X, Loader2, Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";

const ROLES_BY_TYPE = {
  shipper: [
    { value: "account_owner", label: "Account Owner" },
    { value: "operations_manager", label: "Operations Manager" },
    { value: "viewer", label: "Viewer" },
  ],
  transporter: [
    { value: "account_owner", label: "Account Owner" },
    { value: "fleet_manager", label: "Fleet Manager" },
    { value: "driver", label: "Driver" },
  ],
};

function roleLabel(user) {
  return user.shipper_role ?? user.transporter_role ?? user.admin_role ?? "—";
}

function roleLabelFormatted(user) {
  const raw = roleLabel(user);
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CompanyUsersPanel({ companyId, userType }) {
  const searchParams = useSearchParams();
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banningId, setBanningId] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({ full_name: "", phone: "", email: "", role: "" });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/users`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json.users);
    } catch (e) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("User created successfully");
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
      const res = await fetch(`/api/admin/companies/${companyId}/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(action === "ban" ? "User banned" : "User unbanned");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: json.is_active } : u))
      );
    } catch (e) {
      toast.error(e.message || "Failed to update user");
    } finally {
      setBanningId(null);
    }
  }

  const roles = ROLES_BY_TYPE[userType] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Users</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage members of this company.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search users…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-40"
            />
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <UserPlus size={15} />
            {showForm ? "Cancel" : "Add User"}
          </button>
        </div>
      </div>

      {/* Create user form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-slate-50 border border-surface-border rounded-xl p-4 space-y-3"
        >
          <h3 className="font-medium text-slate-800 text-sm">New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <label className="label">Phone *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-surface-border bg-white text-slate-500 text-sm">
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
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : "Create User"}
            </button>
          </div>
        </form>
      )}

      {/* Users list */}
      {loading ? (
        <p className="text-sm text-slate-400 py-6 text-center">Loading users…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          {search ? "No users match your search." : "No users found for this company."}
        </p>
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
              {paginated.map((u) => (
                <tr key={u.id} className="group">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-800">{u.full_name}</div>
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
                        Banned
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
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
                      {u.is_active ? "Ban" : "Unban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
