class ContentService {
  constructor() {
    this.cache = new Map();
    this.manifest = null;
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

  async loadA1Topics() {
    const manifest = await this.loadManifest();
    return (await this.#json(manifest.levels.A1.grammar)).topics.filter((topic) => topic.active !== false);
  }

  async loadTopicDefinition(topicId) {
    const topics = await this.loadA1Topics();
    const topic = topics.find((candidate) => candidate.id === topicId);
    if (!topic) throw new Error(`No existe el tema ${topicId}.`);
    return topic;
  }

  async loadCatalog(source) {
    const manifest = await this.loadManifest();
    const paths = {
      verbs: manifest.levels.A1.verbs,
      pronouns: manifest.levels.A1.pronouns,
      grammar: manifest.levels.A1.grammarItems,
      expressions: manifest.levels.A1.expressions
    };
    const data = await this.#json(paths[source]);
    return data.items.filter((item) => item.active !== false);
  }

  async loadA1Topic(topicId, selectedItemIds = null) {
    const topic = await this.loadTopicDefinition(topicId);
    const catalog = await this.loadCatalog(topic.itemSource);
    const allowed = new Set(topic.itemIds);
    const selected = selectedItemIds?.length ? new Set(selectedItemIds) : allowed;
    const items = catalog.filter((item) => allowed.has(item.id) && selected.has(item.id));
    const itemIds = new Set(items.map((item) => item.id));
    const chunks = topic.exampleChunks.filter((chunk) => chunk.itemIds.some((id) => itemIds.has(id)));
    const files = await Promise.all(chunks.map((chunk) => this.#json(chunk.path)));
    const examples = files.flatMap((file) => file.examples).filter((example) => itemIds.has(example.itemId) && example.active !== false);
    return { section: "A1", topic, items, examples };
  }

  async loadModals(selectedItemIds = null) {
    const definition = await this.loadModalsDefinition();
    const selected = selectedItemIds?.length ? new Set(selectedItemIds) : null;
    const items = definition.items.filter((item) => item.active !== false && (!selected || selected.has(item.id)));
    const itemIds = new Set(items.map((item) => item.id));
    const chunks = definition.exampleChunks.filter((chunk) => chunk.itemIds.some((id) => itemIds.has(id)));
    const files = await Promise.all(chunks.map((chunk) => this.#json(chunk.path)));
    const examples = files.flatMap((file) => file.examples).filter((example) => itemIds.has(example.itemId) && example.active !== false);
    return { section: "professional", topic: { ...definition, id: "modals" }, items, examples };
  }

  async loadModalsDefinition() {
    const manifest = await this.loadManifest();
    return this.#json(manifest.professional.modals);
  }
}

export const contentService = new ContentService();
