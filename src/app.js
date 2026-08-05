import { contentService } from "./content-service.js";
import { storageService } from "./storage-service.js";

const app = document.getElementById("app");
const resetBtn = document.getElementById("resetBtn");
const settingsBtn = document.getElementById("settingsBtn");
const themeBtn = document.getElementById("themeBtn");
const installBtn = document.getElementById("installBtn");
const state = { manifest: null, topics: null, setup: null, active: null, question: null, answered: false, feedback: null, session: null, previousView: null };
let installPrompt = null;

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const normalize = (value) => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ");
const shuffle = (values) => { const copy = [...values]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy };
const random = (values) => values[Math.floor(Math.random() * values.length)];
const modeNames = { "fill-blank": "Completar la frase", matching: "Relacionar traducción", "translate-es-en": "Escribir en inglés" };
const modeDescriptions = { "fill-blank": "Completa el hueco usando la regla y el contexto.", matching: "Relaciona la palabra inglesa con su significado.", "translate-es-en": "Recuerda la palabra sin ver opciones." };
const crumb = (label) => `<nav class="crumb"><button data-action="home">Inicio</button><span>›</span><span>${esc(label)}</span></nav>`;
const privacy = '<p class="privacy">Tu progreso se guarda únicamente en este dispositivo y no se envía a ningún servidor.</p>';

function setLoading(message = "Cargando contenido…") { app.innerHTML = `<div class="card loading">${esc(message)}</div>` }
function showError(error) { app.innerHTML = `<div class="card error"><strong>No se pudo completar la operación.</strong><p>${esc(error.message || error)}</p><button class="primary" data-action="home">Volver al inicio</button></div>` }
function applyTheme(theme) { if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme }
function settings() { return storageService.getSettings() }
function selectedFor(topicId, fallback) { const selected = settings().selectedItemsByTopic?.[topicId]; return Array.isArray(selected) && selected.length ? selected.filter((id) => fallback.includes(id)) : fallback }

async function init() {
  try {
    state.manifest = await contentService.loadManifest();
    const status = storageService.init(state.manifest.contentVersion);
    applyTheme(settings().theme);
    renderHome(status.warning);
  } catch (error) { showError(error) }
}

function renderHome(warning = storageService.warning) {
  state.setup = state.active = state.question = state.feedback = null;
  resetBtn.hidden = true;
  const session = storageService.getCurrentSession();
  const resume = session ? `<section class="banner"><div><strong>Hay una sesión sin terminar</strong><p>${esc(session.title)} · ${session.answeredCount || 0} respuestas completadas.</p></div><div class="banner-actions"><button class="secondary" data-action="discard-session">Descartar</button><button class="primary" data-action="continue-session">Continuar</button></div></section>` : "";
  app.innerHTML = `${warning ? `<div class="notice">${esc(warning)}</div>` : ""}${resume}<section class="hero"><div class="eyebrow">Entrenamiento local y privado</div><h2>Aprende, practica y vuelve a repasar.</h2><p>El contenido se carga por tema y queda disponible sin conexión. Tu progreso, errores y sesiones viven solamente en este navegador.</p></section><section class="menu"><button class="menu-card" data-action="open-a1"><span class="icon">A1</span><span class="arrow">→</span><h3>Nivel A1</h3><p>Ocho temas fundamentales con práctica, teoría y repaso adaptativo.</p></button><button class="menu-card" data-action="setup-modals"><span class="icon">MA</span><span class="arrow">→</span><h3>Modales y auxiliares</h3><p>Completa frases, relaciona significados y revisa errores.</p></button></section>${privacy}`;
}

async function renderA1Menu() {
  setLoading();
  try {
    state.topics ||= await contentService.loadA1Topics();
    resetBtn.hidden = true;
    app.innerHTML = `${crumb("Nivel A1")}<section class="subintro"><h2>Temas A1</h2><p>Solo se descargarán los ejemplos del tema y los elementos que selecciones.</p></section><section class="menu">${state.topics.map((topic, index) => `<button class="menu-card" data-action="setup-a1" data-topic="${esc(topic.id)}"><span class="icon">${String(index + 1).padStart(2, "0")}</span><span class="arrow">→</span><h3>${esc(topic.title)}</h3><p>${esc(topic.description)}</p></button>`).join("")}</section>${privacy}`;
  } catch (error) { showError(error) }
}

