/* Рамки карточек AniGalaxy: SVG-орнамент каждого ранга (C, B, A, S, SS) строкой.
   Цвета берутся из CSS-переменных --m1..m4, --gem, --gem2, --glow на .gc-<rank>. */
/* eslint-disable */
interface T { n: number; v?: string }

function defs(u: string, t: T): string {
  return '' +
  '<linearGradient id="metalG'+u+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--m3)"/><stop offset=".5" style="stop-color:var(--m2)"/><stop offset="1" style="stop-color:var(--m1)"/></linearGradient>' +
  '<linearGradient id="metalH'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--m3)"/><stop offset=".45" style="stop-color:var(--m4)"/><stop offset=".55" style="stop-color:var(--m2)"/><stop offset="1" style="stop-color:var(--m1)"/></linearGradient>' +
  '<radialGradient id="gemG'+u+'" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".3" style="stop-color:var(--gem)"/><stop offset="1" style="stop-color:var(--gem2)"/></radialGradient>' +
  '<pattern id="lat'+u+'" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H20M0 0V20" stroke="rgba(0,0,0,.5)" stroke-width="1.6" fill="none"/><path d="M10 0V20M0 10H20" stroke="rgba(255,255,255,.4)" stroke-width="1" fill="none"/></pattern>' +
  '<linearGradient id="bandH'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--m2)"/><stop offset=".2" style="stop-color:var(--m3)"/><stop offset=".55" style="stop-color:var(--m4)"/><stop offset="1" style="stop-color:var(--m2)"/></linearGradient>' +
  '<linearGradient id="bandV'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--m2)"/><stop offset=".2" style="stop-color:var(--m3)"/><stop offset=".55" style="stop-color:var(--m4)"/><stop offset="1" style="stop-color:var(--m2)"/></linearGradient>' +
  '<pattern id="vineH'+u+'" width="44" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 C11 1 33 23 44 12" fill="none" stroke="rgba(0,0,0,.7)" stroke-width="5"/><path d="M0 11.5 C11 .5 33 22.5 44 11.5" fill="none" style="stroke:var(--m1)" stroke-width="2.4"/><ellipse cx="22" cy="12" rx="6.5" ry="3.4" transform="rotate(-20 22 12)" style="fill:var(--gem)" stroke="rgba(0,0,0,.6)" stroke-width=".8"/></pattern>' +
  '<pattern id="vineV'+u+'" width="24" height="44" patternUnits="userSpaceOnUse"><path d="M12 0 C1 11 23 33 12 44" fill="none" stroke="rgba(0,0,0,.7)" stroke-width="5"/><path d="M11.5 0 C.5 11 22.5 33 11.5 44" fill="none" style="stroke:var(--m1)" stroke-width="2.4"/><ellipse cx="12" cy="22" rx="3.4" ry="6.5" transform="rotate(20 12 22)" style="fill:var(--gem)" stroke="rgba(0,0,0,.6)" stroke-width=".8"/></pattern>' +
  '<filter id="soft'+u+'" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="4"/></filter>' +
  '<path id="orbit'+u+'" d="M64 30 H936 A34 34 0 0 1 970 64 V1398 A34 34 0 0 1 936 1432 H64 A34 34 0 0 1 30 1398 V64 A34 34 0 0 1 64 30Z"/>' +
  '<g id="spark'+u+'"><path d="M0 -16 Q1.5 -1.5 16 0 Q1.5 1.5 0 16 Q-1.5 1.5 -16 0 Q-1.5 -1.5 0 -16Z" fill="#fff"/></g>' +
  '<g id="gemShape'+u+'">' +
    '<path d="M0 -40 L7 -13 L36 0 L7 13 L0 40 L-7 13 L-36 0 L-7 -13Z" fill="url(#metalG'+u+')" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/>' +
    '<circle r="25" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.6)" stroke-width="2"/>' +
    '<circle r="21" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2" stroke-dasharray="1 4.2" stroke-linecap="round"/>' +
    '<circle class="gem" r="15" fill="url(#gemG'+u+')" stroke="rgba(0,0,0,.55)" stroke-width="1.5"/>' +
    '<ellipse cx="-5" cy="-6" rx="5.5" ry="3.2" fill="#fff" opacity=".9" transform="rotate(-35 -5 -6)"/>' +
    '<use class="spk" href="#spark'+u+'" x="6" y="6" transform="scale(.7)"/>' +
  '</g>' +
  '<g id="stud'+u+'"><path d="M0 -17 L10 0 L0 17 L-10 0Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.6)" stroke-width="1.6"/><circle r="4.6" fill="url(#gemG'+u+')" stroke="rgba(0,0,0,.5)" stroke-width="1"/></g>' +
  '<g id="cornerTL'+u+'">' +
    '<path d="M64 232 L64 98 Q64 64 98 64 L232 64" fill="none" stroke="rgba(0,0,0,.75)" stroke-width="13" stroke-linecap="round"/>' +
    '<path d="M64 232 L64 98 Q64 64 98 64 L232 64" fill="none" stroke="url(#metalG'+u+')" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M62.5 230 L62.5 97 Q62.5 62.5 97 62.5 L230 62.5" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M80 176 L80 108 Q80 80 108 80 L176 80" fill="none" stroke="var(--m4)" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>' +
    '<path d="M92 74 L110 92 L92 110 L74 92Z" fill="rgba(0,0,0,.4)" style="stroke:var(--m4)" stroke-width="1.6"/>' +
    '<circle cx="92" cy="92" r="4.6" fill="url(#gemG'+u+')" stroke="rgba(0,0,0,.55)" stroke-width="1"/>' +
    (t.n >= 2 ? '<circle cx="64" cy="244" r="9" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.7)" stroke-width="2"/><circle cx="64" cy="244" r="3.6" style="fill:var(--gem)"/><circle cx="244" cy="64" r="9" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.7)" stroke-width="2"/><circle cx="244" cy="64" r="3.6" style="fill:var(--gem)"/>' : '') +
  '</g>' +
  '<g id="wing'+u+'">' +
    '<path d="M352 18 C300 -2 220 -2 110 22 C205 24 285 32 348 46Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.65)" stroke-width="2"/>' +
    '<path d="M346 36 C300 24 232 24 140 44 C222 42 288 50 342 62Z" fill="url(#metalG'+u+')" stroke="rgba(0,0,0,.6)" stroke-width="1.8"/>' +
    '<path d="M340 52 C300 44 250 44 188 58 C246 58 296 64 336 74Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.55)" stroke-width="1.6"/>' +
    '<path d="M340 22 C290 10 220 12 140 28" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.4"/>' +
  '</g>';
}

