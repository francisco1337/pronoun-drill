import { contentService } from "./content-service.js";
import { storageService } from "./storage-service.js";

const app = document.getElementById("app");
const pageTitle = document.getElementById("pageTitle");
const pageContext = document.getElementById("pageContext");
const menuBtn = document.getElementById("menuBtn");
const themeBtn = document.getElementById("themeBtn");
const installBtn = document.getElementById("installBtn");
const state = { curriculum: null, allItems: [], context: null, selection: new Set(), filters: {}, setup: null, active: null, session: null, question: null, answered: false, feedback: null, results: null, timer: null };
let installPrompt = null;

const privacy = '<p class="privacy">Tu progreso se guarda únicamente en este dispositivo y no se envía a ningún servidor.</p>';
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const random = (values) => values[Math.floor(Math.random() * values.length)];
const shuffle = (values) => { const copy = [...values]; for (let index = copy.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [copy[index], copy[target]] = [copy[target], copy[index]] } return copy };
const settings = () => storageService.getSettings();
const progress = (id) => storageService.getProgress(id);
const routePath = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];
const routeParts = () => routePath().split("/").filter(Boolean).map(decodeURIComponent);
const go = (path) => {
  if (routePath() === path.split("?")[0]) router();
  else location.hash = `#${path}`;
};
const levelClass = (level) => `level-${String(level).toLowerCase()}`;
const formatDate = (value) => value ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(value)) : "—";
const formatMinutes = (milliseconds) => `${Math.round((milliseconds || 0) / 60000)} min`;
const isDue = (record) => record.nextReviewAt && new Date(record.nextReviewAt).getTime() <= Date.now();

const MODE_LABELS = {
  matching: "Inglés ↔ español", "verb-example": "Verbo con ejemplo", "question-answer": "Pregunta con respuesta", "translate-es-en": "Español → inglés", "translate-en-es": "Inglés → español",
  "fill-blank": "Completar espacio", "multiple-choice": "Opción múltiple", "word-order": "Ordenar palabras", conjugation: "Conjugar", "negative-transform": "Afirmativa → negativa",
  "question-transform": "Afirmativa → pregunta", "tense-transform": "Cambiar tiempo", "active-passive": "Activa → pasiva", "error-correction": "Corregir errores", "choose-response": "Respuesta adecuada",
  "answer-question": "Responder pregunta", classify: "Clasificar", slack: "Slack", ticket: "Tickets", "pull-request": "Pull requests", "code-review": "Code review",
  "professional-scenario": "Escenario profesional", "free-writing": "Escritura libre", dictation: "Listening / dictado", pronunciation: "Pronunciación", "mixed-challenge": "Desafío mixto", "topic-evaluation": "Evaluación"
};

function setHeader(title, context = "Preparación profesional") {
  pageTitle.textContent = title;
  pageContext.textContent = context;
  document.title = `${title} · English Drill`;
}
function loading(message = "Cargando contenido…") { app.innerHTML = `<div class="panel loading">${esc(message)}</div>` }
function showError(error) { app.innerHTML = `<div class="panel empty"><h2>No se pudo completar la operación</h2><p>${esc(error.message || error)}</p><button class="primary" data-route="/">Volver al inicio</button></div>` }
function applyTheme(theme) { if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme }
function metric(label, value, detail = "") { return `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${detail ? `<span>${esc(detail)}</span>` : ""}</article>` }
function bar(value, color = "") { const safe = Math.max(0, Math.min(100, Math.round(value || 0))); return `<span class="progress-bar ${color}"><i style="width:${safe}%"></i></span>` }
function crumb(parts) { return `<nav class="crumbs"><button data-route="/">Inicio</button>${parts.map((part) => `<span>›</span>${part.path ? `<button data-route="${esc(part.path)}">${esc(part.label)}</button>` : `<b>${esc(part.label)}</b>`}`).join("")}</nav>` }

async function init() {
  try {
    const manifest = await contentService.loadManifest();
    state.curriculum = await contentService.loadCurriculum();
    storageService.init(manifest.contentVersion);
    applyTheme(settings().theme);
    const catalogs = await Promise.all(state.curriculum.levels.map((level) => contentService.loadLevelCatalogs(level.id)));
    state.allItems = catalogs.flatMap((catalog) => catalog.items);
    storageService.seedInitialProgress(state.allItems);
    state.selection = new Set(settings().selectedItemIds || []);
    await router();
  } catch (error) { showError(error) }
}

function aggregate(items = state.allItems) {
  const records = items.map((item) => progress(item.id));
  const attempts = records.reduce((sum, record) => sum + (record.timesSeen || 0), 0);
  const correct = records.reduce((sum, record) => sum + (record.correctTotal || 0), 0);
  return {
    total: items.length,
    mastered: records.filter((record) => record.status === "mastered").length,
    learning: records.filter((record) => record.status === "learning").length,
    due: records.filter(isDue).length,
    newCount: records.filter((record) => record.status === "new").length,
    accuracy: attempts ? Math.round(correct / attempts * 100) : 0,
    attempts,
    last: records.map((record) => record.lastReviewedAt).filter(Boolean).sort().at(-1) || null,
    next: records.map((record) => record.nextReviewAt).filter(Boolean).sort()[0] || null
  };
}

function studyStreak() {
  const days = new Set(Object.keys(storageService.getDailySummaries()));
  let streak = 0;
  const date = new Date();
  while (days.has(date.toISOString().slice(0, 10))) { streak += 1; date.setDate(date.getDate() - 1) }
  return streak;
}

function renderHome() {
  setHeader("Inicio", "Preparación para trabajo remoto");
  const stats = aggregate();
  const sessions = storageService.getSessionSummaries();
  const time = sessions.reduce((sum, session) => sum + (session.durationMs || 0), 0);
  const activeLevel = settings().activeLevel || "A1";
  const errors = storageService.getErrors({ pendingOnly: true });
  const current = storageService.getCurrentSession();
  const readiness = Math.round((stats.mastered / Math.max(1, stats.total) * 60) + (Math.min(stats.accuracy, 100) * .25) + (Math.min(sessions.length, 15)));
  const nextEvaluation = state.curriculum.levels.find((level) => level.id === activeLevel)?.evaluations?.find((evaluation) => !evaluation.result) || null;
  app.innerHTML = `${storageService.warning ? `<div class="notice warning">${esc(storageService.warning)}</div>` : ""}
    ${current ? `<section class="resume"><div><small>Sesión en curso</small><b>${esc(current.title)}</b><span>${current.answeredCount || 0} respuestas</span></div><div><button class="secondary" data-action="discard-session">Descartar</button><button class="primary" data-action="resume-session">Continuar práctica</button></div></section>` : ""}
    <section class="welcome"><div><span class="eyebrow">Objetivo · diciembre de 2026</span><h1>Inglés para conseguir tu próximo trabajo remoto.</h1><p>Full-stack, DevOps y automatización: reuniones, tickets, pull requests, incidentes, arquitectura y entrevistas.</p><div class="actions"><button class="primary" data-route="/practice/setup">Configurar sesión</button><button class="secondary" data-route="/levels/${activeLevel.toLowerCase()}">Continuar ${activeLevel}</button></div></div><div class="readiness"><span>Listo para buscar trabajo</span><strong>${readiness}%</strong>${bar(readiness)}<small>${stats.mastered} de ${stats.total} elementos dominados</small></div></section>
    <section class="metric-grid">${metric("Nivel actual", activeLevel, "Ruta activa")}${metric("Racha de estudio", `${studyStreak()} días`)}${metric("Precisión", `${stats.accuracy}%`, `${stats.attempts} intentos`)}${metric("Tiempo estudiado", formatMinutes(time))}${metric("Dominados", stats.mastered)}${metric("Aprendiendo", stats.learning)}${metric("Repasos pendientes", stats.due)}${metric("Errores frecuentes", errors.length)}</section>
    <div class="dashboard-grid"><section class="panel"><div class="section-head"><div><small>Rutas</small><h2>Progreso por nivel</h2></div><button class="text-btn" data-route="/levels">Ver todos</button></div>${state.curriculum.levels.map((level) => { const value = aggregate(state.allItems.filter((item) => item.level === level.id)); const percent = Math.round(value.mastered / Math.max(1, value.total) * 100); return `<button class="level-row" data-route="/levels/${level.id.toLowerCase()}"><span class="level-badge ${levelClass(level.id)}">${level.id}</span><span><b>${esc(level.title)}</b><small>${value.mastered}/${value.total} dominados</small></span>${bar(percent, levelClass(level.id))}<strong>${percent}%</strong></button>` }).join("")}</section>
    <aside class="panel"><div class="section-head"><div><small>Siguiente paso</small><h2>Esta semana</h2></div></div><ul class="task-list"><li><span>01</span><div><b>Practicar errores pendientes</b><small>${errors.length} elementos</small></div></li><li><span>02</span><div><b>Repasar elementos vencidos</b><small>${stats.due} elementos</small></div></li><li><span>03</span><div><b>Próxima evaluación</b><small>${nextEvaluation ? `Semana ${nextEvaluation.week} · ${activeLevel}` : "Evaluación de nivel"}</small></div></li></ul><button class="primary full" data-route="/practice/setup">Comenzar práctica</button></aside></div>${privacy}`;
}

