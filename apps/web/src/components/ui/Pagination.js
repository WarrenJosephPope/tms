"use client";

import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Unified pagination component.
 *
 * Link-mode  (server-rendered pages): omit `onPage` — builds URL links using
 *            the current pathname + searchParams, updating only the "page" param.
 * Button-mode (client components):   pass `onPage` callback.
 */
export default function Pagination({ page, totalPages, onPage }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  if (totalPages <= 1) return null;

  function buildHref(p) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `${pathname}?${params}`;
  }

  const pages = buildPageList(page, totalPages);

  function renderPage(p) {
    const isActive = p === page;
    const cls = `min-w-[32px] h-8 px-1 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;
    if (onPage) {
      return (
        <button key={p} onClick={() => onPage(p)} disabled={isActive} className={cls}>
          {p}
        </button>
      );
    }
    return (
      <Link key={p} href={buildHref(p)} className={cls}>
        {p}
      </Link>
    );
  }

  function renderNav(targetPage, icon, disabled) {
    const cls = `h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 transition-colors ${
      disabled ? "opacity-30 pointer-events-none" : "hover:bg-slate-100"
    }`;
    if (onPage) {
      return (
        <button onClick={() => onPage(targetPage)} disabled={disabled} className={cls}>
          {icon}
        </button>
      );
    }
    if (disabled) return <span className={cls}>{icon}</span>;
    return <Link href={buildHref(targetPage)} className={cls}>{icon}</Link>;
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4 pb-2">
      {renderNav(page - 1, <ChevronLeft size={14} />, page <= 1)}
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`el-${i}`} className="min-w-[32px] h-8 flex items-center justify-center text-slate-400 text-xs">
            …
          </span>
        ) : (
          renderPage(p)
        )
      )}
      {renderNav(page + 1, <ChevronRight size={14} />, page >= totalPages)}
    </div>
  );
}

function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current]);
  for (let d = -2; d <= 2; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = Array.from(set).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}
