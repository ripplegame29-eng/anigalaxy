"use client";

/**
 * WebGL-шейдер резкости для локальных hero-роликов (идея Anime4K / CAS).
 *
 * Аниме — это плоские заливки и чёткие линии, стандартный билинейный фильтр
 * размазывает их при любом масштабировании. Шейдер берёт кадр из <video>
 * (оно остаётся источником звука и декодирования), добавляет нерезкую маску
 * по четырём соседям и лёгкий подъём контраста — изображение выглядит
 * «апскейленным», хотя исходник тот же.
 *
 * Деградация без потери функциональности: нет WebGL, шейдер не скомпилировался
 * или контекст потерян — возвращается пустая очистка, канвас остаётся
 * прозрачным, и пользователь видит обычное видео.
 */

export interface SharpenOptions {
  /** Сила нерезкой маски: 0.15–0.4 умеренно, выше — ореолы на линиях */
  strength: number;
  /** Подъём контраста, 1 — выкл */
  contrast: number;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vUv = aPos * 0.5 + 0.5;
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uScale;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uContrast;

void main() {
  vec2 uv = (vUv - 0.5) * uScale + 0.5;
  vec3 c = texture2D(uTex, uv).rgb;
  vec3 n = texture2D(uTex, uv + vec2(0.0, uTexel.y)).rgb;
  vec3 s = texture2D(uTex, uv - vec2(0.0, uTexel.y)).rgb;
  vec3 w = texture2D(uTex, uv - vec2(uTexel.x, 0.0)).rgb;
  vec3 e = texture2D(uTex, uv + vec2(uTexel.x, 0.0)).rgb;
  vec3 sharp = c + (4.0 * c - (n + s + w + e)) * uStrength;
  sharp = (sharp - 0.5) * uContrast + 0.5;
  gl_FragColor = vec4(clamp(sharp, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Прикрепляет шейдер к канвасу поверх активного ролика.
 *
 * Возвращает функцию очистки: останавливает цикл отрисовки, освобождает
 * ресурсы и сразу отдаёт WebGL-контекст браузеру (контекстов вкладка
 * держит ограниченное число, а слайды меняются каждые 7 секунд).
 */
export function attachSharpen(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  options: SharpenOptions,
): () => void {
  const noop = (): void => {};

  const gl = canvas.getContext("webgl", {
    alpha: true, // до первого кадра канвас прозрачный — видно постер
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return noop;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERT);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (program) gl.deleteProgram(program);
    return noop;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return noop;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture) {
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    gl.deleteProgram(program);
    return noop;
  }

  // Полноэкранный треугольник (2 треугольника из трёх вершин)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  const uScale = gl.getUniformLocation(program, "uScale");
  const uTexel = gl.getUniformLocation(program, "uTexel");
  gl.uniform1f(gl.getUniformLocation(program, "uStrength"), options.strength);
  gl.uniform1f(gl.getUniformLocation(program, "uContrast"), options.contrast);

  let disposed = false;
  let rafId = 0;
  let lastTime = -1;

  const onLost = (event: Event): void => {
    event.preventDefault();
    disposed = true;
    cancelAnimationFrame(rafId);
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const frame = (): void => {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);

    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    // Канвас держим в размерах контейнера с ограничением по devicePixelRatio,
    // чтобы на 4K-экранах шейдер не считал кадр втрое дороже без выигрыша.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    const resized = width !== canvas.width || height !== canvas.height;
    if (resized) {
      canvas.width = width;
      canvas.height = height;
    }
    // Кадр не изменился (видео на паузе) — перезаливать текстуру незачем
    if (!resized && video.currentTime === lastTime) return;
    lastTime = video.currentTime;

    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // object-cover: подрезаем ту ось, которая «длиннее» контейнера
    const canvasRatio = width / height;
    const videoRatio = video.videoWidth / video.videoHeight;
    const scaleX = videoRatio > canvasRatio ? canvasRatio / videoRatio : 1;
    const scaleY = videoRatio > canvasRatio ? 1 : videoRatio / canvasRatio;
    gl.uniform2f(uScale, scaleX, scaleY);
    gl.uniform2f(uTexel, scaleX / video.videoWidth, scaleY / video.videoHeight);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  rafId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener("webglcontextlost", onLost);
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
