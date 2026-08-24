/**
 * Conversión HSV <-> hex para el selector de color completo (rueda de matiz +
 * cuadrado de saturación/brillo) de `ColorWheelPicker`. Funciones puras,
 * sin dependencias de React Native, para poder testearlas sin el runtime.
 */
export interface HsvColor {
  /** Matiz, en grados [0, 360). */
  readonly h: number;
  /** Saturación, [0, 1]. */
  readonly s: number;
  /** Brillo/valor, [0, 1]. */
  readonly v: number;
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Sin match reconocible (no es un hex #RRGGBB de 6 dígitos), devuelve blanco puro (h=0, s=0, v=1) — mismo default que el resto del design system usa para "sin color elegido todavía". */
export function hexToHsv(hex: string): HsvColor {
  const match = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return { h: 0, s: 0, v: 1 };

  const intVal = parseInt(match[1]!, 16);
  const r = ((intVal >> 16) & 0xff) / 255;
  const g = ((intVal >> 8) & 0xff) / 255;
  const b = (intVal & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): readonly [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  const [r1, g1, b1] = rgbSectorFor(h, c, x);

  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function rgbSectorFor(h: number, c: number, x: number): readonly [number, number, number] {
  if (h < 60) return [c, x, 0];
  if (h < 120) return [x, c, 0];
  if (h < 180) return [0, c, x];
  if (h < 240) return [0, x, c];
  if (h < 300) return [x, 0, c];
  return [c, 0, x];
}

function toHex(component: number): string {
  return Math.max(0, Math.min(255, component)).toString(16).padStart(2, '0');
}
