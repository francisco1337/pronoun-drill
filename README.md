# English Drill

Aplicación web progresiva para aprender inglés A1–B2 orientado a desarrollo full-stack, DevOps, automatización y trabajo remoto. Es completamente estática: no tiene backend, cuentas, base de datos remota ni IA en tiempo de ejecución.

## Contenido implementado

- Cuatro niveles completos: A1, A2, B1 y B2.
- Nueve áreas por nivel: gramática, verbos, vocabulario, expresiones, listening, writing, comunicación laboral, simulaciones y evaluaciones.
- Teoría por tema, formas verbales, errores comunes y ejemplos contextualizados.
- 27 modalidades: traducción en ambos sentidos, completar, relacionar, opción múltiple, orden, conjugación, transformaciones, corrección de errores, dictado, pronunciación, escritura y escenarios profesionales.
- Selección exacta de contenido por nivel, área, tema, tipo, categoría, estado, errores y repasos.
- Práctica adaptativa, repetición espaciada, cuaderno de errores y dominio simple o robusto.
- Progreso, sesiones y respaldos guardados exclusivamente en `localStorage`.
- Transferencia de avance entre dispositivos mediante exportación e importación JSON validada.

El banco generado actualmente contiene 1,032 elementos y 34,651 ejercicios. El reporte de importación enlaza 905 filas de las hojas fuente y documenta las filas duplicadas o inválidas omitidas.

## Arquitectura

| Ruta | Responsabilidad |
|---|---|
| `index.html`, `styles.css`, `src/app.js` | Interfaz, navegación y motor de práctica. |
| `src/content-service.js` | Carga bajo demanda manifiesto, currículo, catálogos y ejemplos. |
| `src/storage-service.js` | Acceso único a `localStorage`, migración, progreso e importación/exportación. |
| `data/manifest.json` | Punto de entrada y versión del contenido. |
| `data/curriculum.json` | Niveles, áreas, temas, teoría y relaciones por ID. |
| `data/levels/{a1,a2,b1,b2}/` | Catálogos pequeños y ejemplos separados por elemento. |
| `data/import-report.json` | Trazabilidad y omisiones de la importación. |
| `sources/google-sheets/` | Instantánea versionada de las fuentes importadas. |
| `scripts/build-curriculum.js` | Normaliza las fuentes y genera los cuatro niveles. |
| `scripts/validate-data.js` | Comprueba esquemas, IDs, rutas, relaciones, duplicados y límites. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y funcionamiento sin conexión. |

La aplicación primero descarga los catálogos pequeños y solo carga los JSON de ejemplos necesarios para la sesión elegida. Ninguna vista descarga de golpe el banco completo de ejercicios.

## Desarrollo y validación

Se requiere Node.js:

```bash
npm run generate:data
npm run validate:data
npm start
```

Abre `http://127.0.0.1:4173`. Servir por HTTP es necesario para `fetch`, el service worker y la instalación PWA.

## Datos locales y privacidad

Las claves usan el espacio `englishTrainer:v1:*`. Se guardan preferencias, selección, progreso por ID estable, errores, sesiones, listas personalizadas y reportes de contenido. La pantalla **Transferir avance** descarga un JSON con todo el estado personal —incluida una sesión en curso— y permite restaurarlo en el `localStorage` de otro navegador. La importación valida el esquema, conserva una copia preventiva del avance anterior y actualiza la interfaz inmediatamente. Los estados iniciales importados como dominados se conservan.

El contenido educativo no forma parte del respaldo del usuario y ningún dato se envía a servidores.

## Publicación

El repositorio puede publicarse directamente en GitHub Pages desde `main`. Al cambiar contenido o recursos, actualiza `contentVersion` y el nombre de caché en `sw.js`.