async function prepareSetup(section, topicId) {
  setLoading("Cargando catálogo…");
  try {
    let topic, items;
    if (section === "A1") {
      topic = await contentService.loadTopicDefinition(topicId);
      const catalog = await contentService.loadCatalog(topic.itemSource);
      const allowed = new Set(topic.itemIds);
      items = catalog.filter((item) => allowed.has(item.id));
    } else {
      const definition = await contentService.loadModalsDefinition();
      topic = { ...definition, id: "modals" };
      items = definition.items.filter((item) => item.active !== false);
    }
    const allIds = items.map((item) => item.id);
    state.setup = { section, topic, items, selectedIds: new Set(selectedFor(topic.id, allIds)), mode: topic.modes[0] };
    renderSetup();
  } catch (error) { showError(error) }
}

function itemMeaning(item) { return item.spanish || item.category || "" }
function renderSetup() {
  const { topic, items, selectedIds, mode } = state.setup;
  resetBtn.hidden = true;
  app.innerHTML = `${crumb(topic.title)}<div class="setup"><main class="card"><div class="eyebrow">Preparar sesión</div><h2 class="screen-title">${esc(topic.title)}</h2><p class="muted">${esc(topic.description || "Selecciona una modalidad y los elementos que quieres practicar.")}</p><div class="mode-list">${topic.modes.map((value) => `<button class="mode${value === mode ? " selected" : ""}" data-action="select-mode" data-mode="${value}"><b>${esc(modeNames[value])}</b><span>${esc(modeDescriptions[value])}</span></button>`).join("")}</div><div class="start-row"><span class="muted"><b id="selectedCount">${selectedIds.size}</b> de ${items.length} seleccionados</span><button class="primary" data-action="start-session">Comenzar sesión</button></div></main><aside class="card selector"><div class="selector-head"><h3>Elementos</h3><div class="selector-tools"><button class="secondary" data-action="select-all">Todos</button><button class="secondary" data-action="select-none">Ninguno</button></div></div><div class="selector-list">${items.map((item) => `<label class="check"><input type="checkbox" data-item-id="${esc(item.id)}"${selectedIds.has(item.id) ? " checked" : ""}><span><b>${esc(item.english || item.label)}</b><small>${esc(itemMeaning(item))}</small></span></label>`).join("")}</div><p class="notice" id="selectionError" hidden>Selecciona al menos un elemento.</p></aside></div>${privacy}`;
}

function saveSetupSelection() {
  const ids = [...document.querySelectorAll("[data-item-id]:checked")].map((input) => input.dataset.itemId);
  state.setup.selectedIds = new Set(ids);
  const current = settings();
  storageService.saveSettings({ selectedItemsByTopic: { ...(current.selectedItemsByTopic || {}), [state.setup.topic.id]: ids } });
  return ids;
}

async function startSession({ resume = null, selectedIds: suppliedIds = null } = {}) {
  const selectedIds = resume?.selectedItemIds || suppliedIds || saveSetupSelection();
  if (!selectedIds.length) {
    const selectionError = document.getElementById("selectionError");
    if (selectionError) selectionError.hidden = false;
    return;
  }
  setLoading("Cargando ejemplos seleccionados…");
  try {
    const section = resume?.section || state.setup.section;
    const topicId = resume?.topicId || state.setup.topic.id;
    const mode = resume?.mode || state.setup.mode;
    const data = section === "A1" ? await contentService.loadA1Topic(topicId, selectedIds) : await contentService.loadModals(selectedIds);
    if (!data.items.length) throw new Error("La selección no contiene elementos disponibles.");
    state.active = { ...data, mode };
    state.session = resume || {
      id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
      title: data.topic.title,
      section,
      topicId,
      mode,
      selectedItemIds: selectedIds,
      position: 0,
      answeredCount: 0,
      correctCount: 0,
      answeredExampleIds: [],
      startedAt: new Date().toISOString()
    };
    state.question = state.feedback = null;
    state.answered = false;
    storageService.saveCurrentSession(state.session);
    nextQuestion();
  } catch (error) { showError(error) }
}

