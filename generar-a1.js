/* Genera el banco A1 a partir del vocabulario de la hoja "Inglés A1".
 * El resultado se guarda como JSON legible y después se empaqueta en datos-client.js. */
const fs = require("fs");
const path = require("path");

const vocabulary = [
["move","múv","mover / mudarse","Move your car.","Mueve tu coche."],["need","nid","necesitar","I need help.","Necesito ayuda."],["call","kol","llamar","Call me tonight.","Llámame esta noche."],["use","yús","usar","I use my laptop daily.","Uso mi laptop a diario."],["lead","lid","liderar / conducir","She leads the team.","Ella lidera el equipo."],["try","trái","intentar / probar","I try to eat healthy.","Intento comer sano."],["pass","pas","pasar / aprobar","Pass the salt.","Pasa la sal."],["talk","tok","hablar / conversar","We talk every day.","Hablamos todos los días."],["create","kriéit","crear","I create designs.","Creo diseños."],["report","ripórt","reportar / informar","Report the issue.","Reporta el problema."],
["seem","sim","parecer","You seem happy.","Pareces feliz."],["turn","tern","girar / voltear","Turn left here.","Gira a la izquierda aquí."],["continue","continiú","continuar","Please continue.","Por favor continúa."],["serve","serv","servir","We serve breakfast.","Servimos desayuno."],["start","start","empezar","Let's start now.","Empecemos ahora."],["consider","consíder","considerar","Consider the options.","Considera las opciones."],["plan","plan","planear","Plan the trip.","Planea el viaje."],["offer","ófer","ofrecer","They offer discounts.","Ofrecen descuentos."],["act","akt","actuar","Act quickly.","Actúa rápido."],["count","káunt","contar","Count to ten.","Cuenta hasta diez."],
["provide","prováid","proveer / proporcionar","We provide food.","Proporcionamos comida."],["visit","vísit","visitar","Visit your family.","Visita a tu familia."],["work","uérk","trabajar","I work from home.","Trabajo desde casa."],["carry","kéri","cargar / llevar","Carry the bags.","Carga las bolsas."],["include","inclúd","incluir","The price includes tax.","El precio incluye impuestos."],["ask","ask","preguntar / pedir","Ask a question.","Haz una pregunta."],["live","liv","vivir","I live in Mexico.","Vivo en México."],["learn","lern","aprender","I learn English.","Aprendo inglés."],["play","pléi","jugar / tocar","I play the guitar.","Toco la guitarra."],["appear","apíar","aparecer","A star appeared.","Apareció una estrella."],
["explain","ikspléin","explicar","Explain the rules.","Explica las reglas."],["cause","kos","causar","Rain caused delays.","La lluvia causó retrasos."],["show","shóu","mostrar","Show me the way.","Muéstrame el camino."],["support","supórt","apoyar / soportar","I support your idea.","Apoyo tu idea."],["point","póint","señalar / apuntar","Point at the map.","Señala el mapa."],["require","rikuáir","requerir","This requires time.","Esto requiere tiempo."],["suggest","sagchést","sugerir","I suggest we wait.","Sugiero que esperemos."],["touch","tach","tocar","Don't touch that.","No toques eso."],["decide","disáid","decidir","I decided to go.","Decidí ir."],["want","uánt","querer","I want some water.","Quiero un poco de agua."],
["stop","stop","parar / detener","Stop the car.","Detén el coche."],["look","luk","mirar","Look at the sky.","Mira el cielo."],["produce","prodiús","producir","We produce cars.","Producimos autos."],["remain","riméin","permanecer","Remain calm.","Permanece en calma."],["add","ad","añadir / agregar","Add some sugar.","Agrega un poco de azúcar."],["die","dái","morir","The plant died.","La planta murió."],["prefer","prifér","preferir","I prefer tea.","Prefiero el té."],["watch","uách","ver / observar","I watch movies.","Veo películas."],["walk","uók","caminar","I walk to work.","Camino al trabajo."],["help","jelp","ayudar","Can you help me?","¿Puedes ayudarme?"],
["rent","rent","rentar / alquilar","We rent a house.","Rentamos una casa."],["change","chéinch","cambiar","Change your mind.","Cambia de opinión."],["wait","uéit","esperar","Wait for me.","Espérame."],["drop","drop","soltar / dejar caer","Don't drop it.","No lo dejes caer."],["fill","fil","llenar","Fill the glass.","Llena el vaso."],["plant","plant","plantar / sembrar","Plant a tree.","Planta un árbol."],["raise","réis","levantar / criar","Raise your hand.","Levanta la mano."],["reach","rich","alcanzar / llegar a","Reach the top.","Alcanza la cima."],["return","ritérn","regresar / devolver","Return the book.","Devuelve el libro."],["stay","stéi","quedarse","Stay home.","Quédate en casa."],
["pull","pul","jalar / tirar","Pull the rope.","Jala la cuerda."],["prepare","pripéar","preparar","Prepare dinner.","Prepara la cena."],["push","push","empujar","Push the button.","Empuja el botón."],["defend","difénd","defender","Defend your ideas.","Defiende tus ideas."],["happen","jápen","suceder / pasar","What happened?","¿Qué pasó?"],["repeat","ripít","repetir","Repeat after me.","Repite después de mí."],["mention","ménshon","mencionar","You mentioned it before.","Lo mencionaste antes."],["study","stádi","estudiar","I study at night.","Estudio de noche."],["believe","bilív","creer","I believe you.","Te creo."],["prevent","privént","prevenir / impedir","Prevent accidents.","Previene accidentes."],
["agree","agrí","estar de acuerdo","I agree with you.","Estoy de acuerdo contigo."],["paint","péint","pintar","Paint the wall.","Pinta la pared."],["prove","pruv","probar / demostrar","Prove your point.","Demuestra tu punto."],["hope","jóup","esperar / desear","I hope it works.","Espero que funcione."],["receive","risív","recibir","I received a gift.","Recibí un regalo."],["admit","admít","admitir","I admit my error.","Admito mi error."],["cook","kuk","cocinar","I cook every day.","Cocino todos los días."],["order","órder","ordenar / pedir","Order a pizza.","Pide una pizza."],["cover","káver","cubrir","Cover the pot.","Cubre la olla."],["apply","aplái","aplicar / postular","Apply for the job.","Postula al trabajo."]
].map((v, i) => ({ id: i + 1, type: "Verbo", english: v[0], pronunciation: v[1], spanish: v[2], exampleEn: v[3], exampleEs: v[4], level: "A1" }));

