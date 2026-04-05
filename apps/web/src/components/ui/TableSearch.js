"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * Generic debounced search input.
 * Updates the "search" URL param (or a custom param via `paramName`)
 * and resets "page" to 1 on every new search.
 */
export default function TableSearch({ placeholder = "Search…", paramName = "search", className }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get(paramName) ?? "");
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(paramName, value.trim());
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [value]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
      />
    </div>
  );
}
