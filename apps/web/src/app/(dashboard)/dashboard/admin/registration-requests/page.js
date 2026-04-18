"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { ClockIcon, CheckCircleIcon, XCircleIcon, UserIcon, BuildingIcon, Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { formatDate } from "@/lib/format";

const STATUS_BADGE = {
  pending:  { label: "Pending",  className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

export default function RegistrationRequestsPage() {
  const searchParamsHook = useSearchParams();
  const limit = Math.max(1, parseInt(searchParamsHook.get("limit") ?? "10", 10) || 10);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null); // request being reviewed
  const [reviewNotes, setReviewNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const inFlightRef = useRef(false);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/registration-requests");
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to load"); return; }
      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRequests(); }, []);

  function openReview(req) {
    setSelected(req);
    setReviewNotes("");
  }

  function closeReview() {
    setSelected(null);
    setReviewNotes("");
  }

  function handleAction(action) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/registration-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected.id, action, review_notes: reviewNotes }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Action failed"); return; }
        toast.success(action === "approve" ? "Request approved" : "Request rejected");
        closeReview();
        fetchRequests();
      } finally {
        inFlightRef.current = false;
      }
    });
  }

  const byStatus = requests.filter((r) => filter === "all" || r.status === filter);
  const filtered = byStatus.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.full_name?.toLowerCase().includes(q) ||
      r.company_name?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  function handleFilterChange(f) {
    setFilter(f);
    setPage(1);
  }

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Registration Requests</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search requests…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "approved", "rejected"].map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && (
                  <span className="ml-1.5 text-xs opacity-75">
                    ({requests.filter((r) => r.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-12 text-center">
            No {filter !== "all" ? filter : ""} registration requests{search ? " matching your search" : ""}.
          </p>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Applicant</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {paginated.map((req) => {
                  const badge = STATUS_BADGE[req.status];
                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{req.full_name}</div>
                        <div className="text-xs text-slate-400">{req.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{req.company_name}</div>
                        {req.gstin && <div className="text-xs text-slate-400">GSTIN: {req.gstin}</div>}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 hidden sm:table-cell">{req.user_type}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">
                        {[req.city, req.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap hidden md:table-cell">
                        {formatDate(req.created_at, { dateStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        {req.review_notes && (
                          <p className="mt-1 text-xs text-slate-400 max-w-[160px] truncate">{req.review_notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === "pending" ? (
                          <button
                            onClick={() => openReview(req)}
                            className="text-brand-600 text-sm font-medium hover:underline"
                          >
                            Review →
                          </button>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
          </>
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Review Registration Request</h2>

            <div className="rounded-xl border border-surface-border p-4 space-y-2 text-sm">
              <Row icon={<UserIcon size={14} />} label="Applicant" value={selected.full_name} />
              <Row icon={<BuildingIcon size={14} />} label="Company" value={selected.company_name} />
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-slate-400 w-20 shrink-0">Type</span>
                <span className="capitalize font-medium text-slate-800">{selected.user_type}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-slate-400 w-20 shrink-0">Phone</span>
                <span className="font-medium text-slate-800">{selected.phone}</span>
              </div>
              {selected.gstin && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400 w-20 shrink-0">GSTIN</span>
                  <span className="font-medium text-slate-800">{selected.gstin}</span>
                </div>
              )}
              {(selected.city || selected.state) && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400 w-20 shrink-0">Location</span>
                  <span className="font-medium text-slate-800">
                    {[selected.city, selected.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="label" htmlFor="review_notes">Notes (optional)</label>
              <textarea
                id="review_notes"
                className="input resize-none"
                rows={3}
                placeholder="Add a reason for rejection or any notes…"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleAction("approve")}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isPending ? "Processing…" : "Approve"}
              </button>
              <button
                onClick={() => handleAction("reject")}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isPending ? "Processing…" : "Reject"}
              </button>
              <button
                onClick={closeReview}
                disabled={isPending}
                className="px-4 py-2.5 rounded-lg border border-surface-border text-slate-600 hover:bg-slate-50 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400 w-16 shrink-0">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
