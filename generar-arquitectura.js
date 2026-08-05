/* Migra los bancos históricos al esquema estático y fragmentado de English Trainer.
 * Este script solo se ejecuta durante el desarrollo; la aplicación nunca genera contenido. */
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const CONTENT_VERSION = "2026.08.2";
const INITIAL_EXAMPLES_PER_ITEM = 30;
const MAX_EXAMPLES_PER_ITEM = 200;
if (fs.existsSync(DATA)) fs.rmSync(DATA, { recursive: true, force: true });
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
const write = (relative, value) => {
  const file = path.join(DATA, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
};
const slug = (value) => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stableExampleId = (itemId, topicId, prompt, answer) => {
  const fingerprint = crypto.createHash("sha1").update(`${itemId}\u0000${topicId}\u0000${prompt}\u0000${answer}`).digest("hex").slice(0, 12);
  return `${itemId}-${topicId}-example-${fingerprint}`;
};
const chunks = (array, size) => Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size));
const uniqueExamples = (examples) => {
  const seen = new Set();
  return examples.filter((example) => {
    const canonical = (value) => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\bcan not\b/g, "cannot").replace(/[^a-z0-9]+/g, " ").trim();
    const key = `${example.itemId}\u0000${canonical(example.prompt)}\u0000${canonical(example.answer)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const assertExampleLimit = (examples, itemId) => {
  if (examples.length > MAX_EXAMPLES_PER_ITEM) throw new Error(`${itemId} supera MAX_EXAMPLES_PER_ITEM (${MAX_EXAMPLES_PER_ITEM}).`);
};

const a1 = read("a1.json");
const pronounsLegacy = read("frases.json");
const modalsLegacy = read("modales.json");

const verbs = a1.vocabulary.map((v) => ({
  id: `a1-verb-${slug(v.english)}`,
  level: "A1",
  type: "verb",
  english: v.english,
  spanish: v.spanish,
  pronunciation: v.pronunciation,
  categories: ["general", "a1"],
  forms: {
    base: v.forms.base,
    thirdPerson: v.forms.thirdPerson,
    past: v.forms.past,
    pastParticiple: v.forms.participle,
    gerund: v.forms.gerund
  },
  example: { en: v.exampleEn, es: v.exampleEs },
  defaultStatus: "new",
  active: true
}));
const verbByEnglish = new Map(verbs.map((v) => [v.english, v]));

const pronouns = pronounsLegacy.pronouns.map((p) => ({
  id: `a1-pronoun-${slug(p.id)}`,
  legacyId: p.id,
  level: "A1",
  type: "pronoun",
  english: p.answer,
  label: p.label,
  spanish: p.cat,
  group: p.group,
  role: p.role,
  category: p.cat,
  explanation: p.tip,
  defaultStatus: "new",
  active: true
}));
const pronounByLegacyId = new Map(pronounsLegacy.pronouns.map((p, i) => [p.id + "|" + p.role, pronouns[i]]));

const modals = modalsLegacy.items.map((m) => ({
  id: `modal-${slug(m.id)}`,
  legacyId: m.id,
  level: "A1",
  type: "modal",
  english: m.english,
  spanish: m.spanish,
  pronunciation: m.pronunciation,
  categories: ["modal", "auxiliary"],
  example: { en: m.exampleEn, es: m.exampleEs },
  defaultStatus: "new",
  active: true
}));
const modalByLegacyId = new Map(modalsLegacy.items.map((m, i) => [m.id, modals[i]]));

const grammarItems = [];
const topicDefinitions = [];
const exampleChunksByTopic = {};
const modesByTopic = {
  "personal-pronouns": ["fill-blank"],
  "to-be": ["fill-blank"],
  articles: ["fill-blank"],
  "simple-present": ["fill-blank", "matching", "translate-es-en"],
  "do-does": ["fill-blank"],
  "third-person": ["fill-blank"],
  "there-is-are": ["fill-blank"],
  "present-continuous": ["fill-blank"]
};

function normalizedExample({ id, itemId, topicId, mode = "fill-blank", difficulty = 1, prompt, answer, options = [], translation = "", hint = "", explanation = "", grammarTags = [], subject = null, polarity = "affirmative" }) {
  return { id, itemId, level: "A1", topicId, mode, difficulty, context: "general", instruction: mode === "translate-es-en" ? "Traduce al inglés." : "Completa la frase.", prompt, answer, acceptableAnswers: [], options, translation, hint, explanation, grammarTags, subject, polarity, active: true };
}

for (const topic of a1.topics) {
  const definition = {
    id: topic.id,
    level: "A1",
    title: topic.title,
    description: topic.description,
    theory: topic.theory,
    modes: modesByTopic[topic.id],
    itemSource: topic.kind === "pronouns" ? "pronouns" : ["simple-present", "third-person", "present-continuous"].includes(topic.id) ? "verbs" : "grammar",
    itemIds: []
  };
  const examples = [];

  if (topic.kind === "pronouns") {
    pronounsLegacy.pronouns.forEach((legacy) => {
      const item = pronounByLegacyId.get(legacy.id + "|" + legacy.role);
      definition.itemIds.push(item.id);
      const options = pronounsLegacy.groups[legacy.group] || [legacy.answer];
      legacy.sentences.forEach((sentence) => examples.push(normalizedExample({
        id: stableExampleId(item.id, topic.id, sentence.en, legacy.answer),
        itemId: item.id,
        topicId: topic.id,
        prompt: sentence.en,
        answer: legacy.answer,
        options,
        translation: sentence.es,
        hint: legacy.tip,
        explanation: legacy.tip,
        grammarTags: ["pronouns", legacy.role]
      })));
    });
  } else {
    topic.items.forEach((legacyItem) => {
      let item;
      if (definition.itemSource === "verbs") {
        const base = legacyItem.id.replace(/^(simple|third|continuous)-/, "");
        item = verbByEnglish.get(base);
      } else {
        item = {
          id: `a1-grammar-${topic.id}-${slug(legacyItem.id)}`,
          level: "A1",
          type: "grammar-target",
          topicId: topic.id,
          english: legacyItem.label,
          label: legacyItem.label,
          spanish: topic.title,
          category: legacyItem.cat,
          explanation: legacyItem.tip,
          defaultStatus: "new",
          active: true
        };
        grammarItems.push(item);
      }
      if (!item) throw new Error(`No se encontró el verbo para ${legacyItem.id}`);
      definition.itemIds.push(item.id);
      legacyItem.examples.forEach((example) => examples.push(normalizedExample({
        id: stableExampleId(item.id, topic.id, example.prompt, example.answer),
        itemId: item.id,
        topicId: topic.id,
        prompt: example.prompt,
        answer: example.answer,
        options: example.options,
        translation: example.es,
        hint: legacyItem.tip,
        explanation: legacyItem.tip,
        grammarTags: [topic.id]
      })));
    });
  }

  const grouped = chunks(definition.itemIds, 1);
  const files = grouped.map((ids, index) => {
    const file = `levels/a1/examples/${topic.id}-${String(index + 1).padStart(3, "0")}.json`;
    const selected = uniqueExamples(examples.filter((e) => ids.includes(e.itemId)));
    assertExampleLimit(selected, ids[0]);
    write(file, { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", topicId: topic.id, examples: selected });
    return { path: `./data/${file.replace(/\\/g, "/")}`, itemIds: ids, count: selected.length };
  });
  exampleChunksByTopic[topic.id] = files;
  definition.exampleChunks = files;
  topicDefinitions.push(definition);
}

const modalExamples = [];
modalsLegacy.items.forEach((legacy) => {
  const item = modalByLegacyId.get(legacy.id);
  legacy.examples.forEach((example) => modalExamples.push({
    id: stableExampleId(item.id, "modals", example.en, example.answer),
    itemId: item.id,
    level: "A1",
    topicId: "modals",
    mode: "fill-blank",
    difficulty: 1,
    context: "general",
    instruction: "Completa la frase.",
    prompt: example.en.replace(new RegExp(`\\b${example.answer.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i"), "___"),
    answer: example.answer,
    acceptableAnswers: [],
    options: [],
    translation: example.es,
    hint: `${item.english} significa ${item.spanish}.`,
    explanation: `La frase requiere ${item.english} porque expresa ${item.spanish}.`,
    grammarTags: ["modals"],
    subject: null,
    polarity: "affirmative",
    active: true
  }));
});
const modalChunkFiles = chunks(modals.map((m) => m.id), 1).map((ids, index) => {
  const file = `professional/examples/modals-${String(index + 1).padStart(3, "0")}.json`;
  const selected = uniqueExamples(modalExamples.filter((e) => ids.includes(e.itemId)));
  assertExampleLimit(selected, ids[0]);
  write(file, { schemaVersion: 1, contentVersion: CONTENT_VERSION, topicId: "modals", examples: selected });
  return { path: `./data/${file}`, itemIds: ids, count: selected.length };
});

