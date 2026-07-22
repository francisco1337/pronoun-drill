# Pronoun Drill

Práctica de pronombres en inglés (PWA). **10 aciertos seguidos** dominan un pronombre;
**1 error** reinicia el contador de ese pronombre. Funciona offline y se puede instalar.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app (interfaz + lógica). Carga las frases desde `frases.json`. |
| `frases.json` | **Las frases** (inglés + traducción). Esto es lo que editas para cambiarlas. |
| `generar-frases.js` | Generador opcional: reconstruye `frases.json` a partir de plantillas y vocabulario. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Piezas de la PWA (instalable + offline). |

## Probar en tu PC

`frases.json` se carga por red, así que **no funciona abriendo `index.html` con doble clic**
(`file://` lo bloquea). Levanta un servidor estático en la carpeta:

```bash
npx --yes serve .
```

Luego abre la URL que muestre (p. ej. `http://localhost:3000`).

## Publicar en GitHub Pages (gratis)

```bash
git init
git add .
git commit -m "Pronoun Drill"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pronoun-drill.git
git push -u origin main
```

En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` / `root` → Save.** En 1–2 min queda en
`https://TU_USUARIO.github.io/pronoun-drill/`. Ábrela en el móvil y usa
**"Añadir a pantalla de inicio"** para instalarla como app.

## Cambiar o añadir frases

**Opción 1 — editar el JSON directo.** Abre `frases.json`, busca el pronombre y añade
objetos a su lista `sentences`:

```json
{ "en": "___ is my favorite book.", "es": "Este es mi libro favorito." }
```

Reglas: el inglés debe tener **exactamente un** `___` (el hueco). El español es la
traducción de apoyo (sin hueco).

**Opción 2 — regenerar con plantillas.** Edita `generar-frases.js` (agrega palabras a
`THINGS` o `NAMES`, o nuevas plantillas) y ejecuta:

```bash
node generar-frases.js
```

Cada palabra nueva del vocabulario añade frases a todos los pronombres a la vez.

## Al actualizar la app instalada

Si cambias `index.html`, `sw.js` o los iconos, sube el número de versión en `sw.js`
(`const CACHE = "pronoun-drill-v2"`) para que los dispositivos ya instalados tomen la
versión nueva. Los cambios solo en `frases.json` se ven al recargar con conexión.
