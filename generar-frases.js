/*
 * generar-frases.js
 * ---------------------------------------------------------------------------
 * Genera frases.json con ~200 frases correctas (inglés + traducción al español)
 * por cada pronombre, combinando plantillas gramaticales con vocabulario.
 *
 * Para tener MÁS frases o variedad: agrega palabras a THINGS / NAMES o añade
 * plantillas en las funciones gen*(). Luego ejecuta:  node generar-frases.js
 * ---------------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const GOAL = 10;
const CAP = 200; // máx. frases por pronombre

// ---------------------------------------------------------------------------
// Vocabulario: [en, es, genero(m/f), enPlural, esPlural]
// ---------------------------------------------------------------------------
const THINGS = [
  ["car","coche","m","cars","coches"],
  ["book","libro","m","books","libros"],
  ["house","casa","f","houses","casas"],
  ["phone","teléfono","m","phones","teléfonos"],
  ["pen","bolígrafo","m","pens","bolígrafos"],
  ["bag","bolsa","f","bags","bolsas"],
  ["jacket","chaqueta","f","jackets","chaquetas"],
  ["dog","perro","m","dogs","perros"],
  ["cat","gato","m","cats","gatos"],
  ["bike","bicicleta","f","bikes","bicicletas"],
  ["watch","reloj","m","watches","relojes"],
  ["laptop","computadora","f","laptops","computadoras"],
  ["camera","cámara","f","cameras","cámaras"],
  ["guitar","guitarra","f","guitars","guitarras"],
  ["chair","silla","f","chairs","sillas"],
  ["table","mesa","f","tables","mesas"],
  ["umbrella","paraguas","m","umbrellas","paraguas"],
  ["wallet","cartera","f","wallets","carteras"],
  ["ticket","boleto","m","tickets","boletos"],
  ["hat","sombrero","m","hats","sombreros"],
  ["shirt","camisa","f","shirts","camisas"],
  ["key","llave","f","keys","llaves"],
  ["cup","taza","f","cups","tazas"],
  ["pencil","lápiz","m","pencils","lápices"],
  ["notebook","cuaderno","m","notebooks","cuadernos"],
  ["backpack","mochila","f","backpacks","mochilas"],
  ["mirror","espejo","m","mirrors","espejos"],
  ["ball","pelota","f","balls","pelotas"],
  ["box","caja","f","boxes","cajas"],
  ["plant","planta","f","plants","plantas"]
];

const NAMES = ["Anna","Tom","Maria","John","Sofia","Peter","Lucas","Emma","Carlos",
  "Lisa","David","Laura","Mark","Elena","Paul","Nora","Diego","Clara","Sam","Rosa"];

// ---------------------------------------------------------------------------
// Helpers de concordancia en español
// ---------------------------------------------------------------------------
const un   = g => (g === "m" ? "un"  : "una");
const el   = g => (g === "m" ? "el"  : "la");
const este = g => (g === "m" ? "este" : "esta");
const ese  = g => (g === "m" ? "ese"  : "esa");
const estos= g => (g === "m" ? "estos": "estas");
const esos = g => (g === "m" ? "esos" : "esas");
const nuestro = g => (g === "m" ? "nuestro" : "nuestra");
const mio  = (g, n = "s") => (g === "m" ? "mío"  : "mía")  + (n === "p" ? "s" : "");
const tuyo = (g, n = "s") => (g === "m" ? "tuyo" : "tuya") + (n === "p" ? "s" : "");

// adjetivo regular en -o (bonito, hermoso, nuevo, sucio)
function adjO(base, g, n = "s") {
  const stem = base.slice(0, -1);
  return stem + (g === "m" ? "o" : "a") + (n === "p" ? "s" : "");
}
// artículo indefinido inglés a/an
const aan = w => ("aeiou".indexOf(w[0].toLowerCase()) >= 0 ? "an" : "a");
// capitaliza la primera LETRA (respeta ¿ ¡)
function capFirst(s) {
  const m = s.match(/[a-záéíóúñ]/i);
  if (!m) return s;
  const i = s.indexOf(m[0]);
  return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}

// ---------------------------------------------------------------------------
// Verbos
// ---------------------------------------------------------------------------
// Sujeto: transitivos, conjugados por persona (yo, tu, el, nos, ellos)
const SUBJ_VERBS = [
  { base:"have",  s:"has",   es:{yo:"tengo",tu:"tienes",el:"tiene",nos:"tenemos",ellos:"tienen"} },
  { base:"want",  s:"wants", es:{yo:"quiero",tu:"quieres",el:"quiere",nos:"queremos",ellos:"quieren"} },
  { base:"see",   s:"sees",  es:{yo:"veo",tu:"ves",el:"ve",nos:"vemos",ellos:"ven"} },
  { base:"buy",   s:"buys",  es:{yo:"compro",tu:"compras",el:"compra",nos:"compramos",ellos:"compran"} },
  { base:"need",  s:"needs", es:{yo:"necesito",tu:"necesitas",el:"necesita",nos:"necesitamos",ellos:"necesitan"} },
  { base:"find",  s:"finds", es:{yo:"encuentro",tu:"encuentras",el:"encuentra",nos:"encontramos",ellos:"encuentran"} },
  { base:"use",   s:"uses",  es:{yo:"uso",tu:"usas",el:"usa",nos:"usamos",ellos:"usan"} },
  { base:"bring", s:"brings",es:{yo:"traigo",tu:"traes",el:"trae",nos:"traemos",ellos:"traen"} },
  { base:"sell",  s:"sells", es:{yo:"vendo",tu:"vendes",el:"vende",nos:"vendemos",ellos:"venden"} },
  { base:"lose",  s:"loses", es:{yo:"pierdo",tu:"pierdes",el:"pierde",nos:"perdemos",ellos:"pierden"} },
  { base:"carry", s:"carries",es:{yo:"llevo",tu:"llevas",el:"lleva",nos:"llevamos",ellos:"llevan"} },
  { base:"wash",  s:"washes",es:{yo:"lavo",tu:"lavas",el:"lava",nos:"lavamos",ellos:"lavan"} },
  { base:"fix",   s:"fixes", es:{yo:"arreglo",tu:"arreglas",el:"arregla",nos:"arreglamos",ellos:"arreglan"} },
  { base:"clean", s:"cleans",es:{yo:"limpio",tu:"limpias",el:"limpia",nos:"limpiamos",ellos:"limpian"} }
];

// Objeto: 3.ª persona singular (para "Nombre + verbo + pronombre-objeto")
const OBJ_VERBS = [
  ["calls","llama"],["sees","ve"],["helps","ayuda"],["knows","conoce"],
  ["needs","necesita"],["visits","visita"],["loves","quiere"],["invites","invita"],
  ["hears","oye"],["misses","extraña"],["watches","observa"],["understands","entiende"]
];

// ---------------------------------------------------------------------------
// Generadores por rol
// ---------------------------------------------------------------------------
function genSubject(esPerson, cap, enS /* usa forma -s? */) {
  const out = [];
  for (const v of SUBJ_VERBS) {
    for (const [ten, tes, g] of THINGS) {
      const verbEn = enS ? v.s : v.base;
      out.push({
        en: `___ ${verbEn} ${aan(ten)} ${ten}.`,
        es: capFirst(`${cap} ${v.es[esPerson]} ${un(g)} ${tes}.`)
      });
    }
  }
  return out;
}

