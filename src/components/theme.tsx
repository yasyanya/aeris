"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const KEY = "aeris-theme";

/** Runs before paint (inlined in <head>) so the saved theme never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  window.dispatchEvent(new Event("aeris-theme"));
}

export function ThemeToggle({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    // Sync with what the head script applied (external storage → state).
    const t = readTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t !== "system") setTheme(t);
  }, []);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Auto";
  return (
    <button
      type="button"
      onClick={() => {
        const t = next[theme];
        setTheme(t);
        applyTheme(t);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 h-9 text-[13px] text-ink-2 hover:text-ink ${className}`}
      aria-label={`Theme: ${label}. Click to change.`}
      title="Change theme"
    >
      <Icon className="size-4" /> {!iconOnly && label}
    </button>
  );
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("aeris-theme", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("aeris-theme", cb);
  };
}
function isDarkNow() {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return true;
  if (forced === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** True when the page is currently rendered in dark mode (used to pick map tiles). */
export function useIsDark() {
  return useSyncExternalStore(subscribe, isDarkNow, () => false);
}