const subjects = [
  { en: "I", es: "Yo", be: "am", aux: "do", third: false },
  { en: "You", es: "Tú", be: "are", aux: "do", third: false },
  { en: "He", es: "Él", be: "is", aux: "does", third: true },
  { en: "She", es: "Ella", be: "is", aux: "does", third: true },
  { en: "It", es: "Eso", be: "is", aux: "does", third: true },
  { en: "We", es: "Nosotros", be: "are", aux: "do", third: false },
  { en: "They", es: "Ellos", be: "are", aux: "do", third: false }
];
const objects = [
  ["a car","un coche"],["an email","un correo"],["the report","el informe"],["a plan","un plan"],
  ["the lesson","la lección"],["an idea","una idea"],["a house","una casa"],["the project","el proyecto"]
];
const ingIrregular = { die: "dying" };
function third(v) {
  if (v.endsWith("y") && !/[aeiou]y$/.test(v)) return v.slice(0, -1) + "ies";
  if (/(s|sh|ch|x|z|o)$/.test(v)) return v + "es";
  return v + "s";
}
function ing(v) {
  if (ingIrregular[v]) return ingIrregular[v];
  if (v.endsWith("ie")) return v.slice(0, -2) + "ying";
  if (v.endsWith("e") && !v.endsWith("ee")) return v.slice(0, -1) + "ing";
  return v + "ing";
}
function item(id, label, cat, tip, examples) { return { id, label, cat, tip, examples }; }
function ex(prompt, es, answer, options) { return { prompt, es, answer, options: [...new Set(options)] }; }

