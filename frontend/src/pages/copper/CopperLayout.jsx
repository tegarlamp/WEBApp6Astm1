import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Gauge, PlusCircle, History, TrendingUp } from "lucide-react";
import { KhtHeader } from "@/components/kht/ui";

export const COPPER_TABS = [
  { to: "/copper-strip", label: "Dashboard", icon: Gauge, end: true, title: "Copper Strip ASTM D130", subtitle: "Copper Strip Corrosion" },
  { to: "/copper-strip/new", label: "New Test", icon: PlusCircle, title: "New Test", subtitle: "Copper Strip AI Vision" },
  { to: "/copper-strip/history", label: "History", icon: History, title: "History & Data", subtitle: "Corrosion records" },
  { to: "/copper-strip/trend", label: "Trend", icon: TrendingUp, title: "Chart & Trend", subtitle: "Severity per sampel" },
];

export default function CopperLayout() {
  const { pathname } = useLocation();
  const active = COPPER_TABS.find((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to))) || COPPER_TABS[0];
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950" data-testid="copper-module">
      <KhtHeader title={active.title} subtitle={active.subtitle} logo="CU" accent="amber" />
      <nav className="sticky top-0 z-20 flex border-b border-zinc-700 bg-zinc-900/95 backdrop-blur" data-testid="copper-tabs">
        {COPPER_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            data-testid={`copper-tab-${t.label.toLowerCase().replace(" ", "-")}`}
            className={({ isActive }) =>
              `relative flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-[11px] font-medium tracking-wider transition-colors ${isActive ? "text-amber-400" : "text-zinc-500 hover:text-zinc-200"}`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label.toUpperCase()}</span>
                <span className={`absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-t bg-amber-500 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
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
