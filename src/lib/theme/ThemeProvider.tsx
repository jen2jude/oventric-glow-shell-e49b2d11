import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLaunchContext } from "@/hooks/use-launch-context";

type Theme = "dark" | "light";
const KEY = "oventric.theme";

interface Ctx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<Ctx>({ theme: "dark", toggle: () => {}, setTheme: () => {} });

function applyTheme(t: Theme, isApp: boolean) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  // The app shell is intentionally dark. Keep the saved website preference,
  // but never apply the site's light-mode text remapping over dark app cards.
  const activeTheme = isApp ? "dark" : t;
  el.classList.toggle("light", activeTheme === "light");
  el.classList.toggle("dark", activeTheme === "dark");
  el.dataset.theme = activeTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const launchContext = useLaunchContext();
  const isApp = launchContext === "app";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY) as Theme | null;
      const initial: Theme = raw === "light" ? "light" : "dark";
      setThemeState(initial);
      applyTheme(initial, isApp);
    } catch {
      applyTheme("dark", isApp);
    }
  }, [isApp]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t, isApp);
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  };
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