function genObject(clitic, prep) {
  const out = [];
  for (const [ven, ves] of OBJ_VERBS) {
    for (const name of NAMES) {
      out.push({
        en: `${name} ${ven} ___.`,
        es: `${name} ${clitic} ${ves}.`
      });
    }
  }
  // Frases preposicionales (usan la forma tónica: mí, ti, él, ella, nosotros, ellos)
  out.push({ en: "This is for ___.",       es: `Esto es para ${prep}.` });
  out.push({ en: "Come with ___.",         es: `Ven con ${prep}.` });
  out.push({ en: "She did it for ___.",     es: `Lo hizo por ${prep}.` });
  out.push({ en: "He sat next to ___.",     es: `Se sentó junto a ${prep}.` });
  return out;
}

function genPossAdj(possWord /* fn(g) */) {
  const out = [];
  for (const [ten, tes, g] of THINGS) {
    const p = possWord(g);
    out.push({ en: `I like ___ ${ten}.`,        es: capFirst(`Me gusta ${p} ${tes}.`) });
    out.push({ en: `Where is ___ ${ten}?`,      es: capFirst(`¿Dónde está ${p} ${tes}?`) });
    out.push({ en: `She saw ___ ${ten}.`,       es: capFirst(`Ella vio ${p} ${tes}.`) });
    out.push({ en: `Don't touch ___ ${ten}.`,   es: capFirst(`No toques ${p} ${tes}.`) });
    out.push({ en: `I found ___ ${ten}.`,       es: capFirst(`Encontré ${p} ${tes}.`) });
    out.push({ en: `He borrowed ___ ${ten}.`,   es: capFirst(`Él tomó ${adjO("prestado",g)} ${p} ${tes}.`) });
    out.push({ en: `This is ___ ${ten}.`,       es: capFirst(`${este(g)} es ${p} ${tes}.`) });
  }
  return out;
}

