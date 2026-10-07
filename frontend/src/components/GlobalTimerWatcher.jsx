import React, { useEffect } from "react";
import { API } from "@/lib/api";
import { remainingSeconds } from "@/lib/htcbt/api";
import {
  requestNotifyPermission,
  unlockAudio,
  notifyTimerDoneOnce,
} from "@/lib/notify";

// Modules that own a running countdown timer. Add future timer modules here.
const TIMER_MODULES = [
  { key: "htcbt", label: "HTCBT", url: `${API}/htcbt/active` },
  { key: "dkacec", label: "DKA-CEC", url: `${API}/dkacec/active` },
];

const POLL_MS = 15000;

// Background watcher that lives inside the authenticated layout, so it keeps
// polling every timer module regardless of which page/module the user is on.
// When any active run's countdown reaches zero it fires the alarm + browser
// notification exactly once per run (de-duped via localStorage, shared with the
// on-page Monitor timers).
export default function GlobalTimerWatcher() {
  useEffect(() => {
    requestNotifyPermission();

    // The alarm uses Web Audio, which browsers only allow after a user gesture.
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    let cancelled = false;

    async function checkModule(mod) {
      try {
        const res = await fetch(mod.url);
        if (!res.ok) return;
        const data = await res.json();
        const run = data?.active;
        if (!run || !run.finish_at) return;
        if (remainingSeconds(run.finish_at) <= 0) {
          const hrs = Math.round(run.duration_hours || 0);
          const temp = Math.round(run.temperature_c || 0);
          notifyTimerDoneOnce(
            `${mod.key}:${run.id}`,
            `${mod.label} SELESAI \u2014 Timer 0 jam`,
            `Pengujian ${hrs} jam @ ${temp}\u00b0C telah selesai. Segera konfirmasi batch.`,
          );
        }
      } catch {
        /* transient network error, retry next tick */
      }
    }

    async function poll() {
      if (cancelled) return;
      await Promise.all(TIMER_MODULES.map(checkModule));
    }

    poll();
    const id = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
