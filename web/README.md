# web/

Sitio público de Pastillero Visual. Tres páginas, HTML y CSS a mano, **sin
build ni dependencias**: se sirve tal cual está.

```
web/
├── index.html       Landing
├── privacidad.html  Política de privacidad (la exige Google Play)
├── soporte.html     Ayuda y preguntas frecuentes
└── estilos.css      Hoja compartida
```

No hay framework a propósito. Son tres documentos que cambian dos veces por
año; meter Next.js acá significaría un `node_modules`, un paso de build y
actualizaciones de seguridad que mantener, a cambio de nada.

## ANTES DE PUBLICAR

Las páginas tienen huecos marcados con `[COMPLETAR: …]`, resaltados en
amarillo para que sea imposible publicarlos sin verlos. Buscá `completar` en
el HTML. Hacen falta:

| Dato | Dónde |
| --- | --- |
| Nombre o razón social del responsable | `privacidad.html` |
| Domicilio | `privacidad.html` |
| Correo de contacto | `privacidad.html` (×3), `soporte.html` (×2) |
| Región del proyecto de Supabase | `privacidad.html` §5 |
| Plazo de borrado de cuenta | `privacidad.html` §7 |
| Fecha de entrada en vigencia | `privacidad.html`, encabezado |

La región de Supabase está en el dashboard del proyecto, en Settings →
General. Importa porque determina si hay transferencia internacional de
datos, y eso hay que declararlo.

> **La política de privacidad es un borrador técnico, no asesoramiento
> legal.** Describe con exactitud lo que el código hace hoy — se escribió
> leyendo el esquema de la base, no una plantilla. Pero maneja datos de
> salud, que la Ley 25.326 clasifica como sensibles: que la revise alguien
> que sepa antes de publicarla.

## Deploy en Vercel

El sitio vive dentro del repo de la app, así que hay que apuntar Vercel al
subdirectorio:

1. Importar el repo en Vercel.
2. **Root Directory**: `web`
3. **Framework Preset**: `Other`
4. Build Command y Output Directory: vacíos. No hay nada que compilar.

Funciona igual en Cloudflare Pages, Netlify o GitHub Pages: son archivos
estáticos.

## Decisiones de diseño

**La paleta no se inventó.** Son los mismos tokens que usa la app
(`src/presentation/design-system/tokens.ts` y `utils/time-of-day-theme.ts`).
Los fondos de mañana, tarde y noche son la firma visual del producto, y las
dos tarjetas de la sección de roles usan justamente el color que cada
persona ve en su propio teléfono.

**La pastilla del hero se dibuja como la dibuja la app**: gradiente claro →
base → oscuro más una elipse de brillo especular, la misma técnica que
`PillVisual`.

**La tipografía es Atkinson Hyperlegible**, del Braille Institute, diseñada
para personas con baja visión: distingue 1 de l de I, y 0 de O. Para una app
cuya tesis es que alguien no confunda dos pastillas, es la elección con más
sentido disponible.

**Los pasos están numerados porque son una secuencia real** (el recorrido de
una toma), no para decorar una lista.

## Verificación

Probado con Chrome headless y en un viewport real de 375 px: sin
desbordamiento horizontal, contraste por encima de 7:1 en todas las
combinaciones de texto, foco visible (invertido a blanco sobre el índigo),
`prefers-reduced-motion` respetado y un solo `h1` por página con los
encabezados en orden.

Ojo al medir: `chrome --headless --window-size=390,…` **no** maqueta a 390 px
—usa un ancho mayor y recorta—, así que aparenta un desbordamiento que no
existe. Para responsive hay que usar un viewport emulado de verdad.
