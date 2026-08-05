/* Construye el currículo A1–B2 desde la instantánea de Google Sheets.
 * Se ejecuta únicamente durante desarrollo; la aplicación consume los JSON resultantes. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const SOURCE = JSON.parse(fs.readFileSync(path.join(ROOT, "sources/google-sheets/curriculum-source.json"), "utf8"));
const CONTENT_VERSION = "2026.08.2";
const INITIAL_EXAMPLES_PER_ITEM = 30;
const MAX_EXAMPLES_PER_ITEM = 200;

const LEVELS = {
  A1: { title: "Base operativa", color: "blue", description: "Construye oraciones y participa en interacciones laborales sencillas." },
  A2: { title: "Comunicación cotidiana laboral", color: "green", description: "Describe problemas, planes y acciones pasadas en el trabajo." },
  B1: { title: "Trabajo remoto funcional", color: "orange", description: "Colabora con autonomía en tareas, revisiones e incidentes." },
  B2: { title: "Autonomía profesional", color: "purple", description: "Argumenta decisiones, facilita reuniones y supera entrevistas técnicas." }
};

const REQUIRED_GRAMMAR = {
  A1: ["Pronombres personales", "Verbo to be", "Artículos", "Presente simple", "Do/does", "Tercera persona", "There is/there are", "Presente continuo", "Have/has", "Can/can’t", "WH questions", "Imperativos", "Preposiciones de tiempo y lugar", "Posesivos", "Pronombres de objeto"],
  A2: ["Pasado simple", "Did", "Pasado continuo", "Will", "Going to", "Can, could, should y must", "Comparativos y superlativos", "Contables e incontables", "Peticiones con could/would", "Secuenciación", "Too/enough", "Infinitivo de propósito", "Causa, resultado y contraste", "Formación de preguntas"],
  B1: ["Present perfect", "Present perfect contra past simple", "First conditional", "Second conditional", "Passive voice", "Gerunds and infinitives", "Relative clauses", "Linking words", "Modales de deducción", "Tiempos narrativos", "Propósito y resultado", "Sugerencias corteses", "Fechas, arreglos y compromisos", "Preguntas técnicas"],
  B2: ["Present perfect continuous", "Past perfect", "Reported speech", "Indirect questions", "Past modals", "Advanced passive", "Mixed conditionals", "Hedging and diplomacy", "Reporting verbs", "Contraste avanzado", "Grados de certeza", "Lenguaje de negociación", "Frases nominales complejas", "Organización del discurso"]
};

const COMMUNICATION = {
  A1: [
    ["Presentarse", "introduce yourself"], ["Decir que trabaja desde casa", "say that you work from home"], ["Describir su stack", "describe your technology stack"],
    ["Describir su tarea actual", "describe your current task"], ["Pedir ayuda", "ask for help"], ["Pedir repetición", "ask someone to repeat"],
    ["Pedir que compartan pantalla", "ask someone to share their screen"], ["Reportar un error sencillo", "report a simple error"],
    ["Hablar de archivos, carpetas y acceso", "talk about files, folders, and access"], ["Decir qué puede y qué no puede hacer", "explain what you can and cannot do"]
  ],
  A2: [
    ["Describir un bug", "describe a bug"], ["Explicar cuándo comenzó", "explain when an issue started"], ["Explicar qué se intentó", "explain what you tried"],
    ["Reportar un deployment fallido", "report a failed deployment"], ["Comunicar planes", "communicate plans"], ["Comparar opciones", "compare options"],
    ["Pedir aclaraciones", "ask for clarification"], ["Preguntar fechas", "ask about dates"], ["Solicitar una revisión", "request a review"],
    ["Pedir más tiempo", "ask for more time"], ["Coordinar una llamada", "schedule a call"], ["Escribir mensajes de Slack", "write Slack messages"],
    ["Crear tickets sencillos", "create simple tickets"]
  ],
  B1: [
    ["Daily stand-up", "give a daily stand-up update"], ["Progreso, siguiente paso y bloqueo", "report progress, next steps, and blockers"], ["Tickets", "write actionable tickets"],
    ["Acceptance criteria", "define acceptance criteria"], ["Estimaciones", "discuss estimates"], ["Alcance", "clarify scope"], ["Dependencias", "explain dependencies"],
    ["Pull requests", "write pull request descriptions"], ["Code review", "give code review feedback"], ["Breaking changes", "communicate breaking changes"],
    ["Pruebas y edge cases", "discuss tests and edge cases"], ["APIs", "explain an API"], ["Bases de datos", "explain database decisions"],
    ["README", "write README instructions"], ["CI/CD", "explain a CI/CD pipeline"], ["Incidentes", "report an incident"], ["Workarounds", "propose a workaround"],
    ["Rollback", "coordinate a rollback"], ["Riesgos", "communicate risks"], ["Handoff", "give a clear handoff"], ["Entrevista inicial", "handle an initial interview"]
  ],
  B2: [
    ["Daily", "lead a daily meeting"], ["Refinement", "facilitate backlog refinement"], ["Planning", "contribute to sprint planning"], ["Retrospectiva", "facilitate a retrospective"],
    ["Facilitación de reuniones", "facilitate remote meetings"], ["Discrepar diplomáticamente", "disagree diplomatically"], ["Confirmar requisitos", "confirm requirements"],
    ["Stakeholders", "communicate with stakeholders"], ["Arquitectura", "explain software architecture"], ["System design", "present a system design"],
    ["Trade-offs", "defend technical trade-offs"], ["Escalabilidad", "discuss scalability"], ["Rendimiento", "discuss performance"], ["Costos", "discuss infrastructure costs"],
    ["Seguridad", "discuss security"], ["Secretos", "manage secrets"], ["Menor privilegio", "apply least privilege"], ["CI/CD", "design a CI/CD strategy"],
    ["Infraestructura como código", "explain infrastructure as code"], ["Observabilidad", "design observability"], ["Métricas", "choose operational metrics"],
    ["Alertas", "define useful alerts"], ["Incidentes", "lead incident communication"], ["Rollback", "decide on a rollback"], ["Postmortems", "present a postmortem"],
    ["Causa raíz", "explain root cause"], ["Automatización", "propose automation"], ["Idempotencia", "explain idempotency"],
    ["Entrevistas técnicas", "answer technical interview questions"], ["Respuestas STAR", "give STAR interview answers"],
    ["Disponibilidad y zona horaria", "discuss availability and time zones"]
  ]
};

const BASE_MODES = ["matching", "verb-example", "question-answer", "translate-es-en", "translate-en-es", "fill-blank", "multiple-choice", "word-order", "conjugation", "negative-transform", "question-transform", "tense-transform", "active-passive", "error-correction", "choose-response", "answer-question", "classify", "free-writing", "mixed-challenge"];
const PROFESSIONAL_MODES = ["slack", "ticket", "pull-request", "code-review", "professional-scenario"];

const slug = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalize = (value) => slug(String(value).replace(/\bthe\b/gi, "").replace(/\bverbo\b/gi, ""));
const hash = (value) => crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
const write = (relative, value) => {
  const file = path.join(DATA, relative);
  const serialized = JSON.stringify(value, null, 2) + "\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === serialized) return;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { fs.writeFileSync(file, serialized, "utf8"); return }
    catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * (attempt + 1));
    }
  }
  throw lastError;
};
const readData = (relative) => JSON.parse(fs.readFileSync(path.join(DATA, relative), "utf8"));
const titleCaseLevel = (value) => value === "B2 laboral" ? "B2" : value;
const stateValue = (value) => String(value || "").trim().toLowerCase();
const isMastered = (value) => stateValue(value) === "dominado";
const categoryFor = (text) => {
  const value = String(text).toLowerCase();
  const matches = [["frontend",/front|css|html|react|browser/],["backend",/back|server|api|endpoint/],["databases",/database|sql|query|table/],["git",/git|commit|branch|pull request/],["testing",/test|edge case/],["devops",/deploy|pipeline|container|docker|kubernetes|rollback|incident/],["cicd",/ci\/cd|pipeline/],["cloud",/cloud|infrastructure|scalab|cost/],["automation",/automat|script|idempoten/],["security",/secur|secret|privilege/],["architecture",/architect|system design|trade-off/],["interviews",/interview|star/],["remote-work",/slack|meeting|daily|handoff|stakeholder|time zone/]];
  return matches.filter(([,pattern]) => pattern.test(value)).map(([name]) => name).length ? matches.filter(([,pattern]) => pattern.test(value)).map(([name]) => name) : ["general"];
};

function sourceRef(levelSource, sheet, rowIndex) {
  return { spreadsheet: levelSource.title, spreadsheetId: levelSource.spreadsheetId, sheet, row: rowIndex + 4 };
}

function itemFromCatalogRow(levelSource, level, sheet, row, rowIndex) {
  const [number, type, english, pronunciation, spanish, exampleEn, exampleEs, , state, theory, writing, live, listening, hits, errors, lastReviewedAt, nextReviewAt, notes] = row;
  if (!String(english || "").trim()) return null;
  const itemType = sheet === "Vocabulario" && /verbo/i.test(type) ? (String(type).toLowerCase().includes("phrasal") ? "phrasal-verb" : "verb") : sheet === "Expresiones" ? "expression" : "vocabulary";
  const prefix = itemType === "expression" ? "expression" : itemType === "verb" ? "verb" : itemType === "phrasal-verb" ? "phrasal" : "word";
  return {
    id: `${level.toLowerCase()}-${prefix}-${slug(english)}`,
    level,
    type: itemType,
    subtype: String(type || "general").toLowerCase(),
    english: String(english).trim(),
    spanish: String(spanish || "").trim(),
    pronunciation: String(pronunciation || "").trim(),
    categories: [...new Set([...categoryFor(`${type} ${english} ${spanish} ${exampleEn}`), level.toLowerCase()])],
    example: { en: String(exampleEn || "").trim(), es: String(exampleEs || "").trim() },
    forms: itemType === "verb" || itemType === "phrasal-verb" ? inferForms(String(english).trim()) : undefined,
    defaultStatus: isMastered(state) ? "mastered" : stateValue(state) === "aprendiendo" ? "learning" : "new",
    initialProgress: { correctTotal: Number(hits) || 0, errorTotal: Number(errors) || 0, lastReviewedAt: lastReviewedAt || null, nextReviewAt: nextReviewAt || null, notes: notes || "" },
    source: sourceRef(levelSource, sheet, rowIndex),
    active: true
  };
}

function inferForms(english) {
  const base = english;
  const irregular = {
    be: ["is", "was", "been", "being"], have: ["has", "had", "had", "having"], do: ["does", "did", "done", "doing"], go: ["goes", "went", "gone", "going"],
    make: ["makes", "made", "made", "making"], take: ["takes", "took", "taken", "taking"], write: ["writes", "wrote", "written", "writing"], speak: ["speaks", "spoke", "spoken", "speaking"],
    build: ["builds", "built", "built", "building"], break: ["breaks", "broke", "broken", "breaking"], keep: ["keeps", "kept", "kept", "keeping"], grow: ["grows", "grew", "grown", "growing"]
  };
  const first = base.split(" ")[0];
  const rest = base.slice(first.length);
  const special = irregular[first];
  const third = special?.[0] || (/[^aeiou]y$/i.test(first) ? first.slice(0, -1) + "ies" : /(s|sh|ch|x|z|o)$/i.test(first) ? first + "es" : first + "s") + rest;
  const past = special?.[1] || (first.endsWith("e") ? first + "d" : /[^aeiou]y$/i.test(first) ? first.slice(0, -1) + "ied" : first + "ed") + rest;
  const participle = special?.[2] || past;
  const gerund = special?.[3] || (first.endsWith("ie") ? first.slice(0, -2) + "ying" : first.endsWith("e") && !first.endsWith("ee") ? first.slice(0, -1) + "ing" : first + "ing") + rest;
  return { base, thirdPerson: third, past, pastParticiple: participle, gerund };
}

function grammarItem(levelSource, level, title, row = null, rowIndex = null) {
  const objective = row?.[2] || `Usar ${title} en comunicación profesional.`;
  return {
    id: `${level.toLowerCase()}-grammar-${slug(title)}`,
    level,
    type: "grammar",
    english: title,
    spanish: objective,
    pronunciation: "",
    categories: [...new Set([...categoryFor(`${title} ${objective}`), "grammar", level.toLowerCase()])],
    example: { en: row?.[3] || `Use ${title} in a clear work message.`, es: objective },
    defaultStatus: isMastered(row?.[5]) ? "mastered" : stateValue(row?.[5]) === "aprendiendo" ? "learning" : "new",
    initialProgress: { correctTotal: Number(row?.[10]) || 0, errorTotal: Number(row?.[11]) || 0, lastReviewedAt: row?.[12] || null, nextReviewAt: row?.[13] || null, notes: row?.[14] || "" },
    source: row ? sourceRef(levelSource, "Gramática", rowIndex) : { addedBy: "curriculum-requirement", requirement: title },
    active: true
  };
}

function communicationItem(level, spanish, english) {
  return {
    id: `${level.toLowerCase()}-communication-${slug(english)}`,
    level,
    type: "communication",
    english,
    spanish,
    pronunciation: "",
    categories: [...new Set([...categoryFor(`${spanish} ${english}`), "professional", level.toLowerCase()])],
    example: { en: `I can ${english} clearly and concisely.`, es: `Puedo ${spanish.toLowerCase()} con claridad y concisión.` },
    defaultStatus: "new",
    source: { addedBy: "curriculum-requirement", requirement: spanish },
    active: true
  };
}

function buildExamples(item, topicId, count = INITIAL_EXAMPLES_PER_ITEM) {
  const subjects = ["I", "you", "he", "she", "it", "we", "they"];
  const contexts = ["a stand-up", "a Slack update", "a ticket", "a pull request", "a code review", "a deployment", "an incident", "a planning meeting", "technical documentation", "an interview"];
  const purposes = ["report progress", "ask for clarification", "explain a decision", "describe a problem", "propose a solution", "confirm a requirement"];
  const examples = [];
  for (let index = 0; index < Math.min(count, MAX_EXAMPLES_PER_ITEM); index += 1) {
    const subject = subjects[index % subjects.length];
    const context = contexts[index % contexts.length];
    const purpose = purposes[index % purposes.length];
    const isThird = ["he", "she", "it"].includes(subject.toLowerCase());
    const baseAnswer = item.forms ? (isThird ? item.forms.thirdPerson : item.forms.base) : item.english;
    const polarity = index % 4 === 1 ? "negative" : index % 4 === 2 ? "question" : "affirmative";
    const sentenceType = index % 5 === 3 ? "request" : index % 5 === 4 ? "suggestion" : polarity;
    let prompt;
    if (item.type === "grammar") prompt = `Use “${item.english}” to ${purpose} in ${context}.`;
    else if (polarity === "question") prompt = `During ${context}, how would ${subject.toLowerCase()} use “${item.spanish}”?`;
    else if (polarity === "negative") prompt = `${subject} do not ___ this concept when we need to ${purpose} in ${context}.`;
    else prompt = `${subject} ___ this concept to ${purpose} during ${context}.`;
    const answer = item.type === "grammar" ? (item.example?.en || item.english) : baseAnswer;
    const compatibleModes = item.type === "communication" ? [...BASE_MODES, ...PROFESSIONAL_MODES] : BASE_MODES;
    examples.push({
      id: `${item.id}-example-${hash(`${topicId}\u0000${prompt}\u0000${answer}`)}`,
      itemId: item.id,
      level: item.level,
      topicId,
      compatibleModes,
      difficulty: 1 + index % 3,
      context: slug(context),
      instruction: "Responde según el contexto profesional.",
      prompt,
      answer,
      acceptableAnswers: item.type === "grammar" ? [] : [item.english, item.forms?.base].filter(Boolean),
      translation: item.spanish,
      hint: item.type === "grammar" ? item.spanish : `La idea objetivo es “${item.spanish}”.`,
      explanation: item.type === "grammar" ? `${item.english}: ${item.spanish}` : `“${item.english}” significa “${item.spanish}”.`,
      modelAnswer: item.example?.en || answer,
      requiredTerms: item.type === "communication" ? item.english.split(/\s+/).filter((word) => word.length > 3).slice(0, 3) : [],
      grammarTags: item.type === "grammar" ? [slug(item.english)] : [],
      subject: subject.toLowerCase(),
      polarity,
      sentenceType,
      formality: index % 3 === 0 ? "formal" : "neutral",
      active: true
    });
  }
  return examples;
}

const report = { importedAt: SOURCE.importedAt, contentVersion: CONTENT_VERSION, validRows: {}, importedItems: {}, newItemsAdded: {}, duplicatesDetected: [], omittedRows: [], masteredItemsPreserved: {}, differences: [] };
const curricula = [];
const manifestLevels = {};
const existingA1 = {
  verbs: readData("levels/a1/verbs.json").items,
  pronouns: readData("levels/a1/pronouns.json").items,
  grammarItems: readData("levels/a1/grammar-items.json").items,
  expressions: readData("levels/a1/expressions.json").items,
  topics: readData("levels/a1/grammar.json").topics
};

function mergeItem(list, item, existingByEnglish) {
  const existing = existingByEnglish?.get(slug(item.english));
  if (existing) {
    Object.assign(existing, { ...item, id: existing.id, forms: existing.forms || item.forms, example: item.example?.en ? item.example : existing.example });
    return { item: existing, added: false };
  }
  const duplicate = list.find((value) => value.id === item.id);
  if (duplicate) {
    report.duplicatesDetected.push({ id: item.id, kept: duplicate.source, omitted: item.source });
    if (item.source?.sheet && item.source?.row) report.omittedRows.push({ level: item.level, sheet: item.source.sheet, row: item.source.row, reason: `duplicate-of-${duplicate.id}` });
    return { item: duplicate, added: false };
  }
  list.push(item);
  return { item, added: true };
}

function topicTheory(title, objective, example) {
  return {
    summary: objective || `Aprende a usar ${title} con claridad en el trabajo remoto.`,
    rules: [`Identifica la estructura de ${title}.`, "Adapta sujeto, tiempo y polaridad al contexto.", "En evaluación responde sin pistas."],
    examples: [example || `Use ${title} in a professional message.`],
    commonErrors: ["Traducir palabra por palabra desde el español.", "Olvidar adaptar el auxiliar o la forma verbal."]
  };
}

for (const levelSource of SOURCE.levels) {
  const level = levelSource.id;
  const lower = level.toLowerCase();
  const grammarRows = levelSource.sheets["Gramática"].slice(3);
  const vocabularyRows = levelSource.sheets.Vocabulario.slice(3);
  const expressionRows = levelSource.sheets.Expresiones.slice(3);
  report.validRows[level] = { grammar: grammarRows.length, vocabulary: vocabularyRows.length, expressions: expressionRows.length, route: levelSource.sheets.Ruta.length - 3, evaluations: levelSource.sheets.Evaluaciones.length - 3, live: levelSource.sheets["Práctica Live"].length - 3 };

  const verbs = level === "A1" ? existingA1.verbs : [];
  const pronouns = level === "A1" ? existingA1.pronouns : [];
  const vocabulary = [];
  const expressions = level === "A1" ? existingA1.expressions : [];
  const grammarItems = level === "A1" ? existingA1.grammarItems : [];
  const communication = [];
  const existingVerbMap = new Map(verbs.map((item) => [slug(item.english), item]));
  const existingExpressionMap = new Map(expressions.map((item) => [slug(item.english), item]));
  let added = 0;

  vocabularyRows.forEach((row, index) => {
    const item = itemFromCatalogRow(levelSource, level, "Vocabulario", row, index);
    if (!item) { report.omittedRows.push({ level, sheet: "Vocabulario", row: index + 4, reason: "missing-english" }); return }
    const target = item.type === "verb" || item.type === "phrasal-verb" ? verbs : vocabulary;
    const result = mergeItem(target, item, target === verbs ? existingVerbMap : null);
    if (result.added) added += 1;
  });

  expressionRows.forEach((row, index) => {
    if (level === "A1" && /pronombre/i.test(row[1]) && !/^(i|me|my|mine|you|your|yours|he|him|his|she|her|we|us|our|they|them|their|it|this|that|these|those)$/i.test(String(row[2] || ""))) {
      report.omittedRows.push({ level, sheet: "Expresiones", row: index + 4, reason: "source-row-missing-english; covered-by-existing-pronoun-id" });
      return;
    }
    const item = itemFromCatalogRow(levelSource, level, "Expresiones", row, index);
    if (!item) { report.omittedRows.push({ level, sheet: "Expresiones", row: index + 4, reason: "missing-english" }); return }
    const result = mergeItem(expressions, item, existingExpressionMap);
    if (result.added) added += 1;
  });

  const grammarByNormalized = new Map(grammarRows.map((row, index) => [normalize(row[1]), { row, index }]));
  const grammarTopics = [];
  const existingTopicByNormalized = new Map((level === "A1" ? existingA1.topics : []).map((topic) => [normalize(topic.title), topic]));
  for (const requiredTitle of REQUIRED_GRAMMAR[level]) {
    const exact = grammarByNormalized.get(normalize(requiredTitle)) || [...grammarByNormalized.values()].find(({ row }) => normalize(row[1]).includes(normalize(requiredTitle)) || normalize(requiredTitle).includes(normalize(row[1])));
    const existingTopic = existingTopicByNormalized.get(normalize(requiredTitle)) || [...existingTopicByNormalized.values()].find((topic) => normalize(topic.title).includes(normalize(requiredTitle)) || normalize(requiredTitle).includes(normalize(topic.title)));
    if (existingTopic) {
      const sheetState = exact?.row?.[5];
      if (isMastered(sheetState) && /pronombre/i.test(requiredTitle)) pronouns.forEach((item) => { item.defaultStatus = "mastered" });
      grammarTopics.push({ ...existingTopic, areaId: "grammar", source: exact ? sourceRef(levelSource, "Gramática", exact.index) : existingTopic.source, defaultStatus: isMastered(sheetState) ? "mastered" : stateValue(sheetState) === "aprendiendo" ? "learning" : "new", availableModes: [...new Set([...(existingTopic.modes || []), "multiple-choice", "error-correction", "negative-transform", "question-transform", "mixed-challenge"])], theory: { ...existingTopic.theory, commonErrors: topicTheory(existingTopic.title).commonErrors } });
      continue;
    }
    const item = grammarItem(levelSource, level, requiredTitle, exact?.row, exact?.index);
    const merged = mergeItem(grammarItems, item);
    if (merged.added) added += 1;
    grammarTopics.push({ id: slug(requiredTitle), level, areaId: "grammar", title: requiredTitle, description: item.spanish, theory: topicTheory(requiredTitle, item.spanish, item.example.en), itemIds: [merged.item.id], availableModes: ["fill-blank", "multiple-choice", "word-order", "conjugation", "negative-transform", "question-transform", "tense-transform", "error-correction", "mixed-challenge"] });
    if (!exact) report.differences.push({ level, type: "required-grammar-added", title: requiredTitle });
  }

  // Vincula también filas cuyo título es una variante del nombre curricular.
  grammarRows.forEach((row, index) => {
    const key = normalize(row[1]);
    const topic = grammarTopics.find((candidate) => normalize(candidate.title).includes(key) || key.includes(normalize(candidate.title))) || grammarTopics[index];
    if (topic) topic.sourceAliases = [...(topic.sourceAliases || []), sourceRef(levelSource, "Gramática", index)];
  });

  for (const [spanish, english] of COMMUNICATION[level]) communication.push(communicationItem(level, spanish, english));
  added += communication.length;

  const allItems = [...verbs, ...pronouns, ...vocabulary, ...expressions, ...grammarItems, ...communication];
  const mastered = allItems.filter((item) => item.defaultStatus === "mastered").length;
  report.importedItems[level] = allItems.length;
  report.newItemsAdded[level] = added;
  report.masteredItemsPreserved[level] = mastered;

  const genericExampleFiles = new Map();
  for (const item of [...vocabulary, ...expressions, ...grammarItems.filter((item) => !existingA1.grammarItems.includes(item)), ...communication, ...(level === "A1" ? [] : verbs)]) {
    const topicId = `core-${item.type}`;
    const relative = `levels/${lower}/examples/${item.id}.json`;
    const examples = buildExamples(item, topicId);
    write(relative, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, topicId, examples });
    genericExampleFiles.set(item.id, { path: `./data/${relative}`, itemIds: [item.id], count: examples.length });
  }

  const existingFilesByItem = new Map();
  if (level === "A1") for (const topic of existingA1.topics) for (const chunk of topic.exampleChunks || []) for (const itemId of chunk.itemIds) {
    if (!existingFilesByItem.has(itemId)) existingFilesByItem.set(itemId, []);
    existingFilesByItem.get(itemId).push(chunk);
  }
  const filesFor = (ids) => {
    const unique = new Map();
    ids.forEach((id) => {
      const files = genericExampleFiles.has(id) ? [genericExampleFiles.get(id)] : existingFilesByItem.get(id) || [];
      files.forEach((file) => unique.set(file.path, file));
    });
    return [...unique.values()];
  };

  grammarTopics.forEach((topic) => { topic.exampleFiles = topic.exampleChunks || filesFor(topic.itemIds); delete topic.exampleChunks; delete topic.modes });
  const communicationIds = communication.map((item) => item.id);
  const vocabularyTopicItems = vocabulary.length ? vocabulary : expressions.slice(0, Math.min(30, expressions.length));
  const areas = [
    { id: "grammar", title: "Gramática", description: "Estructuras para comunicarte con precisión.", topics: grammarTopics },
    { id: "verbs", title: "Verbos", description: "Acciones generales y técnicas.", topics: [{ id: "core-verbs", level, areaId: "verbs", title: "Verbos del nivel", description: `${verbs.length} verbos y phrasal verbs.`, itemIds: verbs.map((item) => item.id), availableModes: BASE_MODES, exampleFiles: filesFor(verbs.map((item) => item.id)) }] },
    { id: "vocabulary", title: "Vocabulario", description: "Vocabulario general y profesional.", topics: [{ id: "core-vocabulary", level, areaId: "vocabulary", title: "Vocabulario del nivel", description: `${vocabularyTopicItems.length} elementos.`, itemIds: vocabularyTopicItems.map((item) => item.id), availableModes: BASE_MODES, exampleFiles: filesFor(vocabularyTopicItems.map((item) => item.id)) }] },
    { id: "expressions", title: "Expresiones", description: "Frases, conectores y expresiones útiles.", topics: [{ id: "core-expressions", level, areaId: "expressions", title: "Expresiones del nivel", description: `${expressions.length + pronouns.length} expresiones.`, itemIds: [...pronouns, ...expressions].map((item) => item.id), availableModes: BASE_MODES, exampleFiles: filesFor([...pronouns, ...expressions].map((item) => item.id)) }] },
    { id: "listening", title: "Listening", description: "Dictado y comprensión con voz del navegador.", topics: [{ id: "guided-listening", level, areaId: "listening", title: "Listening profesional", description: "Escucha, escribe y compara con una respuesta modelo.", itemIds: communicationIds, availableModes: ["dictation", "pronunciation", "answer-question"], exampleFiles: filesFor(communicationIds), writtenFallback: true }] },
    { id: "writing", title: "Escritura", description: "Mensajes profesionales con rúbrica y autoevaluación.", topics: [{ id: "professional-writing", level, areaId: "writing", title: "Escritura profesional", description: "Practica respuestas guiadas sin fingir evaluación semántica.", itemIds: communicationIds, availableModes: ["free-writing", "slack", "ticket", "pull-request", "code-review"], exampleFiles: filesFor(communicationIds) }] },
    { id: "workplace", title: "Comunicación laboral", description: "Trabajo remoto, desarrollo, DevOps y automatización.", topics: communication.map((item) => ({ id: slug(item.english), level, areaId: "workplace", title: item.spanish, description: item.english, itemIds: [item.id], availableModes: [...PROFESSIONAL_MODES, "free-writing", "answer-question", "mixed-challenge"], exampleFiles: filesFor([item.id]), theory: topicTheory(item.spanish, item.english, item.example.en) })) },
    { id: "simulations", title: "Simulaciones", description: "Escenarios completos de trabajo remoto.", topics: [{ id: "professional-simulations", level, areaId: "simulations", title: "Simulaciones profesionales", description: "Resuelve situaciones de reuniones, código, despliegues e incidentes.", itemIds: communicationIds, availableModes: ["professional-scenario", "slack", "ticket", "pull-request", "code-review", "free-writing"], exampleFiles: filesFor(communicationIds) }] },
    { id: "evaluation", title: "Evaluación del nivel", description: "Evaluación sin pistas con resultado final.", topics: [{ id: "level-evaluation", level, areaId: "evaluation", title: `Evaluación ${level}`, description: "Desafío mixto de 20 preguntas.", itemIds: allItems.map((item) => item.id), availableModes: ["topic-evaluation", "mixed-challenge"], exampleFiles: filesFor(allItems.map((item) => item.id)), evaluation: { questionCount: 20, hints: false, immediateFeedback: false, passingAccuracy: 80 } }] }
  ];

  const routeRows = levelSource.sheets.Ruta.slice(3).map((row) => ({ id: `${lower}-route-week-${row[0]}`, week: Number(row[0]), objective: row[1], grammar: row[2], speaking: row[3], listening: row[4], writing: row[5], evaluation: row[6] }));
  const evaluationRows = levelSource.sheets.Evaluaciones.slice(3).map((row) => ({ id: `${lower}-evaluation-week-${row[0]}`, week: Number(row[0]), grammar: Number(row[1]) || 0, vocabulary: Number(row[2]) || 0, live: Number(row[3]) || 0, listening: Number(row[4]) || 0, writing: Number(row[5]) || 0, simulation: Number(row[6]) || 0, result: row[7] || "", nextFocus: row[8] || "" }));
  curricula.push({ id: level, ...LEVELS[level], areas, route: routeRows, evaluations: evaluationRows });

  write(`levels/${lower}/verbs.json`, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, items: verbs });
  write(`levels/${lower}/pronouns.json`, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, items: pronouns });
  write(`levels/${lower}/vocabulary.json`, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, items: vocabulary });
  write(`levels/${lower}/expressions.json`, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, items: expressions });
  write(`levels/${lower}/grammar-items.json`, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, items: grammarItems });
  write(`levels/${lower}/communication.json`, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level, items: communication });
  manifestLevels[level] = { catalogs: { verbs: `./data/levels/${lower}/verbs.json`, pronouns: `./data/levels/${lower}/pronouns.json`, vocabulary: `./data/levels/${lower}/vocabulary.json`, expressions: `./data/levels/${lower}/expressions.json`, grammar: `./data/levels/${lower}/grammar-items.json`, communication: `./data/levels/${lower}/communication.json` } };
}

// Asegura una única versión de contenido también en los bancos A1 heredados.
for (const file of fs.readdirSync(path.join(DATA, "levels/a1/examples"))) {
  const relative = `levels/a1/examples/${file}`;
  const value = readData(relative);
  value.contentVersion = CONTENT_VERSION;
  write(relative, value);
}
const curriculum = { schemaVersion: 1, contentVersion: CONTENT_VERSION, targetDate: "2026-12-01", goal: "Listo para buscar trabajo remoto", levels: curricula };
write("curriculum.json", curriculum);
write("import-report.json", report);
write("manifest.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, appName: "English Trainer", curriculum: "./data/curriculum.json", importReport: "./data/import-report.json", levels: manifestLevels });

console.log(`Currículo ${CONTENT_VERSION}: ${curricula.length} niveles, ${Object.values(report.importedItems).reduce((sum, value) => sum + value, 0)} elementos, ${Object.values(report.masteredItemsPreserved).reduce((sum, value) => sum + value, 0)} dominados conservados.`);
