"use client";

import { RESTORE_CNN_S, UPSCALE_CNN_X2_S } from "./anime4k-shaders";
import { linkProgram } from "./webgl-util";

/**
 * Мини-движок пользовательских шейдеров mpv для конвейера апскейла:
 * парсит директивы //!DESC ///!BIND ///!SAVE ///!WIDTH ///!HEIGHT и
 * запускает проходы на WebGL 1 — браузерный эквивалент того, что mpv
 * делает со своими шейдерами. Так в плеер встраивается настоящий
 * Anime4K (bloc97, MIT — тексты пресетов в lib/anime4k-shaders.ts).
 *
 * Сравнение с mpv (намеренные упрощения, задокументированы):
 *  - //!WHEN не вычисляется. В mpv оно читает OUTPUT (экран) и пропускает
 *    апскейл, когда экран почти равен кадру. Наш конвейер всегда рендерит
 *    промежуточную стадию 2× — то есть OUTPUT/MAIN = 2.0 > 1.2, условие
 *    истинно по построению.
 *  - //!OFFSET и //!COMPONENTS игнорируются: проход рисует весь кадр,
 *    формат текстуры всегда RGBA.
 *  - //!SAVE MAIN читает исходник и пишет в «другой» слот имени
 *    (ping-pong): в WebGL читать и писать одну текстуру нельзя.
 *
 * Топология (оба пресета кончаются //!SAVE MAIN):
 *   Restore (4 прохода) — восстановление линий на исходном размере, затем
 *   Upscale (5 проходов) — свёртки 1× и depth-to-space в 2×. На выходе —
 *   текстура 2×src, которую вызывающий стягивает в канвас (FRAG_DOWN).
 *
 * Ориентация кадра: DOM-текстура хранит строку 0 сверху, FBO рисуется
 * снизу вверх — первый проход (flip) разворачивает Y ровно так же, как
 * это делал FRAG_UP, дальше все проходы согласованы между собой.
 *
 * Деградация без потери функциональности: любой сбой компиляции или
 * аллокации → createAnime4K() вернёт null (или run() → null), рендерер
 * остаётся на старом Catmull-Rom-пути (FRAG_UP + FRAG_DOWN).
 */

/** Один //!DESC-блок исходного mpv-шейдера */
interface ParsedPass {
  binds: string[];
  save: string;
  width: string;
  height: string;
  body: string;
}

/** Скомпилированный проход: директивы + программа + локации юниформов */
interface CompiledPass {
  binds: string[];
  save: string;
  width: string;
  height: string;
  program: WebGLProgram;
  uSampler: (WebGLUniformLocation | null)[];
  uSize: (WebGLUniformLocation | null)[];
  uPt: (WebGLUniformLocation | null)[];
}

/** Промежуточный буфер цепочки: текстура + собственный FBO */
interface Rt {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

/** Два слота на имя (ping-pong) + текущий указатель (кто «MAIN» прямо сейчас) */
interface PoolEntry {
  slots: (Rt | null)[];
  current: Rt | null;
}

export interface Anime4KOutput {
  tex: WebGLTexture;
  w: number;
  h: number;
}

export interface Anime4KRunner {
  /**
   * Прогоняет цепочку по одному кадру: src (DOM-текстура) → разворот Y →
   * Restore → Upscale → текстура 2×src. null — сбой шага: вызывающий
   * выключает Anime4K и уходит на Catmull-Rom-путь.
   */
  run(src: WebGLTexture, srcW: number, srcH: number): Anime4KOutput | null;
  dispose(): void;
}

/** Проход 0: DOM-текстура → FBO с разворотом Y (конвенция FRAG_UP) */
const FRAG_FLIP = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uSrc;

void main() {
  gl_FragColor = texture2D(uSrc, vec2(vUv.x, 1.0 - vUv.y));
}`;

/**
 * Разбор mpv-исходника на проходы. Текст до первого //!DESC (MIT-шапка)
 * отбрасывается, директивы между телами не попадают в GLSL — в тело
 * прохода уходит только его собственный код.
 */
function parseShader(source: string): ParsedPass[] {
  const passes: ParsedPass[] = [];
  let current: ParsedPass | null = null;
  for (const line of source.split("\n")) {
    if (line.startsWith("//!DESC")) {
      current = { binds: [], save: "", width: "", height: "", body: "" };
      passes.push(current);
      continue;
    }
    if (line.startsWith("//!")) {
      if (!current) continue;
      const sp = line.indexOf(" ");
      const key = sp === -1 ? line.slice(3) : line.slice(3, sp);
      const value = sp === -1 ? "" : line.slice(sp + 1).trim();
      // HOOK / WHEN / OFFSET / COMPONENTS — см. комментарий над файлом
      if (key === "BIND") current.binds.push(value);
      else if (key === "SAVE") current.save = value;
      else if (key === "WIDTH") current.width = value;
      else if (key === "HEIGHT") current.height = value;
      continue;
    }
    if (current) current.body += line + "\n";
  }
  return passes.filter(
    (pass) => pass.save !== "" && pass.binds.length > 0 && pass.body.includes("hook"),
  );
}

/**
 * Перевод тела прохода из нотации mpv в GLSL ES 1.0:
 *   NAME_texOff(o) → сэмпл NAME со смещением o в пикселях от текущей точки,
 *   NAME_tex(p)    → texture2D(s_NAME, p),
 *   NAME_pos       → vUv,
 *   NAME_size      → sz_NAME,
 *   NAME_pt        → pt_NAME.
 * Разворот Y здесь не нужен: к уже перевёрнутому в FBO кадру все проходы
 * обращаются одной общей координатой vUv.
 */
function fragmentSource(binds: string[], body: string): string {
  let head = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
`;
  for (const name of binds) {
    head += `uniform sampler2D s_${name};
uniform vec2 sz_${name};
uniform vec2 pt_${name};
`;
  }
  for (const name of binds) {
    head += `vec4 texOff_${name}(vec2 off) { return texture2D(s_${name}, vUv + off * pt_${name}); }
`;
  }
  let frag = body;
  for (const name of binds) {
    frag = frag
      .replace(new RegExp(`\\b${name}_texOff\\(`, "g"), `texOff_${name}(`)
      .replace(new RegExp(`\\b${name}_tex\\(`, "g"), `texture2D(s_${name}, `)
      .replace(new RegExp(`\\b${name}_pos\\b`, "g"), "vUv")
      .replace(new RegExp(`\\b${name}_size\\b`, "g"), `sz_${name}`)
      .replace(new RegExp(`\\b${name}_pt\\b`, "g"), `pt_${name}`);
  }
  return head + frag + "\nvoid main() { gl_FragColor = hook(); }\n";
}

