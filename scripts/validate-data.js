const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];
const itemIds = new Set();
const exampleIds = new Set();
const examplesPerItem = new Map();
const sourceRefs = new Set();
const readFiles = new Set();
let exampleCount = 0;

const fail = (message) => errors.push(message);
const cleanPath = (value) => value.replace(/^\.\//, "");
function read(relativePath) {
  const full = path.resolve(root, cleanPath(relativePath));
  if (!full.startsWith(root + path.sep)) throw new Error(`Ruta fuera del proyecto: ${relativePath}`);
  if (!fs.existsSync(full)) throw new Error(`No existe ${relativePath}`);
  try { return JSON.parse(fs.readFileSync(full, "utf8")) }
  catch (error) { throw new Error(`JSON inválido en ${relativePath}: ${error.message}`) }
}
const stableId = (id) => typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const normalized = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(can not)\b/g, "cannot").replace(/[^a-z0-9]+/g, " ").trim();
const sourceKey = (source) => source?.spreadsheetId && source?.sheet && source?.row ? `${source.spreadsheetId}|${source.sheet}|${source.row}` : null;

function validateItem(item, file, contentVersion) {
  if (!stableId(item.id)) fail(`ID de elemento inválido en ${file}: ${item.id}`);
  if (itemIds.has(item.id)) fail(`ID de elemento duplicado: ${item.id}`);
  itemIds.add(item.id);
  if (!item.level || !item.type || !item.english || !item.spanish) fail(`Elemento incompleto: ${item.id}`);
  if (item.active === false) return;
  const key = sourceKey(item.source);
  if (key) sourceRefs.add(key);
  if (!item.defaultStatus) fail(`Elemento sin estado inicial: ${item.id}`);
}

function validateExampleFile(filePath, expectedVersion) {
  if (readFiles.has(filePath)) return;
  readFiles.add(filePath);
  const file = read(filePath);
  if (file.contentVersion !== expectedVersion) fail(`Versión distinta en ${filePath}`);
  if (!Array.isArray(file.examples)) return fail(`Archivo sin examples: ${filePath}`);
  const seenContent = new Set();
  file.examples.forEach((example) => {
    exampleCount += 1;
    if (!stableId(example.id)) fail(`ID de ejemplo inválido: ${example.id}`);
    if (exampleIds.has(example.id)) fail(`ID de ejemplo duplicado: ${example.id}`);
    exampleIds.add(example.id);
    if (!itemIds.has(example.itemId)) fail(`${example.id} referencia un elemento inexistente: ${example.itemId}`);
    if (!example.prompt || !example.answer || !example.explanation) fail(`Ejemplo incompleto: ${example.id}`);
    const modes = example.compatibleModes || (example.mode ? [example.mode] : []);
    if (!Array.isArray(modes) || !modes.length) fail(`Ejemplo sin modalidades: ${example.id}`);
    if (!Array.isArray(example.acceptableAnswers)) fail(`acceptableAnswers inválido: ${example.id}`);
    const contentKey = `${example.itemId}|${normalized(example.prompt)}|${normalized(example.answer)}`;
    if (seenContent.has(contentKey)) fail(`Ejemplo duplicado tras normalizar: ${example.id}`);
    seenContent.add(contentKey);
    examplesPerItem.set(example.itemId, (examplesPerItem.get(example.itemId) || 0) + 1);
  });
}

try {
  const manifest = read("./data/manifest.json");
  const curriculum = read(manifest.curriculum);
  const report = read(manifest.importReport);
  const source = read("./sources/google-sheets/curriculum-source.json");
  if (manifest.schemaVersion !== 1 || curriculum.schemaVersion !== 1) fail("schemaVersion no soportado");
  if (manifest.contentVersion !== curriculum.contentVersion) fail("Manifest y currículo tienen versiones distintas");
  const requiredAreas = ["grammar", "verbs", "vocabulary", "expressions", "listening", "writing", "workplace", "simulations", "evaluation"];

  for (const level of curriculum.levels || []) {
    const definition = manifest.levels?.[level.id];
    if (!definition) { fail(`Nivel ${level.id} ausente del manifest`); continue }
    for (const catalogPath of Object.values(definition.catalogs || {})) {
      const catalog = read(catalogPath);
      if (catalog.contentVersion !== manifest.contentVersion) fail(`Versión distinta en ${catalogPath}`);
      if (!Array.isArray(catalog.items)) fail(`Catálogo sin items: ${catalogPath}`);
      else catalog.items.forEach((item) => validateItem(item, catalogPath, manifest.contentVersion));
    }
  }

  for (const level of curriculum.levels || []) {
    const areaIds = new Set(level.areas.map((area) => area.id));
    requiredAreas.forEach((id) => { if (!areaIds.has(id)) fail(`${level.id} no contiene el área ${id}`) });
    for (const area of level.areas) for (const topic of area.topics || []) {
      if (!stableId(topic.id)) fail(`ID de tema inválido: ${level.id}/${area.id}/${topic.id}`);
      if (!Array.isArray(topic.itemIds) || !topic.itemIds.length) fail(`Tema sin elementos: ${level.id}/${topic.id}`);
      (topic.itemIds || []).forEach((id) => { if (!itemIds.has(id)) fail(`Tema ${topic.id} referencia ${id}, que no existe`) });
      if (!Array.isArray(topic.availableModes) || !topic.availableModes.length) fail(`Tema sin modalidades: ${topic.id}`);
      const key = sourceKey(topic.source);
      if (key) sourceRefs.add(key);
      (topic.sourceAliases || []).map(sourceKey).filter(Boolean).forEach((value) => sourceRefs.add(value));
      (topic.exampleFiles || []).forEach((entry) => validateExampleFile(entry.path, manifest.contentVersion));
    }
  }

  for (const [itemId, count] of examplesPerItem) if (count > 200) fail(`${itemId} supera 200 ejemplos (${count})`);
  for (const level of source.levels) for (const sheet of ["Gramática", "Vocabulario", "Expresiones"]) {
    const rows = level.sheets[sheet].slice(3);
    rows.forEach((row, index) => {
      const rowNumber = index + 4;
      const key = `${level.spreadsheetId}|${sheet}|${rowNumber}`;
      const omitted = report.omittedRows.some((value) => value.level === level.id && value.sheet === sheet && value.row === rowNumber);
      if (!sourceRefs.has(key) && !omitted) fail(`Fila educativa sin ID: ${level.id}/${sheet}/${rowNumber}`);
    });
  }

  const expectedRows = Object.values(report.validRows).reduce((sum, value) => sum + value.grammar + value.vocabulary + value.expressions, 0);
  if (expectedRows < 1) fail("El reporte de importación no contiene filas válidas");
  if (errors.length) {
    console.error(`Validación fallida con ${errors.length} error(es):`);
    errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
    if (errors.length > 100) console.error(`- … ${errors.length - 100} errores adicionales`);
    process.exitCode = 1;
  } else {
    console.log(`Datos válidos: ${curriculum.levels.length} niveles, ${itemIds.size} elementos, ${exampleCount} ejemplos, ${sourceRefs.size} filas vinculadas.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