function genPossPron(pronWord /* fn(g,n) */) {
  const out = [];
  for (const [ten, tes, g] of THINGS) {
    const pr = pronWord(g);
    out.push({ en: `This ${ten} is ___.`,             es: capFirst(`${este(g)} ${tes} es ${pr}.`) });
    out.push({ en: `That ${ten} is ___.`,             es: capFirst(`${ese(g)} ${tes} es ${pr}.`) });
    out.push({ en: `Is this ${ten} ___?`,             es: capFirst(`¿Es ${este(g)} ${tes} ${pr}?`) });
    out.push({ en: `I think this ${ten} is ___.`,     es: capFirst(`Creo que ${este(g)} ${tes} es ${pr}.`) });
    out.push({ en: `Excuse me, is that ${ten} ___?`,  es: capFirst(`Disculpa, ¿es ${ese(g)} ${tes} ${pr}?`) });
    out.push({ en: `Yes, the ${ten} is ___.`,         es: capFirst(`Sí, ${el(g)} ${tes} es ${pr}.`) });
    out.push({ en: `Look, the ${ten} is ___.`,        es: capFirst(`Mira, ${el(g)} ${tes} es ${pr}.`) });
  }
  return out;
}

function genIt() {
  const out = [];
  const weather = [
    ["___ is raining.","Está lloviendo."],
    ["___ is snowing.","Está nevando."],
    ["___ is very hot today.","Hace mucho calor hoy."],
    ["___ is cold outside.","Hace frío afuera."],
    ["___ is sunny today.","Está soleado hoy."],
    ["___ is windy right now.","Hace viento ahora."],
    ["___ is late.","Es tarde."],
    ["___ is nine o'clock.","Son las nueve."]
  ];
  for (const [en, es] of weather) out.push({ en, es });
  for (const [ten, tes, g] of THINGS) {
    const clit = g === "m" ? "lo" : "la";
    out.push({ en: `I bought a ${ten}; ___ is great.`,        es: capFirst(`Compré ${un(g)} ${tes}; es genial.`) });
    out.push({ en: `Where is the ${ten}? ___ is here.`,       es: capFirst(`¿Dónde está ${el(g)} ${tes}? Está aquí.`) });
    out.push({ en: `The ${ten} is dirty; clean ___.`,         es: capFirst(`${el(g)} ${tes} está ${adjO("sucio",g)}; límpia${clit}.`) });
    out.push({ en: `Look at the ${ten}. ___ is beautiful.`,   es: capFirst(`Mira ${el(g)} ${tes}. Es ${adjO("hermoso",g)}.`) });
    out.push({ en: `The ${ten} works well; ___ is useful.`,   es: capFirst(`${el(g)} ${tes} funciona bien; es útil.`) });
    out.push({ en: `Give me the ${ten}; ___ is mine.`,        es: capFirst(`Dame ${el(g)} ${tes}; es ${mio(g)}.`) });
    out.push({ en: `The ${ten} is new; ___ is on the table.`, es: capFirst(`${el(g)} ${tes} es ${adjO("nuevo",g)}; está sobre la mesa.`) });
  }
  return out;
}

