/**
 * Aclara (`percent` > 0) u oscurece (`percent` < 0) un color hex `#RRGGBB`
 * en un porcentaje 0-100. Usado para derivar los stops del gradiente
 * "glossy" de `PillVisual` a partir del único color que guarda el dominio
 * (`VisualProfile.color`) — no hay un segundo color persistido para el
 * brillo/sombra del comprimido.
 */
export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(num)) return hex;

  const amount = Math.round(2.55 * percent);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);

  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}
