import test from "node:test";
import assert from "node:assert/strict";
import { mergeVoices, voiceKey, pickDefaultVoice } from "../../.tsc-tests/lib/voice-merge.js";

const k = (id, title, n = 12) => ({ id, title, type: "voice", mediaId: "serial-1", episodeCount: n });
const c = (name) => ({ id: -10000 - name.length, title: `CVH · ${name}`, type: "voice", mediaId: "", provider: "cvh", studio: name, episodeCount: 12 });

test("ключ студии одинаков у разных написаний", () => {
  assert.equal(voiceKey("AniLibria.TV"), voiceKey("AnilibriaTV"));
  assert.equal(voiceKey("AniLiberty · FHD"), voiceKey("AniLibria.TV"));
  assert.equal(voiceKey("AniDub"), voiceKey("AniDub Online"));
  assert.equal(voiceKey("SHIZA Project"), voiceKey("Shiza Project"));
  assert.notEqual(voiceKey("AniDub"), voiceKey("AniLibria.TV"));
});

test("повтор студии: остаётся 1080p, Kodik уходит в запасные", () => {
  const list = mergeVoices([k(1, "AniDub"), k(2, "Dream Cast"), k(3, "Субтитры")], [c("AniDub Online"), c("Shiza")]);
  assert.equal(list.length, 4);
  const anidub = list.find((o) => o.studio === "AniDub Online");
  assert.equal(anidub.quality, 1080);
  assert.equal(anidub.title, "AniDub Online");
  assert.equal(anidub.fallbacks[0].id, 1);
  // 1080p выше 720p
  assert.ok(list.findIndex((o) => o.quality === 720) > list.findLastIndex((o) => o.quality === 1080));
  // уникальные студии Kodik добавляются
  assert.ok(list.some((o) => o.title === "Dream Cast" && o.quality === 720));
});

test("озвучка по умолчанию: та же студия в 1080p, иначе первая 1080p", () => {
  const list = mergeVoices([k(1, "AniDub")], [c("Shiza"), c("AniDub Online")]);
  assert.equal(pickDefaultVoice(list, "AniDub").studio, "AniDub Online");
  assert.equal(pickDefaultVoice(list, "Неизвестная").quality, 1080);
});
