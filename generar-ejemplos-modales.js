/* Genera 200 ejemplos bilingües por cada modal/auxiliar de modales.json.
 * 8 sujetos × 25 acciones = 200 ejemplos únicos por palabra. */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "modales.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

const subjects = [
  { en: "I", es: "yo", person: 0 },
  { en: "you", es: "tú", person: 1 },
  { en: "he", es: "él", person: 2 },
  { en: "she", es: "ella", person: 2 },
  { en: "we", es: "nosotros", person: 3 },
  { en: "they", es: "ellos", person: 4 },
  { en: "Maria", es: "María", person: 2 },
  { en: "my friends", es: "mis amigos", person: 4 }
];

const actions = [
  ["finish the report", "terminar el informe"],
  ["call the client", "llamar al cliente"],
  ["open the window", "abrir la ventana"],
  ["help the new student", "ayudar al nuevo estudiante"],
  ["learn this lesson", "aprender esta lección"],
  ["prepare dinner", "preparar la cena"],
  ["send the email", "enviar el correo"],
  ["visit the museum", "visitar el museo"],
  ["solve the problem", "resolver el problema"],
  ["clean the kitchen", "limpiar la cocina"],
  ["read the instructions", "leer las instrucciones"],
  ["buy the tickets", "comprar los boletos"],
  ["start the meeting", "iniciar la reunión"],
  ["answer the question", "responder la pregunta"],
  ["check the schedule", "revisar el horario"],
  ["practice English", "practicar inglés"],
  ["close the door", "cerrar la puerta"],
  ["write the message", "escribir el mensaje"],
  ["bring some water", "traer un poco de agua"],
  ["organize the files", "organizar los archivos"],
  ["join the class", "unirse a la clase"],
  ["use the computer", "usar la computadora"],
  ["change the password", "cambiar la contraseña"],
  ["wait outside", "esperar afuera"],
  ["explain the idea", "explicar la idea"]
];

const forms = {
  can: ["puedo", "puedes", "puede", "podemos", "pueden"],
  could: ["podría", "podrías", "podría", "podríamos", "podrían"],
  might: ["pueda", "puedas", "pueda", "podamos", "puedan"],
  must: ["debo", "debes", "debe", "debemos", "deben"],
  should: ["debería", "deberías", "debería", "deberíamos", "deberían"],
  will: ["voy", "vas", "va", "vamos", "van"],
  would: ["quisiera", "quisieras", "quisiera", "quisiéramos", "quisieran"],
  haveTo: ["tengo", "tienes", "tiene", "tenemos", "tienen"],
  needTo: ["necesito", "necesitas", "necesita", "necesitamos", "necesitan"],
  want: ["quiero", "quieres", "quiere", "queremos", "quieren"],
  wanted: ["quería", "querías", "quería", "queríamos", "querían"],
  havePerfect: ["he", "has", "ha", "hemos", "han"]
};

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function sentence(subject, action, id) {
  const [enAction, esAction] = action;
  const p = subject.person;
  const S = subject.en;
  const E = subject.es;
  const third = p === 2;
  const plural = p === 3 || p === 4;
  const be = p === 0 ? "am" : plural || p === 1 ? "are" : "is";
  const was = plural || p === 1 ? "were" : "was";
  const have = third ? "has" : "have";
  const doForm = third ? "does" : "do";
  const esReady = plural ? "listos" : subject.en === "she" || subject.en === "Maria" ? "lista" : "listo";

  switch (id) {
    case "can": return { answer: "can", en: `${S} can ${enAction}.`, es: `${cap(E)} ${forms.can[p]} ${esAction}.` };
    case "cannot": return { answer: "cannot", en: `${S} cannot ${enAction}.`, es: `${cap(E)} no ${forms.can[p]} ${esAction}.` };
    case "could": return { answer: "could", en: `${S} could ${enAction}.`, es: `${cap(E)} ${forms.could[p]} ${esAction}.` };
    case "may": return { answer: "may", en: `${S} may ${enAction}.`, es: `${cap(E)} ${forms.can[p]} ${esAction}.` };
    case "might": return { answer: "might", en: `${S} might ${enAction}.`, es: `Quizá ${E} ${forms.might[p]} ${esAction}.` };
    case "must": return { answer: "must", en: `${S} must ${enAction}.`, es: `${cap(E)} ${forms.must[p]} ${esAction}.` };
    case "should": return { answer: "should", en: `${S} should ${enAction}.`, es: `${cap(E)} ${forms.should[p]} ${esAction}.` };
    case "should-not": return { answer: "should not", en: `${S} should not ${enAction}.`, es: `${cap(E)} no ${forms.should[p]} ${esAction}.` };
    case "will": return { answer: "will", en: `${S} will ${enAction}.`, es: `${cap(E)} ${forms.will[p]} a ${esAction}.` };
    case "would": return { answer: "would", en: `${S} would like to ${enAction}.`, es: `${cap(E)} ${forms.would[p]} ${esAction}.` };
    case "shall": return { answer: "shall", en: `Shall ${S} ${enAction}?`, es: `¿Debería ${E} ${esAction}?` };
    case "have-to": return { answer: third ? "has to" : "have to", en: `${S} ${third ? "has" : "have"} to ${enAction}.`, es: `${cap(E)} ${forms.haveTo[p]} que ${esAction}.` };
    case "need-to": return { answer: third ? "needs to" : "need to", en: `${S} ${third ? "needs" : "need"} to ${enAction}.`, es: `${cap(E)} ${forms.needTo[p]} ${esAction}.` };
    case "ought-to": return { answer: "ought to", en: `${S} ought to ${enAction}.`, es: `${cap(E)} ${forms.should[p]} ${esAction}.` };
    case "do-does": return { answer: doForm, en: `${cap(doForm)} ${S} want to ${enAction}?`, es: `¿${cap(E)} ${forms.want[p]} ${esAction}?` };
    case "did": return { answer: "did", en: `Did ${S} want to ${enAction}?`, es: `¿${cap(E)} ${forms.wanted[p]} ${esAction}?` };
    case "be-present": return { answer: be, en: `${S} ${be} ready to ${enAction}.`, es: `${cap(E)} está ${esReady} para ${esAction}.` };
    case "be-past": return { answer: was, en: `${S} ${was} ready to ${enAction}.`, es: `${cap(E)} estaba ${esReady} para ${esAction}.` };
    case "have-has": return { answer: have, en: `${S} ${have} decided to ${enAction}.`, es: `${cap(E)} ${forms.havePerfect[p]} decidido ${esAction}.` };
    default: throw new Error(`Modal sin plantilla: ${id}`);
  }
}

data.items.forEach((item) => {
  item.examples = subjects.flatMap((subject) => actions.map((action) => sentence(subject, action, item.id)));
  if (item.examples.length !== 200) throw new Error(`${item.id}: se esperaban 200 ejemplos`);
  const unique = new Set(item.examples.map((example) => example.en));
  if (unique.size !== 200) throw new Error(`${item.id}: hay ejemplos duplicados`);
});

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`Generados ${data.items.length * 200} ejemplos (${data.items.length} × 200).`);
require("./generar-arquitectura.js");