function eligibleItems() {
  const config = settings();
  const due = Date.now();
  let pool = state.active.items.filter((item) => {
    const progress = storageService.getProgress(item.id);
    if (progress.status !== "mastered" || !config.excludeMastered) return true;
    return config.includeMasteredInReview && progress.nextReviewAt && new Date(progress.nextReviewAt).getTime() <= due;
  });
  return pool.length ? pool : state.active.items;
}

function chooseItem() {
  const pool = eligibleItems();
  const last = state.question?.item?.id;
  const alternatives = pool.length > 1 ? pool.filter((item) => item.id !== last) : pool;
  return random(alternatives);
}

function chooseExample(item) {
  const progress = storageService.getProgress(item.id);
  const examples = state.active.examples.filter((example) => example.itemId === item.id && example.mode === "fill-blank");
  const fresh = examples.filter((example) => !(progress.recentExampleIds || []).includes(example.id));
  return random(fresh.length ? fresh : examples);
}

function buildQuestion() {
  const item = chooseItem();
  const mode = state.active.mode;
  if (mode === "matching") {
    const distractors = shuffle(state.active.items.filter((candidate) => candidate.id !== item.id)).slice(0, 3);
    return { item, mode, id: `dynamic-match-${item.id}-${Date.now()}`, prompt: item.english, translation: item.pronunciation ? `Pronunciación: ${item.pronunciation}` : "Elige el significado correcto.", answer: item.id, options: shuffle([item, ...distractors]).map((candidate) => ({ id: candidate.id, label: itemMeaning(candidate) })), explanation: `“${item.english}” significa “${itemMeaning(item)}”.` };
  }
  if (mode === "translate-es-en") return { item, mode, id: `dynamic-write-${item.id}-${Date.now()}`, prompt: itemMeaning(item), translation: "Escribe la palabra en inglés.", answer: item.english, acceptableAnswers: [], explanation: `“${itemMeaning(item)}” se traduce como “${item.english}”.` };
  const example = chooseExample(item);
  if (!example) throw new Error(`No hay ejemplos disponibles para ${item.english || item.label}.`);
  return { ...example, item, mode, options: (example.options || []).map((value) => ({ id: value, label: value })) };
}

function nextQuestion() {
  const limit = settings().questionsPerSession;
  if (limit > 0 && state.session.answeredCount >= limit) { finishSession(); return }
  state.question = buildQuestion();
  state.answered = false;
  state.feedback = null;
  state.session.position += 1;
  storageService.saveCurrentSession(state.session);
  renderExercise();
}

function dots(count, goal) { return `<span class="dots">${Array.from({ length: goal }, (_, i) => `<i class="${i < count ? "on" : ""}"></i>`).join("")}</span>` }
function renderRail() {
  const config = settings();
  const rows = state.active.items.map((item) => {
    const p = storageService.getProgress(item.id);
    const done = p.status === "mastered";
    const value = Math.min(config.correctAnswersToMaster, p.currentStreak);
    return `<div class="prow${done ? " done" : ""}"><span class="word" title="${esc(item.english || item.label)}">${esc(item.english || item.label)}</span><span class="bar"><i style="width:${Math.round(value / config.correctAnswersToMaster * 100)}%"></i></span><span class="cnt">${done ? "✓" : `${value}/${config.correctAnswersToMaster}`}</span></div>`;
  }).join("");
  const mastered = state.active.items.filter((item) => storageService.getProgress(item.id).status === "mastered").length;
  return `<aside class="rail"><h3>Progreso</h3><p class="summary"><b>${mastered}</b> de <b>${state.active.items.length}</b> dominados</p>${rows}</aside>`;
}

