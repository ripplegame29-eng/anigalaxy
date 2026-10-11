"use client";

import { createAnime4K, type Anime4KRunner } from "./anime4k";
import { linkProgram } from "./webgl-util";

/**
 * WebGL-апскейл — сердце кнопки «Апскейл 2x» (см. lib/live-upscale).
 *
 * Основной путь — настоящий Anime4K (bloc97, MIT): lib/anime4k.ts
 * исполняет на WebGL 1 пользовательские шейдеры mpv (anime4k-shaders.ts) —
 * цепочку Restore-CNN (восстановление линий, 4 прохода) + Upscale-CNN ×2
 * (4 свёртки + depth-to-space), выход 2×. Это те же пресеты, что ставят
 * в mpv, только страница применяет их к кадру захвата без расширений.
 *
 * Запасной путь (не собрался шейдер Anime4K, старый GPU) — прежний
 * двухпроходный «Simple 2x», описанный ниже: та же техника, что делают
 * апскейл-расширения, только средствами самой страницы.
 *
 * Проход 1 (FBO 2×): исходный кадр ресемплируется вдвое по Catmull-Rom —
 *   девять опорных точек, веса по кубическим полиномам. Резче билинейного,
 *   без «лестницы» на диагоналях; это и есть стадия «2x».
 * Проход 2 (канвас 1×): честное уменьшение (угол билинейной выборки —
 *   ровно среднее по 2×2 текселям) + нерезкая маска с шагом в один пиксель
 *   вывода. Результат стягивается в диапазон локальных минимум/максимум
 *   соседей 3×3 — приём Anime4K: микродетали поднимаются, но ореолы на
 *   контрастных линиях аниме физически не могут появиться (выход не выходит
 *   за пределы того, что и так есть рядом).
 *
 * Цветокоррекцией шейдер сознательно не занимается: её отдаём CSS-фильтру
 * iframe (QUALITY_FILTERS в lib/quality), чтобы обработка не дублировалась.
 *
 * Деградация без потери функциональности: нет WebGL или контекст потерян —
 * render() отдаёт false, вызывающий остаётся на CSS-пути. Какой движок
 * отработал кадр, рендерер пишет в canvas[data-upscale-engine]
 * («anime4k» | «catmull») — это видно в инспекторе и в E2E-замерах.
 */

/** Источник пикселей: VideoFrame из захвата вкладки либо ImageBitmap */
export type FrameSource = TexImageSource;

export interface UpscaleRenderer {
  /**
   * Прогнать один кадр через конвейер. srcW/srcH — размер кадра в
   * пикселях (для VideoFrame — displayWidth/Height), outW/outH — размер
   * канваса (задаёт вызывающий: сам канвас может быть ещё скрыт, а бокс
   * берётся у iframe). false — кадр не отрисован (нет контекста / ошибка).
   */
  render(
    src: FrameSource,
    srcW: number,
    srcH: number,
    outW: number,
    outH: number,
    sharpen: number,
  ): boolean;
  dispose(): void;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vUv = aPos * 0.5 + 0.5;
}`;

/* Проход 1: Catmull-Rom-ресемплинг в 2× */
const FRAG_UP = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uSrcSize;

vec3 sampleCmr(vec2 uv) {
  vec2 p = uv * uSrcSize;
  vec2 base = floor(p - 0.5) + 0.5;
  vec2 f = p - base;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 k12 = w2 / max(w12, vec2(1e-5));
  vec2 t0 = (base - 1.0) / uSrcSize;
  vec2 t3 = (base + 2.0) / uSrcSize;
  vec2 t12 = (base + k12) / uSrcSize;
  vec3 sum = vec3(0.0);
  sum += texture2D(uSrc, vec2(t0.x, t0.y)).rgb * w0.x * w0.y;
  sum += texture2D(uSrc, vec2(t12.x, t0.y)).rgb * w12.x * w0.y;
  sum += texture2D(uSrc, vec2(t3.x, t0.y)).rgb * w3.x * w0.y;
  sum += texture2D(uSrc, vec2(t0.x, t12.y)).rgb * w0.x * w12.y;
  sum += texture2D(uSrc, vec2(t12.x, t12.y)).rgb * w12.x * w12.y;
  sum += texture2D(uSrc, vec2(t3.x, t12.y)).rgb * w3.x * w12.y;
  sum += texture2D(uSrc, vec2(t0.x, t3.y)).rgb * w0.x * w3.y;
  sum += texture2D(uSrc, vec2(t12.x, t3.y)).rgb * w12.x * w3.y;
  sum += texture2D(uSrc, vec2(t3.x, t3.y)).rgb * w3.x * w3.y;
  return sum;
}

void main() {
  // DOM-текстура хранит строку 0 сверху, а FBO рисуется снизу вверх —
  // разворачиваем Y только на входе; обратный проход уже согласован.
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  gl_FragColor = vec4(clamp(sampleCmr(uv), 0.0, 1.0), 1.0);
}`;

/* Проход 2: box-уменьшение 2× → 1× + нерезкая маска с локальным клампом */
const FRAG_DOWN = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uSharpen;