function renderLevels() {
  setHeader("Niveles", "A1 → B2 laboral");
  app.innerHTML = `<section class="page-intro"><span class="eyebrow">Currículo profesional</span><h1>Tu ruta hacia la autonomía laboral</h1><p>Cada nivel integra gramática, vocabulario, comunicación, simulaciones y evaluación.</p></section><section class="level-grid">${state.curriculum.levels.map((level) => {
    const items = state.allItems.filter((item) => item.level === level.id); const stats = aggregate(items); const completed = Math.round(stats.mastered / Math.max(1, stats.total) * 100);
    const levelTopics = level.areas.flatMap((area) => area.topics); const completedTopics = levelTopics.filter((topic) => topic.itemIds.every((id) => progress(id).status === "mastered")).length;
    return `<article class="level-card ${levelClass(level.id)}"><div class="level-card-top"><span>${level.id}</span><small>${esc(level.title)}</small></div><h2>${esc(level.description)}</h2>${bar(completed, levelClass(level.id))}<div class="level-stats"><span><b>${completed}%</b> completado</span><span><b>${completedTopics}/${levelTopics.length}</b> temas</span><span><b>${stats.mastered}</b> dominados</span><span><b>${stats.newCount + stats.learning}</b> pendientes</span><span><b>${stats.accuracy}%</b> precisión</span><span><b>${formatDate(stats.next)}</b> próximo repaso</span></div><div class="card-actions"><button class="primary" data-route="/levels/${level.id.toLowerCase()}">Continuar</button><button class="secondary" data-route="/levels/${level.id.toLowerCase()}">Ver contenido</button><button class="secondary" data-action="practice-level" data-level="${level.id}">Practicar</button><button class="secondary" data-action="evaluate-level" data-level="${level.id}">Evaluación</button></div></article>`;
  }).join("")}</section>${privacy}`;
}

async function renderLevel(levelId) {
  const level = await contentService.getLevel(levelId);
  setHeader(level.id, level.title);
  const levelItems = state.allItems.filter((item) => item.level === level.id);
  const stats = aggregate(levelItems);
  app.innerHTML = `${crumb([{ label: "Niveles", path: "/levels" }, { label: level.id }])}<section class="level-hero ${levelClass(level.id)}"><div><span class="eyebrow">${esc(level.title)}</span><h1>${esc(level.description)}</h1><p>${stats.mastered} dominados · ${stats.learning} aprendiendo · ${stats.due} para repasar</p></div><strong>${Math.round(stats.mastered / Math.max(1, stats.total) * 100)}%</strong></section><section class="area-grid">${level.areas.map((area) => {
    const ids = [...new Set(area.topics.flatMap((topic) => topic.itemIds))]; const values = aggregate(levelItems.filter((item) => ids.includes(item.id))); const percent = Math.round(values.mastered / Math.max(1, values.total) * 100);
    return `<article class="area-card"><span class="area-icon">${area.id === "grammar" ? "Aa" : area.id === "verbs" ? "V" : area.id === "listening" ? "◖" : area.id === "writing" ? "✎" : area.id === "workplace" ? "⌘" : "◇"}</span><div><small>${area.topics.length} temas</small><h2>${esc(area.title)}</h2><p>${esc(area.description)}</p>${bar(percent)}<span class="area-meta">${values.mastered}/${values.total} dominados · ${values.accuracy}% precisión</span></div><div class="card-actions"><button class="primary" data-route="/levels/${level.id.toLowerCase()}/${area.id}">Ver temas</button><button class="secondary" data-action="practice-area" data-level="${level.id}" data-area="${area.id}">Practicar</button></div></article>`;
  }).join("")}</section>${privacy}`;
}

async function renderArea(levelId, areaId) {
  const { level, area } = await contentService.getArea(levelId, areaId);
  setHeader(area.title, `${level.id} · ${level.title}`);
  app.innerHTML = `${crumb([{ label: "Niveles", path: "/levels" }, { label: level.id, path: `/levels/${level.id.toLowerCase()}` }, { label: area.title }])}<section class="page-intro compact"><span class="eyebrow">${level.id} · ${esc(area.title)}</span><h1>${esc(area.description)}</h1></section><section class="topic-list">${area.topics.map((topic) => {
    const items = state.allItems.filter((item) => topic.itemIds.includes(item.id)); const stats = aggregate(items); const percent = Math.round(stats.mastered / Math.max(1, stats.total) * 100); const status = percent === 100 ? "Dominado" : stats.learning ? "Aprendiendo" : "Nuevo";
    return `<article class="topic-card"><div class="topic-index">${String(area.topics.indexOf(topic) + 1).padStart(2, "0")}</div><div><span class="status ${slug(status)}">${status}</span><h2>${esc(topic.title)}</h2><p>${esc(topic.description)}</p><div class="topic-meta"><span>${topic.itemIds.length} elementos</span><span>${stats.accuracy}% precisión</span><span>Repaso ${formatDate(stats.next)}</span></div>${bar(percent)}</div><div class="topic-actions"><button class="secondary" data-route="/learn/${level.id.toLowerCase()}/${topic.id}?area=${area.id}">Aprender</button><button class="primary" data-route="/levels/${level.id.toLowerCase()}/${area.id}/${topic.id}">Abrir tema</button></div></article>`;
  }).join("")}</section>${privacy}`;
}

async function renderTopic(levelId, areaId, topicId) {
  const { level, area, topic } = await contentService.getTopic(levelId, areaId, topicId);
  const items = state.allItems.filter((item) => topic.itemIds.includes(item.id));
  const stats = aggregate(items);
  state.context = { levelId: level.id, areaId: area.id, topicId: topic.id };
  setHeader(topic.title, `${level.id} · ${area.title}`);
  const theory = topic.theory || { summary: topic.description, rules: [], examples: [], commonErrors: [] };
  app.innerHTML = `${crumb([{ label: "Niveles", path: "/levels" }, { label: level.id, path: `/levels/${level.id.toLowerCase()}` }, { label: area.title, path: `/levels/${level.id.toLowerCase()}/${area.id}` }, { label: topic.title }])}
    <section class="topic-hero"><div><span class="eyebrow">${level.id} · ${esc(area.title)}</span><h1>${esc(topic.title)}</h1><p>${esc(topic.description)}</p><div class="actions"><button class="secondary" data-route="/learn/${level.id.toLowerCase()}/${topic.id}?area=${area.id}">Aprender</button><button class="primary" data-action="setup-topic">Practicar</button><button class="secondary" data-action="evaluate-topic">Evaluación</button><button class="secondary" data-action="practice-topic-errors">Practicar errores</button></div></div><div class="mastery-box"><span>Progreso del tema</span><strong>${stats.mastered}/${stats.total}</strong>${bar(stats.mastered / Math.max(1, stats.total) * 100)}<small>Meta: ${settings().correctAnswersToMaster} aciertos · ${settings().masteryMode === "robust" ? "dominio robusto" : "dominio simple"}</small></div></section>
    <div class="content-grid"><section class="panel theory"><div class="section-head"><div><small>Fundamentos</small><h2>Teoría y reglas</h2></div></div><p>${esc(theory.summary || topic.description)}</p><h3>Reglas</h3><ul>${(theory.rules || []).map((rule) => `<li>${esc(rule)}</li>`).join("") || "<li>Revisa la explicación y aplica la estructura en contexto.</li>"}</ul><h3>Ejemplos</h3><ul>${(theory.examples || []).map((example) => `<li>${esc(example)}</li>`).join("") || items.slice(0, 3).map((item) => `<li>${esc(item.example?.en || item.english)} · ${esc(item.example?.es || item.spanish)}</li>`).join("")}</ul><h3>Errores comunes</h3><ul>${(theory.commonErrors || []).map((error) => `<li>${esc(error)}</li>`).join("") || "<li>Traducir literalmente sin adaptar la estructura.</li>"}</ul></section>
    <aside class="panel"><div class="section-head"><div><small>Contenido</small><h2>Elementos relacionados</h2></div><button class="text-btn" data-action="setup-topic">Seleccionar</button></div><div class="compact-items">${items.slice(0, 12).map((item) => { const record = progress(item.id); return `<div><span><b>${esc(item.english)}</b><small>${esc(item.spanish)}</small></span><em class="status ${record.status}">${record.status === "mastered" ? "Dominado" : record.status === "learning" ? `${record.currentStreak}/${settings().correctAnswersToMaster}` : "Nuevo"}</em></div>` }).join("")}</div>${items.length > 12 ? `<p class="muted">+ ${items.length - 12} elementos adicionales</p>` : ""}<h3>Modalidades disponibles</h3><div class="chips">${topic.availableModes.map((mode) => `<span>${esc(MODE_LABELS[mode] || mode)}</span>`).join("")}</div></aside></div>${privacy}`;
}

