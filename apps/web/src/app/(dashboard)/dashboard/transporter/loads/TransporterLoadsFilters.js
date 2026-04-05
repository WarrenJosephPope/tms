"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const VEHICLE_TYPE_OPTIONS = [
  { value: "", label: "All Vehicles" },
  { value: "closed_container", label: "Closed Container" },
  { value: "open_trailer",     label: "Open Trailer" },
  { value: "flatbed",          label: "Flatbed" },
  { value: "tanker",           label: "Tanker" },
  { value: "refrigerated",     label: "Refrigerated" },
  { value: "mini_truck",       label: "Mini Truck" },
];

export default function TransporterLoadsFilters({ vehicleFilter, originFilter, destFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [origin, setOrigin]   = useState(originFilter ?? "");
  const [dest, setDest]       = useState(destFilter ?? "");
  const [vehicle, setVehicle] = useState(vehicleFilter ?? "");

  const timer = useRef(null);

  function pushParams(o, d, v) {
    const params = new URLSearchParams(searchParams.toString());
    if (o.trim()) params.set("origin", o.trim()); else params.delete("origin");
    if (d.trim()) params.set("dest",   d.trim()); else params.delete("dest");
    if (v)        params.set("vehicle", v);        else params.delete("vehicle");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Debounce text inputs
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => pushParams(origin, dest, vehicle), 350);
    return () => clearTimeout(timer.current);
  }, [origin, dest]);

  // Vehicle type reacts immediately
  function handleVehicle(e) {
    const v = e.target.value;
    setVehicle(v);
    clearTimeout(timer.current);
    pushParams(origin, dest, v);
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative">
        <input
          type="search"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="Origin city…"
          className="input text-sm w-44"
        />
      </div>
      <div className="relative">
        <input
          type="search"
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Destination city…"
          className="input text-sm w-44"
        />
      </div>
      <select value={vehicle} onChange={handleVehicle} className="input text-sm w-48">
        {VEHICLE_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {(origin || dest || vehicle) && (
        <button
          onClick={() => {
            setOrigin(""); setDest(""); setVehicle("");
            clearTimeout(timer.current);
            pushParams("", "", "");
          }}
          className="btn-secondary text-sm px-4"
        >
          Clear
        </button>
      )}
    </div>
  );
}
