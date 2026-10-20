import fs from 'node:fs';
const base = 'C:\\Users\\WHITE POWER\\anime-hub\\';

{
  const p = base + 'src\\components\\CatalogFilters.tsx';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    `  const [density, setDensity] = useState<Density>("norm");`,
    `  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "norm";
    try {
      const saved = window.localStorage.getItem(DENSITY_KEY);
      return saved === "big" || saved === "compact" ? saved : "norm";
    } catch {
      return "norm";
    }
  });`,
  );
  s = s.replace(
    `    const next: Density = saved === "big" || saved === "compact" ? saved : "norm";
    setDensity(next);
    document.documentElement.dataset.catDensity = next;`,
    `    document.documentElement.dataset.catDensity = density;`,
  );
  s = s.replace(
    `    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(DENSITY_KEY);
    } catch {
      /* приватный режим — остаёмся на среднем размере */
    }
`,
    "",
  );
  fs.writeFileSync(p, s, 'utf8');
}

{
  const p = base + 'src\\components\\aniswipe\\AniSwipeView.tsx';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    'import { useEffect, useRef, useState } from "react";',
    'import { useEffect, useRef, useState, useSyncExternalStore } from "react";',
  );
  s = s.replace(
    `  const [state, setState] = useState<SwipeState>(EMPTY_STATE);
  const [tab, setTab] = useState<Tab>("swipe");`,
    `  const [state, setState] = useState<SwipeState>(() =>
    typeof window === "undefined" ? EMPTY_STATE : loadState(),
  );
  const [tab, setTab] = useState<Tab>("swipe");`,
  );
  s = s.replace(
    `  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);`,
    `  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );`,
  );
  s = s.replace(
    `  const [hydrated, setHydrated] = useState(false);`,
    "",
  );
  fs.writeFileSync(p, s, 'utf8');
}

{
  const p = base + 'src\\components\\comments\\CommentsBlock.tsx';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    `        let last = 0;
        let match: RegExpExecArray | null;
        TOKEN_RE.lastIndex = 0;
        while ((match = TOKEN_RE.exec(line))) {`,
    `        let last = 0;
        for (const match of line.matchAll(TOKEN_RE)) {`,
  );
  fs.writeFileSync(p, s, 'utf8');
}

console.log('done');