async function renderLearn(levelId, topicId) {
  const areaId = new URLSearchParams(location.hash.split("?")[1] || "").get("area") || "grammar";
  const { level, area, topic } = await contentService.getTopic(levelId, areaId, topicId);
  const items = state.allItems.filter((item) => topic.itemIds.includes(item.id));
  const theory = topic.theory || { summary: topic.description, rules: [], examples: [], commonErrors: [] };
  setHeader(`Aprender · ${topic.title}`, `${level.id} · ${area.title}`);
  app.innerHTML = `${crumb([{ label: level.id, path: `/levels/${level.id.toLowerCase()}` }, { label: topic.title, path: `/levels/${level.id.toLowerCase()}/${area.id}/${topic.id}` }, { label: "Aprender" }])}<article class="lesson panel"><span class="eyebrow">Lección guiada</span><h1>${esc(topic.title)}</h1><p class="lead">${esc(theory.summary || topic.description)}</p><section><h2>Reglas clave</h2><ol>${(theory.rules || []).map((rule) => `<li>${esc(rule)}</li>`).join("")}</ol></section><section><h2>Ejemplos comentados</h2><div class="example-list">${[...(theory.examples || []), ...items.slice(0, 6).map((item) => `${item.example?.en || item.english} · ${item.example?.es || item.spanish}`)].slice(0, 10).map((example) => `<div><span>→</span><p>${esc(example)}</p></div>`).join("")}</div></section>${items.some((item) => item.forms) ? `<section><h2>Formas verbales</h2><div class="table-wrap"><table><thead><tr><th>Verbo</th><th>3.ª persona</th><th>Pasado</th><th>Participio</th><th>-ing</th></tr></thead><tbody>${items.filter((item) => item.forms).slice(0, 30).map((item) => `<tr><td>${esc(item.forms.base)}</td><td>${esc(item.forms.thirdPerson)}</td><td>${esc(item.forms.past)}</td><td>${esc(item.forms.pastParticiple)}</td><td>${esc(item.forms.gerund)}</td></tr>`).join("")}</tbody></table></div></section>` : ""}<section><h2>Antes de practicar</h2><ul>${(theory.commonErrors || ["Evita traducir literalmente.", "Comprueba el auxiliar y la forma verbal."]).map((value) => `<li>${esc(value)}</li>`).join("")}</ul></section><div class="actions"><button class="secondary" data-route="/levels/${level.id.toLowerCase()}/${area.id}/${topic.id}">Volver al tema</button><button class="primary" data-action="setup-context" data-level="${level.id}" data-area="${area.id}" data-topic="${topic.id}">Practicar ahora</button></div></article>${privacy}`;
}

async function renderContentSelection() {
  setHeader("Seleccionar contenido", "Listas y filtros");
  const filters = state.filters;
  let items = await contentService.searchItems(filters);
  const levelsForFilter = filters.level && filters.level !== "all" ? state.curriculum.levels.filter((level) => level.id === filters.level) : state.curriculum.levels;
  const areasForFilter = [...new Map(levelsForFilter.flatMap((level) => level.areas).map((area) => [area.id, area])).values()];
  const topicsForFilter = levelsForFilter.flatMap((level) => level.areas.filter((area) => !filters.area || filters.area === "all" || area.id === filters.area).flatMap((area) => area.topics.map((topic) => ({ ...topic, levelId: level.id, areaId: area.id }))));
  const allowedTopicIds = new Set(topicsForFilter.filter((topic) => !filters.topic || filters.topic === "all" || topic.id === filters.topic).flatMap((topic) => topic.itemIds));
  const errors = new Set(storageService.getErrors({ pendingOnly: true }).map((value) => value.itemId));
  items = items.filter((item) => {
    const record = progress(item.id);
    if ((filters.area && filters.area !== "all" || filters.topic && filters.topic !== "all") && !allowedTopicIds.has(item.id)) return false;
    if (filters.status && filters.status !== "all" && record.status !== filters.status) return false;
    if (filters.errors === "yes" && !errors.has(item.id)) return false;
    if (filters.due === "yes" && !isDue(record)) return false;
    return true;
  });
  const categories = [...new Set(state.allItems.flatMap((item) => item.categories || []))].sort();
  const types = [...new Set(state.allItems.map((item) => item.type))].sort();
  app.innerHTML = `<section class="page-intro compact"><span class="eyebrow">Banco completo</span><h1>Selecciona exactamente qué quieres practicar</h1><p>La sesión guardará solamente los IDs elegidos.</p></section><section class="panel filters"><div class="filter-grid"><label><span>Buscar</span><input id="searchFilter" value="${esc(filters.query || "")}" placeholder="Inglés o español"></label><label><span>Nivel</span><select id="levelFilter"><option value="all">Todos</option>${state.curriculum.levels.map((level) => `<option value="${level.id}"${filters.level === level.id ? " selected" : ""}>${level.id}</option>`).join("")}</select></label><label><span>Área</span><select id="areaFilter"><option value="all">Todas</option>${areasForFilter.map((area) => `<option value="${area.id}"${filters.area === area.id ? " selected" : ""}>${esc(area.title)}</option>`).join("")}</select></label><label><span>Tema</span><select id="topicFilter"><option value="all">Todos</option>${topicsForFilter.map((topic) => `<option value="${topic.id}"${filters.topic === topic.id ? " selected" : ""}>${topic.levelId} · ${esc(topic.title)}</option>`).join("")}</select></label><label><span>Tipo</span><select id="typeFilter"><option value="all">Todos</option>${types.map((type) => `<option value="${type}"${filters.type === type ? " selected" : ""}>${type}</option>`).join("")}</select></label><label><span>Categoría</span><select id="categoryFilter"><option value="all">Todas</option>${categories.map((category) => `<option value="${category}"${filters.category === category ? " selected" : ""}>${category}</option>`).join("")}</select></label><label><span>Estado</span><select id="statusFilter"><option value="all">Todos</option><option value="new"${filters.status === "new" ? " selected" : ""}>Nuevos</option><option value="learning"${filters.status === "learning" ? " selected" : ""}>Aprendiendo</option><option value="mastered"${filters.status === "mastered" ? " selected" : ""}>Dominados</option></select></label><label><span>Errores</span><select id="errorsFilter"><option value="all">Todos</option><option value="yes"${filters.errors === "yes" ? " selected" : ""}>Con errores</option></select></label><label><span>Repaso</span><select id="dueFilter"><option value="all">Todos</option><option value="yes"${filters.due === "yes" ? " selected" : ""}>Pendientes</option></select></label><button class="primary" data-action="apply-filters">Aplicar filtros</button></div><div class="selection-tools"><span><b>${state.selection.size}</b> seleccionados · ${items.length} resultados</span><button class="secondary" data-action="select-visible">Seleccionar todos</button><button class="secondary" data-action="deselect-visible">Deseleccionar</button><button class="secondary" data-action="select-new">Nuevos</button><button class="secondary" data-action="select-errors">Errores frecuentes</button><button class="secondary" data-action="select-due">Repasos</button><button class="secondary" data-action="select-random">20 aleatorios</button></div></section><section class="panel item-browser"><div class="item-grid">${items.slice(0, 500).map((item) => { const record = progress(item.id); return `<label class="select-item"><input type="checkbox" data-select-id="${item.id}"${state.selection.has(item.id) ? " checked" : ""}><span class="level-dot ${levelClass(item.level)}">${item.level}</span><span><b>${esc(item.english)}</b><small>${esc(item.spanish)} · ${(item.categories || []).slice(0, 2).join(" · ")}</small></span><em class="status ${record.status}">${record.status}</em></label>` }).join("")}</div>${items.length > 500 ? `<p class="notice">Mostrando 500 de ${items.length}. Usa los filtros para reducir la lista.</p>` : ""}<div class="sticky-actions"><button class="secondary" data-action="save-list">Guardar como lista</button><button class="primary" data-action="practice-selection">Practicar selección (${state.selection.size})</button></div></section>${privacy}`;
}

async function prepareSetup(context = state.context, selectedIds = null, evaluation = false) {
  if (!context) {
    const preferred = settings().activeLevel || "A1";
    const level = await contentService.getLevel(preferred);
    const area = level.areas.find((value) => value.id === "grammar") || level.areas[0];
    const topic = area.topics[0];
    context = { levelId: level.id, areaId: area.id, topicId: topic.id };
  }
  const { level, area, topic } = await contentService.getTopic(context.levelId, context.areaId, context.topicId);
  const topicItems = state.allItems.filter((item) => topic.itemIds.includes(item.id));
  const saved = settings().selectedItemsByTopic?.[`${level.id}:${area.id}:${topic.id}`] || [];
  const eligibleSaved = (selectedIds || saved).filter((id) => topic.itemIds.includes(id));
  const defaults = eligibleSaved.length ? eligibleSaved : topicItems.filter((item) => !settings().excludeMastered || progress(item.id).status !== "mastered" || isDue(progress(item.id))).map((item) => item.id);
  state.setup = { level, area, topic, items: topicItems, selectedIds: new Set(defaults.length ? defaults : topic.itemIds), modes: new Set(evaluation ? ["topic-evaluation"] : topic.availableModes.filter((mode) => settings().enabledExerciseModes.includes(mode)).slice(0, 5)), evaluation };
  if (!state.setup.modes.size) state.setup.modes.add(evaluation ? "topic-evaluation" : topic.availableModes[0]);
  go("/practice/setup");
}

