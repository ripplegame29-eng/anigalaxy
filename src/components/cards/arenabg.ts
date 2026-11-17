/**
 * Фон арены: живая космическая сцена на WebGL (фрагментный шейдер).
 * Туманность с завихрениями, слои звёзд с параллаксом, газовый гигант с кольцами и атмосферой.
 * Палитра берётся из CSS-переменных --b1/--b2/--b3 оверлея (зависит от правила арены дня).
 */

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec2 uMouse;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float a = .5, s = 0.;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) { s += a * noise(p); p = m * p; a *= .5; }
  return s;
}
float stars(vec2 uv, float sc, float th){
  vec2 g = uv * sc;
  vec2 id = floor(g);
  vec2 f = fract(g) - .5;
  float h = hash(id);
  if (h < th) return 0.;
  vec2 o = (vec2(hash(id + 1.3), hash(id + 7.1)) - .5) * .7;
  float d = length(f - o);
  float b = (h - th) / (1. - th);
  float tw = .65 + .35 * sin(uTime * (.8 + h * 2.5) + h * 40.);
  return smoothstep(.07 * b + .025, 0., d) * tw * (.35 + b);
}

void main(){
  float asp = uRes.x / uRes.y;
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec2 m = uMouse * .02;
  float t = uTime;

  vec3 col = mix(vec3(.008, .010, .024), vec3(.022, .028, .066), smoothstep(-.5, .5, uv.y));

  /* туманность: шум, дважды искажённый самим собой */
  vec2 p = uv * 1.35 + m * .6 + vec2(t * .005, 0.);
  vec2 q = vec2(fbm(p + vec2(0., t * .012)), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2)), fbm(p + 3.4 * q + vec2(8.3, 2.8) - t * .009));
  float n = fbm(p + 3.1 * r);
  float band = exp(-pow((uv.y - uv.x * .32 + .04) * 1.55, 2.));
  float dens = smoothstep(.34, .92, n) * (.3 + .95 * band);
  vec3 neb = mix(uC1, uC2, clamp(r.x * 1.5 - .25, 0., 1.));
  neb = mix(neb, uC3, smoothstep(.72, 1., n) * .55);
  col += neb * dens * 1.05;
  col += uC1 * pow(band, 3.) * .05;
  float dust = smoothstep(.42, .8, fbm(p * 2.3 + r * 2. + 11.));
  col *= 1. - .6 * dust * band;

  /* звёзды в три слоя глубины */
  float st = stars(uv + m * .2, 36., .87) + stars(uv + m * .35, 72., .9) * .7 + stars(uv + m * .5, 150., .93) * .45;
  col += vec3(.85, .9, 1.) * st * (1. - .55 * dens);

  /* газовый гигант с кольцами */
  float R = asp > 1. ? .21 : .16;
  vec2 pc = (asp > 1. ? vec2(asp * .5 - .34, .27) : vec2(asp * .5 - .12, .36)) - m * 1.3;
  vec2 d = (uv - pc) / R;
  float l = length(d);
  vec3 L = normalize(vec3(-.66, .42, .62));
  float ca = cos(-.36), sa = sin(-.36);
  vec2 rd = mat2(ca, -sa, sa, ca) * d;
  vec2 re = vec2(rd.x, rd.y / .23);
  float rr = length(re);
  float ringMask = smoothstep(1.34, 1.42, rr) * smoothstep(2.3, 2.12, rr);
  float ringTex = (.45 + .55 * noise(vec2(rr * 30., 3.))) * smoothstep(0., .035, abs(rr - 1.8)) * (.7 + .3 * noise(vec2(rr * 90., 9.)));
  float shade = 1. - smoothstep(0., .35, re.x) * smoothstep(1.08, .9, abs(re.y));
  vec3 ringCol = mix(uC3, uC1, .3) * ringTex * (.55 + .45 * shade);
  float ringA = ringMask * .8 * (.25 + .75 * shade);
  if (l < 1.) {
    vec3 nrm = vec3(d, sqrt(1. - l * l));
    float dif = clamp(dot(nrm, L), 0., 1.);
    float lat = nrm.y * 5. + fbm(vec2(nrm.x * 2. + t * .012, nrm.y * 7.)) * 1.7;
    float bands = .5 + .5 * sin(lat * 3.);
    vec3 base = mix(uC1 * .55 + .04, uC3 * .92, bands);
    base = mix(base, uC2 * .75, fbm(nrm.xy * 3. + 4.) * .55);
    vec3 pl = base * (pow(dif, .85) * 1.2 + .012);
    float fres = pow(1. - nrm.z, 3.);
    pl += uC3 * fres * .55 * smoothstep(-.2, .5, dot(nrm, L));
    /* тень колец на планете */
    pl *= 1. - .35 * smoothstep(.06, 0., abs(rd.y + .1 + rd.x * .05)) * step(0., dif);
    col = mix(col, pl, smoothstep(1., .985, l));
    if (rd.y < 0.) col = mix(col, ringCol, ringA);
  } else {
    float lit = smoothstep(-.7, .6, dot(normalize(d), L.xy));
    col += uC3 * exp(-(l - 1.) * 10.) * .55 * lit;
    col += mix(uC1, uC3, .5) * exp(-(l - 1.) * 2.2) * .09 * lit;
    col = mix(col, ringCol, ringA);
  }

  /* крупные размытые блики на переднем плане — ощущение глубины */
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 bp = vec2(sin(fi * 12.9 + t * .02) * asp * .55, fract(fi * .37 + t * .006) - .5) + m * (1.5 + fi * .3);
    float br = .05 + .035 * fract(fi * .61);
    col += mix(uC1, uC3, fract(fi * .43)) * smoothstep(br, br * .55, length(uv - bp)) * .028;
  }

  vec2 v = uv * vec2(.72, 1.05);
  col *= 1. - .6 * dot(v, v);
  col = 1. - exp(-col * 1.7);
  col = pow(col, vec3(.92));
  col += (hash(gl_FragCoord.xy + fract(t)) - .5) / 255.;
  gl_FragColor = vec4(col, 1.);
}`;

const rgb = (hex: string, fb: [number, number, number]): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fb;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Запускает фон; still — один неподвижный кадр (экономия, отключённые анимации). Возвращает остановку. */
export function runArenaBg(cv: HTMLCanvasElement, still = false): () => void {
  const gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return () => {};
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {};
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U("uRes");
  const uTime = U("uTime");
  const uMouse = U("uMouse");
  const cs = getComputedStyle(cv);
  gl.uniform3fv(U("uC1"), rgb(cs.getPropertyValue("--b1"), [0.18, 0.36, 1]));
  gl.uniform3fv(U("uC2"), rgb(cs.getPropertyValue("--b2"), [0.54, 0.24, 1]));
  gl.uniform3fv(U("uC3"), rgb(cs.getPropertyValue("--b3"), [0.66, 0.75, 1]));

  /* фон рисуется в пониженном разрешении: он размыт по природе, а видеокарте легче */
  const size = () => {
    const k = Math.min(1, window.devicePixelRatio || 1) * (cv.clientWidth < 700 ? 0.6 : 0.72);
    const w = Math.max(2, Math.round(cv.clientWidth * k));
    const h = Math.max(2, Math.round(cv.clientHeight * k));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  };
  let mx = 0;
  let my = 0;
  let tx = 0;
  let ty = 0;
  const onMove = (e: PointerEvent) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  const seed = Math.random() * 40;
  const draw = (sec: number) => {
    size();
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;
    gl.uniform1f(uTime, seed + sec);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  cv.dataset.on = "1";
  if (still) {
    draw(0);
    const onResize = () => draw(0);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }
  let raf = 0;
  let last = 0;
  let dead = false;
  const t0 = performance.now();
  const loop = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden || now - last < 30) return;
    last = now;
    draw((now - t0) / 1000);
  };
  raf = requestAnimationFrame(loop);
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
  };
}