function renderPrompt(question) {
  if (question.mode === "matching") return `<div class="sentence">${esc(question.prompt)}<span class="translation">${esc(question.translation)}</span></div><div class="options">${question.options.map((option) => `<button class="opt" data-answer="${esc(option.id)}">${esc(option.label)}</button>`).join("")}</div>`;
  if (question.mode === "translate-es-en" || !question.options?.length) return `<div class="sentence">${esc(question.prompt)}<span class="translation">${esc(question.translation)}</span></div><form id="answerForm" class="answer-row"><input class="answer" id="answerInput" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Respuesta en inglés"><button class="primary" type="submit">Comprobar</button></form>`;
  const sentence = String(question.prompt).split("___").map(esc).join('<span class="blank">?</span>');
  return `<div class="sentence">${sentence}<span class="translation">${esc(question.translation)}</span></div><div class="options">${question.options.map((option) => `<button class="opt" data-answer="${esc(option.id)}">${esc(option.label)}</button>`).join("")}</div>`;
}

function renderFeedback() {
  if (!state.feedback) return '<div class="feedback" id="feedback"></div>';
  const value = state.feedback;
  return `<div class="feedback"><div class="fb"><div><div class="${value.correct ? "good" : "bad"}">${value.correct ? "<strong>¡Correcto!</strong>" : `<strong>La respuesta correcta era “${esc(value.answer)}”.</strong>`}</div><div class="explanation">${esc(value.explanation)}</div></div><button class="primary" data-action="next">Siguiente →</button></div></div>`;
}

function renderExercise() {
  resetBtn.hidden = false;
  const q = state.question;
  const p = storageService.getProgress(q.item.id);
  const config = settings();
  app.innerHTML = `${crumb(state.active.topic.title)}<div class="quiz-grid"><main class="card" id="quiz"><div class="qhead"><span class="pill">${esc(modeNames[q.mode])}</span><div class="qtools"><button class="secondary" data-action="theory">Teoría</button><span class="streak">Racha ${dots(Math.min(p.currentStreak, config.correctAnswersToMaster), config.correctAnswersToMaster)} ${p.currentStreak}/${config.correctAnswersToMaster}</span></div></div>${renderPrompt(q)}${renderFeedback()}</main>${renderRail()}</div><p class="privacy">Pregunta ${state.session.position} · ${state.session.correctCount} correctas en esta sesión. Tu progreso se guarda únicamente en este dispositivo.</p>`;
  if (state.answered) {
    document.querySelectorAll("[data-answer]").forEach((button) => {
      button.disabled = true;
      if (button.dataset.answer === q.answer) button.classList.add("correct");
      else if (button.dataset.answer === state.feedback.chosen) button.classList.add("wrong");
      else button.classList.add("dim");
    });
    const input = document.getElementById("answerInput");
    if (input) { input.disabled = true; input.value = state.feedback.chosen; input.classList.add(state.feedback.correct ? "correct" : "wrong") }
  } else document.getElementById("answerInput")?.focus();
}

function explainWrong(chosen) {
  const q = state.question;
  if (q.mode === "matching") {
    const selected = state.active.items.find((item) => item.id === chosen);
    return `${q.explanation}${selected ? ` La opción elegida, “${itemMeaning(selected)}”, corresponde a “${selected.english}”.` : ""}`;
  }
  if (q.mode === "translate-es-en") return `${q.explanation} Tu respuesta “${chosen}” no coincide con la forma esperada.`;
  return `${q.explanation || q.hint || "Revisa la regla de este ejercicio."} En esta frase corresponde “${q.answer}”, no “${chosen}”.`;
}

