/**
 * Cuándo suena la próxima alarma, en palabras: "hoy a las 20:30" se entiende
 * de un vistazo y "27/9/2026 20:30" no.
 *
 * Compara DÍAS DE CALENDARIO, no horas de diferencia: a las 23:00, una
 * alarma dentro de dos horas es "mañana", no "hoy" — que es exactamente lo
 * que alguien mirando la pantalla espera leer.
 *
 * 24 horas siempre, igual que el resto de la app: "12:00 a. m." es ambiguo
 * y en una app de medicación ese es el error más caro posible.
 */
export function describeNextAlarm(fecha: Date, ahora: Date): string {
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const soloDia = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((soloDia(fecha) - soloDia(ahora)) / 86_400_000);

  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `mañana a las ${hora}`;
  return `${fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a las ${hora}`;
}
