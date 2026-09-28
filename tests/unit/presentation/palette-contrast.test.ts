import { describe, it, expect } from 'vitest';
import { PALETA_CLARA, PALETA_OSCURA, type Paleta } from '../../../src/presentation/design-system/palettes';
import { contrastRatio } from '../../helpers/contrast';

/**
 * `tokens.ts` promete, desde la primera línea de su docblock, "contraste AAA
 * (>=7:1) en texto sobre fondo, no solo AA" para el perfil de adulto mayor.
 * Hasta ahora esa promesa vivía sólo en un comentario y en los números que
 * alguien anotó al lado de cada color — que es exactamente el tipo de cosa
 * que se desactualiza en silencio cuando se cambia un token.
 *
 * Con la paleta oscura el riesgo se duplica literalmente: los mismos roles,
 * el doble de valores, y ninguna forma de verlos todos juntos en pantalla.
 *
 * Umbrales, y por qué cada uno:
 *  - Texto principal: 7:1 (AAA), que es lo que promete el archivo.
 *  - Texto secundario y acentos usados COMO TEXTO: 4.5:1 (AA normal).
 *  - Texto blanco sobre un relleno de color: 3:1. Las etiquetas de botón son
 *    `typography.label` (22px) en negrita, o sea "texto grande" para WCAG,
 *    cuyo umbral es 3:1 y no 4.5:1.
 *  - Contorno de un control contra el fondo: 3:1 (WCAG 2.1, componentes de
 *    interfaz). Es lo que hace que un botón se lea COMO botón.
 */

const BLANCO = '#FFFFFF';

const PALETAS: ReadonlyArray<readonly [string, Paleta]> = [
  ['clara', PALETA_CLARA],
  ['oscura', PALETA_OSCURA],
];

describe('contraste de la paleta', () => {
  it.each(PALETAS)('%s: el texto principal sobre el fondo llega a AAA (>=7:1)', (_n, p) => {
    expect(contrastRatio(p.textPrimary, p.background)).toBeGreaterThanOrEqual(7);
  });

  it.each(PALETAS)('%s: el texto secundario llega a AA (>=4.5:1)', (_n, p) => {
    expect(contrastRatio(p.textSecondary, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETAS)('%s: `primary` se puede LEER sobre el fondo (>=4.5:1)', (_n, p) => {
    // Se usa como color de link y de ícono activo, no sólo como relleno.
    expect(contrastRatio(p.primary, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETAS)('%s: los rellenos de botón aguantan texto blanco grande (>=3:1)', (_n, p) => {
    expect(contrastRatio(BLANCO, p.primaryFill)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(BLANCO, p.successStrong)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(BLANCO, p.criticalFill)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(BLANCO, p.disabled)).toBeGreaterThanOrEqual(3);
  });

  it.each(PALETAS)('%s: los rellenos de botón se distinguen del fondo (>=3:1)', (_n, p) => {
    // Sin esto un botón lleno se funde con la pantalla y deja de leerse como
    // botón, que es el riesgo concreto que trae el tratamiento extruido.
    expect(contrastRatio(p.primaryFill, p.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.successStrong, p.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.criticalFill, p.background)).toBeGreaterThanOrEqual(3);
  });

  it.each(PALETAS)('%s: cada tinte de estado sostiene su propio texto (>=4.5:1)', (_n, p) => {
    expect(contrastRatio(p.success, p.successBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.critical, p.criticalBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.warning, p.warningBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.primaryDark, p.primarySoft)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETAS)('%s: los acentos se leen como texto sobre el fondo (>=4.5:1)', (_n, p) => {
    expect(contrastRatio(p.success, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.critical, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.warning, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('las dos paletas declaran exactamente las mismas claves', () => {
    // Si una gana un token y la otra no, el modo que falte hereda `undefined`
    // y React Native lo ignora en silencio: el color simplemente no se
    // aplica, sin error y sin pista de dónde mirar.
    expect(Object.keys(PALETA_OSCURA).sort()).toEqual(Object.keys(PALETA_CLARA).sort());
  });
});
