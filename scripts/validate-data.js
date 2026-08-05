const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];
const itemIds = new Set();
const exampleIds = new Set();
const examplesPerItem = new Map();
let exampleCount = 0;

function fail(message) { errors.push(message) }
function read(relativePath) {
  const clean = relativePath.replace(/^\.\//, "");
  const fullPath = path.resolve(root, clean);
  if (!fullPath.startsWith(root + path.sep)) throw new Error(`Ruta fuera del proyecto: ${relativePath}`);
  if (!fs.existsSync(fullPath)) throw new Error(`No existe ${relativePath}`);
  try { return JSON.parse(fs.readFileSync(fullPath, "utf8")) }
  catch (error) { throw new Error(`JSON inválido en ${relativePath}: ${error.message}`) }
}

function validateItem(item, source) {
  if (!item || typeof item !== "object") return fail(`Elemento inválido en ${source}`);
  if (!item.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) fail(`ID de elemento inestable en ${source}: ${item.id}`);
  if (itemIds.has(item.id)) fail(`ID de elemento duplicado: ${item.id}`);
  itemIds.add(item.id);
  if (!item.english && !item.label) fail(`Elemento sin texto inglés: ${item.id}`);
  if (!item.level || !item.type) fail(`Elemento incompleto: ${item.id}`);
}

function validateExample(example, topicId, source) {
  exampleCount += 1;
  if (!example.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(example.id)) fail(`ID de ejemplo inestable en ${source}: ${example.id}`);
  if (exampleIds.has(example.id)) fail(`ID de ejemplo duplicado: ${example.id}`);
  exampleIds.add(example.id);
  if (!itemIds.has(example.itemId)) fail(`Ejemplo ${example.id} apunta a un elemento inexistente: ${example.itemId}`);
  if (example.topicId !== topicId) fail(`Tema incorrecto en ${example.id}: ${example.topicId} != ${topicId}`);
  if (!example.prompt || !example.answer || !example.explanation) fail(`Ejemplo incompleto: ${example.id}`);
  if (!Array.isArray(example.acceptableAnswers) || !Array.isArray(example.options) || !Array.isArray(example.grammarTags)) fail(`Listas inválidas en ${example.id}`);
  if (example.mode === "fill-blank" && example.options.length && !example.options.includes(example.answer)) fail(`La respuesta no aparece entre las opciones de ${example.id}`);
  const count = (examplesPerItem.get(example.itemId) || 0) + 1;
  examplesPerItem.set(example.itemId, count);
}

try {
  const manifest = read("./data/manifest.json");
  if (manifest.schemaVersion !== 1) fail("schemaVersion del manifiesto no soportado");
  if (!manifest.contentVersion) fail("El manifiesto no tiene contentVersion");

  const catalogPaths = [
    manifest.levels?.A1?.verbs,
    manifest.levels?.A1?.pronouns,
    manifest.levels?.A1?.grammarItems,
    manifest.levels?.A1?.expressions
  ].filter(Boolean);

  for (const catalogPath of catalogPaths) {
    const catalog = read(catalogPath);
    if (catalog.contentVersion !== manifest.contentVersion) fail(`Versión distinta en ${catalogPath}`);
    if (!Array.isArray(catalog.items)) fail(`Catálogo sin items: ${catalogPath}`);
    else catalog.items.forEach((item) => validateItem(item, catalogPath));
  }

  const modalPath = manifest.professional?.modals;
  const modals = read(modalPath);
  if (modals.contentVersion !== manifest.contentVersion) fail(`Versión distinta en ${modalPath}`);
  modals.items.forEach((item) => validateItem(item, modalPath));

  const grammarPath = manifest.levels?.A1?.grammar;
  const grammar = read(grammarPath);
  if (grammar.contentVersion !== manifest.contentVersion) fail(`Versión distinta en ${grammarPath}`);
  const definitions = [...grammar.topics, { ...modals, id: modals.topicId }];

  const promptsByItem = new Map();
  for (const definition of definitions) {
    if (!definition.id || !Array.isArray(definition.itemIds) && definition !== definitions.at(-1)) fail(`Definición de tema inválida: ${definition.id}`);
    const topicItemIds = definition.itemIds || definition.items.map((item) => item.id);
    topicItemIds.forEach((id) => { if (!itemIds.has(id)) fail(`Tema ${definition.id} referencia ${id}, que no existe`) });
    if (!Array.isArray(definition.exampleChunks) || !definition.exampleChunks.length) fail(`Tema sin archivos de ejemplos: ${definition.id}`);
    for (const chunk of definition.exampleChunks || []) {
      const file = read(chunk.path);
      if (file.contentVersion !== manifest.contentVersion) fail(`Versión distinta en ${chunk.path}`);
      if (file.topicId !== definition.id) fail(`topicId incorrecto en ${chunk.path}`);
      if (!Array.isArray(file.examples)) { fail(`Archivo sin examples: ${chunk.path}`); continue }
      if (chunk.count !== file.examples.length) fail(`Conteo incorrecto en ${chunk.path}`);
      file.examples.forEach((example) => {
        validateExample(example, definition.id, chunk.path);
        const key = `${example.prompt}\u0000${example.answer}`.toLowerCase();
        const known = promptsByItem.get(example.itemId) || new Set();
        if (known.has(key)) warnings.push(`Ejemplo repetido para ${example.itemId}: ${example.prompt}`);
        known.add(key);
        promptsByItem.set(example.itemId, known);
      });
    }
  }

  for (const [itemId, count] of examplesPerItem) {
    if (count > 200) fail(`${itemId} supera el máximo de 200 ejemplos (${count})`);
  }

  if (errors.length) {
    console.error(`Validación fallida con ${errors.length} error(es):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`Datos válidos: ${itemIds.size} elementos, ${exampleCount} ejemplos y ${definitions.length} temas.`);
    if (warnings.length) console.log(`${warnings.length} advertencia(s) de contenido repetido.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