function renderPracticeSetup() {
  setHeader("Configurar práctica", state.setup ? `${state.setup.level.id} · ${state.setup.topic.title}` : "Sesión personalizada");
  if (!state.setup) {
    app.innerHTML = `<section class="page-intro"><span class="eyebrow">Nueva sesión</span><h1>Elige el punto de partida</h1><p>Selecciona un nivel y un tema, o usa una lista guardada.</p></section><section class="level-grid compact">${state.curriculum.levels.map((level) => `<article class="level-card ${levelClass(level.id)}"><div class="level-card-top"><span>${level.id}</span><small>${esc(level.title)}</small></div><p>${esc(level.description)}</p><button class="primary" data-action="choose-level-setup" data-level="${level.id}">Elegir tema</button></article>`).join("")}</section><section class="panel"><h2>Listas personalizadas</h2><div class="list-grid">${storageService.getCustomLists().map((list) => `<button class="secondary" data-action="practice-list" data-list="${list.id}">${esc(list.name)} · ${list.itemIds.length}</button>`).join("") || "<p class='muted'>Todavía no has guardado listas. Puedes crearlas en Seleccionar contenido.</p>"}</div></section>${privacy}`;
    return;
  }
  const s = settings(); const { level, area, topic, items, selectedIds, modes, evaluation } = state.setup;
  const setupCrumbs = state.setup.mixed
    ? [{ label: "Seleccionar contenido", path: "/content/select" }, { label: evaluation ? "Evaluación" : "Configurar" }]
    : [{ label: level.id, path: `/levels/${level.id.toLowerCase()}` }, { label: topic.title, path: `/levels/${level.id.toLowerCase()}/${area.id}/${topic.id}` }, { label: evaluation ? "Evaluación" : "Configurar" }];
  app.innerHTML = `${crumb(setupCrumbs)}<section class="setup-layout"><main class="panel"><span class="eyebrow">${evaluation ? "Evaluación sin pistas" : "Sesión adaptativa"}</span><h1>${esc(topic.title)}</h1><p>${esc(topic.description)}</p><h2>Modalidades</h2><div class="mode-grid">${(evaluation ? ["topic-evaluation"] : topic.availableModes).map((mode) => `<label class="mode-choice"><input type="checkbox" data-mode="${mode}"${modes.has(mode) ? " checked" : ""}><span><b>${esc(MODE_LABELS[mode] || mode)}</b><small>${mode === "free-writing" ? "Rúbrica y respuesta modelo" : mode === "dictation" ? "Voz del navegador y alternativa escrita" : "Retroalimentación explicada"}</small></span></label>`).join("")}</div><h2>Configuración</h2><div class="settings-grid"><label><span>Preguntas</span><select id="setupQuestions"><option>10</option><option${s.questionsPerSession === 20 ? " selected" : ""}>20</option><option>30</option><option>50</option></select></label><label><span>Duración máxima</span><select id="setupDuration"><option value="0">Sin límite</option><option value="10">10 minutos</option><option value="20">20 minutos</option><option value="30">30 minutos</option></select></label><label><span>Dificultad</span><select id="setupDifficulty"><option value="adaptive">Adaptativa</option><option value="1">Básica</option><option value="2">Intermedia</option><option value="3">Avanzada</option></select></label><label><span>Traducción</span><select id="setupDirection"><option value="both">Ambas direcciones</option><option value="es-en">Español → inglés</option><option value="en-es">Inglés → español</option></select></label></div><label class="checkline"><input id="setupHints" type="checkbox"${!evaluation && s.showHints ? " checked" : ""}${evaluation ? " disabled" : ""}><span>Mostrar pistas bajo demanda</span></label><label class="checkline"><input id="setupImmediate" type="checkbox"${!evaluation && s.feedbackMode === "immediate" ? " checked" : ""}${evaluation ? " disabled" : ""}><span>Corrección inmediata</span></label><div class="start-row"><span><b>${selectedIds.size}</b> elementos · <b>${modes.size}</b> modalidades</span><button class="primary" data-action="start-session">${evaluation ? "Comenzar evaluación" : "Comenzar sesión"}</button></div><p class="notice" id="setupError" hidden>Selecciona al menos un elemento y una modalidad.</p></main><aside class="panel selector"><div class="section-head"><div><small>Contenido</small><h2>Elementos</h2></div><div><button class="text-btn" data-action="setup-all">Todos</button><button class="text-btn" data-action="setup-none">Ninguno</button></div></div><div class="selector-list">${items.map((item) => { const record = progress(item.id); return `<label class="select-item"><input type="checkbox" data-setup-item="${item.id}"${selectedIds.has(item.id) ? " checked" : ""}><span><b>${esc(item.english)}</b><small>${esc(item.spanish)}</small></span><em class="status ${record.status}">${record.status}</em></label>` }).join("")}</div></aside></section>${privacy}`;
}

function adaptiveScore(item) {
  const record = progress(item.id);
  let score = 1 + Math.random();
  if (isDue(record)) score += 20;
  if (record.errorTotal) score += Math.min(15, record.errorTotal * 2);
  if (record.status === "learning") score += 10;
  if (record.status === "new") score += 4;
  if (record.status === "mastered") score -= 8;
  if (state.question?.item.id === item.id) score -= 100;
  return score;
}

function chooseAdaptiveItem() {
  const candidates = state.active.items.filter((item) => !settings().excludeMastered || progress(item.id).status !== "mastered" || isDue(progress(item.id)));
  const pool = candidates.length ? candidates : state.active.items;
  return [...pool].sort((a, b) => adaptiveScore(b) - adaptiveScore(a))[0];
}

function chooseMode(item) {
  const compatible = state.active.modes.filter((mode) => mode === "topic-evaluation" || state.active.topic.availableModes.includes(mode));
  const choices = compatible.length ? compatible : [state.active.topic.availableModes[0]];
  if (choices.includes("mixed-challenge") || choices.includes("topic-evaluation")) {
    const base = state.active.topic.availableModes.filter((mode) => !["mixed-challenge", "topic-evaluation"].includes(mode));
    return random(base.length ? base : ["fill-blank"]);
  }
  const lastMode = state.question?.mode;
  const alternatives = choices.length > 1 ? choices.filter((mode) => mode !== lastMode) : choices;
  return random(alternatives);
}

function chooseExample(item, mode) {
  const record = progress(item.id);
  const candidates = state.active.examples.filter((example) => example.itemId === item.id && (!example.compatibleModes || example.compatibleModes.includes(mode) || example.mode === mode));
  const unseen = candidates.filter((example) => !(record.recentExampleIds || []).includes(example.id) && !state.session.answeredExampleIds.includes(example.id));
  return random(unseen.length ? unseen : candidates) || { id: `dynamic-${item.id}-${Date.now()}`, itemId: item.id, prompt: item.spanish, answer: item.english, acceptableAnswers: [], translation: item.spanish, explanation: `“${item.english}” significa “${item.spanish}”.`, hint: item.spanish, modelAnswer: item.example?.en || item.english, requiredTerms: [] };
}

function buildQuestion() {
  const item = chooseAdaptiveItem();
  const mode = chooseMode(item);
  const example = chooseExample(item, mode);
  const distractors = shuffle(state.active.items.filter((candidate) => candidate.id !== item.id)).slice(0, 3);
  const choiceModes = ["matching", "verb-example", "question-answer", "multiple-choice", "choose-response", "classify"];
  if (choiceModes.includes(mode)) return { ...example, item, mode, prompt: mode === "matching" ? item.english : example.prompt, answer: item.id, displayAnswer: item.spanish, options: shuffle([item, ...distractors]).map((candidate) => ({ id: candidate.id, label: mode === "verb-example" ? candidate.example?.en || candidate.spanish : candidate.spanish })) };
  if (mode === "translate-es-en") return { ...example, item, mode, prompt: item.spanish, answer: item.english, acceptableAnswers: [item.forms?.base].filter(Boolean) };
  if (mode === "translate-en-es") return { ...example, item, mode, prompt: item.english, answer: item.spanish, acceptableAnswers: item.spanish.split("/").map((value) => value.trim()) };
  if (mode === "conjugation" && item.forms) { const forms = ["thirdPerson", "past", "pastParticiple", "gerund"]; const form = random(forms); return { ...example, item, mode, prompt: `${item.forms.base} · ${form === "thirdPerson" ? "3.ª persona" : form === "past" ? "pasado" : form === "pastParticiple" ? "participio" : "-ing"}`, answer: item.forms[form], acceptableAnswers: [] } }
  if (mode === "word-order") { const answer = example.modelAnswer || item.example?.en || example.answer; return { ...example, item, mode, prompt: "Ordena las palabras para formar la respuesta modelo.", answer, tokens: shuffle(answer.replace(/[.!?]/g, "").split(/\s+/)) } }
  if (["negative-transform", "question-transform", "tense-transform", "active-passive", "error-correction"].includes(mode)) return { ...example, item, mode, prompt: `${mode === "negative-transform" ? "Pasa a negativa" : mode === "question-transform" ? "Convierte en pregunta" : mode === "tense-transform" ? "Cambia al tiempo indicado" : mode === "active-passive" ? "Convierte a voz pasiva" : "Corrige el error"}: ${item.example?.en || example.prompt}`, answer: example.modelAnswer || item.example?.en || example.answer, acceptableAnswers: example.acceptableAnswers || [] };
  if (["slack", "ticket", "pull-request", "code-review", "professional-scenario", "free-writing"].includes(mode)) return { ...example, item, mode, prompt: `${MODE_LABELS[mode]}: ${item.spanish}. Escribe una respuesta profesional.`, answer: example.modelAnswer || item.example?.en || `I can ${item.english}.`, openWriting: true, requiredTerms: example.requiredTerms || item.english.split(/\s+/).filter((word) => word.length > 3).slice(0, 3) };
  if (["dictation", "pronunciation"].includes(mode)) return { ...example, item, mode, prompt: mode === "dictation" ? "Escucha y escribe la frase." : "Escucha, repite y escribe lo que dijiste.", answer: item.example?.en || item.english, speakText: item.example?.en || item.english };
  if (mode === "answer-question") return { ...example, item, mode, prompt: `How would you ${item.english}?`, answer: example.modelAnswer || item.example?.en || item.english, openWriting: true, requiredTerms: example.requiredTerms || [] };
  return { ...example, item, mode, options: (example.options || []).map((value) => ({ id: value, label: value })) };
}

