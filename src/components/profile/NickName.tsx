"use client";

import { DEFAULT_NICK_STYLE, nickStyleProps, type NickStyle } from "@/lib/nickname";

/**
 * Отображаемое имя с оформлением (услуга «Цвет ника»).
 *
 * Классы и переменные берёт `lib/nickname.ts` — тот же источник, что и
 * превью в окне услуги, поэтому окно и профиль показывают одно и то же.
 */

export interface NickNameProps {
  name: string;
  style?: NickStyle;
  className?: string;
}

export function NickName({ name, style, className }: NickNameProps) {
  const props = nickStyleProps(style ?? DEFAULT_NICK_STYLE);
  return (
    <span className={`${props.className}${className ? ` ${className}` : ""}`} style={props.vars}>
      {name}
    </span>
  );
}
