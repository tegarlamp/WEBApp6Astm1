import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Gauge, ScanLine, History } from "lucide-react";
import { KhtHeader } from "@/components/kht/ui";

export const DKACEC_TABS = [
  { to: "/dka-cec", label: "Monitor", icon: Gauge, end: true, title: "DKA-CEC L-48-A-00", subtitle: "Oxidation Test · Smart Timer 192 jam" },
  { to: "/dka-cec/new", label: "New Sample", icon: ScanLine, title: "New Sample", subtitle: "OCR Label & Smart Timer" },
  { to: "/dka-cec/history", label: "History", icon: History, title: "History & Runs", subtitle: "Riwayat batch pengujian" },
];

export default function DkacecLayout() {
  const { pathname } = useLocation();
  const active = DKACEC_TABS.find((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to))) || DKACEC_TABS[0];
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950" data-testid="dkacec-module">
      <KhtHeader title={active.title} subtitle={active.subtitle} logo="L48" accent="blue" />
      <nav className="sticky top-0 z-20 flex border-b border-zinc-700 bg-zinc-900/95 backdrop-blur" data-testid="dkacec-tabs">
        {DKACEC_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            data-testid={`dkacec-tab-${t.label.toLowerCase().replace(" ", "-")}`}
            className={({ isActive }) =>
              `relative flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-[11px] font-medium tracking-wider transition-colors ${isActive ? "text-blue-400" : "text-zinc-500 hover:text-zinc-200"}`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label.toUpperCase()}</span>
                <span className={`absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-t bg-blue-500 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:px-6">
        <Outlet />
      </div>
    </div>
  );
}