async function startSession(resume = null) {
  try {
    let setup = state.setup;
    if (resume) {
      if (resume.levelId === "MIX") {
        const mixed = await contentService.loadSelection(resume.selectedItemIds);
        setup = { ...mixed, selectedIds: new Set(resume.selectedItemIds), modes: new Set(resume.modes), evaluation: resume.evaluation, mixed: true };
      } else {
        const { level, area, topic } = await contentService.getTopic(resume.levelId, resume.areaId, resume.topicId);
        setup = { level, area, topic, selectedIds: new Set(resume.selectedItemIds), modes: new Set(resume.modes), evaluation: resume.evaluation };
      }
    }
    if (!setup) throw new Error("Primero configura una sesión.");
    const selectedIds = resume?.selectedItemIds || [...document.querySelectorAll("[data-setup-item]:checked")].map((input) => input.dataset.setupItem);
    const modes = resume?.modes || [...document.querySelectorAll("[data-mode]:checked")].map((input) => input.dataset.mode);
    if (!selectedIds.length || !modes.length) { const error = document.getElementById("setupError"); if (error) error.hidden = false; return }
    loading("Cargando solamente los ejemplos seleccionados…");
    const data = setup.mixed ? await contentService.loadSelection(selectedIds) : await contentService.loadTopic(setup.level.id, setup.area.id, setup.topic.id, selectedIds);
    storageService.seedInitialProgress(data.items);
    const questionLimit = resume?.questionLimit || Number(document.getElementById("setupQuestions")?.value || settings().questionsPerSession);
    const durationMinutes = resume?.durationMinutes ?? Number(document.getElementById("setupDuration")?.value || 0);
    const evaluation = Boolean(resume?.evaluation ?? setup.evaluation);
    state.active = { ...data, modes, evaluation, showHints: evaluation ? false : Boolean(document.getElementById("setupHints")?.checked ?? settings().showHints), immediateFeedback: evaluation ? false : Boolean(document.getElementById("setupImmediate")?.checked ?? settings().feedbackMode === "immediate") };
    state.session = resume || { id: crypto.randomUUID?.() || `session-${Date.now()}`, title: data.topic.title, levelId: data.level.id, areaId: data.area.id, topicId: data.topic.id, selectedItemIds: selectedIds, modes, evaluation, questionLimit, durationMinutes, difficulty: document.getElementById("setupDifficulty")?.value || settings().difficulty, direction: document.getElementById("setupDirection")?.value || settings().translationDirection, position: 0, answeredCount: 0, correctCount: 0, answeredExampleIds: [], results: [], startedAt: new Date().toISOString() };
    state.question = null; state.answered = false; state.feedback = null;
    storageService.saveSettings({ activeLevel: data.level.id, questionsPerSession: questionLimit, durationMinutes, selectedItemIds: selectedIds, selectedItemsByTopic: { ...settings().selectedItemsByTopic, [`${data.level.id}:${data.area.id}:${data.topic.id}`]: selectedIds } });
    storageService.saveCurrentSession(state.session);
    go("/practice/session");
    nextQuestion();
  } catch (error) { showError(error) }
}

function normalizeAnswer(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\bi'm\b/g, "i am").replace(/\byou're\b/g, "you are").replace(/\bhe's\b/g, "he is").replace(/\bshe's\b/g, "she is").replace(/\bwe're\b/g, "we are").replace(/\bthey're\b/g, "they are").replace(/\bcan't\b/g, "cannot").replace(/\bwon't\b/g, "will not").replace(/\bdon't\b/g, "do not").replace(/\bdoesn't\b/g, "does not").replace(/\bdidn't\b/g, "did not").replace(/[^a-z0-9]+/g, " ").trim();
}

function nextQuestion() {
  const elapsed = Date.now() - new Date(state.session.startedAt).getTime();
  if (state.session.answeredCount >= state.session.questionLimit || (state.session.durationMinutes && elapsed >= state.session.durationMinutes * 60000)) { finishSession(); return }
  state.question = buildQuestion();
  state.answered = false; state.feedback = null;
  state.session.position += 1;
  storageService.saveCurrentSession(state.session);
  renderSession();
}

function renderQuestionInput(question) {
  if (question.options?.length) return `<div class="answer-options">${question.options.map((option, index) => `<button class="answer-option" data-answer="${esc(option.id)}"><span>${String.fromCharCode(65 + index)}</span>${esc(option.label)}</button>`).join("")}</div>`;
  if (question.mode === "word-order") return `<div class="word-builder"><div id="orderedWords" class="ordered-words" aria-label="Respuesta ordenada"></div><div class="word-bank">${question.tokens.map((token, index) => `<button data-token="${esc(token)}" data-token-index="${index}">${esc(token)}</button>`).join("")}</div><input id="answerInput" type="hidden"><button class="text-btn" data-action="clear-order">Limpiar orden</button><button class="primary" data-action="submit-answer">Comprobar</button></div>`;
  const textarea = question.openWriting;
  return `${question.speakText ? `<button class="audio-btn" data-action="speak" data-text="${esc(question.speakText)}">▶ Escuchar${question.mode === "pronunciation" ? " y repetir" : ""}</button>` : ""}<div class="answer-form">${textarea ? `<textarea id="answerInput" rows="5" placeholder="Escribe una respuesta profesional…"></textarea>` : `<input id="answerInput" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Escribe tu respuesta">`}<button class="primary" data-action="submit-answer">Comprobar</button></div>`;
}

function renderSession() {
  if (!state.active || !state.session || !state.question) return;
  setHeader(state.active.evaluation ? "Evaluación" : "Práctica", `${state.active.level.id} · ${state.active.topic.title}`);
  const question = state.question; const record = progress(question.item.id); const elapsed = Date.now() - new Date(state.session.startedAt).getTime();
  const supplied = state.feedback?.chosen || "";
  app.innerHTML = `<section class="session-shell"><header class="session-head"><div><span class="level-badge ${levelClass(state.active.level.id)}">${state.active.level.id}</span><span>${esc(state.active.area.title)} · ${esc(state.active.topic.title)}</span></div><div><span>${state.session.position}/${state.session.questionLimit}</span><span>${formatMinutes(elapsed)}</span><button class="text-btn" data-action="quit-session">Salir</button></div></header>${bar(state.session.answeredCount / state.session.questionLimit * 100)}<div class="session-grid"><main class="question-card panel"><div class="question-meta"><span class="pill">${esc(MODE_LABELS[question.mode] || question.mode)}</span><span>Dominio ${record.currentStreak}/${settings().correctAnswersToMaster}</span></div><p class="instruction">${esc(question.instruction || "Responde según la instrucción.")}</p><h1>${esc(question.prompt)}</h1>${question.translation && question.mode !== "translate-es-en" ? `<p class="translation">${esc(question.translation)}</p>` : ""}${!state.answered ? renderQuestionInput(question) : renderFeedback()}<div class="question-tools">${state.active.showHints && !state.answered ? `<button class="secondary" data-action="show-hint">Pista</button>` : ""}${!state.answered ? `<button class="secondary" data-action="dont-know">No sé</button>` : ""}<button class="secondary" data-action="report-problem">Reportar problema</button><button class="secondary" data-action="open-theory">Teoría</button></div><div id="hintBox" class="hint" hidden>${esc(question.hint || "Revisa el significado y la estructura.")}</div></main><aside class="panel session-rail"><small>Sesión</small><h2>${state.active.evaluation ? "Evaluación sin pistas" : "Práctica adaptativa"}</h2><dl><div><dt>Correctas</dt><dd>${state.session.correctCount}</dd></div><div><dt>Errores</dt><dd>${state.session.answeredCount - state.session.correctCount}</dd></div><div><dt>Precisión</dt><dd>${state.session.answeredCount ? Math.round(state.session.correctCount / state.session.answeredCount * 100) : 0}%</dd></div></dl><h3>Prioridad adaptativa</h3><p>Repasos vencidos → errores → aprendiendo → nuevos.</p><h3>Respuesta actual</h3><p>${supplied ? esc(supplied) : "Pendiente"}</p></aside></div></section>${privacy}`;
  if (!state.answered) document.getElementById("answerInput")?.focus();
}

function renderFeedback() {
  const feedback = state.feedback;
  const question = state.question;
  const alternatives = question.acceptableAnswers?.length ? `<p><b>También se acepta:</b> ${question.acceptableAnswers.map(esc).join(" · ")}</p>` : "";
  const writing = question.openWriting ? `<div class="rubric"><h3>Autoevaluación guiada</h3><ul><li>${feedback.requiredHit ? "✓" : "○"} Incluye términos clave.</li><li>○ Es clara y accionable.</li><li>○ Mantiene un tono profesional.</li><li>○ Incluye el siguiente paso cuando corresponde.</li></ul><p><b>Respuesta modelo:</b> ${esc(question.answer)}</p></div>` : "";
  return `<div class="feedback-box ${feedback.correct ? "correct" : "incorrect"}"><span>${feedback.correct ? "Correcto" : "Necesita revisión"}</span><h2>${feedback.correct ? "Bien resuelto." : `Respuesta correcta: ${esc(feedback.answer)}`}</h2><p><b>Tu respuesta:</b> ${esc(feedback.chosen || "No sé")}</p>${alternatives}<p><b>Traducción:</b> ${esc(question.translation || question.item.spanish)}</p><p><b>Explicación:</b> ${esc(feedback.explanation)}</p>${writing}<button class="primary" data-action="next-question">Continuar →</button></div>`;
}

