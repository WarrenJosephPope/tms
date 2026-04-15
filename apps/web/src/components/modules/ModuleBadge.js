import { clsx } from "clsx";

const COLOR = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

/**
 * Tiny pill badge indicating a product module.
 *
 * @param {{ label: string; color?: 'brand'|'green'|'slate'; size?: 'xs'|'sm' }} props
 */
export default function ModuleBadge({ label, color = "slate", size = "xs" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-semibold uppercase tracking-wide rounded-full ring-1",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        COLOR[color] ?? COLOR.slate
      )}
    >
      {label}
    </span>
  );
}
