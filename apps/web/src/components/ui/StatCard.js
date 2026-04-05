import { clsx } from "clsx";

const COLORS = {
  default: "bg-slate-100 text-slate-600",
  brand:   "bg-brand-50 text-brand-700",
  green:   "bg-green-50 text-green-700",
  emerald: "bg-emerald-50 text-emerald-700",
  yellow:  "bg-yellow-50 text-yellow-700",
};

export default function StatCard({ label, value, icon, color = "default" }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={clsx("p-3 rounded-lg", COLORS[color])}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
