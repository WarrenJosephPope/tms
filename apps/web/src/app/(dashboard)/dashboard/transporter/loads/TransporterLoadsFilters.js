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

const MY_STATUS_OPTIONS = [
  { value: "",           label: "Open Market" },
  { value: "bidding",    label: "My Active Bids" },
  { value: "won",        label: "Won" },
  { value: "lost",       label: "Lost" },
  { value: "in_transit", label: "In Transit" },
];

export default function TransporterLoadsFilters({ vehicleFilter, originFilter, destFilter, myStatus: myStatusProp }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [origin, setOrigin]     = useState(originFilter ?? "");
  const [dest, setDest]         = useState(destFilter ?? "");
  const [vehicle, setVehicle]   = useState(vehicleFilter ?? "");
  const [myStatus, setMyStatus] = useState(myStatusProp ?? "");

  const timer = useRef(null);
  const isMounted = useRef(false);

  function pushParams(o, d, v, ms) {
    const params = new URLSearchParams(searchParams.toString());
    if (o.trim()) params.set("origin",   o.trim()); else params.delete("origin");
    if (d.trim()) params.set("dest",     d.trim()); else params.delete("dest");
    if (v)        params.set("vehicle",  v);         else params.delete("vehicle");
    if (ms)       params.set("myStatus", ms);        else params.delete("myStatus");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Debounce text inputs — skip the initial mount to avoid a spurious navigation
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => pushParams(origin, dest, vehicle, myStatus), 350);
    return () => clearTimeout(timer.current);
  }, [origin, dest]);

  // Selects react immediately
  function handleVehicle(e) {
    const v = e.target.value;
    setVehicle(v);
    clearTimeout(timer.current);
    pushParams(origin, dest, v, myStatus);
  }

  function handleMyStatus(e) {
    const ms = e.target.value;
    setMyStatus(ms);
    clearTimeout(timer.current);
    pushParams(origin, dest, vehicle, ms);
  }

  const hasFilters = origin || dest || vehicle || myStatus;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select value={myStatus} onChange={handleMyStatus} className="input text-sm w-44">
        {MY_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
      {hasFilters && (
        <button
          onClick={() => {
            setOrigin(""); setDest(""); setVehicle(""); setMyStatus("");
            clearTimeout(timer.current);
            pushParams("", "", "", "");
          }}
          className="btn-secondary text-sm px-4"
        >
          Clear
        </button>
      )}
    </div>
  );
}