void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  vec3 s1 = texture2D(uTex, vUv + vec2(0.0, uStep.y)).rgb;
  vec3 s2 = texture2D(uTex, vUv - vec2(0.0, uStep.y)).rgb;
  vec3 s3 = texture2D(uTex, vUv + vec2(uStep.x, 0.0)).rgb;
  vec3 s4 = texture2D(uTex, vUv - vec2(uStep.x, 0.0)).rgb;
  vec3 s5 = texture2D(uTex, vUv + uStep).rgb;
  vec3 s6 = texture2D(uTex, vUv - uStep).rgb;
  vec3 s7 = texture2D(uTex, vUv + vec2(uStep.x, -uStep.y)).rgb;
  vec3 s8 = texture2D(uTex, vUv + vec2(-uStep.x, uStep.y)).rgb;

  vec3 blur = (c + s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8) * (1.0 / 9.0);
  vec3 lo = min(min(min(c, s1), min(s2, s3)), min(min(s4, s5), min(s6, s7)));
  lo = min(lo, s8);
  vec3 hi = max(max(max(c, s1), max(s2, s3)), max(max(s4, s5), max(s6, s7)));
  hi = max(hi, s8);

  vec3 sharp = c + uSharpen * (c - blur);
  gl_FragColor = vec4(clamp(sharp, lo, hi), 1.0);
}`;

/**
 * Прикрепляет конвейер апскейла к канвасу поверх плеера.
 * Возвращает null, если WebGL недоступен (вызывающий остаётся на CSS).
 */
export function createUpscaleRenderer(canvas: HTMLCanvasElement): UpscaleRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: false, // канвас полностью закрывает iframe — непрозрачный буфер
    antialias: false,
    depth: false,
    stencil: false,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const progUp = linkProgram(gl, VERT, FRAG_UP);
  const progDown = linkProgram(gl, VERT, FRAG_DOWN);
  if (!progDown) {
    if (progUp) gl.deleteProgram(progUp);
    return null;
  }

  // Anime4K — основной путь; не собрался (старый GPU) — остаётся Catmull-Rom
  let anime4k: Anime4KRunner | null = createAnime4K(gl, VERT);
  if (!progUp && !anime4k) {
    gl.deleteProgram(progDown);
    return null;
  }

  const uUpSrcSize = progUp ? gl.getUniformLocation(progUp, "uSrcSize") : null;
  const uDownTex = gl.getUniformLocation(progDown, "uTex");
  const uDownStep = gl.getUniformLocation(progDown, "uStep");
  const uDownSharpen = gl.getUniformLocation(progDown, "uSharpen");

  const quad = gl.createBuffer();
  const srcTex = gl.createTexture();
  const fboTex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!quad || !srcTex || !fboTex || !fbo) {
    if (progUp) gl.deleteProgram(progUp);
    gl.deleteProgram(progDown);
    if (anime4k) anime4k.dispose();
    if (quad) gl.deleteBuffer(quad);
    if (srcTex) gl.deleteTexture(srcTex);
    if (fboTex) gl.deleteTexture(fboTex);
    if (fbo) gl.deleteFramebuffer(fbo);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const setupTex = (tex: WebGLTexture): void => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  setupTex(srcTex);
  setupTex(fboTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

  let fboW = 0;
  let fboH = 0;
  let disposed = false;

  const ensureFbo = (w: number, h: number): boolean => {
    if (fboW === w && fboH === h) return true;
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (ok) {
      fboW = w;
      fboH = h;
    }
    return ok;
  };

  return {
    render(src, srcW, srcH, outW, outH, sharpen) {
      if (disposed || srcW < 1 || srcH < 1 || outW < 1 || outH < 1) return false;

      // Буфер канваса — в размере бокса под devicePixelRatio, чтобы он
      // совпадал с разрешением захвата и картинка не «поплыла»
      const w = outW;
      const h = outH;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Загрузка кадра (VideoFrame / ImageBitmap)
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      } catch {
        return false;
      }

      // Основной путь: Anime4K (Restore-CNN → Upscale-CNN ×2) → текстура 2×
      let usedAnime4k = false;
      let ok = false;
      if (anime4k) {
        const a4k = anime4k.run(srcTex, srcW, srcH);
        if (a4k) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, w, h);
          gl.useProgram(progDown);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, a4k.tex);
          gl.uniform1i(uDownTex, 0);
          gl.uniform2f(uDownStep, 1 / w, 1 / h);
          gl.uniform1f(uDownSharpen, sharpen);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          usedAnime4k = true;
          ok = !gl.isContextLost();
        } else {
          // Цепочка не состоялась — выключаем Anime4K до пересоздания рендерера
          anime4k.dispose();
          anime4k = null;
        }
      }

      // Запасной путь: Catmull-Rom 2× → box-downsample + unsharp
      if (!usedAnime4k && progUp) {
        if (!ensureFbo(srcW * 2, srcH * 2)) return false;

        // Проход 1: 1× кадр → 2× текстура (Catmull-Rom)
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, fboW, fboH);
        gl.useProgram(progUp);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.uniform1i(gl.getUniformLocation(progUp, "uSrc"), 0);
        if (uUpSrcSize) gl.uniform2f(uUpSrcSize, srcW, srcH);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Проход 2: 2× текстура → канвас (box-downsample + unsharp)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.useProgram(progDown);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fboTex);
        gl.uniform1i(uDownTex, 0);
        gl.uniform2f(uDownStep, 1 / w, 1 / h);
        gl.uniform1f(uDownSharpen, sharpen);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        ok = !gl.isContextLost();
      }

      // Какой движок отработал кадр — видно в инспекторе и в E2E-замерах
      const engine = usedAnime4k ? "anime4k" : "catmull";
      if (ok && canvas.dataset.upscaleEngine !== engine) {
        canvas.dataset.upscaleEngine = engine;
      }
      return ok;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (anime4k) {
        anime4k.dispose();
        anime4k = null;
      }
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(fboTex);
      gl.deleteTexture(srcTex);
      gl.deleteBuffer(quad);
      gl.deleteProgram(progUp);
      gl.deleteProgram(progDown);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