function submitAnswer(chosen) {
  if (state.answered) return;
  const question = state.question;
  const accepted = [question.answer, ...(question.acceptableAnswers || [])].filter(Boolean).map(normalizeAnswer);
  const required = question.requiredTerms || [];
  const requiredHit = !required.length || required.some((term) => normalizeAnswer(chosen).includes(normalizeAnswer(term)));
  const correct = question.options?.length ? chosen === question.answer : question.openWriting ? requiredHit && normalizeAnswer(chosen).split(" ").length >= 4 : accepted.includes(normalizeAnswer(chosen));
  const explanation = correct ? question.explanation || "Aplicaste correctamente la regla." : `${question.explanation || question.hint || "Revisa la estructura."} En este ejercicio corresponde “${question.answer}”, no “${chosen || "sin respuesta"}”.`;
  storageService.recordAttempt({ itemId: question.item.id, mode: question.mode, correct, exampleId: question.id, availableModes: state.active.topic.availableModes, givenAnswer: chosen, correctAnswer: question.displayAnswer || question.answer, rule: question.explanation || question.hint || "", level: question.item.level, topicId: state.active.topic.id });
  state.feedback = { correct, chosen, answer: question.displayAnswer || question.answer, explanation, requiredHit };
  state.answered = true;
  state.session.answeredCount += 1; state.session.correctCount += correct ? 1 : 0;
  state.session.answeredExampleIds = [...state.session.answeredExampleIds, question.id].slice(-100);
  state.session.results.push({ itemId: question.item.id, exampleId: question.id, mode: question.mode, correct, chosen, answer: question.answer });
  storageService.saveCurrentSession(state.session);
  if (!state.active.immediateFeedback) nextQuestion(); else renderSession();
}

function finishSession() {
  const durationMs = Date.now() - new Date(state.session.startedAt).getTime();
  const summary = { ...state.session, durationMs, accuracy: state.session.answeredCount ? Math.round(state.session.correctCount / state.session.answeredCount * 100) : 0 };
  storageService.completeSession(summary);
  state.results = summary;
  contentService.clearExamplesFromMemory();
  go("/practice/results");
}

function renderResults() {
  setHeader("Resultados", "Resumen de sesión");
  const result = state.results || storageService.getSessionSummaries().at(-1);
  if (!result) { app.innerHTML = `<div class="panel empty"><h2>Aún no hay resultados</h2><button class="primary" data-route="/practice/setup">Configurar práctica</button></div>`; return }
  const itemIds = [...new Set(result.results?.map((value) => value.itemId) || result.selectedItemIds || [])];
  const modes = Object.entries((result.results || []).reduce((acc, value) => { acc[value.mode] ||= { total: 0, correct: 0 }; acc[value.mode].total += 1; acc[value.mode].correct += value.correct ? 1 : 0; return acc }, {}));
  const mastered = itemIds.filter((id) => progress(id).status === "mastered");
  const near = itemIds.filter((id) => progress(id).status !== "mastered" && progress(id).currentStreak >= Math.max(1, settings().correctAnswersToMaster - 2));
  const errors = (result.results || []).filter((value) => !value.correct);
  app.innerHTML = `<section class="results-hero ${result.accuracy >= 80 ? "success" : "review"}"><span>${result.accuracy >= 80 ? "Sesión completada" : "Sesión para reforzar"}</span><h1>${result.accuracy}% de precisión</h1><p>${result.correctCount} aciertos de ${result.answeredCount} respuestas en ${formatMinutes(result.durationMs)}.</p></section><section class="metric-grid">${metric("Aciertos", result.correctCount)}${metric("Errores", result.answeredCount - result.correctCount)}${metric("Elementos", itemIds.length)}${metric("Dominados", mastered.length)}${metric("Próximos a dominar", near.length)}${metric("Tiempo", formatMinutes(result.durationMs))}</section><div class="dashboard-grid"><section class="panel"><h2>Rendimiento por modalidad</h2>${modes.map(([mode, value]) => `<div class="performance-row"><span>${esc(MODE_LABELS[mode] || mode)}</span>${bar(value.correct / value.total * 100)}<b>${Math.round(value.correct / value.total * 100)}%</b></div>`).join("") || "<p>Sin desglose.</p>"}<h2>Errores frecuentes</h2>${errors.slice(0, 8).map((value) => { const item = state.allItems.find((candidate) => candidate.id === value.itemId); return `<div class="error-mini"><b>${esc(item?.english || value.itemId)}</b><span>${esc(value.chosen)} → ${esc(value.answer)}</span></div>` }).join("") || "<p class='good'>No hubo errores.</p>"}</section><aside class="panel"><small>Recomendación</small><h2>${errors.length ? "Practica los errores antes de avanzar" : "Continúa con el siguiente tema"}</h2><p>${errors.length ? "Una sesión corta y enfocada consolidará las formas que fallaron." : "Tu precisión permite aumentar gradualmente la dificultad."}</p><div class="stack-actions"><button class="primary" data-action="practice-result-errors"${errors.length ? "" : " disabled"}>Practicar errores</button><button class="secondary" data-action="repeat-session">Repetir</button><button class="secondary" data-action="recommended-session">Continuar con recomendación</button><button class="text-btn" data-route="/">Volver al inicio</button></div></aside></div>${privacy}`;
}

function renderErrors() {
  setHeader("Cuaderno de errores", "Corrección y repaso");
  const errors = storageService.getErrors();
  app.innerHTML = `<section class="page-intro compact"><span class="eyebrow">Aprender del error</span><h1>Cuaderno de errores</h1><p>Cada registro conserva la respuesta, la regla y su próximo repaso.</p><div class="actions"><button class="primary" data-action="practice-all-errors"${errors.some((value) => value.status !== "corrected") ? "" : " disabled"}>Practicar pendientes</button><button class="secondary" data-action="show-pending-errors">Solo pendientes</button></div></section><section class="panel error-table"><div class="table-wrap"><table><thead><tr><th>Elemento</th><th>Tu respuesta</th><th>Respuesta correcta</th><th>Regla</th><th>Repeticiones</th><th>Próximo repaso</th><th>Estado</th><th></th></tr></thead><tbody>${errors.map((error) => { const item = state.allItems.find((value) => value.id === error.itemId); return `<tr><td><b>${esc(item?.english || error.itemId)}</b><small>${esc(item?.spanish || "")}</small></td><td>${esc(error.givenAnswer || "—")}</td><td>${esc(error.correctAnswer || "—")}</td><td>${esc(error.rule || "Revisar explicación")}</td><td>${error.count || 1}</td><td>${formatDate(error.nextReviewAt)}</td><td><span class="status ${error.status || "pending"}">${error.status === "corrected" ? "Corregido" : "Pendiente"}</span></td><td><button class="text-btn" data-action="practice-error" data-item="${error.itemId}">Practicar</button></td></tr>` }).join("") || `<tr><td colspan="8">No hay errores registrados.</td></tr>`}</tbody></table></div></section>${privacy}`;
}

function readinessChecklist() {
  const checks = [
    ["Daily de cinco minutos", "daily"], ["Ticket completo", "ticket"], ["Pull request", "pull-request"], ["Code review", "code-review"], ["Explicación de arquitectura", "architecture"],
    ["Simulación de incidente", "incident"], ["Runbook", "readme"], ["Postmortem", "postmortem"], ["System design", "system-design"], ["Entrevista técnica", "technical-interview"], ["Respuesta STAR", "star"], ["Listening mínimo 80%", "listening"]
  ];
  return checks.map(([label, token]) => { const related = state.allItems.filter((item) => `${item.id} ${(item.categories || []).join(" ")}`.includes(token)); const stats = aggregate(related); const done = related.length && stats.mastered / related.length >= .6 && (token !== "listening" || stats.accuracy >= 80); return { label, done, progress: related.length ? Math.round(stats.mastered / related.length * 100) : 0 } });
}

function renderProgress() {
  setHeader("Progreso", "Preparación para diciembre");
  const total = aggregate(); const sessions = storageService.getSessionSummaries(); const time = sessions.reduce((sum, value) => sum + (value.durationMs || 0), 0); const checklist = readinessChecklist();
  const ready = Math.round(checklist.filter((value) => value.done).length / checklist.length * 100);
  const modeStats = {};
  Object.values(storageService.getAllProgress()).forEach((record) => Object.entries(record.modeStats || {}).forEach(([mode, value]) => { modeStats[mode] ||= { attempts: 0, correct: 0 }; modeStats[mode].attempts += value.attempts; modeStats[mode].correct += value.correct }));
  app.innerHTML = `<section class="progress-hero"><div><span class="eyebrow">Meta · ${formatDate(settings().targetDate)}</span><h1>Listo para buscar trabajo</h1><p>${checklist.filter((value) => value.done).length} de ${checklist.length} competencias demostradas.</p></div><strong>${ready}%</strong></section><section class="metric-grid">${metric("Progreso general", `${Math.round(total.mastered / Math.max(1, total.total) * 100)}%`)}${metric("Precisión histórica", `${total.accuracy}%`)}${metric("Tiempo estudiado", formatMinutes(time))}${metric("Racha", `${studyStreak()} días`)}${metric("Dominados", total.mastered)}${metric("Errores pendientes", storageService.getErrors({ pendingOnly: true }).length)}</section><div class="dashboard-grid"><section class="panel"><h2>Progreso por nivel</h2>${state.curriculum.levels.map((level) => { const stats = aggregate(state.allItems.filter((item) => item.level === level.id)); const percent = Math.round(stats.mastered / Math.max(1, stats.total) * 100); return `<div class="progress-level"><span class="level-badge ${levelClass(level.id)}">${level.id}</span><span><b>${esc(level.title)}</b><small>${stats.mastered}/${stats.total} dominados · ${stats.learning} aprendiendo</small></span>${bar(percent)}<strong>${percent}%</strong></div>` }).join("")}<h2>Rendimiento por modalidad</h2>${Object.entries(modeStats).sort((a,b)=>b[1].attempts-a[1].attempts).slice(0,10).map(([mode,value])=>`<div class="performance-row"><span>${esc(MODE_LABELS[mode]||mode)}</span>${bar(value.correct/value.attempts*100)}<b>${Math.round(value.correct/value.attempts*100)}%</b></div>`).join("") || "<p class='muted'>Completa una sesión para ver el desglose.</p>"}</section><aside class="panel"><h2>Competencias laborales</h2><div class="readiness-list">${checklist.map((value) => `<div class="${value.done ? "done" : ""}"><span>${value.done ? "✓" : "○"}</span><p><b>${esc(value.label)}</b>${bar(value.progress)}</p><em>${value.progress}%</em></div>`).join("")}</div></aside></div>${privacy}`;
}

