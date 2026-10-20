"use client";

/**
 * Компиляция и линковка WebGL-программ — общий инструментарий шейдеров
 * обработки картинки: нерезкая маска на hero-ролях (video-shader) и
 * движок Anime4K в плеере AniLiberty (anime4k).
 *
 * Везде null вместо исключения: вызывающий честно деградирует
 * (CSS-путь / без апскейла), а не роняет страницу.
 */

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
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

export function linkProgram(
  gl: WebGLRenderingContext,
  vert: string,
  frag: string,
): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  // Фиксируем слот атрибута: один VBO обслуживает все проходы
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
