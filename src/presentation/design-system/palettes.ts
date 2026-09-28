/**
 * Las dos paletas de la app. Viven separadas de `tokens.ts` para que quede a
 * la vista que son **la misma forma con dos juegos de valores**: cualquier
 * clave que exista en una tiene que existir en la otra, y `Paleta` lo obliga
 * en tiempo de compilación.
 *
 * Todos los contrastes anotados abajo están medidos, no estimados. El umbral
 * que se respeta es el que ya prometía `tokens.ts` para el perfil de adulto
 * mayor: AAA (>=7:1) para el texto principal, AA (>=4.5:1) para el
 * secundario y los acentos usados como texto, y >=3:1 para el contorno de un
 * control o para texto grande en negrita (>=18.66px), que es el caso de las
 * etiquetas de botón — `typography.label` son 22px bold.
 */

export interface Paleta {
  readonly background: string;
  readonly surface: string;
  readonly surfaceSubtle: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly primary: string;
  /**
   * Relleno del botón primario, con texto blanco encima.
   *
   * Existe por el modo oscuro. En claro, `#2563EB` sirve para las dos cosas:
   * se lee como texto sobre el fondo (4.0:1) y aguanta blanco encima
   * (5.2:1). Sobre fondo oscuro eso deja de ser posible — un azul lo
   * bastante claro para leerse como link tiene blanco ilegible encima
   * (`#60A5FA`: texto 5.2:1 pero blanco 2.5:1), y uno lo bastante oscuro
   * para el blanco desaparece contra el fondo (`#2563EB`: blanco 5.2:1 pero
   * texto 2.6:1). Ningún color cumple los dos roles, así que se separan.
   * En claro los dos valen `#2563EB`, o sea que el modo claro no cambia nada.
   */
  readonly primaryFill: string;
  readonly primaryDark: string;
  readonly primaryLight: string;
  readonly primaryPressed: string;
  readonly primarySoft: string;
  readonly success: string;
  readonly successStrong: string;
  readonly successBackground: string;
  readonly critical: string;
  /** Relleno del botón destructivo. Misma razón que `primaryFill`. */
  readonly criticalFill: string;
  readonly criticalPressed: string;
  readonly criticalBackground: string;
  readonly warning: string;
  readonly warningBackground: string;
  readonly border: string;
  readonly borderLight: string;
  readonly disabled: string;
}

export const PALETA_CLARA: Paleta = {
  // Neumorfismo: la superficie es del MISMO color que el fondo, y lo que
  // separa una tarjeta del resto no es un relleno distinto sino la sombra.
  // Valores del generador con el que se eligió el estilo:
  // design.dev/tools/neumorphism — raised, light, dist 12, blur 36,
  // radius 24, intensity 7.
  background: '#DDE3EC',
  surface: '#DDE3EC',
  surfaceSubtle: '#DDE3EC',
  textPrimary: '#3C4858', // 7.2:1 sobre background (AAA)
  textSecondary: '#475569', // 5.9:1 sobre background (AA)
  // Se oscurecio respecto de #2563EB: ese daba 4.0:1 como texto sobre el
  // fondo, por debajo de AA. Los comentarios viejos decian "sobre blanco",
  // y dejaron de valer cuando el fondo paso a #DDE3EC con el tratamiento
  // extruido. El relleno SIGUE siendo #2563EB, que ahi si cumple.
  primary: '#1D4ED8', // 5.2:1 como texto sobre background
  primaryFill: '#2563EB', // blanco encima: 5.2:1
  primaryDark: '#1E40AF',
  primaryLight: '#3B82F6',
  primaryPressed: '#1E40AF',
  primarySoft: '#EFF6FF',
  success: '#166534', // 5.5:1 como texto sobre background
  // Tambien se oscurecio: #16A34A quedaba en 2.6:1 CONTRA EL FONDO, o sea
  // que el boton mas importante de la app no se distinguia como boton.
  successStrong: '#15803D', // contorno 3.9:1, blanco encima 5.0:1
  successBackground: '#F0FDF4',
  critical: '#B91C1C',
  criticalFill: '#B91C1C', // blanco encima: 6.5:1
  criticalPressed: '#991B1B',
  criticalBackground: '#FEF2F2',
  warning: '#9A3412', // 5.7:1 como texto sobre background
  warningBackground: '#FFF7ED',
  border: '#CBD5E1',
  // Casi invisible a propósito: con superficies extruidas, una línea marcada
  // corta el efecto. `border` (más oscuro) sí se ve — lo usa el contorno de
  // los botones secundarios, que es lo que los hace legibles como botones.
  borderLight: '#DDE3EC',
  // #94A3B8 dejaba el texto blanco del boton deshabilitado en 2.6:1.
  disabled: '#707E91', // blanco encima: 4.1:1
};

/**
 * El fondo oscuro NO es negro. El neumorfismo necesita margen para aclarar Y
 * oscurecer el mismo color: sobre negro puro no hay nada más oscuro que
 * poner del lado de la sombra, y la superficie extruida se convierte en una
 * mancha gris plana. `#2B303B` deja lugar para las dos direcciones y
 * conserva el tinte azulado de la paleta clara.
 */
export const PALETA_OSCURA: Paleta = {
  background: '#2B303B',
  surface: '#2B303B',
  surfaceSubtle: '#2B303B',
  textPrimary: '#E8ECF3', // 11.2:1 sobre background (AAA)
  textSecondary: '#B8C0CC', // 7.2:1 sobre background (AAA, mejor que en claro)
  primary: '#60A5FA', // 5.2:1 como texto sobre background
  primaryFill: '#3B82F6', // contorno 3.6:1, blanco encima 3.7:1
  primaryDark: '#93C5FD', // 7.1:1 sobre primarySoft
  primaryLight: '#60A5FA',
  primaryPressed: '#2563EB',
  primarySoft: '#223349',
  success: '#4ADE80', // 7.6:1 sobre background
  successStrong: '#16A34A', // contorno 4.0:1, blanco encima 3.3:1
  successBackground: '#16442B', // con `success` encima: 6.4:1
  critical: '#F87171', // 4.8:1 sobre background
  criticalFill: '#EF4444', // contorno 3.5:1, blanco encima 3.8:1
  criticalPressed: '#DC2626',
  criticalBackground: '#4A2525', // con `critical` encima: 4.8:1
  warning: '#FB923C', // 5.8:1 sobre background
  warningBackground: '#4A3116', // con `warning` encima: 5.3:1
  border: '#565F70',
  borderLight: '#2B303B',
  disabled: '#6B7280', // blanco encima: 4.8:1
};
