const NS = "englishTrainer:v1:";
const STORAGE_VERSION = 1;
const MAX_SESSIONS = 100;
const MAX_RECENT_EXAMPLES = 12;
const MAX_REVIEW_DAYS = 30;

const DEFAULT_SETTINGS = Object.freeze({
  masteryMode: "streak",
  correctAnswersToMaster: 10,
  requireConsecutiveCorrect: true,
  minimumAccuracy: 80,
  minimumExerciseModes: 1,
  minimumReviewDays: 1,
  excludeMastered: true,
  includeMasteredInReview: true,
  questionsPerSession: 20,
  difficulty: "adaptive",
  translationDirection: "both",
  selectedLevels: ["A1"],
  selectedItemsByTopic: {},
  itemFiltersByTopic: {},
  enabledExerciseModes: ["matching", "translate-es-en", "fill-blank"],
  preserveMasteredOnGoalChange: true,
  theme: null
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const slug = (value) => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nowIso = () => new Date().toISOString();
const dateOnly = (iso = nowIso()) => iso.slice(0, 10);

class StorageService {
  constructor() {
    this.available = this.#detectAvailability();
    this.warning = this.available ? null : "El navegador bloquea el almacenamiento local. El progreso funcionará solo durante esta visita.";
    this.memory = new Map();
  }

  #detectAvailability() {
    try {
      const key = NS + "probe";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  #key(name) { return NS + name }

  #rawGet(name) {
    if (this.memory.has(name)) return this.memory.get(name);
    return this.available ? localStorage.getItem(this.#key(name)) : null;
  }

  #rawSet(name, value) {
    try {
      if (this.available) localStorage.setItem(this.#key(name), value);
      else this.memory.set(name, value);
      return true;
    } catch (error) {
      this.memory.set(name, value);
      this.warning = error?.name === "QuotaExceededError"
        ? "El almacenamiento local está lleno. Exporta tu progreso y libera espacio."
        : "No se pudo guardar el progreso en este navegador.";
      return false;
    }
  }

  #read(name, fallback) {
    const raw = this.#rawGet(name);
    if (raw == null) return clone(fallback);
    try { return JSON.parse(raw) }
    catch (_) {
      this.#rawSet("backup", JSON.stringify({ createdAt: nowIso(), reason: `json-corrupt:${name}`, values: { [name]: raw } }));
      return clone(fallback);
    }
  }

  #write(name, value) { return this.#rawSet(name, JSON.stringify(value)) }

  init(contentVersion) {
    const meta = this.#read("meta", null);
    if (!meta) this.#migrateLegacy(contentVersion);
    else if (meta.storageVersion !== STORAGE_VERSION) this.#migrateVersion(meta, contentVersion);
    this.#write("meta", { storageVersion: STORAGE_VERSION, contentVersion, updatedAt: nowIso() });
    return { available: this.available, warning: this.warning };
  }

  #migrateVersion(previousMeta, contentVersion) {
    const snapshot = this.exportData();
    this.#write("backup", { createdAt: nowIso(), reason: `migration:${previousMeta.storageVersion}->${STORAGE_VERSION}`, values: snapshot });
    this.#write("meta", { storageVersion: STORAGE_VERSION, contentVersion, migratedAt: nowIso() });
  }

  #legacyValue(key) {
    if (!this.available) return null;
    try { return localStorage.getItem(key) } catch (_) { return null }
  }

  #migrateLegacy(contentVersion) {
    if (!this.available) return;
    const oldKeys = ["pronounDrill.v1", "englishDrill.modals.v1", "englishDrill.theme"];
    const topicIds = ["to-be", "articles", "simple-present", "do-does", "third-person", "there-is-are", "present-continuous"];
    topicIds.forEach((id) => oldKeys.push(`englishDrill.a1.${id}.v1`, `englishDrill.selection.${id}.v1`));
    oldKeys.push("englishDrill.selection.modals.v1");
    const backup = {};
    oldKeys.forEach((key) => { const value = this.#legacyValue(key); if (value != null) backup[key] = value });
    if (Object.keys(backup).length) this.#write("backup", { createdAt: nowIso(), reason: "legacy-migration", values: backup });

    const progress = {};
    const importCounters = (raw, mapId, topicId) => {
      if (!raw) return;
      try {
        const values = JSON.parse(raw);
        Object.entries(values).forEach(([legacyId, count]) => {
          if (!Number.isFinite(count)) return;
          const itemId = mapId(legacyId, topicId);
          const existing = progress[itemId];
          const streak = Math.max(0, Number(count) || 0);
          if (!existing || streak > existing.currentStreak) progress[itemId] = this.#newProgress(itemId, streak);
        });
      } catch (_) {}
    };
    importCounters(backup["pronounDrill.v1"], (id) => `a1-pronoun-${slug(id)}`);
    importCounters(backup["englishDrill.modals.v1"], (id) => `modal-${slug(id)}`);
    topicIds.forEach((topicId) => importCounters(backup[`englishDrill.a1.${topicId}.v1`], (id) => {
      if (["simple-present", "third-person", "present-continuous"].includes(topicId)) return `a1-verb-${slug(id.replace(/^(simple|third|continuous)-/, ""))}`;
      return `a1-grammar-${topicId}-${slug(id)}`;
    }, topicId));
    if (Object.keys(progress).length) this.#write("progress", progress);

    const settings = clone(DEFAULT_SETTINGS);
    settings.theme = backup["englishDrill.theme"] || null;
    topicIds.concat("modals").forEach((topicId) => {
      const raw = backup[`englishDrill.selection.${topicId}.v1`];
      if (!raw) return;
      try {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) settings.selectedItemsByTopic[topicId] = ids.map((id) => {
          if (topicId === "modals") return `modal-${slug(id)}`;
          return `a1-verb-${slug(String(id).replace(/^(simple|third|continuous)-/, ""))}`;
        });
      } catch (_) {}
    });
    this.#write("settings", settings);
    this.#write("meta", { storageVersion: STORAGE_VERSION, contentVersion, migratedAt: nowIso() });
  }

  #newProgress(itemId, streak = 0) {
    return {
      itemId,
      status: streak >= 10 ? "mastered" : streak ? "learning" : "new",
      timesSeen: streak,
      correctTotal: streak,
      errorTotal: 0,
      currentStreak: streak,
      recentAccuracy: streak ? 100 : 0,
      recentResults: streak ? Array(Math.min(streak, 20)).fill(true) : [],
      practicedModes: [],
      availableModes: [],
      reviewDays: [],
      recentExampleIds: [],
      lastResult: streak ? "correct" : null,
      lastReviewedAt: null,
      nextReviewAt: null,
      masteredAt: streak >= 10 ? nowIso() : null
    };
  }

  getSettings() { return { ...clone(DEFAULT_SETTINGS), ...this.#read("settings", DEFAULT_SETTINGS) } }
  saveSettings(patch) {
    const next = { ...this.getSettings(), ...clone(patch) };
    this.#write("settings", next);
    return next;
  }
  reevaluateMastery() {
    const settings = this.getSettings();
    const all = this.getAllProgress();
    Object.values(all).forEach((record) => {
      if (record.status === "mastered" && settings.preserveMasteredOnGoalChange) return;
      const meetsGoal = settings.requireConsecutiveCorrect
        ? record.currentStreak >= settings.correctAnswersToMaster
        : record.correctTotal >= settings.correctAnswersToMaster;
      const meetsAccuracy = (record.recentAccuracy || 0) >= settings.minimumAccuracy;
      const availableModeCount = Math.max(1, record.availableModes?.length || record.practicedModes?.length || 1);
      const meetsModes = (record.practicedModes?.length || 0) >= Math.min(settings.minimumExerciseModes, availableModeCount);
      const meetsDays = (record.reviewDays?.length || 0) >= settings.minimumReviewDays;
      const mastered = settings.masteryMode === "robust" ? meetsGoal && meetsAccuracy && meetsModes && meetsDays : meetsGoal;
      record.status = mastered ? "mastered" : record.timesSeen ? "learning" : "new";
      if (mastered) record.masteredAt ||= nowIso();
      else record.masteredAt = null;
    });
    this.#write("progress", all);
    return all;
  }
  resetSettings() { this.#write("settings", DEFAULT_SETTINGS); return this.getSettings() }

  getAllProgress() { return this.#read("progress", {}) }
  getProgress(itemId) { return this.getAllProgress()[itemId] || this.#newProgress(itemId) }

  recordAttempt({ itemId, mode, correct, exampleId, availableModes = [mode] }) {
    const settings = this.getSettings();
    const all = this.getAllProgress();
    const record = all[itemId] || this.#newProgress(itemId);
    const timestamp = nowIso();
    record.timesSeen += 1;
    record.correctTotal += correct ? 1 : 0;
    record.errorTotal += correct ? 0 : 1;
    record.currentStreak = correct ? record.currentStreak + 1 : 0;
    record.recentResults = [...(record.recentResults || []), !!correct].slice(-20);
    record.recentAccuracy = Math.round(record.recentResults.filter(Boolean).length / record.recentResults.length * 100);
    record.practicedModes = [...new Set([...(record.practicedModes || []), mode])];
    record.availableModes = [...new Set([...(record.availableModes || []), ...availableModes])];
    record.reviewDays = [...new Set([...(record.reviewDays || []), dateOnly(timestamp)])].slice(-MAX_REVIEW_DAYS);
    record.recentExampleIds = [...(record.recentExampleIds || []).filter((id) => id !== exampleId), exampleId].filter(Boolean).slice(-MAX_RECENT_EXAMPLES);
    record.lastResult = correct ? "correct" : "incorrect";
    record.lastReviewedAt = timestamp;
    const intervalDays = correct ? Math.min(30, Math.max(1, Math.pow(2, Math.floor(record.currentStreak / 3)))) : 1;
    record.nextReviewAt = new Date(Date.now() + intervalDays * 86400000).toISOString();
    const requiredModes = Math.min(settings.minimumExerciseModes, availableModes.length);
    const meetsGoal = settings.requireConsecutiveCorrect ? record.currentStreak >= settings.correctAnswersToMaster : record.correctTotal >= settings.correctAnswersToMaster;
    const meetsAccuracy = record.recentAccuracy >= settings.minimumAccuracy;
    const meetsModes = record.practicedModes.filter((value) => availableModes.includes(value)).length >= requiredModes;
    const meetsDays = record.reviewDays.length >= settings.minimumReviewDays;
    const wasMastered = record.status === "mastered";
    const meetsMastery = settings.masteryMode === "robust" ? meetsGoal && meetsAccuracy && meetsModes && meetsDays : meetsGoal;
    if (meetsMastery || (wasMastered && settings.preserveMasteredOnGoalChange)) {
      record.status = "mastered";
      record.masteredAt ||= timestamp;
    } else record.status = record.timesSeen ? "learning" : "new";
    all[itemId] = record;
    this.#write("progress", all);
    const errors = this.#read("errors", {});
    if (correct) delete errors[itemId];
    else errors[itemId] = { itemId, count: (errors[itemId]?.count || 0) + 1, lastExampleId: exampleId, lastAt: timestamp };
    this.#write("errors", errors);
    const daily = this.#read("dailySummary", {});
    const day = dateOnly(timestamp);
    daily[day] ||= { date: day, attempts: 0, correct: 0, errors: 0, itemIds: [] };
    daily[day].attempts += 1;
    daily[day].correct += correct ? 1 : 0;
    daily[day].errors += correct ? 0 : 1;
    daily[day].itemIds = [...new Set([...daily[day].itemIds, itemId])].slice(-200);
    const recentDays = Object.keys(daily).sort().slice(-90);
    this.#write("dailySummary", Object.fromEntries(recentDays.map((key) => [key, daily[key]])));
    return record;
  }

  getActiveErrors() { return this.#read("errors", {}) }
  getCustomLists() { return this.#read("customLists", []) }
  saveCustomList(list) {
    if (!list?.id || !list?.name || !Array.isArray(list.itemIds)) throw new Error("La lista personalizada no es válida.");
    const lists = this.getCustomLists().filter((value) => value.id !== list.id);
    lists.push({ id: slug(list.id), name: String(list.name), itemIds: [...new Set(list.itemIds.map(String))] });
    this.#write("customLists", lists);
    return lists;
  }
  deleteCustomList(id) {
    const lists = this.getCustomLists().filter((value) => value.id !== id);
    this.#write("customLists", lists);
    return lists;
  }
  getCurrentSession() { return this.#read("currentSession", null) }
  saveCurrentSession(session) { this.#write("currentSession", { ...session, savedAt: nowIso() }) }
  clearCurrentSession() {
    if (this.available) { try { localStorage.removeItem(this.#key("currentSession")) } catch (_) {} }
    else this.memory.delete("currentSession");
  }
  completeSession(session) {
    const summaries = this.#read("sessionSummary", []);
    summaries.push({ ...session, completedAt: nowIso() });
    this.#write("sessionSummary", summaries.slice(-MAX_SESSIONS));
    this.clearCurrentSession();
  }

  resetProgress(scope = "all") {
    if (scope === "all") {
      this.#write("progress", {});
      this.#write("errors", {});
      this.#write("sessionSummary", []);
      this.#write("dailySummary", {});
      return;
    }
    const progress = this.getAllProgress();
    const prefixes = scope === "A1" ? ["a1-"] : [scope];
    Object.keys(progress).forEach((id) => { if (prefixes.some((prefix) => id.startsWith(prefix))) delete progress[id] });
    this.#write("progress", progress);
    const errors = this.getActiveErrors();
    Object.keys(errors).forEach((id) => { if (prefixes.some((prefix) => id.startsWith(prefix))) delete errors[id] });
    this.#write("errors", errors);
  }

  exportData() {
    return {
      schema: "englishTrainer-backup",
      storageVersion: STORAGE_VERSION,
      exportedAt: nowIso(),
      meta: this.#read("meta", {}),
      settings: this.getSettings(),
      progress: this.getAllProgress(),
      customLists: this.#read("customLists", []),
      errors: this.getActiveErrors(),
      sessionSummary: this.#read("sessionSummary", []),
      dailySummary: this.#read("dailySummary", {})
    };
  }

  importData(data) {
    if (!data || data.schema !== "englishTrainer-backup" || typeof data.progress !== "object" || typeof data.settings !== "object") throw new Error("El archivo no es una copia válida de English Trainer.");
    this.#write("backup", { createdAt: nowIso(), reason: "before-import", values: this.exportData() });
    this.#write("settings", { ...DEFAULT_SETTINGS, ...data.settings });
    this.#write("progress", data.progress || {});
    this.#write("customLists", Array.isArray(data.customLists) ? data.customLists : []);
    this.#write("errors", data.errors || {});
    this.#write("sessionSummary", Array.isArray(data.sessionSummary) ? data.sessionSummary.slice(-MAX_SESSIONS) : []);
    this.#write("dailySummary", data.dailySummary && typeof data.dailySummary === "object" ? data.dailySummary : {});
    return true;
  }
}

export const storageService = new StorageService();
export { DEFAULT_SETTINGS, STORAGE_VERSION };
