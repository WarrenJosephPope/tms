"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CheckCircle2, Navigation } from "lucide-react";

/**
 * Client component — handles trip status updates (mark pickup / mark delivered).
 */
export default function TripActions({ tripId, currentStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function updateStatus(newStatus) {
    const res = await fetch(`/api/trips/${tripId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      toast.error(error ?? "Failed to update status");
      return;
    }
    toast.success(
      newStatus === "in_transit" ? "Pickup confirmed!" : "Delivery confirmed!"
    );
    startTransition(() => router.refresh());
  }

  if (currentStatus === "assigned") {
    return (
      <button
        onClick={() => updateStatus("in_transit")}
        disabled={isPending}
        className="btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        <Navigation size={16} />
        {isPending ? "Updating…" : "Confirm Pickup"}
      </button>
    );
  }

  if (currentStatus === "in_transit") {
    return (
      <button
        onClick={() => updateStatus("delivered")}
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
      >
        <CheckCircle2 size={16} />
        {isPending ? "Updating…" : "Mark Delivered"}
      </button>
    );
  }

  return null;
}