function renderEvaluations() {
  setHeader("Evaluaciones", "Sin pistas · resultado final");
  app.innerHTML = `<section class="page-intro"><span class="eyebrow">Medición objetiva</span><h1>Evaluaciones por nivel</h1><p>20 preguntas mixtas, sin pistas y con retroalimentación al final.</p></section><section class="level-grid compact">${state.curriculum.levels.map((level) => { const area = level.areas.find((value) => value.id === "evaluation"); const topic = area.topics[0]; const stats = aggregate(state.allItems.filter((item) => item.level === level.id)); return `<article class="level-card ${levelClass(level.id)}"><div class="level-card-top"><span>${level.id}</span><small>${esc(level.title)}</small></div><h2>Evaluación ${level.id}</h2><p>Gramática, vocabulario, escritura y comunicación laboral.</p><div class="level-stats"><span><b>${stats.accuracy}%</b> precisión actual</span><span><b>80%</b> mínimo recomendado</span></div><button class="primary" data-action="setup-context" data-level="${level.id}" data-area="${area.id}" data-topic="${topic.id}" data-evaluation="true">Comenzar evaluación</button></article>` }).join("")}</section>${privacy}`;
}

function renderSettings(message = "") {
  setHeader("Configuración", "Dominio, sesiones y privacidad");
  const value = settings(); const custom = ![5, 10, 15, 20].includes(value.correctAnswersToMaster);
  app.innerHTML = `<section class="page-intro compact"><span class="eyebrow">Preferencias locales</span><h1>Configuración</h1><p>Cambiar la meta nunca borra los aciertos ni el historial.</p></section><section class="panel settings-page">${message ? `<div class="notice">${esc(message)}</div>` : ""}<h2>Dominio y repaso</h2><div class="settings-grid"><label><span>Modo de dominio</span><select id="masteryMode"><option value="simple"${value.masteryMode !== "robust" ? " selected" : ""}>Simple</option><option value="robust"${value.masteryMode === "robust" ? " selected" : ""}>Robusto</option></select></label><label><span>Aciertos para dominar</span><select id="goalSelect"><option value="5"${value.correctAnswersToMaster === 5 ? " selected" : ""}>5</option><option value="10"${value.correctAnswersToMaster === 10 ? " selected" : ""}>10</option><option value="15"${value.correctAnswersToMaster === 15 ? " selected" : ""}>15</option><option value="20"${value.correctAnswersToMaster === 20 ? " selected" : ""}>20</option><option value="custom"${custom ? " selected" : ""}>Personalizado</option></select></label><label><span>Valor personalizado</span><input id="customGoal" type="number" min="1" max="100" value="${value.correctAnswersToMaster}"${custom ? "" : " disabled"}></label><label><span>Precisión mínima (%)</span><input id="minimumAccuracy" type="number" min="0" max="100" value="${value.minimumAccuracy}"></label><label><span>Modalidades mínimas</span><input id="minimumModes" type="number" min="1" max="10" value="${value.minimumExerciseModes}"></label><label><span>Días de repaso mínimos</span><input id="minimumDays" type="number" min="1" max="30" value="${value.minimumReviewDays}"></label><label><span>Preguntas predeterminadas</span><select id="defaultQuestions"><option>10</option><option${value.questionsPerSession === 20 ? " selected" : ""}>20</option><option>30</option><option>50</option></select></label><label><span>Fecha objetivo</span><input id="targetDate" type="date" value="${esc(value.targetDate)}"></label></div><label class="checkline"><input id="consecutive" type="checkbox"${value.requireConsecutiveCorrect ? " checked" : ""}><span>Exigir aciertos consecutivos; un error reinicia la racha.</span></label><label class="checkline"><input id="preserveMastered" type="checkbox"${value.preserveMasteredOnGoalChange ? " checked" : ""}><span>Conservar los elementos ya dominados. Desmárcalo para reevaluarlos.</span></label><label class="checkline"><input id="excludeMastered" type="checkbox"${value.excludeMastered ? " checked" : ""}><span>Excluir dominados de la práctica normal; mantener repaso espaciado.</span></label><label class="checkline"><input id="showHints" type="checkbox"${value.showHints ? " checked" : ""}><span>Permitir pistas durante la práctica.</span></label><button class="primary" data-action="save-settings">Guardar configuración</button><section class="settings-section"><h2>Copias de seguridad</h2><p>Incluyen configuración, estadísticas, errores y sesiones; nunca el banco educativo.</p><div class="actions"><button class="secondary" data-action="export-data">Exportar JSON</button><label class="secondary file-label" for="importFile">Importar JSON</label><input id="importFile" type="file" accept="application/json" hidden></div></section><section class="settings-section"><h2>Restablecer</h2><div class="actions"><button class="secondary" data-action="reset-settings">Solo configuración</button><button class="secondary" data-action="discard-session">Sesión actual</button>${state.curriculum.levels.map((level) => `<button class="danger" data-action="reset-level" data-level="${level.id}">Progreso ${level.id}</button>`).join("")}<button class="danger" data-action="reset-all">Todo el progreso</button></div></section></section>${privacy}`;
}

function saveSettings() {
  const selected = document.getElementById("goalSelect").value; const goal = selected === "custom" ? Number(document.getElementById("customGoal").value) : Number(selected);
  const accuracy = Number(document.getElementById("minimumAccuracy").value); const modes = Number(document.getElementById("minimumModes").value); const days = Number(document.getElementById("minimumDays").value);
  if (!Number.isInteger(goal) || goal < 1 || goal > 100 || accuracy < 0 || accuracy > 100 || modes < 1 || days < 1) { renderSettings("Revisa los valores de dominio."); return }
  storageService.saveSettings({ masteryMode: document.getElementById("masteryMode").value, correctAnswersToMaster: goal, minimumAccuracy: accuracy, minimumExerciseModes: modes, minimumReviewDays: days, questionsPerSession: Number(document.getElementById("defaultQuestions").value), targetDate: document.getElementById("targetDate").value, requireConsecutiveCorrect: document.getElementById("consecutive").checked, preserveMasteredOnGoalChange: document.getElementById("preserveMastered").checked, excludeMastered: document.getElementById("excludeMastered").checked, showHints: document.getElementById("showHints").checked });
  storageService.reevaluateMastery(); renderSettings("Configuración guardada; el historial se conservó.");
}