function answerQuestion(chosen) {
  if (state.answered) return;
  const q = state.question;
  const accepted = [q.answer, ...(q.acceptableAnswers || [])].map(normalize);
  const correct = q.mode === "matching" ? chosen === q.answer : accepted.includes(normalize(chosen));
  const progress = storageService.recordAttempt({ itemId: q.item.id, mode: q.mode, correct, exampleId: q.id, availableModes: state.active.topic.modes });
  state.answered = true;
  state.feedback = { correct, chosen, answer: q.mode === "matching" ? itemMeaning(q.item) : q.answer, explanation: correct ? (q.explanation || q.hint || "Aplicaste correctamente la regla.") : explainWrong(chosen), progress };
  state.session.answeredCount += 1;
  state.session.correctCount += correct ? 1 : 0;
  state.session.answeredExampleIds = [...state.session.answeredExampleIds, q.id].slice(-50);
  storageService.saveCurrentSession(state.session);
  renderExercise();
  document.querySelector("[data-action=next]")?.focus();
}

function renderTheory() {
  state.previousView = "exercise";
  resetBtn.hidden = true;
  const { topic } = state.active;
  const item = state.question.item;
  const forms = item.forms ? `<h3>Formas de ${esc(item.english)}</h3><table class="forms"><thead><tr><th>Forma</th><th>Inglés</th></tr></thead><tbody><tr><td>Base</td><td>${esc(item.forms.base)}</td></tr><tr><td>3.ª persona</td><td>${esc(item.forms.thirdPerson)}</td></tr><tr><td>Pasado</td><td>${esc(item.forms.past)}</td></tr><tr><td>Participio</td><td>${esc(item.forms.pastParticiple)}</td></tr><tr><td>-ing</td><td>${esc(item.forms.gerund)}</td></tr></tbody></table>` : "";
  app.innerHTML = `${crumb(topic.title)}<main class="card theory"><button class="secondary" data-action="back-exercise">← Volver al ejercicio</button><h2>${esc(topic.title)}</h2><p>${esc(topic.theory?.summary || item.explanation || "Revisa la regla y los ejemplos antes de continuar.")}</p><h3>Reglas clave</h3><ul>${(topic.theory?.rules || [item.explanation]).filter(Boolean).map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul><h3>Ejemplos</h3><ul>${(topic.theory?.examples || [item.example?.en]).filter(Boolean).map((example) => `<li>${esc(example)}</li>`).join("")}</ul>${forms}</main>${privacy}`;
}

function finishSession() {
  const summary = { ...state.session, accuracy: state.session.answeredCount ? Math.round(state.session.correctCount / state.session.answeredCount * 100) : 0 };
  storageService.completeSession(summary);
  resetBtn.hidden = true;
  app.innerHTML = `${crumb(state.active.topic.title)}<main class="card done"><div class="trophy">🏆</div><h2>Sesión completada</h2><p>Respondiste ${summary.answeredCount} preguntas con ${summary.accuracy}% de precisión.</p><div class="settings-actions"><button class="secondary" data-action="home">Volver al inicio</button><button class="primary" data-action="repeat-session">Practicar otra vez</button></div></main>${privacy}`;
}

