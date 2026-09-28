/**
 * Stub de `react-native` para Vitest.
 *
 * Por qué existe: Vitest no puede parsear el Flow del código fuente de
 * react-native (ver el comentario en `vitest.config.mts`), así que cualquier
 * módulo de `src/` que lo importe rompe la suite entera al importarse — aunque
 * el test no ejercite nada nativo. Eso pasó cuando `design-system/tokens.ts`
 * empezó a leer `Appearance` para resolver el tema claro/oscuro: el token de
 * color es información de diseño pura, la usa un test de Vitest
 * (`adherence-display.test.ts`), y de golpe dejó de poder importarse.
 *
 * Qué NO es: un mock de la plataforma. Todo lo que de verdad ejercita
 * comportamiento nativo sigue yendo por Jest, que usa el preset real de
 * react-native. Acá sólo vive lo mínimo para que un módulo de presentación se
 * pueda importar.
 *
 * El `Proxy` es deliberado: si alguien importa de react-native algo que no
 * está declarado abajo, el test falla con el nombre exacto de lo que falta en
 * vez de recibir `undefined` y romperse más adelante de forma confusa. Un
 * stub silencioso taparía justamente el tipo de error que este archivo
 * pretende evitar.
 */

type Esquema = 'light' | 'dark' | null;

const declarado: Record<string, unknown> = {
  /** Vitest corre siempre en claro: es el tema por defecto y el que más se prueba. */
  Appearance: {
    getColorScheme: (): Esquema => null,
    addChangeListener: () => ({ remove: () => {} }),
  },
  Platform: {
    OS: 'android',
    select: (opciones: Record<string, unknown>) => opciones.android ?? opciones.default,
  },
};

export const Appearance = declarado.Appearance as {
  getColorScheme: () => Esquema;
  addChangeListener: (cb: unknown) => { remove: () => void };
};
export const Platform = declarado.Platform as { OS: string; select: (o: Record<string, unknown>) => unknown };

export default new Proxy(declarado, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    throw new Error(
      `El stub de react-native para Vitest no declara "${String(prop)}". ` +
        `Si el módulo bajo test necesita comportamiento nativo real, el test va en tests/native (Jest). ` +
        `Si sólo hace falta el símbolo, agregalo en tests/stubs/react-native.ts.`,
    );
  },
});
