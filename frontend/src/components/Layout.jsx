import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Menu, X, Hexagon, FlaskConical, Beaker, Gauge, LogOut, Timer, ScanLine, ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import GlobalTimerWatcher from "@/components/GlobalTimerWatcher";
import { MODULE_LIST } from "@/config/modules";
import { useAuth } from "@/context/AuthContext";

const ICONS = {
  khtt: FlaskConical,
  "copper-strip": Beaker,
  "rating-dka": Gauge,
  htcbt: Timer,
  "dka-cec": ScanLine,
  "rust-preventing": ShieldAlert,
};

export const Layout = () => {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="App min-h-screen bg-zinc-950 text-zinc-50">
      <GlobalTimerWatcher />
      <Sidebar />

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 lg:hidden">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-500">
            <Hexagon className="h-5 w-5 text-zinc-950" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-bold">Laboratorium Product Development</span>
        </NavLink>
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-zinc-300 hover:bg-zinc-800"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 lg:hidden">
          {MODULE_LIST.map((m) => {
            const Icon = ICONS[m.slug] || FlaskConical;
            return (
              <NavLink
                key={m.slug}
                to={`/${m.slug}`}
                data-testid={`mobile-nav-${m.slug}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                    isActive ? "bg-zinc-800 text-zinc-50" : "text-zinc-400"
                  }`
                }
              >
                <Icon className="h-4 w-4 text-amber-500" />
                {m.title}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); }}
            data-testid="mobile-logout-button"
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      )}

      <main className="lg:pl-72">
        <Outlet />
      </main>
    </div>
  );
};