function G(u: string, x: number, y: number, sc: number): string { return '<g transform="translate('+x+' '+y+') scale('+sc+')"><use href="#gemShape'+u+'"/></g>'; }
function ssExtra(u: string, v?: string): string {
  let x = '';
  x += '<path d="M424 12 Q500 -30 576 12 L548 30 Q500 6 452 30Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.7)" stroke-width="2.2"/>' + G(u,500,2,1.0);
  x += '<path d="M424 1450 Q500 1492 576 1450 L548 1432 Q500 1456 452 1432Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.7)" stroke-width="2.2"/>';
  x += G(u,40,40,.8)+G(u,960,40,.8)+G(u,40,1422,.8)+G(u,960,1422,.8);
  x += '<use href="#stud'+u+'" x="22" y="400"/><use href="#stud'+u+'" x="978" y="400"/><use href="#stud'+u+'" x="22" y="1062"/><use href="#stud'+u+'" x="978" y="1062"/>';
  return x;
}

function ornaments(u: string, t: T): string {
  const n = t.n; let x = '';
  x += '<defs>' + defs(u, t) + '</defs>';
  /* кромка (у всех) */
  x += '<rect x="2" y="2" width="996" height="1458" rx="52" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="3"/>' +
       '<rect x="6.5" y="6.5" width="987" height="1449" rx="48" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>' +
       '<rect x="10" y="10" width="980" height="1442" rx="46" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>' +
       '<rect x="36" y="36" width="928" height="1390" rx="30" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2.4"/>' +
       '<rect x="38.5" y="38.5" width="923" height="1385" rx="28" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.4"/>' +
       '<rect x="58.5" y="58.5" width="883" height="1345" rx="14" fill="none" stroke="rgba(0,0,0,.75)" stroke-width="3"/>' +
       '<rect x="61" y="61" width="878" height="1340" rx="12" fill="none" stroke="var(--m4)" stroke-width="1.4" opacity=".8"/>';
  /* B+: гильош и бусины */
  if (n >= 1) x += '<rect x="23" y="23" width="954" height="1416" rx="34" fill="none" stroke="url(#lat'+u+')" stroke-width="26"/>' +
       '<rect x="49" y="49" width="902" height="1364" rx="22" fill="none" stroke="url(#metalG'+u+')" stroke-width="7" stroke-dasharray="0.1 14.4" stroke-linecap="round"/>';
  /* A+: каналы с лозой */
  if (n >= 2) {
    x += '<g stroke="rgba(0,0,0,.55)" stroke-width="1.4">' +
      '<rect x="70" y="12" width="280" height="24" fill="url(#bandH'+u+')"/><rect x="650" y="12" width="280" height="24" fill="url(#bandH'+u+')"/>' +
      '<rect x="70" y="1426" width="280" height="24" fill="url(#bandH'+u+')"/><rect x="650" y="1426" width="280" height="24" fill="url(#bandH'+u+')"/>' +
      '<rect x="12" y="80" width="24" height="600" fill="url(#bandV'+u+')"/><rect x="12" y="782" width="24" height="600" fill="url(#bandV'+u+')"/>' +
      '<rect x="964" y="80" width="24" height="600" fill="url(#bandV'+u+')"/><rect x="964" y="782" width="24" height="600" fill="url(#bandV'+u+')"/></g>' +
      '<rect x="70" y="12" width="280" height="24" fill="url(#vineH'+u+')"/><rect x="650" y="12" width="280" height="24" fill="url(#vineH'+u+')"/>' +
      '<rect x="12" y="80" width="24" height="600" fill="url(#vineV'+u+')"/><rect x="12" y="782" width="24" height="600" fill="url(#vineV'+u+')"/>' +
      '<rect x="964" y="80" width="24" height="600" fill="url(#vineV'+u+')"/><rect x="964" y="782" width="24" height="600" fill="url(#vineV'+u+')"/>';
  }
  /* подпись по низу рамки */
  x += '<g font-family="Oswald, Arial Narrow, Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="4">' +
       '<text x="92" y="1444.5" fill="rgba(255,255,255,.45)">ANIGALAXY</text><text x="92" y="1443" fill="rgba(0,0,0,.7)">ANIGALAXY</text>' +
       '</g>';
  /* свечение у арта */
  x += '<rect x="66" y="66" width="868" height="1330" rx="10" fill="none" style="stroke:var(--glow)" stroke-width="5" opacity=".7" filter="url(#soft'+u+')"/>' +
       '<rect x="66" y="66" width="868" height="1330" rx="10" fill="none" style="stroke:var(--glow)" stroke-width="1.2" opacity=".9"/>';
  /* A+: боковые вставки, верхний герб */
  if (n >= 2) {
    x += '<use href="#stud'+u+'" x="22" y="731"/><use href="#stud'+u+'" x="978" y="731"/>';
    x += '<path d="M360 6 H640 L622 28 L576 66 Q500 84 424 66 L378 28Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.7)" stroke-width="2.4"/>' +
      '<path d="M376 14 H624 L610 30 L570 60 Q500 76 430 60 L390 30Z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>' +
      '<path d="M420 22 L500 52 L580 22" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>' +
      '<path d="M440 22 L500 44 L560 22" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/>' +
      '<path d="M360 24 H250 L232 34 H110" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="5" stroke-linecap="round"/><path d="M360 24 H250 L232 34 H110" fill="none" stroke="url(#metalG'+u+')" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M640 24 H750 L768 34 H890" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="5" stroke-linecap="round"/><path d="M640 24 H750 L768 34 H890" fill="none" stroke="url(#metalG'+u+')" stroke-width="2.8" stroke-linecap="round"/>' +
      '<use href="#gemShape'+u+'" x="500" y="30" transform="translate(500 30) scale(.78) translate(-500 -30)"/>';
  }
  /* S+: нижний герб и четыре средних камня */
  if (n >= 3) {
    x += '<path d="M360 1456 H640 L622 1434 L576 1396 Q500 1378 424 1396 L378 1434Z" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.7)" stroke-width="2.4"/>' +
      '<path d="M360 1438 H250 L232 1428 H110" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="5" stroke-linecap="round"/><path d="M360 1438 H250 L232 1428 H110" fill="none" stroke="url(#metalG'+u+')" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M640 1438 H750 L768 1428 H890" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="5" stroke-linecap="round"/><path d="M640 1438 H750 L768 1428 H890" fill="none" stroke="url(#metalG'+u+')" stroke-width="2.8" stroke-linecap="round"/>' +
      '<use href="#gemShape'+u+'" x="232" y="34" transform="translate(232 34) scale(.4) translate(-232 -34)"/><use href="#gemShape'+u+'" x="768" y="34" transform="translate(768 34) scale(.4) translate(-768 -34)"/>' +
      '<use href="#gemShape'+u+'" x="232" y="1428" transform="translate(232 1428) scale(.4) translate(-232 -1428)"/><use href="#gemShape'+u+'" x="768" y="1428" transform="translate(768 1428) scale(.4) translate(-768 -1428)"/>';
  }
  if (n >= 4) x += ssExtra(u, t.v);
  /* B+: угловые кронштейны */
  if (n >= 1) x += '<use href="#cornerTL'+u+'"/><use href="#cornerTL'+u+'" transform="translate(1000 0) scale(-1 1)"/><use href="#cornerTL'+u+'" transform="translate(0 1462) scale(1 -1)"/><use href="#cornerTL'+u+'" transform="translate(1000 1462) scale(-1 -1)"/>';
  /* угловые камни: у каждого свои */
  const gs = n >= 3 ? 1 : (n >= 2 ? .74 : (n >= 1 ? .5 : 0));
  if (gs) {
    [[34,34],[966,34],[34,1428],[966,1428]].forEach(function (p: number[]) {
      x += '<use href="#gemShape'+u+'" x="'+p[0]+'" y="'+p[1]+'" transform="translate('+p[0]+' '+p[1]+') scale('+gs+') translate(-'+p[0]+' -'+p[1]+')"/>';
    });
  } else {
    [[34,34],[966,34],[34,1428],[966,1428]].forEach(function (p: number[]) {
      x += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="9" fill="url(#metalH'+u+')" stroke="rgba(0,0,0,.65)" stroke-width="2"/>';
    });
  }
  return x;
}


const CACHE: string[] = [];
/** SVG-разметка орнамента для ранга 0..4. Идентификаторы суффиксируются рангом, поэтому дубли в DOM безопасны. */
export function ornSvg(rank: number): string {
  if (CACHE[rank]) return CACHE[rank];
  const t: T = { n: rank, v: rank === 4 ? "v3" : undefined };
  CACHE[rank] = ornaments("_r" + rank, t);
  return CACHE[rank];
}
