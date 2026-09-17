# data/

## `vademecum-anmat.csv`

Catálogo de medicamentos del Vademécum Nacional (ANMAT) que alimenta la
búsqueda de CU-01. **16.139 registros**, delimitador `;`, UTF-8.

Es la FUENTE, no el artefacto: el `.db` que consume la app se genera desde
acá y por eso está en `.gitignore`.

```bash
npm run seed:anmat -- --input data/vademecum-anmat.csv --db pastillero.db
```

El `.db` resultante se copia al proyecto host como
`android/app/src/main/assets/custom/pastillero-catalog.db` — ver
`host-integration/README.md`, paso 4.

### Procedencia (leer antes de confiar en este archivo)

Los datos vienen de un scrape del sitio oficial de ANMAT hecho el
**2026-08-24**. El script que lo produjo y su salida original (JSON + CSV
normalizado) se perdieron: vivían en carpetas temporales.

Lo que sobrevivió fue el `.db` ya ingestado. Este CSV se reconstruyó desde
ese `.db` el **2026-09-17** y se verificó regenerándolo: las 16.139 filas
salen idénticas campo por campo.

Consecuencias prácticas:

- **No hay forma de re-scrapear incrementalmente.** Para actualizar el
  catálogo hay que escribir el scraper de nuevo. Cuando eso pase, el
  script va en `scripts/` y commiteado — sin él, este CSV es un dato
  irreemplazable en vez de uno cacheado.
- **No hay versión del vademécum.** ANMAT da de alta y de baja productos;
  un registro de agosto de 2026 envejece. En una app de medicación que
  muestra concentraciones, saber qué versión del catálogo shippeó en cada
  release importa — hoy no se puede responder.

### Formato

Columnas obligatorias (las filas que no las tengan se descartan en la
ingesta, y el script las reporta): `nro_certificado`, `nombre_comercial`,
`generico_droga`, `laboratorio`.

Opcionales: `forma_farmaceutica` (es la que mapea sola a `PillShape`),
`concentracion`, `presentacion_unidades`. Cualquier otra columna se ignora.
