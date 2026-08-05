class ContentService {
  constructor() {
    this.cache = new Map();
    this.manifest = null;
    this.curriculum = null;
    this.levelCatalogs = new Map();
  }

  async #json(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    const promise = fetch(path).then((response) => {
      if (!response.ok) throw new Error(`No se pudo cargar ${path} (${response.status}).`);
      return response.json();
    });
    this.cache.set(path, promise);
    try { return await promise }
    catch (error) { this.cache.delete(path); throw error }
  }

  async loadManifest() {
    this.manifest ||= await this.#json("./data/manifest.json");
    return this.manifest;
  }

  async loadCurriculum() {
    const manifest = await this.loadManifest();
    this.curriculum ||= await this.#json(manifest.curriculum);
    return this.curriculum;
  }

  async getLevels() { return (await this.loadCurriculum()).levels }

  async getLevel(levelId) {
    const level = (await this.getLevels()).find((value) => value.id.toLowerCase() === String(levelId).toLowerCase());
    if (!level) throw new Error(`No existe el nivel ${levelId}.`);
    return level;
  }

  async getArea(levelId, areaId) {
    const level = await this.getLevel(levelId);
    const area = level.areas.find((value) => value.id === areaId);
    if (!area) throw new Error(`No existe el área ${areaId} en ${level.id}.`);
    return { level, area };
  }

  async getTopic(levelId, areaId, topicId) {
    const { level, area } = await this.getArea(levelId, areaId);
    const topic = area.topics.find((value) => value.id === topicId);
    if (!topic) throw new Error(`No existe el tema ${topicId}.`);
    return { level, area, topic };
  }

  async loadLevelCatalogs(levelId) {
    const key = String(levelId).toUpperCase();
    if (this.levelCatalogs.has(key)) return this.levelCatalogs.get(key);
    const manifest = await this.loadManifest();
    const definition = manifest.levels[key];
    if (!definition) throw new Error(`No hay catálogos para ${key}.`);
    const catalogs = await Promise.all(Object.entries(definition.catalogs).map(async ([name, path]) => [name, await this.#json(path)]));
    const items = catalogs.flatMap(([catalog, data]) => (data.items || []).map((item) => ({ ...item, catalog })));
    const result = { catalogs: Object.fromEntries(catalogs), items };
    this.levelCatalogs.set(key, result);
    return result;
  }

  async loadTopic(levelId, areaId, topicId, selectedItemIds = null) {
    const { level, area, topic } = await this.getTopic(levelId, areaId, topicId);
    const { items: catalogItems } = await this.loadLevelCatalogs(level.id);
    const allowed = new Set(topic.itemIds);
    const selected = selectedItemIds?.length ? new Set(selectedItemIds) : allowed;
    const items = catalogItems.filter((item) => allowed.has(item.id) && selected.has(item.id) && item.active !== false);
    const itemIds = new Set(items.map((item) => item.id));
    const files = (topic.exampleFiles || []).filter((file) => file.itemIds?.some((id) => itemIds.has(id)));
    const chunks = await Promise.all(files.map((file) => this.#json(file.path)));
    const examples = chunks.flatMap((file) => file.examples || []).filter((example) => itemIds.has(example.itemId) && example.active !== false);
    return { level, area, topic, items, examples };
  }

  async loadItems(levelId, ids = null) {
    const { items } = await this.loadLevelCatalogs(levelId);
    if (!ids?.length) return items.filter((item) => item.active !== false);
    const selected = new Set(ids);
    return items.filter((item) => selected.has(item.id) && item.active !== false);
  }

  async searchItems(filters = {}) {
    const levels = filters.level && filters.level !== "all" ? [filters.level] : (await this.getLevels()).map((level) => level.id);
    const collections = await Promise.all(levels.map((level) => this.loadLevelCatalogs(level)));
    const query = String(filters.query || "").trim().toLowerCase();
    return collections.flatMap((value) => value.items).filter((item) => {
      if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.category && filters.category !== "all" && !item.categories?.includes(filters.category)) return false;
      if (query && !`${item.english} ${item.spanish} ${(item.categories || []).join(" ")}`.toLowerCase().includes(query)) return false;
      return item.active !== false;
    });
  }

  async loadSelection(ids) {
    const selected = new Set(ids);
    const levels = await this.getLevels();
    const catalogs = await Promise.all(levels.map((level) => this.loadLevelCatalogs(level.id)));
    const items = catalogs.flatMap((catalog) => catalog.items).filter((item) => selected.has(item.id) && item.active !== false);
    const files = new Map();
    const modes = new Set();
    levels.flatMap((level) => level.areas).flatMap((area) => area.topics).forEach((topic) => {
      if (!topic.itemIds.some((id) => selected.has(id))) return;
      topic.availableModes.filter((mode) => mode !== "topic-evaluation").forEach((mode) => modes.add(mode));
      (topic.exampleFiles || []).filter((file) => file.itemIds.some((id) => selected.has(id))).forEach((file) => files.set(file.path, file));
    });
    const chunks = await Promise.all([...files.values()].map((file) => this.#json(file.path)));
    const examples = chunks.flatMap((file) => file.examples || []).filter((example) => selected.has(example.itemId) && example.active !== false);
    return { level: { id: "MIX", title: "Selección personalizada" }, area: { id: "selection", title: "Contenido seleccionado" }, topic: { id: "custom-selection", title: "Selección personalizada", description: `${items.length} elementos seleccionados`, itemIds: items.map((item) => item.id), availableModes: [...modes] }, items, examples };
  }

  clearExamplesFromMemory() {
    for (const key of this.cache.keys()) if (key.includes("/examples/")) this.cache.delete(key);
  }
}

export const contentService = new ContentService();
