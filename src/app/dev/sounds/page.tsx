"use client";

import { useState } from "react";
import { bs, renderBattleSound } from "@/lib/cards/battle-audio";
import { renderLegacySound } from "@/lib/cards/sound";
import type { Sfx } from "@/lib/cards/sound";
import type { SkillFx } from "@/lib/cards/skills";

const FX: SkillFx[] = ["slash", "whirl", "pierce", "burst", "rain", "debuff", "fire", "drain", "heal", "shield", "buff", "poison", "quake", "taunt", "ice", "wind", "earth", "beam", "dark"];
const LEGACY: Sfx[] = ["ok", "err", "charge", "burst", "reveal0", "reveal1", "reveal2", "reveal3", "reveal4", "star", "hit", "crit", "cast", "ult", "heal", "shield", "ko", "win", "lose"];
const BATTLE: [string, number, () => void][] = [
  ["b01-klik-knopki", 0.6, () => bs.ui()],
  ["b02-zamah", 0.7, () => bs.swing()],
  ["b03-udar", 1.2, () => bs.hit(false, false)],
  ["b04-silnyi-udar", 1.3, () => bs.hit(false, true)],
  ["b05-krit", 1.8, () => bs.hit(true, true)],
  ["b06-umenie-zaryadka", 1.2, () => bs.cast("burst", false, 0)],
  ["b07-ultimeit-zaryadka", 2.2, () => bs.cast("burst", true, 0)],
  ["b08-ultimeit-S-SS-zaryadka", 2.6, () => bs.cast("burst", true, 2)],
  ["b09-ultimeit-popadanie", 3.6, () => bs.impact("burst", true, true)],
  ["b10-bankai", 6, () => bs.bankai()],
  ["b11-lechenie", 2.6, () => bs.heal()],
  ["b12-shchit", 2.4, () => bs.shield()],
  ["b13-buff", 1.4, () => bs.status(true, true)],
  ["b14-debuff", 1.4, () => bs.status(false, true)],
  ["b15-oglushenie", 1.6, () => bs.stun()],
  ["b16-goreniye", 1.2, () => bs.dot()],
  ["b17-nokaut", 2, () => bs.ko(false)],
  ["b18-nokaut-poslednego", 4, () => bs.ko(true)],
  ["b19-voskreshenie", 3.6, () => bs.revive()],
  ["b20-taktika", 2.6, () => bs.tactic()],
  ["b21-gong-raunda", 4.2, () => bs.round()],
  ["b22-zastavka-boya", 5.2, () => bs.intro()],
  ["b23-razdacha-kart", 2.4, () => bs.deal()],
  ["b24-pobeda", 5.2, () => bs.win()],
  ["b25-porazhenie", 5, () => bs.lose()],
];

function wav(buf: AudioBuffer): ArrayBuffer {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i += 1) for (let c = 0; c < ch; c += 1) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
  return out.buffer;
}
const save = (name: string, buf: AudioBuffer) => fetch(`/api/dev-sound?name=${name}`, { method: "POST", body: wav(buf) });

/** Выгрузка всех звуков в data/_sounds (только для разработки) */
export default function Page() {
  const [log, setLog] = useState("");
  const run = async () => {
    for (const [name, sec, fn] of BATTLE) { setLog(name); await save(name, await renderBattleSound(fn, sec)); }
    for (const f of FX) { setLog(`fx-${f}`); await save(`fx-${f}`, await renderBattleSound(() => bs.impact(f, false, false), 2.4)); }
    for (const n of LEGACY) { setLog(`old-${n}`); await save(`old-${n}`, await renderLegacySound(n, 2.4)); }
    setLog("ГОТОВО");
  };
  return (
    <div style={{ padding: 32, background: "#0a0e22", minHeight: "100vh", color: "#fff", fontFamily: "system-ui" }}>
      <button onClick={() => void run()} style={{ padding: "12px 20px" }}>Отрендерить все звуки</button>
      <p id="log">{log}</p>
    </div>
  );
}
