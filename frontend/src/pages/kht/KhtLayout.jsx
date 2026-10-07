import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Gauge, PlusCircle, History, TrendingUp } from "lucide-react";
import { KhtHeader } from "@/components/kht/ui";

export const KHT_TABS = [
  { to: "/khtt", label: "Dashboard", icon: Gauge, end: true, title: "K-HTT ANALYST", subtitle: "Komatsu Hot Tube Tester" },
  { to: "/khtt/new", label: "New Test", icon: PlusCircle, title: "New Test", subtitle: "AI Vision analysis" },
  { to: "/khtt/history", label: "History", icon: History, title: "History & Data", subtitle: "Test records" },
  { to: "/khtt/trend", label: "Trend", icon: TrendingUp, title: "Chart & Trend", subtitle: "Rating history" },
];

export default function KhtLayout() {
  const { pathname } = useLocation();
  const active = KHT_TABS.find((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to))) || KHT_TABS[0];
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950" data-testid="kht-module">
      <KhtHeader title={active.title} subtitle={active.subtitle} />
      <nav className="sticky top-0 z-20 flex border-b border-zinc-700 bg-zinc-900/95 backdrop-blur" data-testid="kht-tabs">
        {KHT_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            data-testid={`kht-tab-${t.label.toLowerCase().replace(" ", "-")}`}
            className={({ isActive }) =>
              `relative flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-[11px] font-medium tracking-wider transition-colors ${
                isActive ? "text-amber-500" : "text-zinc-500 hover:text-zinc-200"
              }`
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