function exportData() {
  const blob = new Blob([JSON.stringify(storageService.exportData(), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `english-trainer-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(file) {
  try { storageService.importData(JSON.parse(await file.text())); applyTheme(settings().theme); renderSettings("Respaldo importado correctamente; se guardó una copia previa.") }
  catch (error) { renderSettings(error.message) }
}

async function router() {
  document.body.classList.remove("menu-open");
  document.querySelectorAll("[data-route]").forEach((button) => button.classList.toggle("active", button.dataset.route === routePath()));
  const parts = routeParts();
  try {
    if (!parts.length) renderHome();
    else if (parts[0] === "levels" && parts.length === 1) renderLevels();
    else if (parts[0] === "levels" && parts.length === 2) await renderLevel(parts[1]);
    else if (parts[0] === "levels" && parts.length === 3) await renderArea(parts[1], parts[2]);
    else if (parts[0] === "levels" && parts.length >= 4) await renderTopic(parts[1], parts[2], parts[3]);
    else if (parts[0] === "learn") await renderLearn(parts[1], parts[2]);
    else if (parts[0] === "content" && parts[1] === "select") await renderContentSelection();
    else if (parts[0] === "practice" && parts[1] === "setup") renderPracticeSetup();
    else if (parts[0] === "practice" && parts[1] === "session") state.question ? renderSession() : storageService.getCurrentSession() ? await startSession(storageService.getCurrentSession()) : go("/practice/setup");
    else if (parts[0] === "practice" && parts[1] === "results") renderResults();
    else if (parts[0] === "evaluations") renderEvaluations();
    else if (parts[0] === "errors") renderErrors();
    else if (parts[0] === "progress") renderProgress();
    else if (parts[0] === "settings") renderSettings();
    else renderHome();
  } catch (error) { showError(error) }
}

async function setupBroadContext(levelId, areaId = null) {
  const level = await contentService.getLevel(levelId); const area = areaId ? level.areas.find((value) => value.id === areaId) : level.areas.find((value) => value.id === "grammar"); const topic = area.topics[0]; await prepareSetup({ levelId: level.id, areaId: area.id, topicId: topic.id });
}

async function practiceSpecificIds(ids) {
  if (!ids.length) return;
  const mixed = await contentService.loadSelection(ids);
  state.setup = { ...mixed, selectedIds: new Set(mixed.items.map((item) => item.id)), modes: new Set(mixed.topic.availableModes.filter((mode) => settings().enabledExerciseModes.includes(mode)).slice(0, 5)), evaluation: false, mixed: true };
  if (!state.setup.modes.size) state.setup.modes.add("matching");
  go("/practice/setup");
}

document.addEventListener("click", async (event) => {
  const route = event.target.closest("[data-route]");
  if (route) { event.preventDefault(); go(route.dataset.route); return }
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "setup-topic") await prepareSetup(state.context);
    else if (action === "setup-context") await prepareSetup({ levelId: button.dataset.level, areaId: button.dataset.area, topicId: button.dataset.topic }, null, button.dataset.evaluation === "true");
    else if (action === "evaluate-topic") await prepareSetup(state.context, null, true);
    else if (action === "practice-topic-errors") { const ids = storageService.getErrors({ pendingOnly: true }).filter((value) => value.topicId === state.context.topicId).map((value) => value.itemId); await prepareSetup(state.context, ids.length ? ids : null) }
    else if (action === "practice-level" || action === "choose-level-setup") await setupBroadContext(button.dataset.level);
    else if (action === "practice-area") await setupBroadContext(button.dataset.level, button.dataset.area);
    else if (action === "evaluate-level") { const level = await contentService.getLevel(button.dataset.level); const area = level.areas.find((value) => value.id === "evaluation"); await prepareSetup({ levelId: level.id, areaId: area.id, topicId: area.topics[0].id }, null, true) }
    else if (action === "setup-all" || action === "setup-none") { document.querySelectorAll("[data-setup-item]").forEach((input) => { input.checked = action === "setup-all" }); state.setup.selectedIds = new Set([...document.querySelectorAll("[data-setup-item]:checked")].map((input) => input.dataset.setupItem)); renderPracticeSetup() }
    else if (action === "start-session") await startSession();
    else if (button.dataset.answer != null) submitAnswer(button.dataset.answer);
    else if (button.dataset.token != null) { const input = document.getElementById("answerInput"); const output = document.getElementById("orderedWords"); input.value = `${input.value} ${button.dataset.token}`.trim(); output.textContent = input.value; button.disabled = true }
    else if (action === "clear-order") { document.getElementById("answerInput").value = ""; document.getElementById("orderedWords").textContent = ""; document.querySelectorAll("[data-token]").forEach((value) => { value.disabled = false }) }
    else if (action === "submit-answer") submitAnswer(document.getElementById("answerInput")?.value || "");
    else if (action === "dont-know") submitAnswer("");
    else if (action === "show-hint") document.getElementById("hintBox").hidden = false;
    else if (action === "next-question") nextQuestion();
    else if (action === "speak") { if ("speechSynthesis" in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(button.dataset.text)) } else alert("La voz no está disponible. Usa la alternativa escrita.") }
    else if (action === "report-problem") { storageService.reportContentIssue({ itemId: state.question?.item.id, exampleId: state.question?.id, topicId: state.active?.topic.id, reason: "reported-by-user" }); button.textContent = "Problema guardado"; button.disabled = true }
    else if (action === "open-theory") go(`/learn/${state.active.level.id.toLowerCase()}/${state.active.topic.id}?area=${state.active.area.id}`);
    else if (action === "quit-session") { if (confirm("¿Salir de la sesión? Podrás continuarla después.")) go("/") }
    else if (action === "resume-session") await startSession(storageService.getCurrentSession());
    else if (action === "discard-session") { storageService.clearCurrentSession(); state.session = state.active = state.question = null; routePath() === "/settings" ? renderSettings("Sesión descartada.") : renderHome() }
    else if (action === "apply-filters") { state.filters = { query: document.getElementById("searchFilter").value, level: document.getElementById("levelFilter").value, area: document.getElementById("areaFilter").value, topic: document.getElementById("topicFilter").value, type: document.getElementById("typeFilter").value, category: document.getElementById("categoryFilter").value, status: document.getElementById("statusFilter").value, errors: document.getElementById("errorsFilter").value, due: document.getElementById("dueFilter").value }; await renderContentSelection() }
    else if (["select-visible", "deselect-visible", "select-new", "select-errors", "select-due", "select-random"].includes(action)) {
      const visible = [...document.querySelectorAll("[data-select-id]")].map((input) => input.dataset.selectId);
      let chosen = visible;
      if (action === "select-new") chosen = visible.filter((id) => progress(id).status === "new");
      if (action === "select-errors") { const ids = new Set(storageService.getErrors({ pendingOnly: true }).map((value) => value.itemId)); chosen = visible.filter((id) => ids.has(id)) }
      if (action === "select-due") chosen = visible.filter((id) => isDue(progress(id)));
      if (action === "select-random") chosen = shuffle(visible).slice(0, 20);
      if (action === "deselect-visible") visible.forEach((id) => state.selection.delete(id)); else chosen.forEach((id) => state.selection.add(id));
      storageService.saveSettings({ selectedItemIds: [...state.selection] }); await renderContentSelection();
    }
    else if (action === "practice-selection") await practiceSpecificIds([...state.selection]);
    else if (action === "save-list") { const name = prompt("Nombre de la lista:"); if (name?.trim() && state.selection.size) storageService.saveCustomList({ id: `${slug(name)}-${Date.now()}`, name: name.trim(), itemIds: [...state.selection] }) }
    else if (action === "practice-list") { const list = storageService.getCustomLists().find((value) => value.id === button.dataset.list); if (list) await practiceSpecificIds(list.itemIds) }
    else if (action === "practice-error") await practiceSpecificIds([button.dataset.item]);
    else if (action === "practice-all-errors" || action === "practice-result-errors") await practiceSpecificIds(storageService.getErrors({ pendingOnly: true }).map((value) => value.itemId));
    else if (action === "show-pending-errors") { const pending = new Set(storageService.getErrors({ pendingOnly: true }).map((value) => value.itemId)); document.querySelectorAll(".error-table tbody tr").forEach((row) => { const id = row.querySelector("[data-item]")?.dataset.item; row.hidden = id && !pending.has(id) }) }
    else if (action === "repeat-session") { const result = state.results; await prepareSetup({ levelId: result.levelId, areaId: result.areaId, topicId: result.topicId }, result.selectedItemIds, result.evaluation) }
    else if (action === "recommended-session") { const result = state.results; const level = await contentService.getLevel(result.levelId); const area = level.areas.find((value) => value.id === result.areaId); const current = area.topics.findIndex((value) => value.id === result.topicId); const next = area.topics[Math.min(area.topics.length - 1, current + 1)]; await prepareSetup({ levelId: level.id, areaId: area.id, topicId: next.id }) }
    else if (action === "save-settings") saveSettings();
    else if (action === "export-data") exportData();
    else if (action === "reset-settings") { storageService.resetSettings(); renderSettings("Configuración restablecida.") }
    else if (action === "reset-level" && confirm(`¿Restablecer el progreso ${button.dataset.level}?`)) { storageService.resetProgress(button.dataset.level); storageService.seedInitialProgress(state.allItems.filter((item) => item.level === button.dataset.level)); renderSettings(`Progreso ${button.dataset.level} restablecido; se conservaron los estados iniciales importados.`) }
    else if (action === "reset-all" && confirm("¿Restablecer TODO el progreso? Esta acción no se puede deshacer.")) { storageService.resetProgress("all"); storageService.clearCurrentSession(); storageService.seedInitialProgress(state.allItems); renderSettings("Todo el progreso fue restablecido; se conservaron los estados iniciales importados.") }
  } catch (error) { showError(error) }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-select-id]")) { event.target.checked ? state.selection.add(event.target.dataset.selectId) : state.selection.delete(event.target.dataset.selectId); storageService.saveSettings({ selectedItemIds: [...state.selection] }) }
  if (event.target.matches("[data-setup-item]")) { event.target.checked ? state.setup.selectedIds.add(event.target.dataset.setupItem) : state.setup.selectedIds.delete(event.target.dataset.setupItem) }
  if (event.target.matches("[data-mode]")) { event.target.checked ? state.setup.modes.add(event.target.dataset.mode) : state.setup.modes.delete(event.target.dataset.mode) }
  if (event.target.id === "goalSelect") document.getElementById("customGoal").disabled = event.target.value !== "custom";
  if (event.target.id === "importFile" && event.target.files[0]) importData(event.target.files[0]);
});

document.addEventListener("keydown", (event) => {
  if (routePath() !== "/practice/session" || state.answered) return;
  if (event.key === "Enter" && !event.shiftKey && document.activeElement?.tagName !== "TEXTAREA") { const input = document.getElementById("answerInput"); if (input) { event.preventDefault(); submitAnswer(input.value) } }
  if (/^[1-4]$/.test(event.key)) document.querySelectorAll("[data-answer]")[Number(event.key) - 1]?.click();
  if (event.key.toLowerCase() === "h") document.querySelector("[data-action=show-hint]")?.click();
  if (event.key.toLowerCase() === "n") document.querySelector("[data-action=dont-know]")?.click();
});

window.addEventListener("hashchange", router);
menuBtn.addEventListener("click", () => document.body.classList.toggle("menu-open"));
themeBtn.addEventListener("click", () => { const current = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"); const next = current === "dark" ? "light" : "dark"; storageService.saveSettings({ theme: next }); applyTheme(next) });
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; installBtn.hidden = false });
installBtn.addEventListener("click", async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; installBtn.hidden = true });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

init();