write("levels/a1/verbs.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", items: verbs });
write("levels/a1/pronouns.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", groups: pronounsLegacy.groups, items: pronouns });
write("levels/a1/grammar-items.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", items: grammarItems });
write("levels/a1/grammar.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", topics: topicDefinitions });
write("levels/a1/expressions.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", items: [] });
write("professional/modals.json", { schemaVersion: 1, contentVersion: CONTENT_VERSION, level: "A1", topicId: "modals", title: "Modales y auxiliares", description: "Capacidad, obligación, posibilidad y auxiliares.", modes: ["fill-blank", "matching"], theory: { summary: "Los modales y auxiliares modifican o apoyan al verbo principal.", rules: ["Los modales preceden a la forma base.", "Los auxiliares forman preguntas y negaciones."], examples: ["I can help.", "Do you work here?"] }, items: modals, exampleChunks: modalChunkFiles });

write("manifest.json", {
  schemaVersion: 1,
  contentVersion: CONTENT_VERSION,
  appName: "English Trainer",
  levels: {
    A1: {
      grammar: "./data/levels/a1/grammar.json",
      verbs: "./data/levels/a1/verbs.json",
      pronouns: "./data/levels/a1/pronouns.json",
      grammarItems: "./data/levels/a1/grammar-items.json",
      expressions: "./data/levels/a1/expressions.json"
    }
  },
  professional: { modals: "./data/professional/modals.json" }
});

const writtenExampleCount = topicDefinitions.reduce((n, t) => n + t.exampleChunks.reduce((m, c) => m + c.count, 0), 0) + modalChunkFiles.reduce((n, c) => n + c.count, 0);
console.log(`Arquitectura generada: ${verbs.length} verbos, ${pronouns.length} pronombres, ${modals.length} modales y ${writtenExampleCount} ejemplos (inicio recomendado: ${INITIAL_EXAMPLES_PER_ITEM}, máximo: ${MAX_EXAMPLES_PER_ITEM}).`);
