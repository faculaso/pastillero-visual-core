/**
 * Cálculo de contraste WCAG 2.1, compartido por los tests de color.
 *
 * Vive acá y no dentro de un test porque hay dos suites que lo necesitan —
 * la de los temas por turno y la de la paleta clara/oscura — y tener dos
 * copias del mismo cálculo es la forma más fácil de que una se corrija y la
 * otra no.
 *
 * Soporta colores traslúcidos en el frente (`rgba(...)`), que es
 * imprescindible: buena parte de los chips y ranuras de la app son blancos o
 * negros con alfa sobre el fondo del turno, y el ratio real es el del color
 * YA APLANADO contra ese fondo, no el del rgba en abstracto.
 */

export type Rgb = readonly [number, number, number];

export function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hexDigits = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hexDigits !== undefined) {
    const n = parseInt(hexDigits, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Color no soportado por el test: ${value}`);
}

/** Aplana un color traslúcido sobre un fondo opaco (lo que ve el ojo). */
export function composite(foreground: string, background: string): Rgb {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (bg.alpha !== 1) throw new Error('El fondo tiene que ser opaco');
  const blend = (channel: number, base: number): number => channel * fg.alpha + base * (1 - fg.alpha);
  return [blend(fg.rgb[0], bg.rgb[0]), blend(fg.rgb[1], bg.rgb[1]), blend(fg.rgb[2], bg.rgb[2])];
}

export function relativeLuminance(rgb: Rgb): number {
  const toLinear = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

export function toHex(rgb: Rgb): string {
  const channel = (value: number): string => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

/** `foreground` puede ser traslúcido; `background` tiene que ser opaco. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(composite(foreground, background));
  const l2 = relativeLuminance(parseColor(background).rgb);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}