function renderSettings(message = "") {
  resetBtn.hidden = true;
  const s = settings();
  const standard = [5, 10, 15, 20].includes(s.correctAnswersToMaster);
  app.innerHTML = `${crumb("Configuración")}<main class="card">
    <h2 class="screen-title">Configuración</h2>${message ? `<div class="notice">${esc(message)}</div>` : ""}
    <div class="settings-grid">
      <label class="field"><span>Modelo de dominio</span><select id="masteryMode"><option value="streak"${s.masteryMode === "streak" ? " selected" : ""}>Meta de aciertos</option><option value="robust"${s.masteryMode === "robust" ? " selected" : ""}>Dominio robusto</option></select></label>
      <label class="field"><span>Aciertos para dominar</span><select id="goalSelect"><option value="5"${s.correctAnswersToMaster === 5 ? " selected" : ""}>5</option><option value="10"${s.correctAnswersToMaster === 10 ? " selected" : ""}>10</option><option value="15"${s.correctAnswersToMaster === 15 ? " selected" : ""}>15</option><option value="20"${s.correctAnswersToMaster === 20 ? " selected" : ""}>20</option><option value="custom"${!standard ? " selected" : ""}>Personalizado</option></select></label>
      <label class="field"><span>Valor personalizado</span><input id="customGoal" type="number" min="1" max="100" value="${s.correctAnswersToMaster}"${standard ? " disabled" : ""}></label>
      <label class="field"><span>Preguntas por sesión</span><select id="questionLimit"><option value="10"${s.questionsPerSession === 10 ? " selected" : ""}>10</option><option value="20"${s.questionsPerSession === 20 ? " selected" : ""}>20</option><option value="30"${s.questionsPerSession === 30 ? " selected" : ""}>30</option><option value="50"${s.questionsPerSession === 50 ? " selected" : ""}>50</option><option value="0"${s.questionsPerSession === 0 ? " selected" : ""}>Sin límite</option></select></label>
      <label class="field"><span>Precisión mínima (%)</span><input id="minimumAccuracy" type="number" min="0" max="100" value="${s.minimumAccuracy}"></label>
      <label class="field"><span>Modalidades mínimas</span><input id="minimumExerciseModes" type="number" min="1" max="5" value="${s.minimumExerciseModes}"></label>
      <label class="field"><span>Días distintos de repaso</span><input id="minimumReviewDays" type="number" min="1" max="30" value="${s.minimumReviewDays}"></label>
    </div>
    <p class="muted">El dominio robusto exige la meta, la precisión, las modalidades disponibles y los días de repaso indicados.</p>
    <label class="checkline"><input id="consecutive" type="checkbox"${s.requireConsecutiveCorrect ? " checked" : ""}><span>Exigir aciertos consecutivos; un error reinicia la racha.</span></label>
    <label class="checkline"><input id="preserveMastered" type="checkbox"${s.preserveMasteredOnGoalChange ? " checked" : ""}><span>Conservar elementos ya dominados al cambiar la meta. Desmárcalo para reevaluarlos.</span></label>
    <label class="checkline"><input id="excludeMastered" type="checkbox"${s.excludeMastered ? " checked" : ""}><span>Excluir dominados salvo cuando toque su repaso.</span></label>
    <div class="settings-actions"><button class="primary" data-action="save-settings">Guardar configuración</button></div>
    <section class="settings-section"><h3>Copias de seguridad</h3><p class="muted">La exportación contiene configuración y progreso, nunca el banco educativo.</p><div class="settings-actions"><button class="secondary" data-action="export">Exportar JSON</button><label class="secondary" for="importFile">Importar JSON</label><input id="importFile" type="file" accept="application/json" hidden></div></section>
    <section class="settings-section"><h3>Restablecer</h3><div class="settings-actions"><button class="secondary" data-action="reset-settings">Solo configuración</button><button class="secondary" data-action="discard-session">Sesión en curso</button><button class="danger" data-action="reset-a1">Progreso A1</button><button class="danger" data-action="reset-all">Todo el progreso</button></div></section>
  </main>${privacy}`;
}