/**
 * Вычисление //!WIDTH ///!HEIGHT в нотации RPN («conv2d_last_tf.w 2 *»):
 * операнды — NAME.w / NAME.h / числа, операции — арифметика.
 * fallback — размер по умолчанию (mpv подставляет сюда OUTPUT: у нас это
 * промежуточная стадия 2×); при неизвестном токене — тоже он, чтобы сбой
 * разбора не останавливал цепочку.
 */
function evalRpn(
  expr: string,
  sizes: Map<string, { w: number; h: number }>,
  fallback: number,
): number {
  if (!expr) return fallback;
  const stack: number[] = [];
  for (const token of expr.split(/\s+/)) {
    const operand = /^([A-Za-z_]\w*)\.([wh])$/.exec(token);
    if (operand) {
      const size = sizes.get(operand[1]);
      stack.push(size ? (operand[2] === "w" ? size.w : size.h) : fallback);
      continue;
    }
    if (/^\d+(\.\d+)?$/.test(token)) {
      stack.push(parseFloat(token));
      continue;
    }
    if (token === "*" || token === "/" || token === "+" || token === "-") {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return fallback;
      stack.push(
        token === "*" ? a * b : token === "/" ? a / b : token === "+" ? a + b : a - b,
      );
      continue;
    }
    return fallback;
  }
  const value = stack.length === 1 ? stack[0] : fallback;
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

/**
 * Создаёт исполнитель цепочки Anime4K поверх контекста.
 * null — исходник разобрался, а скомпилироваться не удалось (старый GPU,
 * слишком длинный unrolled-код): рендерер остаётся на Catmull-Rom-пути.
 */
export function createAnime4K(
  gl: WebGLRenderingContext,
  vert: string,
): Anime4KRunner | null {
  let disposed = false;
  const passes: CompiledPass[] = [];
  const rts: Rt[] = [];
  const pool = new Map<string, PoolEntry>();
  let flipRt: Rt | null = null;
  let progFlip: WebGLProgram | null = null;
  let uFlipSrc: WebGLUniformLocation | null = null;

  const cleanup = (): void => {
    for (const pass of passes) gl.deleteProgram(pass.program);
    passes.length = 0;
    if (progFlip) {
      gl.deleteProgram(progFlip);
      progFlip = null;
    }
    for (const rt of rts) {
      gl.deleteTexture(rt.tex);
      gl.deleteFramebuffer(rt.fbo);
    }
    rts.length = 0;
    pool.clear();
    flipRt = null;
  };

  const createRt = (w: number, h: number): Rt | null => {
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) {
      if (tex) gl.deleteTexture(tex);
      if (fbo) gl.deleteFramebuffer(fbo);
      return null;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      return null;
    }
    const rt: Rt = { tex, fbo, w, h };
    rts.push(rt);
    return rt;
  };

  const resizeRt = (rt: Rt, w: number, h: number): boolean => {
    if (rt.w === w && rt.h === h) return true;
    gl.bindTexture(gl.TEXTURE_2D, rt.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (ok) {
      rt.w = w;
      rt.h = h;
    }
    return ok;
  };

  /**
   * Буфер под !SAVE: предпочтительно слот уже нужного размера, который не
   * занят входом прохода; иначе — свободный слот, (пере)аллоцируемый под
   * новые размеры. Два слота достаточно: читается всегда не больше одного
   * текстура текущего имени (SAVE MAIN читает MAIN — второй слот свободен).
   */
  const acquire = (
    save: string,
    w: number,
    h: number,
    bound: Set<WebGLTexture>,
  ): Rt | null => {
    let entry = pool.get(save);
    if (!entry) {
      entry = { slots: [null, null], current: null };
      pool.set(save, entry);
    }
    for (const slot of entry.slots) {
      if (slot && !bound.has(slot.tex) && slot.w === w && slot.h === h) return slot;
    }
    for (let i = 0; i < entry.slots.length; i++) {
      const slot = entry.slots[i];
      if (slot && bound.has(slot.tex)) continue;
      if (slot) {
        if (resizeRt(slot, w, h)) return slot;
        continue;
      }
      const rt = createRt(w, h);
      if (!rt) return null;
      entry.slots[i] = rt;
      return rt;
    }
    return null;
  };

  // --- компиляция проходов обоих пресетов ---
  try {
    const parsed = [...parseShader(RESTORE_CNN_S), ...parseShader(UPSCALE_CNN_X2_S)];
    if (parsed.length < 8) return null; // защита от битого парсинга
    for (const pass of parsed) {
      const program = linkProgram(gl, vert, fragmentSource(pass.binds, pass.body));
      if (!program) {
        cleanup();
        return null;
      }
      passes.push({
        binds: pass.binds,
        save: pass.save,
        width: pass.width,
        height: pass.height,
        program,
        uSampler: pass.binds.map((n) => gl.getUniformLocation(program, `s_${n}`)),
        uSize: pass.binds.map((n) => gl.getUniformLocation(program, `sz_${n}`)),
        uPt: pass.binds.map((n) => gl.getUniformLocation(program, `pt_${n}`)),
      });
    }
    progFlip = linkProgram(gl, vert, FRAG_FLIP);
    if (!progFlip) {
      cleanup();
      return null;
    }
    uFlipSrc = gl.getUniformLocation(progFlip, "uSrc");
  } catch {
    cleanup();
    return null;
  }

  return {
    run(src, srcW, srcH) {
      if (disposed || srcW < 1 || srcH < 1 || !progFlip) return null;
      try {
        // flip-текстура: кадр захвата в размере источника, развёрнутый по Y
        if (!flipRt) {
          flipRt = createRt(srcW, srcH);
          if (!flipRt) return null;
        } else if (!resizeRt(flipRt, srcW, srcH)) {
          return null;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, flipRt.fbo);
        gl.viewport(0, 0, flipRt.w, flipRt.h);
        gl.useProgram(progFlip);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src);
        if (uFlipSrc) gl.uniform1i(uFlipSrc, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (gl.isContextLost()) return null;

        // MAIN на каждый кадр начинается со свежего flip-кадра
        const mainEntry = pool.get("MAIN");
        if (mainEntry) mainEntry.current = flipRt;
        else pool.set("MAIN", { slots: [null, null], current: flipRt });

        const sizes = new Map<string, { w: number; h: number }>();
        for (const [name, entry] of pool) {
          if (entry.current) sizes.set(name, { w: entry.current.w, h: entry.current.h });
        }
        // mpv по умолчанию берёт OUTPUT — у нас это промежуточная стадия 2×
        const fallback = Math.max(1, Math.round(srcW * 2));

        for (const pass of passes) {
          const inputs: Rt[] = [];
          for (const name of pass.binds) {
            const input = pool.get(name)?.current;
            if (!input) return null; // вход не готов — структурная ошибка цепочки
            inputs.push(input);
          }
          const w = evalRpn(pass.width, sizes, fallback);
          const h = evalRpn(
            pass.height,
            sizes,
            Math.max(1, Math.round((fallback * srcH) / srcW)),
          );
          const target = acquire(
            pass.save,
            w,
            h,
            new Set(inputs.map((input) => input.tex)),
          );
          if (!target) return null;

          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          gl.viewport(0, 0, w, h);
          gl.useProgram(pass.program);
          for (let i = 0; i < pass.binds.length; i++) {
            const input = inputs[i];
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, input.tex);
            const sampler = pass.uSampler[i];
            const size = pass.uSize[i];
            const pt = pass.uPt[i];
            if (sampler) gl.uniform1i(sampler, i);
            if (size) gl.uniform2f(size, input.w, input.h);
            if (pt) gl.uniform2f(pt, 1 / input.w, 1 / input.h);
          }
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          if (gl.isContextLost()) return null;
          const entry = pool.get(pass.save);
          if (!entry) return null;
          entry.current = target;
          sizes.set(pass.save, { w: target.w, h: target.h });
        }

        const output = pool.get("MAIN")?.current;
        if (!output) return null;
        return { tex: output.tex, w: output.w, h: output.h };
      } catch {
        return null;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cleanup();
    },
  };
}
