/* ============ КОМПОНЕНТ: levelEmblem(level, percent, sizePx) -> HTML ============ */
export const ERAS=[
 {from:1,  n:'Новичок',  sh:'Круг-цветок',      c:'#34e0a1',c2:'#18a0ff',a:'#c8ff9a',st:4, orb:1,rp:0,beam:0,cmt:0,pt:0,em:0, rays:0},
 {from:5,  n:'Зритель',  sh:'Гексагон-радар',   c:'#38b6ff',c2:'#7a7dff',a:'#aee0ff',st:4, orb:1,rp:2,beam:1,cmt:0,pt:0,em:0, rays:0},
 {from:15, n:'Знаток',   sh:'Октаграмма-молнии',c:'#b06bff',c2:'#ff5fd2',a:'#e6d0ff',st:5, orb:1,rp:1,beam:0,cmt:2,pt:0,em:0, rays:0,neb:1},
 {from:30, n:'Мастер',   sh:'Солнце-клинки',    c:'#ff4fa3',c2:'#ff9a3d',a:'#ffd27a',st:6, orb:2,rp:1,beam:0,cmt:1,pt:6,em:0, rays:1,neb:1},
 {from:50, n:'Чемпион',  sh:'Щит с крыльями',   c:'#ffd04d',c2:'#ff8a1f',a:'#fff0b0',st:5, orb:2,rp:1,beam:0,cmt:1,pt:0,em:8, rays:1,neb:1},
 {from:75, n:'Легенда',  sh:'Пламенное кольцо', c:'#ff4d4d',c2:'#ffa31f',a:'#ffd9a0',st:6, orb:3,rp:2,beam:0,cmt:2,pt:0,em:12,rays:2,neb:1,fire:1},
 {from:100,n:'Трансцендент',sh:'Гексаграмма-космос',c:'#6cf0ff',c2:'#ff6bd6',a:'#ffffff',st:10,orb:4,rp:2,beam:0,cmt:3,pt:0,em:0,rays:2,neb:1,holo:1}
];
export const eraOf=L=>{let i=0;ERAS.forEach((e,k)=>{if(L>=e.from)i=k});return i};
export const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
export const pt=(n,r,rot)=>Array.from({length:n},(_,i)=>{const a=(rot+360*i/n)*Math.PI/180;return(50+r*Math.cos(a)).toFixed(2)+','+(50+r*Math.sin(a)).toFixed(2)}).join(' ');
export const star=(n,ro,ri,rot=-90)=>Array.from({length:n*2},(_,i)=>{const a=(rot+180*i/n)*Math.PI/180,r=i%2?ri:ro;return(50+r*Math.cos(a)).toFixed(2)+','+(50+r*Math.sin(a)).toFixed(2)}).join(' ');
let UID=0;
export function levelEmblem(L,pct=0,size=96,o={}){
  const lite=size<64,k=eraOf(L),E=lite?{...ERAS[k],rays:0,cmt:0,em:0,pt:0,beam:0,rp:0,orb:1,st:2,neb:0}:ERAS[k],nx=ERAS[k+1],w=Math.min(1,(L-E.from)/((nx?nx.from:101)-E.from)),r=rng(L*7919+13),id='g'+(++UID);
  const T=()=>`style="--t:${(10+r()*20).toFixed(0)}s"`, dash=()=>`${(1.5+r()*8).toFixed(1)} ${(2+r()*6).toFixed(1)}`, f=(x)=>(+x).toFixed(1);
  const prog=(tag,at,ex='')=>`<${tag} ${at} fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4.5" stroke-linejoin="round" ${ex}/>`+(pct>0?`<${tag} ${at} class="arc" pathLength="100" fill="none" stroke="url(#${id}${k==6?'h':''})" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${pct} 100" ${ex}/>`:'');
  const circ=(rad,sw,col,op,da,cls,ex='')=>`<circle class="${cls}" ${T()} cx="50" cy="50" r="${rad}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-opacity="${op}" ${da?`stroke-dasharray="${da}"`:''} ${ex}/>`;
  const bolt=()=>{const a=r()*6.283;let d='';for(let i=0;i<=5;i++){const rr=46-i*4.8,aa=a+(r()-.5)*7/rr;d+=(i?'L':'M')+f(50+rr*Math.cos(aa))+' '+f(50+rr*Math.sin(aa))}return`<path class="bolt" d="${d}" style="--t:${(2+r()*3).toFixed(1)}s;--d:${(-r()*4).toFixed(1)}s"/>`};
  let s=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${E.c}"/><stop offset="1" stop-color="${E.c2}"/></linearGradient>
   <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6cf0ff"/><stop offset=".33" stop-color="#ff6bd6"/><stop offset=".66" stop-color="#ffd04d"/><stop offset="1" stop-color="#6cf0ff"/></linearGradient>
   <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${E.c}"/><stop offset=".6" stop-color="${E.c2}"/><stop offset="1" stop-color="#fff3a0"/></linearGradient></defs>`;
  if(k==0){ /* круг-цветок */
    const N=5+Math.floor(r()*4);let pe='';for(let i=0;i<N;i++)pe+=`<ellipse cx="50" cy="7" rx="3" ry="6.5" fill="url(#${id})" opacity=".85" transform="rotate(${f(i*360/N)} 50 50)"/>`;
    s+=`<g class="br">${circ(48,.9,E.c,.6,dash(),'r')}<g class="r rv" ${T()}>${pe}</g>${prog('circle','cx="50" cy="50" r="34"','transform="rotate(-90 50 50)"')}${circ(29,.8,E.c2,.6,'','r')}</g>`;
  }else if(k==1){ /* гексагон-радар */
    let dots='';pt(6,48,-90).split(' ').forEach(p=>{const[x,y]=p.split(',');dots+=`<circle cx="${x}" cy="${y}" r="1.7" fill="#fff"/>`});
    s+=`<g class="r" ${T()}><polygon points="${pt(6,48,-90)}" fill="none" stroke="url(#${id})" stroke-width="1.5"/>${dots}</g>
     <polygon class="r rv" ${T()} points="${pt(6,44,-60)}" fill="none" stroke="${E.a}" stroke-width="1.1" stroke-dasharray="${dash()}"/>
     ${prog('polygon',`points="${pt(6,37,-90)}"`)}<polygon class="r rv" ${T()} points="${pt(6,30,-90)}" fill="none" stroke="${E.c2}" stroke-width=".8" stroke-opacity=".7"/>`;
  }else if(k==2){ /* октаграмма-молнии */
    s+=`<polygon class="r" ${T()} points="${pt(4,48,-90)}" fill="${E.c}" fill-opacity=".08" stroke="url(#${id})" stroke-width="1.5"/>
     <polygon class="r rv" ${T()} points="${pt(4,48,-45)}" fill="${E.c2}" fill-opacity=".08" stroke="${E.c2}" stroke-width="1.5"/>
     <circle class="dm" cx="50" cy="50" r="43" fill="none" stroke="${E.a}" stroke-width="1.6" stroke-dasharray=".8 3.6"/>
     ${prog('polygon',`points="${pt(8,35,-90)}"`)}${bolt()}${bolt()}${bolt()}`;
  }else if(k==3){ /* солнце-клинки */
    const N=10+Math.floor(r()*5);
    s+=`<g class="pu"><polygon class="r" style="--t:${(9+r()*6).toFixed(0)}s" points="${star(N,49,41)}" fill="url(#${id})" fill-opacity=".85"/></g>
     <polygon class="r rv" ${T()} points="${star(8,32,26)}" fill="none" stroke="${E.a}" stroke-width="1"/>${prog('circle','cx="50" cy="50" r="36"','transform="rotate(-90 50 50)"')}${circ(32,.7,E.c2,.7,dash(),'r rv')}`;
  }else if(k==4){ /* щит с крыльями */
    const sh='M50 6L86 18V48C86 72 68 88 50 96C32 88 14 72 14 48V18Z';
    const wing=`<g class="wg">${[-28,-8,12].map((a,i)=>`<ellipse cx="${2-i}" cy="${38+i*2}" rx="${12+i}" ry="3.2" fill="url(#${id}f)" transform="rotate(${a} 14 40)" opacity=".92"/>`).join('')}</g>`;
    s+=`<g transform="translate(0 0)">${wing}</g><g transform="translate(100 0) scale(-1 1)">${wing}</g>
     <path d="${sh}" fill="#0b0810" fill-opacity=".85" stroke="url(#${id}f)" stroke-width="1.6"/>
     ${prog('path',`d="${sh}" transform="translate(50 52) scale(.84) translate(-50 -52)"`)}
     <path d="M41 9L44 0L50 6L56 0L59 9Z" fill="url(#${id}f)" class="bob" stroke="#fff3a0" stroke-width=".6"/>`;
  }else if(k==5){ /* пламенное кольцо */
    const N=10+Math.floor(r()*5);let fl='';for(let i=0;i<N;i++)fl+=`<g transform="rotate(${f(i*360/N)} 50 50)"><path class="fl" style="--t:${(.35+r()*.5).toFixed(2)}s;--d:${(-r()).toFixed(2)}s" d="M50 1C57 9 56 16 50 23C44 16 43 9 50 1Z" fill="url(#${id}f)"/></g>`;
    s+=`${fl}${prog('circle','cx="50" cy="50" r="33"','transform="rotate(-90 50 50)"')}${circ(28,.8,E.a,.7,dash(),'r rv')}<circle class="dm" cx="50" cy="50" r="38" fill="none" stroke="${E.a}" stroke-width="1" stroke-dasharray="1 3"/>${bolt()}${bolt()}`;
  }else{ /* гексаграмма-космос */
    s+=`${circ(48,1,`url(#${id}h)`,.9,dash(),'r')}<polygon class="r" ${T()} points="${pt(3,45,-90)}" fill="${E.c}" fill-opacity=".1" stroke="url(#${id}h)" stroke-width="1.5"/>
     <polygon class="r rv" ${T()} points="${pt(3,45,-30)}" fill="${E.c2}" fill-opacity=".1" stroke="url(#${id}h)" stroke-width="1.5"/>
     ${prog('circle','cx="50" cy="50" r="33"','transform="rotate(-90 50 50)"')}<polygon class="r rv" ${T()} points="${pt(5,26,-90)}" fill="none" stroke="#fff" stroke-width=".8" stroke-opacity=".7"/>
     <circle class="dm" cx="50" cy="50" r="49.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray=".6 2.9"/>`;
  }
  /* слои вокруг */
  let h='';
  const n=(c,fn)=>{for(let i=0;i<c;i++)h+=fn(i)};
  n(E.rp+(w>.5&&k>0?1:0),i=>`<i class="rp" style="--d:${i*1.1}s;--t:${k==5?1.6:3}s"></i>`);
  if(E.beam)h+='<i class="beam"></i>';
  n(E.cmt,i=>`<i class="cmt" style="--i:${2+i*3}%;--t:${(3+r()*4).toFixed(1)}s;--d:${(-r()*5).toFixed(1)}s;--cc:${i%2?E.c2:E.c}"></i>`);
  n(E.orb+(w>.66?1:0),i=>`<i class="orb" style="--t:${(5+r()*6+i*2).toFixed(1)}s;--d:${(-r()*8).toFixed(1)}s"></i>`);
  n(E.st+Math.floor(w*3),()=>{const a=r()*6.283,d=8+r()*17;return`<i class="st" style="left:${f(50+Math.cos(a)*d)}%;top:${f(50+Math.sin(a)*d)}%;--t:${(1.6+r()*2.4).toFixed(1)}s;--d:${(-r()*3).toFixed(1)}s"></i>`});
  n(E.em,()=>`<i class="em" style="--x:${f(20+r()*60)}%;--dx:${f((r()-.5)*30)}px;--t:${(k==5?1.2:2)+r()*1.5}s;--d:${(-r()*3).toFixed(1)}s"></i>`);
  n(E.pt,()=>`<i class="pt" style="--x:${f(10+r()*80)}%;--dx:${f((r()-.5)*30)}px;--t:${(3+r()*2).toFixed(1)}s;--d:${(-r()*5).toFixed(1)}s"></i>`);
  const hue=(E.holo||o.locked)?0:Math.round((r()-.5)*40), dg=String(L).length, fs=dg>2?.24:dg>1?.3:.38;
  return `<div class="le ${E.fire?'fire':''} ${E.holo?'holo':''} ${o.locked?'lk':''}" role="img" aria-label="Уровень ${L}, эра ${E.n}${o.locked?', закрыт':', прогресс '+pct+'%'}" style="--s:${size}px;--c:${E.c};--c2:${E.c2};--fs:${fs};--neb:${E.neb||0};--d0:${(-r()*3).toFixed(1)}s;${hue?`filter:hue-rotate(${hue}deg)`:''}">
   <i class="gl"></i>${E.rays?'<i class="rays"></i>':''}${E.rays>1?'<i class="rays b"></i>':''}<i class="core"></i><svg viewBox="0 0 100 100">${s}</svg>${h}${o.up?'<i class="lu"></i>':''}<b>${L}</b></div>`;
}
