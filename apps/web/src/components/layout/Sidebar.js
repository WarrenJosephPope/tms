"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Gavel,
  MapPin,
  Truck,
  Users,
  FileText,
  Settings,
  ShieldCheck,
  BarChart3,
  ChevronRight,
  Layers,
  X,
} from "lucide-react";
import { clsx } from "clsx";

const NAV_SHIPPER = [
  { label: "Dashboard", href: "/dashboard/shipper", icon: LayoutDashboard },
  { label: "My Loads", href: "/dashboard/shipper/loads", icon: Package },
  { label: "Post a Load", href: "/dashboard/shipper/loads/new", icon: Gavel },
  { label: "Tracking", href: "/dashboard/shipper/tracking", icon: MapPin },
  { label: "Branches", href: "/dashboard/shipper/branches", icon: Layers, ownerOnly: true },
  { label: "Team", href: "/dashboard/shipper/team", icon: Users, ownerOnly: true },
  { label: "Analytics", href: "/dashboard/shipper/analytics", icon: BarChart3 },
];

const NAV_TRANSPORTER = [
  { label: "Dashboard", href: "/dashboard/transporter", icon: LayoutDashboard },
  { label: "Load Market", href: "/dashboard/transporter/loads", icon: Package },
  { label: "My Bids", href: "/dashboard/transporter/bids", icon: Gavel },
  { label: "Active Trips", href: "/dashboard/transporter/trips", icon: MapPin },
  { label: "Fleet", href: "/dashboard/transporter/fleet", icon: Truck },
  { label: "Drivers", href: "/dashboard/transporter/drivers", icon: Users },
  { label: "Team", href: "/dashboard/transporter/team", icon: Users, ownerOnly: true },
  { label: "Documents", href: "/dashboard/transporter/documents", icon: FileText },
];

const NAV_ADMIN = [
  { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { label: "Companies", href: "/dashboard/admin/companies", icon: ShieldCheck },
  { label: "Type Catalog", href: "/dashboard/admin/catalog", icon: Layers },
  { label: "All Loads", href: "/dashboard/admin/loads", icon: Package },
  { label: "All Trips", href: "/dashboard/admin/trips", icon: Truck },
  { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
  { label: "Config", href: "/dashboard/admin/config", icon: Settings },
];

const NAV_BY_TYPE = {
  shipper: NAV_SHIPPER,
  transporter: NAV_TRANSPORTER,
  admin: NAV_ADMIN,
};

export default function Sidebar({ profile, isOpen, onClose }) {
  const pathname = usePathname();
  const allNav = NAV_BY_TYPE[profile.user_type] ?? [];

  // Determine if the user is an account_owner
  const isAccountOwner =
    profile.shipper_role === "account_owner" ||
    profile.transporter_role === "account_owner";

  // Filter out ownerOnly items for non-owners
  const nav = allNav.filter((item) => !item.ownerOnly || isAccountOwner);

  // Find the most specific nav item that matches the current path (longest prefix wins).
  // This prevents parent routes like /dashboard/admin from staying highlighted on sub-pages.
  const activeHref = nav.reduce((best, item) => {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.length) return item.href;
    }
    return best;
  }, null);

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col bg-white border-r border-surface-border h-full transition-transform duration-200 ease-in-out",
        "md:relative md:translate-x-0 md:w-60",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-surface-border">
        <Image
          src="/logo.png"
          alt="Tracking Management System"
          width={140}
          height={36}
          className="object-contain"
          priority
        />
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Company chip */}
      <div className="px-4 py-3 border-b border-surface-border">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
          {profile.user_type}
        </p>
        <p className="text-sm font-semibold text-slate-800 truncate">
          {profile.company?.name ?? "—"}
        </p>
        <p className="text-xs text-slate-400 truncate">{profile.full_name}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(({ label, href, icon: Icon, ownerOnly: _ }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-brand-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom settings link */}
      <div className="p-3 border-t border-surface-border">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