function genThis() {
  const out = [];
  for (const [ten, tes, g] of THINGS) {
    out.push({ en: `___ ${ten} is here.`,        es: capFirst(`${este(g)} ${tes} está aquí.`) });
    out.push({ en: `Look at ___ ${ten}.`,        es: capFirst(`Mira ${este(g)} ${tes}.`) });
    out.push({ en: `I like ___ ${ten}.`,         es: capFirst(`Me gusta ${este(g)} ${tes}.`) });
    out.push({ en: `I want ___ ${ten}.`,         es: capFirst(`Quiero ${este(g)} ${tes}.`) });
    out.push({ en: `___ ${ten} is mine.`,        es: capFirst(`${este(g)} ${tes} es ${mio(g)}.`) });
    out.push({ en: `Do you see ___ ${ten}?`,     es: capFirst(`¿Ves ${este(g)} ${tes}?`) });
    out.push({ en: `___ ${ten} is very nice.`,   es: capFirst(`${este(g)} ${tes} es muy ${adjO("bonito",g)}.`) });
  }
  return out;
}

function genThat() {
  const out = [];
  for (const [ten, tes, g] of THINGS) {
    out.push({ en: `___ ${ten} over there is nice.`,      es: capFirst(`${ese(g)} ${tes} de allá es ${adjO("bonito",g)}.`) });
    out.push({ en: `Look at ___ ${ten} across the street.`,es: capFirst(`Mira ${ese(g)} ${tes} del otro lado de la calle.`) });
    out.push({ en: `I like ___ ${ten} over there.`,        es: capFirst(`Me gusta ${ese(g)} ${tes} de allá.`) });
    out.push({ en: `I want ___ ${ten} in the window.`,     es: capFirst(`Quiero ${ese(g)} ${tes} del escaparate.`) });
    out.push({ en: `___ ${ten} over there is mine.`,       es: capFirst(`${ese(g)} ${tes} de allá es ${mio(g)}.`) });
    out.push({ en: `Do you see ___ ${ten} in the distance?`,es: capFirst(`¿Ves ${ese(g)} ${tes} a lo lejos?`) });
    out.push({ en: `___ ${ten} far away is beautiful.`,    es: capFirst(`${ese(g)} ${tes} de allá es ${adjO("hermoso",g)}.`) });
  }
  return out;
}

function genThese() {
  const out = [];
  for (const [ten, tes, g, tenp, tesp] of THINGS) {
    out.push({ en: `___ ${tenp} are here.`,       es: capFirst(`${estos(g)} ${tesp} están aquí.`) });
    out.push({ en: `Look at ___ ${tenp}.`,        es: capFirst(`Mira ${estos(g)} ${tesp}.`) });
    out.push({ en: `I like ___ ${tenp}.`,         es: capFirst(`Me gustan ${estos(g)} ${tesp}.`) });
    out.push({ en: `I want ___ ${tenp}.`,         es: capFirst(`Quiero ${estos(g)} ${tesp}.`) });
    out.push({ en: `___ ${tenp} are mine.`,       es: capFirst(`${estos(g)} ${tesp} son ${mio(g,"p")}.`) });
    out.push({ en: `Do you see ___ ${tenp}?`,     es: capFirst(`¿Ves ${estos(g)} ${tesp}?`) });
    out.push({ en: `___ ${tenp} are very nice.`,  es: capFirst(`${estos(g)} ${tesp} son muy ${adjO("bonito",g,"p")}.`) });
  }
  return out;
}

function genThose() {
  const out = [];
  for (const [ten, tes, g, tenp, tesp] of THINGS) {
    out.push({ en: `___ ${tenp} over there are nice.`,      es: capFirst(`${esos(g)} ${tesp} de allá son ${adjO("bonito",g,"p")}.`) });
    out.push({ en: `Look at ___ ${tenp} across the room.`,  es: capFirst(`Mira ${esos(g)} ${tesp} del otro lado de la sala.`) });
    out.push({ en: `I like ___ ${tenp} over there.`,        es: capFirst(`Me gustan ${esos(g)} ${tesp} de allá.`) });
    out.push({ en: `___ ${tenp} in the distance are mine.`, es: capFirst(`${esos(g)} ${tesp} a lo lejos son ${mio(g,"p")}.`) });
    out.push({ en: `Do you see ___ ${tenp} far away?`,      es: capFirst(`¿Ves ${esos(g)} ${tesp} a lo lejos?`) });
    out.push({ en: `___ ${tenp} over there are beautiful.`, es: capFirst(`${esos(g)} ${tesp} de allá son ${adjO("hermoso",g,"p")}.`) });
    out.push({ en: `Who owns ___ ${tenp}?`,                 es: capFirst(`¿De quién son ${esos(g)} ${tesp}?`) });
  }
  return out;
}

