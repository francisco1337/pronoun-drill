/* Empaqueta los JSON como una variable JavaScript para que la app no necesite
 * fetch(), servidor local ni peticiones de red para cargar sus ejercicios. */
const fs = require("fs");
const path = require("path");

const pronouns = JSON.parse(fs.readFileSync(path.join(__dirname, "frases.json"), "utf8"));
const modals = JSON.parse(fs.readFileSync(path.join(__dirname, "modales.json"), "utf8"));
const a1 = JSON.parse(fs.readFileSync(path.join(__dirname, "a1.json"), "utf8"));
const output =
  "/* Archivo generado. No editar directamente. */\n" +
  "window.ENGLISH_DRILL_DATA=" +
  JSON.stringify({ pronouns, modals, a1 }) +
  ";\n";

fs.writeFileSync(path.join(__dirname, "datos-client.js"), output, "utf8");
console.log("datos-client.js generado sin dependencias de fetch().");
