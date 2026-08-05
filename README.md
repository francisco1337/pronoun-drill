# English Drill

Aplicación web progresiva para estudiar inglés por niveles. Es completamente
estática: no tiene backend, cuentas, base de datos, sincronización en la nube ni
IA en tiempo de ejecución. El contenido educativo se publica como JSON y la
actividad de cada estudiante permanece exclusivamente en su navegador.

## Arquitectura

| Ruta | Responsabilidad |
|---|---|
| `index.html`, `styles.css`, `src/app.js` | Interfaz y sesiones de estudio. |
| `src/content-service.js` | Carga bajo demanda el manifiesto, catálogos y ejemplos seleccionados. |
| `src/storage-service.js` | Único acceso a `localStorage`: configuración, progreso, errores, sesiones, migración e importación/exportación. |
| `data/manifest.json` | Punto de entrada y versión del contenido. |
| `data/levels/a1/` | Catálogos A1, definición de temas y archivos de ejemplos por elemento. |
| `data/professional/` | Catálogo y ejemplos de modales/auxiliares. |
| `generar-arquitectura.js` | Genera el árbol normalizado desde los JSON fuente. Solo se ejecuta durante desarrollo. |
| `scripts/validate-data.js` | Comprueba rutas, versiones, IDs, relaciones, esquemas y el máximo de 200 ejemplos por elemento. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y funcionamiento sin conexión. |

Los archivos `a1.json`, `frases.json` y `modales.json` se conservan como fuentes
de generación. La aplicación publicada no los descarga ni los importa. Tampoco
carga un paquete global con todo el banco: primero obtiene el manifiesto, después
el catálogo necesario y finalmente solo los archivos correspondientes a la
selección de la sesión.

## Desarrollo

Se requiere Node.js. Para regenerar y validar todo el contenido:

```bash
npm run generate:data
npm run validate:data
```

Para probar la aplicación y el service worker, sírvela por HTTP (abrir el HTML
con doble clic no permite usar `fetch` ni la PWA correctamente):

```bash
npm start
```

Después abre `http://127.0.0.1:4173`.

## Datos locales y privacidad

Las claves usan el espacio `englishTrainer:v1:*`. Se guardan preferencias,
selecciones por tema, progreso por ID estable, errores recientes, sesión en curso
y hasta 100 resúmenes. La pantalla de configuración permite exportar un respaldo
JSON, importarlo con validación, restablecer áreas concretas y cambiar la regla de
dominio. Si `localStorage` no está disponible o se llena, la app avisa y continúa
en modo temporal cuando es posible.

El contenido educativo nunca forma parte del respaldo del usuario. No se envía
información a ningún servidor.

## Publicación

El repositorio puede publicarse directamente con GitHub Pages desde la rama
`main`. Al cambiar recursos de la interfaz o el contenido, actualiza
`contentVersion` y el nombre de `CACHE` en `sw.js` para que las instalaciones
reciban la nueva versión.
