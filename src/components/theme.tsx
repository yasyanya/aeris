"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

// Light is the default. Dark mode is only used when the visitor chooses it (saved per browser).
type Theme = "light" | "dark";
const KEY = "aeris-theme";

/** Runs before paint (inlined in <head>) so a saved dark choice never flashes light. */
export const THEME_SCRIPT = `try{if(localStorage.getItem("${KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(t: Theme) {
  if (t === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try {
    if (t === "dark") localStorage.setItem(KEY, "dark");
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event("aeris-theme"));
}

export function ThemeToggle({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    // Sync with what the head script applied (external storage → state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readTheme() === "dark") setTheme("dark");
  }, []);
  const Icon = theme === "dark" ? Moon : Sun;
  const label = theme === "dark" ? "Dark" : "Light";
  return (
    <button
      type="button"
      onClick={() => {
        const t: Theme = theme === "dark" ? "light" : "dark";
        setTheme(t);
        applyTheme(t);
      }}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] text-ink-2 hover:text-ink ${className}`}
      aria-label={`${label} mode. Switch to ${theme === "dark" ? "light" : "dark"} mode.`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <Icon className={iconOnly ? "size-[18px] shrink-0" : "size-4 shrink-0"} />
      {!iconOnly && label}
    </button>
  );
}

function subscribe(cb: () => void) {
  window.addEventListener("aeris-theme", cb);
  return () => window.removeEventListener("aeris-theme", cb);
}
const isDarkNow = () => document.documentElement.dataset.theme === "dark";

/** True when the page is currently in dark mode (used to pick map tiles). */
export function useIsDark() {
  return useSyncExternalStore(subscribe, isDarkNow, () => false);
}