function saveSettingsFromForm() {
  const goalChoice = document.getElementById("goalSelect").value;
  const custom = Number(document.getElementById("customGoal").value);
  const goal = goalChoice === "custom" ? custom : Number(goalChoice);
  if (!Number.isInteger(goal) || goal < 1 || goal > 100) { renderSettings("La meta debe ser un número entre 1 y 100."); return }
  const minimumAccuracy = Number(document.getElementById("minimumAccuracy").value);
  const minimumExerciseModes = Number(document.getElementById("minimumExerciseModes").value);
  const minimumReviewDays = Number(document.getElementById("minimumReviewDays").value);
  if (!Number.isFinite(minimumAccuracy) || minimumAccuracy < 0 || minimumAccuracy > 100 || !Number.isInteger(minimumExerciseModes) || minimumExerciseModes < 1 || minimumExerciseModes > 5 || !Number.isInteger(minimumReviewDays) || minimumReviewDays < 1 || minimumReviewDays > 30) { renderSettings("Revisa los valores de precisión, modalidades y días de repaso."); return }
  storageService.saveSettings({ masteryMode: document.getElementById("masteryMode").value, correctAnswersToMaster: goal, questionsPerSession: Number(document.getElementById("questionLimit").value), minimumAccuracy, minimumExerciseModes, minimumReviewDays, requireConsecutiveCorrect: document.getElementById("consecutive").checked, preserveMasteredOnGoalChange: document.getElementById("preserveMastered").checked, excludeMastered: document.getElementById("excludeMastered").checked });
  storageService.reevaluateMastery();
  renderSettings("Configuración guardada sin borrar el progreso acumulado.");
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(storageService.exportData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `english-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importProgress(file) {
  try { storageService.importData(JSON.parse(await file.text())); applyTheme(settings().theme); renderSettings("Copia importada correctamente. Se creó un respaldo de los datos anteriores.") }
  catch (error) { renderSettings(error.message) }
}

async function continueSession() {
  const session = storageService.getCurrentSession();
  if (!session) { renderHome(); return }
  await startSession({ resume: session });
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "home") renderHome();
    else if (action === "open-a1") await renderA1Menu();
    else if (action === "setup-a1") await prepareSetup("A1", button.dataset.topic);
    else if (action === "setup-modals") await prepareSetup("professional", "modals");
    else if (action === "select-mode") { state.setup.mode = button.dataset.mode; renderSetup() }
    else if (action === "select-all" || action === "select-none") { document.querySelectorAll("[data-item-id]").forEach((input) => { input.checked = action === "select-all" }); saveSetupSelection(); document.getElementById("selectedCount").textContent = state.setup.selectedIds.size }
    else if (action === "start-session") await startSession();
    else if (button.dataset.answer != null) answerQuestion(button.dataset.answer);
    else if (action === "next") nextQuestion();
    else if (action === "theory") renderTheory();
    else if (action === "back-exercise") renderExercise();
    else if (action === "continue-session") await continueSession();
    else if (action === "discard-session") { storageService.clearCurrentSession(); action === "discard-session" && app.querySelector("#goalSelect") ? renderSettings("Sesión descartada.") : renderHome() }
    else if (action === "repeat-session") {
      const selectedIds = state.active.items.map((item) => item.id);
      state.setup = { section: state.active.section, topic: state.active.topic, items: state.active.items, selectedIds: new Set(selectedIds), mode: state.active.mode };
      await startSession({ selectedIds });
    }
    else if (action === "save-settings") saveSettingsFromForm();
    else if (action === "export") exportProgress();
    else if (action === "reset-settings") { storageService.resetSettings(); renderSettings("Configuración restablecida.") }
    else if (action === "reset-a1" && confirm("¿Restablecer todo el progreso A1?")) { storageService.resetProgress("A1"); renderSettings("Progreso A1 restablecido.") }
    else if (action === "reset-all" && confirm("¿Restablecer TODO el progreso? Esta acción no se puede deshacer.")) { storageService.resetProgress("all"); storageService.clearCurrentSession(); renderSettings("Todo el progreso fue restablecido.") }
  } catch (error) { showError(error) }
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-item-id]")) { saveSetupSelection(); document.getElementById("selectedCount").textContent = state.setup.selectedIds.size; document.getElementById("selectionError").hidden = state.setup.selectedIds.size > 0 }
  if (event.target.id === "goalSelect") document.getElementById("customGoal").disabled = event.target.value !== "custom";
  if (event.target.id === "importFile" && event.target.files[0]) importProgress(event.target.files[0]);
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "answerForm") return;
  event.preventDefault();
  const input = document.getElementById("answerInput");
  if (input.value.trim()) answerQuestion(input.value);
});

document.getElementById("brandBtn").addEventListener("click", () => renderHome());
settingsBtn.addEventListener("click", () => renderSettings());
resetBtn.addEventListener("click", () => { if (confirm("¿Reiniciar esta sesión? El progreso acumulado se conserva.")) { storageService.clearCurrentSession(); state.session.answeredCount = state.session.correctCount = state.session.position = 0; nextQuestion() } });
themeBtn.addEventListener("click", () => { const current = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); const next = current === "dark" ? "light" : "dark"; storageService.saveSettings({ theme: next }); applyTheme(next) });
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; installBtn.hidden = false });
installBtn.addEventListener("click", async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; installBtn.hidden = true });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

init();