// Mezcla dos listas (para "you": sujeto + objeto)
function mix(a, b) { return a.concat(b); }

// ---------------------------------------------------------------------------
// Definición de los 24 pronombres (metadatos + generador)
// ---------------------------------------------------------------------------
const CAT = {
  s1: "1.ª persona (yo)", s2: "2.ª persona (tú/ustedes)",
  m3: "3.ª persona masc. (él)", f3: "3.ª persona fem. (ella)",
  p1: "1.ª plural (nosotros)", p3: "3.ª plural (ellos)",
  it: "Neutro (ello)", dem: "Demostrativos"
};

const DEFS = [
  { id:"I",  label:"I",  answer:"I",  group:"first_sing", role:"sujeto", cat:CAT.s1,
    tip:"Sujeto: hace la acción y va antes del verbo.", gen:() => genSubject("yo","Yo",false) },
  { id:"me", label:"me", answer:"me", group:"first_sing", role:"objeto", cat:CAT.s1,
    tip:"Objeto: recibe la acción, va tras el verbo o la preposición.", gen:() => genObject("me","mí") },
  { id:"my", label:"my", answer:"my", group:"first_sing", role:"posesivo (adjetivo)", cat:CAT.s1,
    tip:"Posesivo ANTES de un sustantivo: my + cosa.", gen:() => genPossAdj(() => "mi") },
  { id:"mine", label:"mine", answer:"mine", group:"first_sing", role:"posesivo (solo)", cat:CAT.s1,
    tip:"Posesivo que va SOLO, sin sustantivo detrás: it's mine.", gen:() => genPossPron(mio) },

  { id:"you", label:"you", answer:"you", group:"second", role:"sujeto / objeto", cat:CAT.s2,
    tip:"Sirve como sujeto y como objeto: You are… / I saw you.",
    gen:() => mix(genSubject("tu","Tú",false), genObject("te","ti")) },
  { id:"your", label:"your", answer:"your", group:"second", role:"posesivo (adjetivo)", cat:CAT.s2,
    tip:"Posesivo antes de un sustantivo: your + cosa.", gen:() => genPossAdj(() => "tu") },
  { id:"yours", label:"yours", answer:"yours", group:"second", role:"posesivo (solo)", cat:CAT.s2,
    tip:"Posesivo que va solo, sin sustantivo: it's yours.", gen:() => genPossPron(tuyo) },

  { id:"he",  label:"he",  answer:"he",  group:"third_m", role:"sujeto", cat:CAT.m3,
    tip:"Sujeto masculino: va antes del verbo.", gen:() => genSubject("el","Él",true) },
  { id:"him", label:"him", answer:"him", group:"third_m", role:"objeto", cat:CAT.m3,
    tip:"Objeto masculino: tras el verbo o la preposición.", gen:() => genObject("lo","él") },
  { id:"his", label:"his", answer:"his", group:"third_m", role:"posesivo", cat:CAT.m3,
    tip:"Posesivo masculino: his + cosa (o solo: it's his).", gen:() => genPossAdj(() => "su") },

  { id:"she", label:"she", answer:"she", group:"third_f", role:"sujeto", cat:CAT.f3,
    tip:"Sujeto femenino: va antes del verbo.", gen:() => genSubject("el","Ella",true) },
  { id:"her_obj", label:"her (objeto)", answer:"her", group:"third_f", role:"objeto", cat:CAT.f3,
    tip:"'her' como OBJETO: tras el verbo o la preposición (I saw her).", gen:() => genObject("la","ella") },
  { id:"her_pos", label:"her (posesivo)", answer:"her", group:"third_f", role:"posesivo (adjetivo)", cat:CAT.f3,
    tip:"'her' como POSESIVO: antes de un sustantivo (her book).", gen:() => genPossAdj(() => "su") },

  { id:"we", label:"we", answer:"we", group:"first_pl", role:"sujeto", cat:CAT.p1,
    tip:"Sujeto plural: va antes del verbo.", gen:() => genSubject("nos","Nosotros",false) },
  { id:"us", label:"us", answer:"us", group:"first_pl", role:"objeto", cat:CAT.p1,
    tip:"Objeto plural: tras el verbo o la preposición.", gen:() => genObject("nos","nosotros") },
  { id:"our", label:"our", answer:"our", group:"first_pl", role:"posesivo (adjetivo)", cat:CAT.p1,
    tip:"Posesivo antes de un sustantivo: our + cosa.", gen:() => genPossAdj(nuestro) },

  { id:"they", label:"they", answer:"they", group:"third_pl", role:"sujeto", cat:CAT.p3,
    tip:"Sujeto plural: va antes del verbo.", gen:() => genSubject("ellos","Ellos",false) },
  { id:"them", label:"them", answer:"them", group:"third_pl", role:"objeto", cat:CAT.p3,
    tip:"Objeto plural: tras el verbo o la preposición.", gen:() => genObject("los","ellos") },
  { id:"their", label:"their", answer:"their", group:"third_pl", role:"posesivo (adjetivo)", cat:CAT.p3,
    tip:"Posesivo antes de un sustantivo: their + cosa.", gen:() => genPossAdj(() => "su") },

  { id:"it", label:"it", answer:"it", group:"it", role:"cosa / animal / clima", cat:CAT.it,
    tip:"'it' para cosas, animales o el clima (no personas).", gen:() => genIt() },

  { id:"this",  label:"this",  answer:"this",  group:"dem", role:"demostrativo · cerca · singular", cat:CAT.dem,
    tip:"'this' = esto/este: UNA cosa CERCA de ti.", gen:() => genThis() },
  { id:"that",  label:"that",  answer:"that",  group:"dem", role:"demostrativo · lejos · singular", cat:CAT.dem,
    tip:"'that' = eso/aquel: UNA cosa LEJOS de ti.", gen:() => genThat() },
  { id:"these", label:"these", answer:"these", group:"dem", role:"demostrativo · cerca · plural", cat:CAT.dem,
    tip:"'these' = estos/estas: VARIAS cosas CERCA de ti.", gen:() => genThese() },
  { id:"those", label:"those", answer:"those", group:"dem", role:"demostrativo · lejos · plural", cat:CAT.dem,
    tip:"'those' = esos/aquellos: VARIAS cosas LEJOS de ti.", gen:() => genThose() }
];