const beItems = ["am","is","are"].map(be => item("be-"+be, be, "Verbo to be", "I usa am; he/she/it usa is; you/we/they usa are.",
  subjects.filter(s => s.be === be).flatMap((s, i) => [
    ex(`${s.en} ___ ready.`, `${s.es} está listo/a.`, be, ["am","is","are"]),
    ex(`___ ${s.en.toLowerCase()} ready?`, `¿${s.es} está listo/a?`, be[0].toUpperCase()+be.slice(1), ["Am","Is","Are"]),
    ex(`${s.en} ___ not at home.`, `${s.es} no está en casa.`, be, ["am","is","are"])
  ])));

const articleNouns = [
  ["car","coche","a"],["house","casa","a"],["plan","plan","a"],["report","informe","a"],
  ["book","libro","a"],["computer","computadora","a"],["dog","perro","a"],["friend","amigo","a"],
  ["garden","jardín","a"],["hotel","hotel","a"],["job","trabajo","a"],["key","llave","a"],
  ["letter","carta","a"],["map","mapa","a"],["phone","teléfono","a"],["question","pregunta","a"],
  ["restaurant","restaurante","a"],["student","estudiante","a"],["table","mesa","a"],["window","ventana","a"],
  ["email","correo","an"],["idea","idea","an"],["apple","manzana","an"],["office","oficina","an"],
  ["address","dirección","an"],["animal","animal","an"],["answer","respuesta","an"],["apartment","apartamento","an"],
  ["egg","huevo","an"],["engine","motor","an"],["example","ejemplo","an"],["hour","hora","an"],
  ["ice cream","helado","an"],["island","isla","an"],["object","objeto","an"],["offer","oferta","an"],
  ["orange","naranja","an"],["umbrella","paraguas","an"],["uncle","tío","an"],["artist","artista","an"]
];
const indefiniteTemplates = [
  ["I need ___ {en}.","Necesito un/una {es}."],
  ["She has ___ {en}.","Ella tiene un/una {es}."],
  ["We see ___ {en} here.","Vemos un/una {es} aquí."],
  ["They want ___ {en}.","Ellos quieren un/una {es}."]
];
const definiteTemplates = [
  ["Open ___ {en} on the desk.","Abre el/la {es} que está en el escritorio."],
  ["Please clean ___ {en} we used.","Por favor limpia el/la {es} que usamos."]
];
function articleExamples(article) {
  const nouns = article === "the" ? articleNouns : articleNouns.filter(n => n[2] === article);
  const templates = article === "the" ? definiteTemplates : indefiniteTemplates;
  return nouns.flatMap(n => templates.map(t =>
    ex(t[0].replace("{en}", n[0]), t[1].replace("{es}", n[1]), article, ["a","an","the"])
  ));
}
const articleItems = ["a","an","the"].map(article =>
  item("article-"+article, article, "Artículos", "Usa a ante sonido consonante, an ante sonido vocálico y the cuando es algo específico.", articleExamples(article))
);

const simpleItems = vocabulary.map(v => item("simple-"+v.english, v.english, "Presente simple", "I/you/we/they usan la forma base; he/she/it usa -s o -es.",
  subjects.flatMap((s, i) => {
    const obj = objects[(v.id + i) % objects.length], form = s.third ? third(v.english) : v.english;
    return [
      ex(`${s.en} ___ ${obj[0]} every day.`, `${s.es} ${v.spanish.split(" / ")[0]} ${obj[1]} todos los días.`, form, [v.english, third(v.english), ing(v.english)]),
      ex(`${s.en} does not ___ ${obj[0]}.`, `${s.es} no ${v.spanish.split(" / ")[0]} ${obj[1]}.`, v.english, [v.english, third(v.english), ing(v.english)])
    ];
  })));

const doItems = ["do","does"].map(aux => item("aux-"+aux, aux, "Do / does", "Do acompaña a I/you/we/they; does acompaña a he/she/it.",
  subjects.filter(s => s.aux === aux).flatMap((s, i) => vocabulary.slice(i * 8, i * 8 + 16).map(v =>
    ex(`___ ${s.en.toLowerCase()} ${v.english} every day?`, `¿${s.es} ${v.spanish.split(" / ")[0]} todos los días?`, aux[0].toUpperCase()+aux.slice(1), ["Do","Does"])
  ))));

