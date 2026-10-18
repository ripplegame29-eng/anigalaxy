import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const mine = new Set();
// классы из моего CSS
const css = readFileSync("src/app/releases/releases.css", "utf8");
for (const m of css.matchAll(/\.([a-z][\w-]*)/gi)) mine.add(m[1]);

// классы сайта: из tsx и из globals.css
const site = new Set();
const files = globSync("src/**/*.{tsx,ts,css}");
for (const f of files) {
  if (f.includes("releases")) continue;
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/className=\{?["`]([^"`]+)["`]/g)) {
    for (const c of m[1].split(/\s+/)) {
      const cl = c.trim();
      if (/^[a-z][\w-]*$/i.test(cl)) site.add(cl);
    }
  }
  for (const m of t.matchAll(/\.([a-z][\w-]*)\s*[,{]/gi)) site.add(m[1]);
}

const clash = [...mine].filter((c) => site.has(c)).sort();
console.log("классов в моём CSS:", mine.size);
console.log("совпадений с сайтом:", clash.length);
console.log(clash.join(", "));