const GROUPS = {
  first_sing: ["I","me","my","mine"],
  second:     ["you","your","yours"],
  third_m:    ["he","him","his"],
  third_f:    ["she","her","hers"],
  first_pl:   ["we","us","our"],
  third_pl:   ["they","them","their"],
  it:         ["it","he","she","this"],
  dem:        ["this","that","these","those"]
};

const CAT_ORDER = [CAT.s1, CAT.s2, CAT.m3, CAT.f3, CAT.p1, CAT.p3, CAT.it, CAT.dem];

// ---------------------------------------------------------------------------
// Construcción: generar, deduplicar por frase EN, barajar y recortar a CAP
// ---------------------------------------------------------------------------
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pronouns = DEFS.map(d => {
  const seen = new Set();
  let list = d.gen().filter(s => {
    if (seen.has(s.en)) return false;
    seen.add(s.en);
    return true;
  });
  list = shuffle(list).slice(0, CAP);
  return {
    id: d.id, label: d.label, answer: d.answer, group: d.group,
    role: d.role, cat: d.cat, tip: d.tip, sentences: list
  };
});

const data = { goal: GOAL, groups: GROUPS, catOrder: CAT_ORDER, pronouns };
const outPath = path.join(__dirname, "frases.json");
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");

// Reporte
console.log("frases.json generado en:", outPath);
console.log("Total frases:", pronouns.reduce((n, p) => n + p.sentences.length, 0));
console.log("--- conteo por pronombre ---");
for (const p of pronouns) {
  console.log(String(p.label).padEnd(16), p.sentences.length);
}