const thirdItems = vocabulary.map(v => item("third-"+v.english, third(v.english), "Tercera persona", "Con he/she/it el verbo suele terminar en -s; -es tras s/sh/ch/x/z/o; consonante + y cambia a -ies.",
  ["He","She","It"].flatMap((s, i) => {
    const obj=objects[(v.id+i)%objects.length];
    return [
      ex(`${s} ___ ${obj[0]}.`, `${s==="He"?"Él":s==="She"?"Ella":"Eso"} ${v.spanish.split(" / ")[0]} ${obj[1]}.`, third(v.english), [v.english, third(v.english), ing(v.english)]),
      ex(`Does ${s.toLowerCase()} ___ ${obj[0]}?`, `¿${s==="He"?"Él":s==="She"?"Ella":"Eso"} ${v.spanish.split(" / ")[0]} ${obj[1]}?`, v.english, [v.english, third(v.english), ing(v.english)])
    ];
  })));

const thereItems = ["There is","There are"].map(form => item("there-"+form.split(" ")[1], form, "There is / are", "There is introduce una cosa; there are introduce dos o más.",
  objects.flatMap((o, i) => form === "There is" ? [
    ex(`___ ${o[0]} here.`, `Hay ${o[1]} aquí.`, form, ["There is","There are"]),
    ex(`___ not ${o[0]} here.`, `No hay ${o[1]} aquí.`, form + " not", ["There is not","There are not"])
  ] : [
    ex(`___ two ${o[0].replace(/^(a|an|the) /,"")}s here.`, `Hay dos ${o[1]}s aquí.`, form, ["There is","There are"]),
    ex(`___ many people here.`, `Hay muchas personas aquí.`, form, ["There is","There are"])
  ])));

const continuousItems = vocabulary.map(v => item("continuous-"+v.english, ing(v.english), "Presente continuo", "Forma: am/is/are + verbo en -ing para una acción que ocurre ahora.",
  subjects.map((s, i) => {
    const obj=objects[(v.id+i)%objects.length], answer=s.be+" "+ing(v.english);
    return ex(`${s.en} ___ ${obj[0]} now.`, `${s.es} está ${v.spanish.split(" / ")[0]} ${obj[1]} ahora.`, answer,
      [answer, s.be+" "+v.english, (s.be==="is"?"are":"is")+" "+ing(v.english)]);
  })));

const data = {
  goal: 10,
  level: "A1",
  source: "Google Drive · Plan de Inglés por Niveles · Inglés A1",
  vocabulary,
  topics: [
    { id:"personal-pronouns", title:"Pronombres personales", description:"Usa I, you, he, she, it, we y they en contexto.", kind:"pronouns" },
    { id:"to-be", title:"Verbo to be", description:"Afirmaciones, negaciones y preguntas con am, is y are.", items:beItems },
    { id:"articles", title:"Artículos a/an/the", description:"Elige el artículo correcto según el sonido y el contexto.", items:articleItems },
    { id:"simple-present", title:"Presente simple", description:"Habla de rutinas y hechos con los 80 verbos A1.", items:simpleItems },
    { id:"do-does", title:"Do/does", description:"Forma preguntas y negaciones en presente simple.", items:doItems },
    { id:"third-person", title:"Tercera persona", description:"Practica -s, -es e -ies con he, she e it.", items:thirdItems },
    { id:"there-is-are", title:"There is/are", description:"Describe la existencia de una o varias cosas.", items:thereItems },
    { id:"present-continuous", title:"Presente continuo", description:"Expresa acciones que están ocurriendo ahora.", items:continuousItems }
  ]
};

fs.writeFileSync(path.join(__dirname, "a1.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`a1.json generado: ${vocabulary.length} palabras, ${data.topics.length} temas y ${data.topics.reduce((n,t)=>n+(t.items||[]).reduce((m,x)=>m+x.examples.length,0),0)} ejercicios.`);
