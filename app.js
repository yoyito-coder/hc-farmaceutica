'use strict';
/* Historia Clínica Farmacéutica — app sin dependencias.
   Estado en localStorage; exportación a Word, PDF (impresión), CSV y JSON. */

const STORE_KEY = 'hcf_caso_v1';
const UI_KEY = 'hcf_ui_v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = v => esc(v).replace(/\n/g, '<br>');
const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const hasKw = (text, kw) => norm(text).includes(norm(kw));
const uid = () => Math.random().toString(36).slice(2, 9);
const pad2 = n => String(n).padStart(2, '0');
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
function today(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } }
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

/* ───────────────────────── Catálogos ───────────────────────── */

const PRM_TAX = {
  'Indicación': {
    'Terapia farmacológica innecesaria': ['Sin indicación médica', 'Terapia duplicada', 'Terapia no farmacológica indicada', 'Tratamiento de una RAM evitable', 'Uso adictivo/recreativo'],
    'Requiere terapia farmacológica adicional': ['Afección no tratada', 'Preventiva/profiláctica', 'Sinérgica/potenciadora']
  },
  'Efectividad': {
    'Medicamento ineficaz': ['Medicamento más eficaz disponible', 'Afección refractaria al medicamento', 'Forma farmacéutica inadecuada', 'No eficaz para la afección'],
    'Dosis demasiado baja': ['Dosis incorrecta', 'Frecuencia demasiado larga', 'Duración demasiado corta', 'Interacción farmacológica', 'Administración incorrecta']
  },
  'Seguridad': {
    'Reacción adversa al medicamento': ['Efecto indeseable', 'Medicamento inseguro para el paciente', 'Interacción con medicamentos', 'Dosis administrada o cambiada demasiado rápido', 'Reacción alérgica', 'Contraindicación presente'],
    'Dosis demasiado alta': ['Dosis incorrecta', 'Frecuencia demasiado corta', 'Duración demasiado larga', 'Interacción con medicamentos', 'Administración incorrecta']
  },
  'Adherencia': {
    'Incumplimiento': ['Instrucciones no entendidas', 'El paciente prefiere no tomar', 'El paciente olvida tomar el medicamento', 'Medicamento demasiado caro', 'No se puede tragar o administrar', 'Medicamento no disponible']
  }
};
const RNM_OPTS = ['Necesidad: problema de salud no tratado', 'Necesidad: efecto de medicamento innecesario', 'Efectividad: inefectividad no cuantitativa', 'Efectividad: inefectividad cuantitativa', 'Seguridad: inseguridad no cuantitativa', 'Seguridad: inseguridad cuantitativa'];
const OPT = {
  sexo: ['Femenino', 'Masculino'],
  gestacion: ['No aplica', 'No', 'Embarazo', 'Lactancia'],
  hepatica: ['Normal', 'Child-Pugh A', 'Child-Pugh B', 'Child-Pugh C', 'No evaluada'],
  rol: ['En formación', 'Formado'],
  curso: ['Agudo', 'Crónico', 'Crónico agudizado'],
  severidad: ['Leve', 'Moderada', 'Severa'],
  control: ['Controlada', 'No controlada', 'En progresión', 'En mejoría'],
  estadoDx: ['Activo', 'Estable', 'Resuelto'],
  fuente: ['Paciente', 'Cuidador/familiar', 'Fórmula médica', 'Historia clínica', 'Dispensación/farmacia', 'Varias fuentes'],
  decision: ['Continuar', 'Ajustar dosis', 'Sustituir', 'Iniciar (nuevo)', 'Suspender', 'Suspender temporalmente'],
  discrepancia: ['Sin discrepancia', 'Discrepancia justificada', 'Omisión', 'Comisión (sin indicación)', 'Diferente dosis, vía o frecuencia', 'Duplicidad', 'Interacción', 'Medicamento equivocado', 'Prescripción incompleta'],
  sevPrm: ['Leve', 'Moderada', 'Grave'],
  prioridad: ['Alta', 'Media', 'Baja'],
  estadoPrm: ['Real', 'Potencial'],
  tipoInt: ['Iniciar medicamento', 'Suspender medicamento', 'Sustituir medicamento', 'Ajustar dosis', 'Ajustar frecuencia/horario', 'Cambiar vía o forma farmacéutica', 'Solicitar paraclínicos/monitorización', 'Educación al paciente/cuidador', 'Interconsulta/remisión', 'Otra'],
  comunicado: ['Médico tratante', 'Enfermería', 'Paciente/cuidador', 'Equipo multidisciplinario'],
  aceptada: ['Pendiente', 'Aceptada', 'Aceptada parcialmente', 'No aceptada'],
  cumplido: ['Pendiente', 'Sí', 'Parcial', 'No'],
  revision: ['Pendiente', 'En revisión', 'Requiere ajustes', 'Aprobado']
};
const DISC_NO_JUST = OPT.discrepancia.slice(2);

const PREGUNTAS = [
  ['¿Hay alguna indicación para el fármaco?', 'No', { categoria: 'Indicación', tipo: 'Terapia farmacológica innecesaria', causa: 'Sin indicación médica' }],
  ['¿La medicación es efectiva para la situación?', 'No', { categoria: 'Efectividad', tipo: 'Medicamento ineficaz' }],
  ['¿La dosis es la correcta?', 'No', {}],
  ['¿Las instrucciones de uso son adecuadas?', 'No', { categoria: 'Adherencia', tipo: 'Incumplimiento', causa: 'Instrucciones no entendidas' }],
  ['¿La pauta de administración es práctica para el paciente?', 'No', { categoria: 'Adherencia', tipo: 'Incumplimiento' }],
  ['¿Tiene el paciente problemas significativos para tomar los medicamentos?', 'Sí', { categoria: 'Adherencia', tipo: 'Incumplimiento', causa: 'No se puede tragar o administrar' }],
  ['¿El paciente sigue adecuadamente las instrucciones de uso?', 'No', { categoria: 'Adherencia', tipo: 'Incumplimiento' }],
  ['¿Existen interacciones fármaco-fármaco clínicamente significativas?', 'Sí', { categoria: 'Seguridad', tipo: 'Reacción adversa al medicamento', causa: 'Interacción con medicamentos' }],
  ['¿Existen interacciones fármaco-enfermedad clínicamente significativas?', 'Sí', { categoria: 'Seguridad', tipo: 'Reacción adversa al medicamento', causa: 'Contraindicación presente' }],
  ['¿Existen duplicaciones innecesarias con otros fármacos?', 'Sí', { categoria: 'Indicación', tipo: 'Terapia farmacológica innecesaria', causa: 'Terapia duplicada' }],
  ['¿La duración del tratamiento es aceptable?', 'No', {}],
  ['¿Es el fármaco la alternativa más costo-efectiva?', 'No', {}]
];

/* Grupos de fármacos (nombres genéricos en español, sin tildes al comparar). */
const G = {
  aine: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'ketorolaco', 'meloxicam', 'celecoxib', 'etoricoxib', 'indometacina', 'piroxicam', 'ketoprofeno', 'nimesulida'],
  dipirona: ['dipirona', 'metamizol'],
  anticoag: ['warfarina', 'enoxaparina', 'heparina', 'dalteparina', 'fondaparinux', 'rivaroxaban', 'apixaban', 'dabigatran', 'edoxaban'],
  antiagreg: ['clopidogrel', 'ticagrelor', 'prasugrel', 'aspirina', 'acido acetilsalicilico', 'asa'],
  ieca: ['enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril'],
  ara2: ['losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan', 'olmesartan'],
  ahk: ['espironolactona', 'eplerenona', 'amilorida', 'triamtereno'],
  potasio: ['cloruro de potasio', 'kcl', 'gluconato de potasio', 'citrato de potasio'],
  ibp: ['omeprazol', 'esomeprazol', 'pantoprazol', 'lansoprazol', 'rabeprazol'],
  ibp2c19: ['omeprazol', 'esomeprazol'],
  benzo: ['alprazolam', 'clonazepam', 'lorazepam', 'diazepam', 'midazolam', 'bromazepam', 'clobazam'],
  opioide: ['morfina', 'hidromorfona', 'fentanilo', 'oxicodona', 'tramadol', 'metadona', 'codeina', 'meperidina', 'tapentadol', 'buprenorfina'],
  isrs: ['fluoxetina', 'sertralina', 'paroxetina', 'citalopram', 'escitalopram', 'venlafaxina', 'desvenlafaxina', 'duloxetina', 'fluvoxamina'],
  qt: ['haloperidol', 'ondansetron', 'levofloxacino', 'moxifloxacino', 'ciprofloxacino', 'azitromicina', 'claritromicina', 'eritromicina', 'amiodarona', 'quetiapina', 'citalopram', 'escitalopram', 'metadona', 'domperidona', 'hidroxicloroquina', 'fluconazol', 'sotalol'],
  estatina: ['atorvastatina', 'simvastatina', 'rosuvastatina', 'lovastatina', 'pravastatina'],
  estatina34: ['simvastatina', 'atorvastatina', 'lovastatina'],
  inh3a4: ['claritromicina', 'eritromicina', 'ketoconazol', 'itraconazol', 'voriconazol', 'posaconazol', 'fluconazol', 'ritonavir'],
  potenWarf: ['trimetoprim', 'sulfametoxazol', 'cotrimoxazol', 'metronidazol'],
  tmpsmx: ['trimetoprim', 'sulfametoxazol', 'cotrimoxazol'],
  quinolona: ['ciprofloxacino', 'levofloxacino', 'moxifloxacino'],
  quelantes: ['carbonato de calcio', 'calcio', 'sulfato ferroso', 'hierro', 'hidroxido de aluminio', 'sucralfato', 'oxido de magnesio', 'hidroxido de magnesio'],
  tiazida: ['hidroclorotiazida', 'clortalidona', 'indapamida'],
  asa_diur: ['furosemida', 'torasemida', 'bumetanida'],
  aminoglucosido: ['gentamicina', 'amikacina', 'tobramicina', 'estreptomicina'],
  penicilina: ['amoxicilina', 'ampicilina', 'penicilina', 'piperacilina', 'oxacilina', 'dicloxacilina'],
  cefalo: ['cefazolina', 'cefalexina', 'ceftriaxona', 'cefepima', 'cefepime', 'cefuroxima', 'ceftazidima', 'cefotaxima', 'cefadroxilo'],
  carbapenem: ['meropenem', 'imipenem', 'ertapenem'],
  sulfonilurea: ['glibenclamida', 'glimepirida', 'glipizida', 'gliclazida'],
  insulina: ['insulina', 'glargina', 'detemir', 'degludec', 'lispro', 'aspart', 'glulisina', 'nph'],
  vasoactivo: ['norepinefrina', 'noradrenalina', 'epinefrina', 'adrenalina', 'dopamina', 'dobutamina', 'vasopresina', 'fenilefrina'],
  sedante: ['midazolam', 'propofol', 'dexmedetomidina', 'ketamina'],
  bloqNM: ['rocuronio', 'vecuronio', 'succinilcolina', 'cisatracurio'],
  quimio: ['ciclofosfamida', 'cisplatino', 'carboplatino', 'doxorrubicina', 'vincristina', 'paclitaxel', 'citarabina', 'fluorouracilo', 'metotrexato'],
  otrosAR: ['sulfato de magnesio', 'nitroprusiato', 'milrinona', 'alteplasa', 'tenecteplasa', 'digoxina', 'amiodarona', 'cloruro de sodio 3']
};
G.sraa = [...G.ieca, ...G.ara2];
G.litioInt = [...G.ieca, ...G.ara2, ...G.aine, ...G.tiazida];
const inG = (m, g) => (G[g] || [g]).some(k => hasKw(m.nombre, k));

const INTER = [
  ['anticoag', 'aine', 'alta', 'Anticoagulante + AINE: aumento del riesgo de sangrado. Evitar o usar gastroprotección y vigilar.'],
  ['anticoag', 'antiagreg', 'alta', 'Anticoagulante + antiagregante: aumento del riesgo de sangrado. Verificar indicación de la combinación.'],
  ['anticoag', 'dipirona', 'media', 'Anticoagulante + metamizol: posible aumento del riesgo de sangrado. Vigilar signos de sangrado y hemograma.'],
  ['anticoag', 'isrs', 'media', 'ISRS/IRSN + anticoagulante: aumento del riesgo de sangrado.'],
  ['warfarina', 'inh3a4', 'alta', 'Warfarina + inhibidor enzimático (macrólido/azol): riesgo de INR elevado. Monitorizar INR estrechamente.'],
  ['warfarina', 'potenWarf', 'alta', 'Warfarina + TMP-SMX/metronidazol: potenciación del efecto anticoagulante. Monitorizar INR.'],
  ['warfarina', 'amiodarona', 'alta', 'Warfarina + amiodarona: suele requerir reducir la dosis de warfarina 30–50 % y monitorizar INR.'],
  ['sraa', 'ahk', 'alta', 'IECA/ARA-II + diurético ahorrador de K: riesgo de hiperpotasemia. Monitorizar K+ y función renal.'],
  ['sraa', 'potasio', 'alta', 'IECA/ARA-II + suplemento de potasio: riesgo de hiperpotasemia.'],
  ['ieca', 'ara2', 'alta', 'IECA + ARA-II (doble bloqueo SRAA): hiperpotasemia, hipotensión e IRA. Generalmente no recomendado.'],
  ['sraa', 'aine', 'media', 'IECA/ARA-II + AINE: riesgo de lesión renal aguda y menor efecto antihipertensivo (mayor si hay diurético).'],
  ['clopidogrel', 'ibp2c19', 'media', 'Clopidogrel + omeprazol/esomeprazol: menor activación de clopidogrel. Preferir pantoprazol.'],
  ['opioide', 'benzo', 'alta', 'Opioide + benzodiacepina: sedación profunda y depresión respiratoria.'],
  ['tramadol', 'isrs', 'alta', 'Tramadol + ISRS/IRSN: riesgo de síndrome serotoninérgico y convulsiones.'],
  ['estatina34', 'inh3a4', 'alta', 'Simva/atorva/lovastatina + inhibidor de CYP3A4: riesgo de miopatía/rabdomiólisis.'],
  ['digoxina', 'amiodarona', 'alta', 'Digoxina + amiodarona: aumento de digoxinemia. Reducir dosis y monitorizar niveles.'],
  ['litio', 'litioInt', 'alta', 'Litio + IECA/ARA-II/AINE/tiazida: puede elevar la litemia. Monitorizar niveles.'],
  ['levotiroxina', 'quelantes', 'media', 'Levotiroxina + calcio/hierro/antiácidos: menor absorción. Separar al menos 4 horas.'],
  ['levotiroxina', 'ibp', 'baja', 'Levotiroxina + IBP: posible menor absorción. Vigilar TSH.'],
  ['quinolona', 'quelantes', 'media', 'Quinolona + cationes (Ca, Fe, Mg, Al): menor absorción. Dar la quinolona 2 h antes o 6 h después.'],
  ['metotrexato', 'aine', 'alta', 'Metotrexato + AINE: aumento de la toxicidad de metotrexato.'],
  ['metotrexato', 'tmpsmx', 'alta', 'Metotrexato + TMP-SMX: riesgo de mielotoxicidad.'],
  ['asa_diur', 'aminoglucosido', 'media', 'Diurético de asa + aminoglucósido: mayor oto y nefrotoxicidad.'],
  ['vancomicina', 'piperacilina', 'media', 'Vancomicina + piperacilina/tazobactam: mayor riesgo de lesión renal aguda. Monitorizar creatinina.'],
  ['qt', 'qt', 'media', 'Dos o más medicamentos que prolongan el QT. Considerar ECG y control de K+/Mg2+.']
];

/* [grupo o lista, CrCl umbral (mL/min), nivel, mensaje] */
const RENAL = [
  [['metformina'], 45, 'alta', 'Metformina: contraindicada con CrCl < 30 mL/min; entre 30–45 no iniciar y limitar dosis (≈1.000 mg/día).'],
  [['enoxaparina'], 30, 'alta', 'Enoxaparina con CrCl < 30: ajustar (profilaxis 30 mg/día; terapéutica 1 mg/kg c/24 h) o considerar heparina no fraccionada.'],
  [['dabigatran'], 30, 'alta', 'Dabigatrán contraindicado con CrCl < 30 mL/min.'],
  [['rivaroxaban', 'apixaban', 'edoxaban'], 50, 'media', 'Anticoagulante oral directo: verificar dosis según indicación, CrCl, edad y peso.'],
  ['aine', 30, 'alta', 'AINE con CrCl < 30 mL/min: evitar (deterioro de la función renal).'],
  [['nitrofurantoina'], 30, 'alta', 'Nitrofurantoína: evitar con CrCl < 30 mL/min (ineficaz y tóxica).'],
  [['espironolactona', 'eplerenona'], 30, 'alta', 'Antagonista mineralocorticoide con CrCl < 30: alto riesgo de hiperpotasemia.'],
  [['gabapentina', 'pregabalina'], 60, 'media', 'Gabapentinoide: ajustar dosis por función renal (sedación, mareo).'],
  [['cefepima', 'cefepime'], 60, 'media', 'Cefepima: ajustar dosis; riesgo de neurotoxicidad en insuficiencia renal.'],
  [['meropenem'], 50, 'media', 'Meropenem: ajustar dosis/intervalo por función renal.'],
  [['piperacilina'], 40, 'media', 'Piperacilina/tazobactam: ajustar dosis por función renal.'],
  [['ertapenem'], 30, 'media', 'Ertapenem: reducir a 500 mg/día con CrCl ≤ 30.'],
  [['levofloxacino'], 50, 'media', 'Levofloxacino: ajustar dosis por función renal.'],
  [['ciprofloxacino'], 30, 'media', 'Ciprofloxacino: ajustar dosis con CrCl < 30.'],
  ['tmpsmx', 30, 'media', 'TMP-SMX: reducir 50 % con CrCl 15–30; evitar si < 15. Vigilar K+.'],
  [['fluconazol'], 50, 'media', 'Fluconazol: reducir 50 % la dosis de mantenimiento con CrCl ≤ 50.'],
  [['aciclovir', 'valaciclovir', 'ganciclovir', 'valganciclovir'], 50, 'media', 'Antiviral: ajustar dosis por función renal (riesgo de neurotoxicidad/nefrotoxicidad).'],
  [['vancomicina'], 60, 'media', 'Vancomicina: dosificar por niveles/AUC y vigilar creatinina.'],
  ['aminoglucosido', 60, 'alta', 'Aminoglucósido: ampliar intervalo y monitorizar niveles (nefro/ototoxicidad).'],
  [['cefazolina', 'ceftazidima', 'cefuroxima'], 35, 'media', 'Cefalosporina de eliminación renal: ajustar dosis/intervalo.'],
  [['ampicilina', 'amoxicilina'], 30, 'baja', 'Aminopenicilina: ampliar intervalo con CrCl < 30.'],
  [['digoxina'], 50, 'media', 'Digoxina: reducir dosis y monitorizar niveles en insuficiencia renal.'],
  [['morfina', 'tramadol', 'codeina'], 30, 'media', 'Opioide con metabolitos renales: acumulación con CrCl < 30. Reducir dosis o preferir alternativa.'],
  [['meperidina'], 60, 'alta', 'Meperidina: evitar en insuficiencia renal (normeperidina neurotóxica).'],
  [['litio'], 60, 'alta', 'Litio: reducir dosis/evitar y monitorizar litemia.'],
  [['alopurinol'], 60, 'media', 'Alopurinol: ajustar dosis por función renal.'],
  [['sitagliptina'], 45, 'media', 'Sitagliptina: 50 mg/día con CrCl 30–45; 25 mg/día si < 30.'],
  [['glibenclamida'], 60, 'alta', 'Glibenclamida en insuficiencia renal: hipoglucemia prolongada. Preferir alternativa.'],
  [['famotidina'], 50, 'baja', 'Famotidina: reducir dosis con CrCl < 50.'],
  [['levetiracetam'], 80, 'media', 'Levetiracetam: ajustar dosis por función renal.'],
  [['colchicina'], 30, 'alta', 'Colchicina con CrCl < 30: reducir dosis o evitar.'],
  [['metoclopramida'], 60, 'baja', 'Metoclopramida: reducir 50 % la dosis con CrCl < 60.']
];

const BEERS = [
  ['benzo', 'Benzodiacepina en ≥ 65 años: deterioro cognitivo, delirium, caídas y fracturas (Beers).'],
  [['difenhidramina', 'hidroxicina', 'clorfeniramina', 'clorfenamina', 'prometazina', 'dimenhidrinato', 'meclizina'], 'Antihistamínico de 1.ª generación: efecto anticolinérgico (Beers).'],
  [['amitriptilina', 'imipramina', 'clomipramina', 'doxepina', 'nortriptilina'], 'Antidepresivo tricíclico: anticolinérgico, sedante, hipotensión ortostática (Beers).'],
  [['glibenclamida', 'glimepirida'], 'Sulfonilurea de acción larga: riesgo de hipoglucemia prolongada (Beers).'],
  [['zolpidem', 'zopiclona', 'eszopiclona'], 'Hipnótico Z: caídas, fracturas y delirium (Beers).'],
  [['ciclobenzaprina', 'metocarbamol', 'orfenadrina', 'carisoprodol'], 'Relajante muscular: anticolinérgico, sedación, poca efectividad (Beers).'],
  [['meperidina'], 'Meperidina: neurotoxicidad; evitar (Beers).'],
  [['metoclopramida'], 'Metoclopramida: efectos extrapiramidales y discinesia tardía (Beers).'],
  [['ketorolaco', 'indometacina'], 'Ketorolaco/indometacina: alto riesgo gastrointestinal y renal en mayores (Beers).'],
  [['digoxina'], 'Digoxina: evitar como 1.ª línea en FA/IC; si se usa, ≤ 0,125 mg/día (Beers).'],
  [['haloperidol', 'quetiapina', 'risperidona', 'olanzapina'], 'Antipsicótico: aumento de mortalidad y ACV en demencia; evitar para delirium salvo necesidad (Beers).']
];
const ALTO_RIESGO = ['anticoag', 'opioide', 'insulina', 'potasio', 'sulfonilurea', 'vasoactivo', 'sedante', 'bloqNM', 'quimio', 'otrosAR'];
const DUP_GROUPS = { ibp: 'IBP', ieca: 'IECA', ara2: 'ARA-II', benzo: 'benzodiacepinas', aine: 'AINE', isrs: 'ISRS/IRSN', estatina: 'estatinas', anticoag: 'anticoagulantes', sulfonilurea: 'sulfonilureas', opioide: 'opioides' };

/* ───────────────────────── Estado ───────────────────────── */

function emptyCase() {
  return {
    version: 1, creado: new Date().toISOString(), actualizado: null,
    paciente: {
      nombre: '', documento: '', edad: '', sexo: '', peso: '', talla: '', servicio: '', cama: '', aseguradora: '',
      fechaIngreso: '', fechaValoracion: today(), gestacion: '',
      motivo: '', enfermedadActual: '', antecedentes: '', alergias: '', habitos: '', social: '',
      pas: '', pad: '', fc: '', fr: '', temp: '', sat: '', dolor: '', scr: '', hepatica: '',
      farmaceutico: '', rol: 'En formación', tutor: '', institucion: ''
    },
    sintesis: { agudos: '', cronicos: '', estables: '' },
    dx: [], labs: [], meds: [], cribado: {}, prm: [], paf: [], monitoreo: [], egreso: [],
    recomendaciones: { dieta: '', alarma: '', medicamentos: '' },
    soap: { s: '', o: '', a: '', p: '' },
    revision: { estado: 'Pendiente', comentarios: '' }
  };
}
const ROW = {
  dx: () => ({ nombre: '', cie: '', curso: '', severidad: '', control: '', estado: 'Activo', hallazgos: '', factores: '', paraclinicos: '' }),
  labs: () => ({ nombre: '', valor: '', unidad: '', min: '', max: '', fecha: '', asociacion: '', interpretacion: '' }),
  meds: () => ({ id: uid(), nombre: '', casa: '', hosp: '', fuente: '', indicacion: '', altoRiesgo: false, decision: '', discrepancia: '', justificacion: '', alta: '' }),
  prm: () => ({ med: '', categoria: '', tipo: '', causa: '', estado: 'Real', rnm: '', descripcion: '', evidencia: '', severidad: '', prioridad: '', objetivo: '', intervencion: '', tipoInt: '', comunicado: '', aceptada: 'Pendiente', parametro: '', meta: '', frecuencia: '', cumplido: 'Pendiente' }),
  paf: () => ({ dx: '', oft: '', terapia: '', parametro: '', meta: '', frecuencia: '' }),
  monitoreo: () => ({ parametro: '', meta: '', frecuencia: '', r1: '', r2: '', r3: '', r4: '', r5: '', r6: '' }),
  egreso: () => ({ med: '', dosis: '', horario: '', paraQue: '', ram: '', consultar: '' })
};
function merge(def, obj) {
  if (Array.isArray(def)) return Array.isArray(obj) ? obj : def;
  if (def && typeof def === 'object') {
    const r = { ...def };
    if (obj && typeof obj === 'object') for (const k in obj) r[k] = k in def ? merge(def[k], obj[k]) : obj[k];
    return r;
  }
  return obj === undefined || obj === null ? def : obj;
}
function hydrate(obj) {
  const s = merge(emptyCase(), obj || {});
  for (const k of Object.keys(ROW)) s[k] = (s[k] || []).map(r => ({ ...ROW[k](), ...r }));
  s.meds.forEach(m => { if (!m.id) m.id = uid(); });
  return s;
}

let S = hydrate(load(STORE_KEY));
const UI = merge({ sec: 'paciente', modo: 'formacion' }, load(UI_KEY));
let lastAlerts = [];
let saveTimer;

function getPath(p) { return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S); }
function setPath(p, v) {
  const ks = p.split('.'); let o = S;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = v;
}
function touch() {
  S.actualizado = new Date().toISOString();
  $('#saveState').textContent = 'Guardando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { store(STORE_KEY, S); $('#saveState').textContent = 'Guardado'; }, 350);
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }

/* ───────────────────────── Cálculos ───────────────────────── */

function calc(p = S.paciente) {
  const peso = num(p.peso), talla = num(p.talla), edad = num(p.edad), scr = num(p.scr);
  const r = {};
  if (peso && talla) {
    const m = talla / 100; r.imc = peso / (m * m); r.sc = Math.sqrt(peso * talla / 3600);
    if (p.sexo) { r.pi = (p.sexo === 'Masculino' ? 50 : 45.5) + 0.9 * (talla - 152.4); if (r.pi > 0) r.pa = r.pi + 0.4 * (peso - r.pi); else r.pi = null; }
  }
  if (peso && edad && scr && p.sexo) {
    const f = p.sexo === 'Femenino' ? 0.85 : 1;
    r.crcl = (140 - edad) * peso / (72 * scr) * f;
    if (r.pi) {
      let pu = r.pi, lbl = 'peso ideal';
      if (peso < r.pi) { pu = peso; lbl = 'peso real'; } else if (peso > 1.2 * r.pi) { pu = r.pa; lbl = 'peso ajustado'; }
      r.crclDos = (140 - edad) * pu / (72 * scr) * f; r.crclLbl = lbl;
    }
  }
  r.crclUso = r.crclDos ?? r.crcl ?? null;
  return r;
}
const imcCat = v => v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : v < 35 ? 'Obesidad I' : v < 40 ? 'Obesidad II' : 'Obesidad III';
const renalCat = v => v >= 90 ? 'Normal' : v >= 60 ? 'Disminución leve' : v >= 30 ? 'Disminución moderada' : v >= 15 ? 'Disminución grave' : 'Falla renal';
const polyCat = n => n >= 10 ? 'polifarmacia excesiva (≥ 10)' : n >= 5 ? 'polifarmacia (5–9)' : 'sin polifarmacia (< 5)';
const isActive = m => m.nombre.trim() && !String(m.decision).startsWith('Suspender');
const activeMeds = () => S.meds.filter(isActive);
const isHighRisk = m => m.altoRiesgo || ALTO_RIESGO.some(g => inG(m, g));
function labFlag(l) {
  const v = num(l.valor), lo = num(l.min), hi = num(l.max);
  if (v === null || (lo === null && hi === null)) return '';
  if (hi !== null && v > hi) return 'Alto';
  if (lo !== null && v < lo) return 'Bajo';
  return 'Normal';
}

/* ───────────────────────── Motor de alertas (orientativo) ───────────────────────── */

function computeAlerts() {
  const out = [], seen = new Set();
  const add = (nivel, tipo, msg, prm) => { const k = tipo + msg; if (seen.has(k)) return; seen.add(k); out.push({ nivel, tipo, msg, prm }); };
  const p = S.paciente, c = calc(), act = activeMeds(), edad = num(p.edad);

  // Conciliación
  S.meds.forEach(m => {
    if (!m.nombre.trim()) return;
    if (m.casa.trim() && !m.decision) add('media', 'Conciliación', `${m.nombre}: medicamento domiciliario sin decisión de conciliación.`);
    if (m.casa.trim() && !m.hosp.trim() && !String(m.decision).startsWith('Suspender') && m.decision !== 'Sustituir')
      add('alta', 'Conciliación', `${m.nombre}: está en la lista domiciliaria pero no en la prescripción actual (posible omisión).`,
        { med: m.nombre, categoria: 'Indicación', tipo: 'Requiere terapia farmacológica adicional', causa: 'Afección no tratada', rnm: RNM_OPTS[0], descripcion: `Omisión en conciliación: ${m.nombre} (${m.casa}) no prescrito al ingreso${m.indicacion ? ' para ' + m.indicacion : ''}.` });
    if (DISC_NO_JUST.includes(m.discrepancia))
      add('alta', 'Conciliación', `${m.nombre}: discrepancia no justificada — ${m.discrepancia}.`,
        { med: m.nombre, descripcion: `Error de conciliación (${m.discrepancia}) con ${m.nombre}. Domicilio: ${m.casa || '—'}; actual: ${m.hosp || '—'}.` });
    if (isActive(m) && !m.indicacion.trim())
      add('media', 'Indicación', `${m.nombre}: sin indicación registrada.`,
        { med: m.nombre, categoria: 'Indicación', tipo: 'Terapia farmacológica innecesaria', causa: 'Sin indicación médica', rnm: RNM_OPTS[1], descripcion: `${m.nombre} sin indicación clínica documentada.` });
  });

  // Diagnósticos sin tratamiento asociado
  S.dx.filter(d => d.nombre.trim() && d.estado !== 'Resuelto').forEach(d => {
    const nd = norm(d.nombre).trim();
    const tratado = act.some(m => { const ni = norm(m.indicacion).trim(); return ni && (ni.includes(nd) || nd.includes(ni)); });
    if (!tratado) add('baja', 'Indicación', `"${d.nombre}" no tiene medicamento activo asociado. ¿Requiere terapia farmacológica o solo no farmacológica?`,
      { categoria: 'Indicación', tipo: 'Requiere terapia farmacológica adicional', causa: 'Afección no tratada', rnm: RNM_OPTS[0], descripcion: `${d.nombre} sin tratamiento farmacológico.` });
  });

  // Duplicidades
  const seenName = {};
  act.forEach(m => { const k = norm(m.nombre).trim().split(' ')[0]; if (!k) return; if (seenName[k]) add('alta', 'Duplicidad', `${m.nombre} aparece más de una vez en la lista activa.`, { med: m.nombre, categoria: 'Indicación', tipo: 'Terapia farmacológica innecesaria', causa: 'Terapia duplicada', descripcion: `Duplicidad: ${m.nombre} registrado dos veces.` }); seenName[k] = 1; });
  for (const [g, lbl] of Object.entries(DUP_GROUPS)) {
    const ms = act.filter(m => inG(m, g));
    const distintos = [...new Set(ms.map(m => norm(m.nombre).trim().split(' ')[0]))];
    if (distintos.length > 1) {
      const names = ms.map(m => m.nombre).join(' + ');
      add('alta', 'Duplicidad', `Duplicidad terapéutica de ${lbl}: ${names}.${g === 'anticoag' ? ' Verificar si es terapia puente intencional.' : g === 'opioide' ? ' Verificar si es esquema basal + rescate.' : ''}`,
        { med: names, categoria: 'Indicación', tipo: 'Terapia farmacológica innecesaria', causa: 'Terapia duplicada', rnm: RNM_OPTS[1], descripcion: `Duplicidad terapéutica de ${lbl}: ${names}.` });
    }
  }

  // Interacciones
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j];
    for (const [g1, g2, nivel, msg] of INTER) {
      if ((inG(a, g1) && inG(b, g2)) || (inG(a, g2) && inG(b, g1))) {
        add(nivel, 'Interacción', `${a.nombre} + ${b.nombre}: ${msg}`,
          { med: `${a.nombre} + ${b.nombre}`, categoria: 'Seguridad', tipo: 'Reacción adversa al medicamento', causa: 'Interacción con medicamentos', estado: 'Potencial', rnm: RNM_OPTS[4], descripcion: `Interacción ${a.nombre} + ${b.nombre}. ${msg}` });
      }
    }
  }

  // Función renal
  if (c.crclUso) {
    act.forEach(m => RENAL.forEach(([g, umbral, nivel, msg]) => {
      const hit = Array.isArray(g) ? g.some(k => hasKw(m.nombre, k)) : inG(m, g);
      if (hit && c.crclUso < umbral)
        add(nivel, 'Función renal', `${m.nombre} (CrCl ${c.crclUso.toFixed(0)} mL/min): ${msg}`,
          { med: m.nombre, categoria: 'Seguridad', tipo: 'Dosis demasiado alta', causa: 'Dosis incorrecta', estado: 'Potencial', rnm: RNM_OPTS[5], descripcion: `${m.nombre} requiere ajuste por función renal (CrCl ${c.crclUso.toFixed(0)} mL/min). ${msg}` });
    }));
  }

  // Adulto mayor (Beers)
  if (edad && edad >= 65) act.forEach(m => BEERS.forEach(([g, msg]) => {
    const hit = Array.isArray(g) ? g.some(k => hasKw(m.nombre, k)) : inG(m, g);
    if (hit) add('media', 'Adulto mayor', `${m.nombre}: ${msg}`,
      { med: m.nombre, categoria: 'Seguridad', tipo: 'Reacción adversa al medicamento', causa: 'Medicamento inseguro para el paciente', estado: 'Potencial', rnm: RNM_OPTS[4], descripcion: `${m.nombre} potencialmente inapropiado en paciente de ${edad} años. ${msg}` });
  }));

  // Alergias
  const al = norm(p.alergias);
  const niega = /\b(niega|no refiere|ninguna|no conocidas)\b/.test(al);
  if (al.trim() && !niega) {
    const penAl = /penicil|betalact|amoxi|ampici/.test(al);
    const stop = ['alergia', 'alergias', 'conocidas', 'reaccion', 'medicamentos', 'refiere', 'infancia', 'exantema', 'urticaria', 'anafilaxia', 'severa', 'leve'];
    const tokens = al.trim().split(' ').filter(w => w.length >= 5 && !stop.includes(w));
    act.forEach(m => {
      const pr = { med: m.nombre, categoria: 'Seguridad', tipo: 'Reacción adversa al medicamento', causa: 'Reacción alérgica', estado: 'Potencial', rnm: RNM_OPTS[4] };
      if (penAl && inG(m, 'penicilina')) add('alta', 'Alergia', `${m.nombre}: paciente con alergia a penicilinas registrada.`, { ...pr, descripcion: `${m.nombre} prescrito a paciente con alergia a penicilinas.` });
      else if (penAl && (inG(m, 'cefalo') || inG(m, 'carbapenem'))) add('media', 'Alergia', `${m.nombre}: reactividad cruzada baja con alergia a penicilinas; verificar tipo y gravedad de la reacción previa.`, { ...pr, descripcion: `Posible reactividad cruzada de ${m.nombre} con alergia a penicilinas.` });
      else if (tokens.some(w => norm(m.nombre).includes(' ' + w))) add('alta', 'Alergia', `${m.nombre}: coincide con una alergia registrada (${p.alergias}).`, { ...pr, descripcion: `${m.nombre} coincide con alergia registrada.` });
    });
  }

  // Cribado sistemático
  S.meds.forEach(m => PREGUNTAS.forEach(([q, malo, pre], qi) => {
    if (!isActive(m)) return;
    const r = S.cribado[`${m.id}|${qi}`];
    if (r === malo) add('media', 'Evaluación sistemática', `${m.nombre} — P${qi + 1} ${q} Respuesta: ${r}.`,
      { med: m.nombre, ...pre, descripcion: `${m.nombre}: ${q} → ${r}. ${S.cribado[m.id + '|c'] || ''}`.trim() });
  }));

  // Paraclínicos y polifarmacia (informativas)
  const alt = S.labs.filter(l => ['Alto', 'Bajo'].includes(labFlag(l)));
  if (alt.length) add('info', 'Paraclínicos', `Fuera de rango: ${alt.map(l => `${l.nombre} ${l.valor}${l.unidad ? ' ' + l.unidad : ''} (${labFlag(l).toLowerCase()})`).join('; ')}.`);
  if (act.length >= 5) add('info', 'Polifarmacia', `${act.length} medicamentos activos: ${polyCat(act.length)}. Revise adecuación.`);
  const hr = act.filter(isHighRisk);
  if (hr.length) add('info', 'Alto riesgo', `Medicamentos de alto riesgo (ISMP): ${hr.map(m => m.nombre).join(', ')}. Doble verificación y monitoreo estrecho.`);

  const ord = { alta: 0, media: 1, baja: 2, info: 3 };
  return out.sort((a, b) => ord[a.nivel] - ord[b.nivel]);
}

/* ───────────────────────── Componentes ───────────────────────── */

function control(path, t = 'text', o = {}) {
  const v = getPath(path);
  const ph = o.ph ? ` placeholder="${esc(o.ph)}"` : '';
  const list = o.list ? ` list="${o.list}"` : '';
  const re = o.re ? ' data-re' : '';
  if (t === 'area') return `<textarea data-bind="${path}" rows="${o.rows || 1}"${ph}>${esc(v)}</textarea>`;
  if (t === 'select') return `<select data-bind="${path}"${re}><option value="">—</option>${(o.o || []).map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  if (t === 'check') return `<label class="check"><input type="checkbox" data-bind="${path}"${v ? ' checked' : ''}${re}> ${esc(o.cl || '')}</label>`;
  const type = t === 'num' ? 'number' : t === 'date' ? 'date' : 'text';
  const step = t === 'num' ? ' step="any" inputmode="decimal"' : '';
  return `<input type="${type}" data-bind="${path}" value="${esc(v)}"${ph}${list}${step}>`;
}
const field = (path, label, t, o = {}) => `<label class="f ${o.cls || ''}"><span>${label}</span>${control(path, t, o)}</label>`;
const hint = html => `<div class="hint">${html}</div>`;

function tableEd(key, cols, { add = 'Agregar fila', empty = 'Sin registros todavía.' } = {}) {
  const rows = S[key];
  const head = cols.map(c => `<th style="min-width:${c.w || '140px'}">${c.l}</th>`).join('') + '<th></th>';
  const body = rows.length ? rows.map((r, i) => `<tr>${cols.map(c => `<td>${c.render ? c.render(r, i) : control(`${key}.${i}.${c.k}`, c.t || 'text', c)}${c.after ? c.after(r, i) : ''}</td>`).join('')}<td class="del"><button class="x" data-del="${key}.${i}" title="Eliminar fila" aria-label="Eliminar fila">×</button></td></tr>`).join('')
    : `<tr><td colspan="${cols.length + 1}" class="empty">${empty}</td></tr>`;
  return `<div class="tbl-wrap"><table class="ed"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div><button class="btn add" data-add="${key}">+ ${add}</button>`;
}
const datalist = (id, items) => `<datalist id="${id}">${[...new Set(items.filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
const dxNames = () => S.dx.map(d => d.nombre.trim()).filter(Boolean);
const medNames = () => S.meds.map(m => m.nombre.trim()).filter(Boolean);
function secHead(title, sub) { return `<div class="sec-head"><div><h2>${title}</h2><p>${sub}</p></div></div>`; }

/* ───────────────────────── Secciones ───────────────────────── */

function calcHtml() {
  const c = calc(), t = (l, v, s = '', cls = '') => `<div class="stat ${cls}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`;
  const crCls = v => v == null ? '' : v < 30 ? 'red' : v < 60 ? 'amber' : 'green';
  return `<div class="stats">
    ${t('IMC', c.imc ? c.imc.toFixed(1) + ' kg/m²' : '—', c.imc ? imcCat(c.imc) : 'Requiere peso y talla')}
    ${t('Superficie corporal', c.sc ? c.sc.toFixed(2) + ' m²' : '—', 'Mosteller')}
    ${t('Peso ideal', c.pi ? c.pi.toFixed(1) + ' kg' : '—', 'Devine')}
    ${t('Peso ajustado', c.pa ? c.pa.toFixed(1) + ' kg' : '—', 'PI + 0,4 (PR − PI)')}
    ${t('CrCl con peso real', c.crcl ? c.crcl.toFixed(0) + ' mL/min' : '—', c.crcl ? renalCat(c.crcl) : 'Requiere edad, sexo, peso y creatinina', crCls(c.crcl))}
    ${t('CrCl de dosificación', c.crclDos ? c.crclDos.toFixed(0) + ' mL/min' : '—', c.crclDos ? `Cockcroft-Gault con ${c.crclLbl}` : 'Requiere talla', crCls(c.crclDos))}
  </div>`;
}

function secPaciente() {
  const f = (k, l, t = 'text', o = {}) => field('paciente.' + k, l, t, o);
  return secHead('Datos del paciente', 'Recolección de información (Collect)') +
    hint('<b>Recolectar:</b> obtenga información de al menos dos fuentes (paciente, cuidador, historia clínica, fórmulas, dispensación). Registre peso, talla, sexo, edad y creatinina: con ellos se calcula la función renal que usan las alertas de ajuste de dosis.') +
    `<section class="card"><h3>Identificación</h3><div class="grid g4">
      ${f('nombre', 'Nombre o iniciales', 'text', { cls: 'span2', ph: 'Use iniciales en equipos compartidos' })}${f('documento', 'Documento / N.º historia')}${f('aseguradora', 'EPS / aseguradora')}
      ${f('edad', 'Edad (años)', 'num')}${f('sexo', 'Sexo', 'select', { o: OPT.sexo })}${f('peso', 'Peso (kg)', 'num')}${f('talla', 'Talla (cm)', 'num')}
      ${f('servicio', 'Servicio')}${f('cama', 'Cama')}${f('fechaIngreso', 'Fecha de ingreso', 'date')}${f('fechaValoracion', 'Fecha de valoración', 'date')}
      ${f('gestacion', 'Embarazo / lactancia', 'select', { o: OPT.gestacion })}
    </div></section>
    <section class="card"><h3>Información clínica</h3><div class="grid g2">
      ${f('motivo', 'Motivo de consulta / valoración', 'area', { rows: 2 })}
      ${f('enfermedadActual', 'Enfermedad actual', 'area', { rows: 2 })}
      ${f('antecedentes', 'Antecedentes (patológicos, quirúrgicos, farmacológicos, familiares)', 'area', { rows: 2 })}
      ${f('alergias', 'Alergias e intolerancias (medicamento y tipo de reacción)', 'area', { rows: 2, ph: 'Ej.: penicilina — urticaria. Escriba "niega" si no tiene.' })}
      ${f('habitos', 'Hábitos (tabaco, alcohol, SPA, dieta, actividad física)', 'area', { rows: 2 })}
      ${f('social', 'Determinantes sociales (escolaridad, red de apoyo, acceso a medicamentos, cuidador)', 'area', { rows: 2 })}
    </div></section>
    <section class="card"><h3>Signos vitales y función de órganos</h3><div class="grid g6">
      ${f('pas', 'PAS (mmHg)', 'num')}${f('pad', 'PAD (mmHg)', 'num')}${f('fc', 'FC (lpm)', 'num')}${f('fr', 'FR (rpm)', 'num')}${f('temp', 'Temperatura (°C)', 'num')}${f('sat', 'SatO₂ (%)', 'num')}
      ${f('dolor', 'Dolor EVA (0–10)', 'num')}${f('scr', 'Creatinina sérica (mg/dL)', 'num')}${f('hepatica', 'Función hepática', 'select', { o: OPT.hepatica, cls: 'span2' })}
    </div></section>
    <section class="card"><h3>Cálculos automáticos</h3><div id="calcBox">${calcHtml()}</div></section>
    <section class="card"><h3>Responsable de la valoración</h3><div class="grid g4">
      ${f('farmaceutico', 'Químico farmacéutico')}${f('rol', 'Rol', 'select', { o: OPT.rol })}${f('tutor', 'Tutor / supervisor')}${f('institucion', 'Institución')}
    </div></section>`;
}

function secDx() {
  return secHead('Diagnósticos y síntesis', 'Priorización de problemas de salud (Assess)') +
    hint('<b>Síntesis:</b> separe los problemas <b>agudos</b> que motivan la consulta, los <b>crónicos</b> que impactan el manejo y los <b>estables</b> que solo se vigilarán. Luego describa cada diagnóstico como en la tabla “Dx paciente” del taller: curso, severidad, control, hallazgos y factores de riesgo.') +
    `<section class="card"><h3>Síntesis y priorización</h3><div class="grid g3">
      ${field('sintesis.agudos', 'Problemas agudos / activos (2–3)', 'area', { rows: 3 })}
      ${field('sintesis.cronicos', 'Problemas crónicos clave que impactan el manejo', 'area', { rows: 3 })}
      ${field('sintesis.estables', 'Estables y no contribuyentes (solo conciliación y vigilancia)', 'area', { rows: 3 })}
    </div></section>
    <section class="card"><h3>Problemas de salud del paciente</h3>
    ${tableEd('dx', [
      { k: 'nombre', l: 'Diagnóstico', w: '200px', t: 'area' },
      { k: 'cie', l: 'CIE-10', w: '80px' },
      { k: 'curso', l: 'Curso', t: 'select', o: OPT.curso, w: '120px' },
      { k: 'severidad', l: 'Severidad', t: 'select', o: OPT.severidad, w: '110px' },
      { k: 'control', l: 'Control', t: 'select', o: OPT.control, w: '130px' },
      { k: 'estado', l: 'Estado', t: 'select', o: OPT.estadoDx, w: '100px' },
      { k: 'hallazgos', l: 'Signos, síntomas y paraclínicos del paciente', t: 'area', w: '240px' },
      { k: 'factores', l: 'Factores de riesgo', t: 'area', w: '170px' }
    ], { add: 'Agregar diagnóstico' })}</section>`;
}

function secLabs() {
  return secHead('Paraclínicos', 'Solo los clínicamente relevantes') +
    hint('<b>Paraclínicos:</b> registre valor y rango de referencia; la app marca lo que está fuera de rango. En <b>Asociación</b> relacione el resultado con un diagnóstico o medicamento y en <b>Implicación</b> anote qué hay que hacer (ajustar, suspender, repetir, vigilar).') +
    `<section class="card">${tableEd('labs', [
      { k: 'nombre', l: 'Paraclínico', w: '150px' },
      { k: 'valor', l: 'Valor', w: '90px', after: (r, i) => `<div data-labflag="${i}">${flagHtml(r)}</div>` },
      { k: 'unidad', l: 'Unidad', w: '90px' },
      { k: 'min', l: 'Ref. mín', w: '80px' },
      { k: 'max', l: 'Ref. máx', w: '80px' },
      { k: 'fecha', l: 'Fecha', t: 'date', w: '140px' },
      { k: 'asociacion', l: 'Asociación (Dx / medicamento)', t: 'area', w: '200px' },
      { k: 'interpretacion', l: 'Interpretación e implicación terapéutica', t: 'area', w: '260px' }
    ], { add: 'Agregar paraclínico' })}</section>`;
}
function flagHtml(l) { const f = labFlag(l); return f ? `<span class="flag ${f === 'Alto' ? 'hi' : f === 'Bajo' ? 'lo' : 'ok'}">${f}</span>` : ''; }

function secConcil() {
  const act = activeMeds(), conDisc = S.meds.filter(m => DISC_NO_JUST.includes(m.discrepancia)).length;
  const pend = S.meds.filter(m => m.nombre.trim() && m.casa.trim() && !m.decision).length;
  return secHead('Conciliación de medicamentos', 'Domicilio frente a prescripción actual') +
    hint('<b>Conciliación:</b> construya la mejor historia farmacoterapéutica posible (incluya automedicación, fitoterapia y suplementos) y compárela con la prescripción de ingreso. Toda diferencia es una <b>discrepancia</b>; si no tiene justificación clínica es un <b>error de conciliación</b> que debe resolverse con el prescriptor. Escriba la indicación usando el nombre del diagnóstico para que la app relacione medicamento y problema de salud.') +
    `<section class="card"><div class="stats">
      <div class="stat"><span>Medicamentos registrados</span><b>${S.meds.filter(m => m.nombre.trim()).length}</b><small>Domiciliarios y hospitalarios</small></div>
      <div class="stat ${act.length >= 10 ? 'red' : act.length >= 5 ? 'amber' : ''}"><span>Activos</span><b>${act.length}</b><small>${polyCat(act.length)}</small></div>
      <div class="stat ${conDisc ? 'red' : 'green'}"><span>Discrepancias no justificadas</span><b>${conDisc}</b><small>Errores de conciliación</small></div>
      <div class="stat ${pend ? 'amber' : 'green'}"><span>Sin decisión</span><b>${pend}</b><small>Domiciliarios pendientes</small></div>
    </div></section>
    <section class="card">${datalist('dl-dx', dxNames())}
    ${tableEd('meds', [
      { k: 'nombre', l: 'Medicamento (DCI)', w: '170px', after: (r, i) => `<div data-hr="${i}">${hrHtml(r)}</div>` },
      { k: 'casa', l: 'Domicilio: dosis, vía, frecuencia', t: 'area', w: '170px' },
      { k: 'hosp', l: 'Actual / ingreso: dosis, vía, frecuencia', t: 'area', w: '170px' },
      { k: 'fuente', l: 'Fuente', t: 'select', o: OPT.fuente, w: '140px' },
      { k: 'indicacion', l: 'Indicación (Dx)', w: '170px', list: 'dl-dx' },
      { k: 'decision', l: 'Decisión', t: 'select', o: OPT.decision, w: '150px', re: true },
      { k: 'discrepancia', l: 'Discrepancia', t: 'select', o: OPT.discrepancia, w: '180px', re: true },
      { k: 'justificacion', l: 'Justificación clínica', t: 'area', w: '220px' },
      { k: 'alta', l: 'Notas para el alta', t: 'area', w: '170px' },
      { k: 'altoRiesgo', l: 'Alto riesgo', t: 'check', w: '80px', cl: 'Sí' }
    ], { add: 'Agregar medicamento' })}</section>`;
}
function hrHtml(m) { return m.nombre.trim() && isHighRisk(m) ? '<span class="flag hr">Alto riesgo</span>' : ''; }

function secCribado() {
  const act = activeMeds();
  if (!act.length) return secHead('Evaluación sistemática', '12 preguntas por medicamento') + `<section class="card empty">Agregue medicamentos activos en <b>Conciliación</b> para evaluarlos.</section>`;
  const cell = (m, qi, malo) => {
    const k = `${m.id}|${qi}`, v = S.cribado[k] || '';
    const cls = !v ? '' : v === 'FI' ? 'fi' : v === malo ? 'bad' : 'good';
    return `<td class="ans ${cls}"><select data-bind="cribado.${k}" data-re><option value="">—</option>${['Sí', 'No', 'FI'].map(x => `<option${x === v ? ' selected' : ''}>${x}</option>`).join('')}</select></td>`;
  };
  return secHead('Evaluación sistemática', '12 preguntas por medicamento activo') +
    hint('<b>Evaluar:</b> responda cada pregunta para cada medicamento (Sí / No / <b>FI</b> = falta información). Las respuestas en rojo indican un posible PRM y aparecen como alertas en <b>PRM e intervenciones</b>, desde donde puede registrarlo con un clic.') +
    `<section class="card"><div class="tbl-wrap"><table class="ed mx"><thead><tr><th class="q">Pregunta</th>${act.map(m => `<th>${esc(m.nombre)}</th>`).join('')}</tr></thead><tbody>
    ${PREGUNTAS.map(([q, malo], qi) => `<tr><td>${qi + 1}. ${q}</td>${act.map(m => cell(m, qi, malo)).join('')}</tr>`).join('')}
    <tr><td><b>Comentario</b></td>${act.map(m => `<td>${control(`cribado.${m.id}|c`, 'area', { ph: 'Observaciones' })}</td>`).join('')}</tr>
    </tbody></table></div></section>`;
}

function secPrm() {
  lastAlerts = computeAlerts();
  const alertsHtml = lastAlerts.length ? `<div class="alerts">${lastAlerts.map((a, i) => `<div class="alert ${a.nivel}"><span class="lvl">${a.nivel}</span><span class="txt"><span class="tipo">${esc(a.tipo)}</span>${esc(a.msg)}</span>${a.prm ? `<button class="btn small" data-act="prm-alert" data-i="${i}">Registrar PRM</button>` : ''}</div>`).join('')}</div>`
    : '<p class="muted">Sin alertas con los datos actuales.</p>';
  const cards = S.prm.map((r, i) => prmCard(r, i)).join('') || '<section class="card empty">Aún no hay PRM registrados. Use “Registrar PRM” en una alerta o agregue uno manualmente.</section>';
  return secHead('PRM e intervenciones', 'Identificar, prevenir y resolver (Assess → Plan → Implement)') +
    hint('<b>PRM:</b> clasifique según el taller (Indicación, Efectividad, Seguridad, Adherencia), con su tipo y causa. Opcionalmente asigne el <b>RNM</b> del Tercer Consenso de Granada. Las alertas automáticas son <b>orientativas</b>: confírmelas siempre en Micromedex, Lexicomp, UpToDate o guías antes de intervenir.') +
    `<section class="card"><div class="card-head"><h3>Alertas automáticas (${lastAlerts.length})</h3><span class="muted">Se recalculan con cada cambio</span></div>${alertsHtml}</section>
    ${datalist('dl-meds', medNames())}${cards}
    <button class="btn add" data-add="prm">+ Agregar PRM</button>`;
}
function prmCard(r, i) {
  const b = `prm.${i}.`, tipos = r.categoria ? Object.keys(PRM_TAX[r.categoria] || {}) : [];
  const causas = r.categoria && r.tipo ? (PRM_TAX[r.categoria]?.[r.tipo] || []) : [];
  return `<section class="card prm-card sev-${esc(r.severidad)}">
    <div class="card-head"><h4>PRM-${pad2(i + 1)} ${r.categoria ? `<span class="badge blue">${esc(r.categoria)}</span>` : ''} ${r.prioridad ? `<span class="badge ${r.prioridad === 'Alta' ? 'red' : r.prioridad === 'Media' ? 'amber' : 'green'}">Prioridad ${esc(r.prioridad.toLowerCase())}</span>` : ''}</h4>
    <button class="x" data-del="prm.${i}" title="Eliminar PRM" aria-label="Eliminar PRM">×</button></div>
    <div class="subhead">Identificación</div>
    <div class="grid g4">
      ${field(b + 'med', 'Medicamento(s) implicado(s)', 'text', { list: 'dl-meds' })}
      ${field(b + 'categoria', 'Categoría', 'select', { o: Object.keys(PRM_TAX), re: true })}
      ${field(b + 'tipo', 'Tipo', 'select', { o: tipos, re: true })}
      ${field(b + 'causa', 'Causa', 'select', { o: causas })}
      ${field(b + 'descripcion', 'Descripción del PRM', 'area', { cls: 'span2', rows: 2 })}
      ${field(b + 'evidencia', 'Evidencia (S/O: síntoma, signo, paraclínico)', 'area', { cls: 'span2', rows: 2 })}
      ${field(b + 'estado', 'Real / potencial', 'select', { o: OPT.estadoPrm })}
      ${field(b + 'severidad', 'Severidad', 'select', { o: OPT.sevPrm, re: true })}
      ${field(b + 'prioridad', 'Prioridad', 'select', { o: OPT.prioridad, re: true })}
      ${field(b + 'rnm', 'RNM (Consenso de Granada)', 'select', { o: RNM_OPTS })}
    </div>
    <div class="subhead">Plan e intervención</div>
    <div class="grid g4">
      ${field(b + 'objetivo', 'Objetivo farmacoterapéutico', 'area', { cls: 'span2' })}
      ${field(b + 'intervencion', 'Intervención propuesta (fármaco, dosis, vía, frecuencia, duración)', 'area', { cls: 'span2' })}
      ${field(b + 'tipoInt', 'Tipo de intervención', 'select', { o: OPT.tipoInt })}
      ${field(b + 'comunicado', 'Comunicada a', 'select', { o: OPT.comunicado })}
      ${field(b + 'aceptada', 'Aceptación', 'select', { o: OPT.aceptada })}
      ${field(b + 'cumplido', '¿Se cumplió el objetivo?', 'select', { o: OPT.cumplido })}
      ${field(b + 'parametro', 'Parámetro de monitoreo', 'text')}
      ${field(b + 'meta', 'Resultado esperado', 'text')}
      ${field(b + 'frecuencia', 'Frecuencia de monitoreo', 'text', { cls: 'span2' })}
    </div></section>`;
}

function secPaf() {
  return secHead('Plan de atención farmacéutica', 'Un PAF por cada problema de salud') +
    hint('<b>Planificar:</b> el objetivo farmacoterapéutico debe ser medible y con plazo (curar, reducir síntomas, detener la progresión, prevenir, normalizar laboratorios o apoyar el diagnóstico). Los planes de cada PRM se registran en su tarjeta.') +
    `<section class="card"><div class="card-head"><h3>PAF por diagnóstico</h3><button class="btn small" data-act="paf-fill">Precargar desde diagnósticos</button></div>
    ${datalist('dl-dx', dxNames())}
    ${tableEd('paf', [
      { k: 'dx', l: 'Problema de salud', w: '180px', list: 'dl-dx' },
      { k: 'oft', l: 'Objetivo farmacoterapéutico (medible, con plazo)', t: 'area', w: '220px' },
      { k: 'terapia', l: 'Terapia recomendada (farmacológica y no farmacológica)', t: 'area', w: '260px' },
      { k: 'parametro', l: 'Parámetro de monitoreo', t: 'area', w: '170px' },
      { k: 'meta', l: 'Resultado esperado', t: 'area', w: '150px' },
      { k: 'frecuencia', l: 'Frecuencia', t: 'area', w: '130px' }
    ], { add: 'Agregar PAF' })}</section>`;
}

function secMonit() {
  const cols = [
    { k: 'parametro', l: 'Parámetro', w: '160px' },
    { k: 'meta', l: 'Meta', w: '120px' },
    { k: 'frecuencia', l: 'Frecuencia', w: '120px' },
    ...[1, 2, 3, 4, 5, 6].map(n => ({ k: 'r' + n, l: `Registro ${n}`, w: '120px', ph: 'fecha – valor' }))
  ];
  return secHead('Monitoreo y seguimiento', 'Follow-up: monitorear y evaluar') +
    hint('<b>Seguir:</b> registre los valores de cada parámetro en el tiempo (fecha – valor) para evaluar si se cumplen los objetivos del PAF y de los PRM.') +
    `<section class="card"><div class="card-head"><h3>Tabla de monitoreo</h3><button class="btn small" data-act="monit-fill">Precargar desde PAF y PRM</button></div>${tableEd('monitoreo', cols, { add: 'Agregar parámetro' })}</section>`;
}

function secEgreso() {
  return secHead('Plan de egreso', 'Educación y horario optimizado') +
    hint('<b>Egreso:</b> organice los horarios según los hábitos del paciente y evitando interacciones (p. ej., separar levotiroxina de calcio, hierro e IBP). Use lenguaje sencillo para el paciente o cuidador.') +
    `<section class="card"><div class="card-head"><h3>Medicamentos al egreso</h3><button class="btn small" data-act="egreso-fill">Precargar medicamentos activos</button></div>
    ${tableEd('egreso', [
      { k: 'med', l: 'Medicamento', w: '160px' },
      { k: 'dosis', l: 'Dosis', w: '120px' },
      { k: 'horario', l: '¿A qué hora tomarlo?', t: 'area', w: '150px' },
      { k: 'paraQue', l: '¿Para qué sirve?', t: 'area', w: '170px' },
      { k: 'ram', l: 'Efectos adversos importantes', t: 'area', w: '190px' },
      { k: 'consultar', l: '¿Cuándo consultar al médico?', t: 'area', w: '190px' }
    ], { add: 'Agregar medicamento' })}</section>
    <section class="card"><h3>Recomendaciones generales</h3><div class="grid g3">
      ${field('recomendaciones.dieta', 'Dieta y estilo de vida', 'area', { rows: 4 })}
      ${field('recomendaciones.alarma', 'Señales de alarma (ir a urgencias si…)', 'area', { rows: 4 })}
      ${field('recomendaciones.medicamentos', 'Uso de medicamentos', 'area', { rows: 4 })}
    </div></section>`;
}

function secSoap() {
  return secHead('Nota farmacéutica SOAP', 'Seguimiento farmacoterapéutico diario') +
    hint('<b>Nota SOAP:</b> “Generar borrador” arma la nota con los datos registrados (síntesis, paraclínicos alterados, polifarmacia, PRM e intervenciones). Después edítela con su juicio clínico.') +
    `<section class="card"><div class="card-head"><h3>Nota</h3><button class="btn small primary" data-act="soap-gen">Generar borrador desde los datos</button></div>
    <div class="grid g2">
      ${field('soap.s', 'S — Subjetivo', 'area', { rows: 5 })}
      ${field('soap.o', 'O — Objetivo', 'area', { rows: 5 })}
      ${field('soap.a', 'A — Análisis / evaluación farmacoterapéutica', 'area', { rows: 6 })}
      ${field('soap.p', 'P — Plan farmacéutico', 'area', { rows: 6 })}
    </div></section>`;
}

function summaryStats() {
  const act = activeMeds(), al = computeAlerts(), c = calc();
  const byCat = Object.keys(PRM_TAX).map(k => `${k}: ${S.prm.filter(p => p.categoria === k).length}`).join(' · ');
  const t = (l, v, s, cls = '') => `<div class="stat ${cls}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`;
  const noJust = S.meds.filter(m => DISC_NO_JUST.includes(m.discrepancia)).length;
  const altas = al.filter(a => a.nivel === 'alta').length;
  const labsAlt = S.labs.filter(l => ['Alto', 'Bajo'].includes(labFlag(l))).length;
  const acept = S.prm.filter(p => p.aceptada === 'Aceptada' || p.aceptada === 'Aceptada parcialmente').length;
  return `<div class="stats">
    ${t('Medicamentos activos', act.length, polyCat(act.length), act.length >= 10 ? 'red' : act.length >= 5 ? 'amber' : '')}
    ${t('Errores de conciliación', noJust, 'Discrepancias no justificadas', noJust ? 'red' : 'green')}
    ${t('PRM registrados', S.prm.length, byCat || '—')}
    ${t('Intervenciones aceptadas', `${acept}/${S.prm.length}`, 'Total o parcialmente')}
    ${t('Alertas de nivel alto', altas, 'Pendientes de revisar', altas ? 'red' : 'green')}
    ${t('Paraclínicos alterados', labsAlt, `de ${S.labs.length} registrados`, labsAlt ? 'amber' : '')}
    ${t('CrCl de dosificación', c.crclUso ? c.crclUso.toFixed(0) + ' mL/min' : '—', c.crclUso ? renalCat(c.crclUso) : 'Sin datos')}
  </div>`;
}

function secInforme() {
  return secHead('Informe y exportación', 'Resumen del análisis farmacoterapéutico') +
    hint('<b>Cierre:</b> revise el resumen y la vista previa. En modo “En formación”, el tutor registra aquí su revisión. Exporte a Word para editar, a PDF para archivar o a JSON para guardar el caso y retomarlo después.') +
    `<section class="card"><h3>Resumen</h3>${summaryStats()}</section>
    <section class="card only-formacion"><h3>Revisión del tutor</h3><div class="grid g4">
      ${field('revision.estado', 'Estado', 'select', { o: OPT.revision })}
      ${field('revision.comentarios', 'Retroalimentación del tutor', 'area', { cls: 'span3', rows: 3 })}
    </div></section>
    <section class="card"><div class="card-head"><h3>Exportar análisis</h3></div>
      <div class="top-actions">
        <button class="btn primary" data-act="export-word">Word (.doc)</button>
        <button class="btn" data-act="export-pdf">PDF / Imprimir</button>
        <button class="btn" data-act="export-csv">PRM en Excel (.csv)</button>
        <button class="btn" data-act="export-json">Respaldo del caso (.json)</button>
      </div></section>
    <section class="card"><h3>Vista previa</h3><div class="report-preview">${buildReport()}</div></section>`;
}

const SECS = [
  { id: 'paciente', t: 'Datos del paciente', r: secPaciente, b: () => S.paciente.edad && S.paciente.peso ? ['✓', 'green'] : null },
  { id: 'dx', t: 'Diagnósticos', r: secDx, b: () => S.dx.length ? [S.dx.length] : null },
  { id: 'labs', t: 'Paraclínicos', r: secLabs, b: () => { const n = S.labs.filter(l => ['Alto', 'Bajo'].includes(labFlag(l))).length; return S.labs.length ? [n ? `${n} alt.` : S.labs.length, n ? 'amber' : ''] : null; } },
  { id: 'concil', t: 'Conciliación', r: secConcil, b: () => { const n = S.meds.filter(m => DISC_NO_JUST.includes(m.discrepancia)).length; return S.meds.length ? [n ? `${n} error` : S.meds.length, n ? 'red' : ''] : null; } },
  { id: 'cribado', t: 'Evaluación sistemática', r: secCribado, b: () => { const a = activeMeds(); if (!a.length) return null; const tot = a.length * 12, done = a.reduce((s, m) => s + PREGUNTAS.filter((_, q) => S.cribado[`${m.id}|${q}`]).length, 0); return [`${Math.round(done / tot * 100)}%`, done === tot ? 'green' : '']; } },
  { id: 'prm', t: 'PRM e intervenciones', r: secPrm, b: () => { const al = computeAlerts().filter(a => a.nivel === 'alta').length; return al ? [`${al} alertas`, 'red'] : S.prm.length ? [S.prm.length, 'blue'] : null; } },
  { id: 'paf', t: 'Plan de atención (PAF)', r: secPaf, b: () => S.paf.length ? [S.paf.length] : null },
  { id: 'monit', t: 'Monitoreo', r: secMonit, b: () => S.monitoreo.length ? [S.monitoreo.length] : null },
  { id: 'egreso', t: 'Plan de egreso', r: secEgreso, b: () => S.egreso.length ? [S.egreso.length] : null },
  { id: 'soap', t: 'Nota SOAP', r: secSoap, b: () => S.soap.a || S.soap.p ? ['✓', 'green'] : null },
  { id: 'informe', t: 'Informe y exportación', r: secInforme, b: () => null }
];

/* ───────────────────────── Render ───────────────────────── */

function renderNav() {
  $('#nav').innerHTML = SECS.map((s, i) => { const b = s.b(); return `<button data-nav="${s.id}" class="${UI.sec === s.id ? 'on' : ''}"><span class="num">${i + 1}</span><span class="lbl">${s.t}</span>${b ? `<span class="badge ${b[1] || ''}">${b[0]}</span>` : ''}</button>`; }).join('');
}
function renderHeader() {
  const p = S.paciente;
  $('#patientChip').textContent = p.nombre ? `${p.nombre}${p.edad ? ' · ' + p.edad + ' a' : ''}${p.sexo ? ' · ' + p.sexo[0] : ''}${p.servicio ? ' · ' + p.servicio : ''}` : 'Sin paciente';
  document.body.classList.toggle('experto', UI.modo === 'experto');
  $('#mFormacion').classList.toggle('on', UI.modo !== 'experto');
  $('#mExperto').classList.toggle('on', UI.modo === 'experto');
}
function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
function render(keepScroll = true) {
  const y = window.scrollY;
  const sec = SECS.find(s => s.id === UI.sec) || SECS[0];
  const idx = SECS.indexOf(sec);
  $('#main').innerHTML = sec.r() + `<div class="sec-foot">${idx > 0 ? `<button class="btn" data-nav="${SECS[idx - 1].id}">← ${SECS[idx - 1].t}</button>` : '<span></span>'}${idx < SECS.length - 1 ? `<button class="btn primary" data-nav="${SECS[idx + 1].id}">${SECS[idx + 1].t} →</button>` : ''}</div>`;
  $$('#main textarea').forEach(autosize);
  renderNav(); renderHeader();
  if (keepScroll) window.scrollTo(0, y);
}
let liveTimer;
function updateLive() {
  renderHeader();
  if ($('#calcBox')) $('#calcBox').innerHTML = calcHtml();
  $$('[data-labflag]').forEach(el => { el.innerHTML = flagHtml(S.labs[+el.dataset.labflag] || {}); });
  $$('[data-hr]').forEach(el => { const m = S.meds[+el.dataset.hr]; el.innerHTML = m ? hrHtml(m) : ''; });
  clearTimeout(liveTimer); liveTimer = setTimeout(renderNav, 250);
}
function go(id) { UI.sec = id; store(UI_KEY, UI); render(false); window.scrollTo(0, 0); }

/* ───────────────────────── Acciones ───────────────────────── */

function genSoap() {
  const p = S.paciente, c = calc(), act = activeMeds();
  const alt = S.labs.filter(l => ['Alto', 'Bajo'].includes(labFlag(l)));
  const hr = act.filter(isHighRisk).map(m => m.nombre);
  const sv = [p.pas && p.pad && `PA ${p.pas}/${p.pad} mmHg`, p.fc && `FC ${p.fc} lpm`, p.fr && `FR ${p.fr} rpm`, p.temp && `T ${p.temp} °C`, p.sat && `SatO₂ ${p.sat} %`, p.dolor && `EVA ${p.dolor}/10`].filter(Boolean).join(', ');
  const s = [p.motivo && `Motivo de valoración: ${p.motivo}`, p.enfermedadActual, p.habitos && `Hábitos: ${p.habitos}`, p.social && `Contexto: ${p.social}`].filter(Boolean).join('\n');
  const o = [
    `Paciente ${(p.sexo || '').toLowerCase()} de ${p.edad || '—'} años, peso ${p.peso || '—'} kg, talla ${p.talla || '—'} cm${c.imc ? `, IMC ${c.imc.toFixed(1)} (${imcCat(c.imc)})` : ''}.`,
    `Alergias: ${p.alergias || 'no registradas'}.`,
    sv && `Signos vitales: ${sv}.`,
    p.scr && `Función renal: creatinina ${p.scr} mg/dL${c.crclUso ? `, CrCl estimado ${c.crclUso.toFixed(0)} mL/min (${renalCat(c.crclUso)})` : ''}.`,
    p.hepatica && `Función hepática: ${p.hepatica}.`,
    alt.length && `Paraclínicos alterados: ${alt.map(l => `${l.nombre} ${l.valor}${l.unidad ? ' ' + l.unidad : ''} (${labFlag(l).toLowerCase()})`).join('; ')}.`,
    `Medicamentos actuales (${act.length}): ${act.map(m => `${m.nombre} ${m.hosp || m.casa}`.trim()).join('; ') || '—'}.`,
    hr.length && `Medicamentos de alto riesgo: ${hr.join(', ')}.`
  ].filter(Boolean).join('\n');
  const dxTxt = S.dx.filter(d => d.nombre).map(d => `${d.nombre}${[d.curso, d.severidad, d.control].filter(Boolean).length ? ' (' + [d.curso, d.severidad, d.control].filter(Boolean).join(', ').toLowerCase() + ')' : ''}`).join('; ');
  const a = [
    S.sintesis.agudos && `Problemas agudos: ${S.sintesis.agudos}`,
    S.sintesis.cronicos && `Problemas crónicos clave: ${S.sintesis.cronicos}`,
    dxTxt && `Diagnósticos: ${dxTxt}.`,
    `Polifarmacia: ${act.length} medicamentos — ${polyCat(act.length)}.`,
    `Número de PRM identificados: ${S.prm.length}.`,
    ...S.prm.map((r, i) => `PRM-${pad2(i + 1)}: ${r.descripcion || '—'} Categoría: ${r.categoria || '—'}${r.tipo ? ' / ' + r.tipo : ''}. Causa: ${r.causa || '—'}. Severidad: ${r.severidad || '—'}. Prioridad: ${r.prioridad || '—'}.`)
  ].filter(Boolean).join('\n');
  let n = 0;
  const pl = [
    ...S.prm.filter(r => r.intervencion).map(r => `${++n}. ${r.intervencion}${r.parametro ? ` Monitorizar: ${r.parametro}${r.meta ? ` (meta: ${r.meta})` : ''}${r.frecuencia ? `, ${r.frecuencia}` : ''}.` : ''}`),
    ...S.paf.filter(x => x.terapia).map(x => `${++n}. ${x.dx ? x.dx + ': ' : ''}${x.terapia}${x.oft ? ` Objetivo: ${x.oft}.` : ''}`),
    S.egreso.filter(e => e.med).length && `${++n}. Educación al paciente/cuidador sobre: ${S.egreso.map(e => e.med).filter(Boolean).join(', ')}.`
  ].filter(Boolean).join('\n');
  return { s, o, a, p: pl };
}

function addRow(key, data) { S[key].push({ ...ROW[key](), ...(data || {}) }); touch(); }

const ACTIONS = {
  mode(btn) { UI.modo = btn.dataset.mode; store(UI_KEY, UI); renderHeader(); toast(UI.modo === 'experto' ? 'Modo formado: se ocultan las guías' : 'Modo en formación: guías y revisión del tutor visibles'); },
  new() { if (!confirm('¿Iniciar un caso nuevo? Se borrará el caso actual de este navegador (exporte un respaldo .json si lo necesita).')) return; S = hydrate(null); store(STORE_KEY, S); go('paciente'); toast('Caso nuevo'); },
  example() { if (!confirm('¿Cargar el caso de ejemplo? Reemplaza el caso actual.')) return; S = hydrate(exampleCase()); store(STORE_KEY, S); go('concil'); toast('Caso de ejemplo cargado (ficticio)'); },
  import() { $('#fileIn').click(); },
  'export-json'() { download(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), fileBase() + '.json'); },
  'export-word'() { download(new Blob(['﻿', wordDoc()], { type: 'application/msword' }), fileBase() + '.doc'); toast('Informe Word descargado'); },
  'export-pdf'() { $('#print-area').innerHTML = buildReport(); $('details.menu')?.removeAttribute('open'); setTimeout(() => window.print(), 50); },
  'export-csv'() { download(new Blob(['﻿' + prmCsv()], { type: 'text/csv;charset=utf-8' }), fileBase() + '_PRM.csv'); },
  'prm-alert'(btn) {
    const a = lastAlerts[+btn.dataset.i]; if (!a) return;
    addRow('prm', a.prm); render(); toast(`PRM-${pad2(S.prm.length)} registrado. Complete severidad, prioridad e intervención.`);
    const cards = $$('.prm-card'); cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'soap-gen'() {
    if ((S.soap.s || S.soap.o || S.soap.a || S.soap.p) && !confirm('¿Reemplazar la nota actual por un borrador nuevo?')) return;
    S.soap = genSoap(); touch(); render(); toast('Borrador generado: revíselo y edítelo');
  },
  'egreso-fill'() {
    const ya = new Set(S.egreso.map(e => norm(e.med))); let n = 0;
    activeMeds().forEach(m => { if (!ya.has(norm(m.nombre))) { addRow('egreso', { med: m.nombre, dosis: m.hosp || m.casa, paraQue: m.indicacion }); n++; } });
    render(); toast(n ? `${n} medicamentos agregados` : 'No hay medicamentos nuevos para agregar');
  },
  'paf-fill'() {
    const ya = new Set(S.paf.map(e => norm(e.dx))); let n = 0;
    S.dx.filter(d => d.nombre.trim() && d.estado !== 'Resuelto').forEach(d => { if (!ya.has(norm(d.nombre))) { addRow('paf', { dx: d.nombre }); n++; } });
    render(); toast(n ? `${n} diagnósticos agregados` : 'Todos los diagnósticos ya tienen PAF');
  },
  'monit-fill'() {
    const ya = new Set(S.monitoreo.map(e => norm(e.parametro))); let n = 0;
    [...S.paf.map(x => [x.parametro, x.meta, x.frecuencia]), ...S.prm.map(x => [x.parametro, x.meta, x.frecuencia])].forEach(([pm, meta, fr]) => {
      if (pm && pm.trim() && !ya.has(norm(pm))) { ya.add(norm(pm)); addRow('monitoreo', { parametro: pm, meta, frecuencia: fr }); n++; }
    });
    render(); toast(n ? `${n} parámetros agregados` : 'No hay parámetros nuevos en PAF o PRM');
  }
};

function fileBase() {
  const p = S.paciente, id = (p.documento || p.nombre || 'caso').replace(/[^\w\-]+/g, '_').slice(0, 40);
  return `HCF_${id}_${p.fechaValoracion || today()}`;
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  $('details.menu')?.removeAttribute('open');
}
function prmCsv() {
  const cols = [['N.º', (r, i) => `PRM-${pad2(i + 1)}`], ['Medicamento', 'med'], ['Categoría', 'categoria'], ['Tipo', 'tipo'], ['Causa', 'causa'], ['Real/potencial', 'estado'], ['RNM', 'rnm'], ['Descripción', 'descripcion'], ['Evidencia', 'evidencia'], ['Severidad', 'severidad'], ['Prioridad', 'prioridad'], ['Objetivo', 'objetivo'], ['Intervención', 'intervencion'], ['Tipo de intervención', 'tipoInt'], ['Comunicada a', 'comunicado'], ['Aceptación', 'aceptada'], ['Parámetro', 'parametro'], ['Resultado esperado', 'meta'], ['Frecuencia', 'frecuencia'], ['Objetivo cumplido', 'cumplido']];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.map(c => q(c[0])).join(';'), ...S.prm.map((r, i) => cols.map(c => q(typeof c[1] === 'function' ? c[1](r, i) : r[c[1]])).join(';'))].join('\r\n');
}

/* ───────────────────────── Informe ───────────────────────── */

const REPORT_CSS = `body{font-family:"Segoe UI",Arial,sans-serif;font-size:10pt;color:#111}
h1{font-size:16pt;color:#0f766e;margin:0 0 4pt}h2{font-size:12pt;color:#0f766e;border-bottom:1.5pt solid #0f766e;margin:14pt 0 5pt;padding-bottom:2pt}
table{border-collapse:collapse;width:100%;margin:3pt 0 8pt}th,td{border:1px solid #999;padding:3pt 5pt;vertical-align:top;text-align:left;font-size:9pt}
th{background:#e6f2f0}.muted{color:#666}.kv td:first-child{width:28%;font-weight:bold;background:#f5f7f8}.disc{font-size:8pt;color:#666;margin-top:16pt}`;

function buildReport() {
  const p = S.paciente, c = calc(), act = activeMeds(), al = computeAlerts();
  const T = (heads, rows) => rows.length ? `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${nl(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="muted">Sin registros.</p>';
  const KV = rows => `<table class="kv"><tbody>${rows.filter(r => r[1]).map(r => `<tr><td>${r[0]}</td><td>${nl(r[1])}</td></tr>`).join('')}</tbody></table>`;
  const sv = [p.pas && p.pad && `PA ${p.pas}/${p.pad} mmHg`, p.fc && `FC ${p.fc} lpm`, p.fr && `FR ${p.fr} rpm`, p.temp && `T ${p.temp} °C`, p.sat && `SatO₂ ${p.sat} %`, p.dolor && `EVA ${p.dolor}/10`].filter(Boolean).join(' · ');
  const crib = act.filter(m => PREGUNTAS.some((_, q) => S.cribado[`${m.id}|${q}`]));
  let n = 0; const H = t => `<h2>${++n}. ${t}</h2>`;
  return `<div class="rep">
  <h1>Historia clínica farmacéutica</h1>
  <p class="muted">${esc(p.institucion || '')}${p.institucion ? ' · ' : ''}Valoración: ${esc(p.fechaValoracion || '—')} · Químico farmacéutico: ${esc(p.farmaceutico || '—')} (${esc(p.rol || '—')})${p.tutor ? ' · Tutor: ' + esc(p.tutor) : ''}</p>
  ${H('Identificación y datos clínicos')}
  ${KV([['Paciente', p.nombre], ['Documento / historia', p.documento], ['Edad / sexo', [p.edad && p.edad + ' años', p.sexo].filter(Boolean).join(' · ')], ['Servicio / cama', [p.servicio, p.cama].filter(Boolean).join(' · ')], ['Aseguradora', p.aseguradora], ['Fecha de ingreso', p.fechaIngreso], ['Embarazo / lactancia', p.gestacion],
    ['Peso / talla / IMC', [p.peso && p.peso + ' kg', p.talla && p.talla + ' cm', c.imc && `IMC ${c.imc.toFixed(1)} (${imcCat(c.imc)})`].filter(Boolean).join(' · ')],
    ['Función renal', p.scr && `Creatinina ${p.scr} mg/dL${c.crcl ? ` · CrCl (peso real) ${c.crcl.toFixed(0)} mL/min` : ''}${c.crclDos ? ` · CrCl (${c.crclLbl}) ${c.crclDos.toFixed(0)} mL/min — ${renalCat(c.crclDos)}` : ''}`],
    ['Función hepática', p.hepatica], ['Signos vitales', sv], ['Motivo de consulta', p.motivo], ['Enfermedad actual', p.enfermedadActual], ['Antecedentes', p.antecedentes], ['Alergias', p.alergias || 'No registradas'], ['Hábitos', p.habitos], ['Determinantes sociales', p.social]])}
  ${H('Síntesis y priorización')}
  ${KV([['Problemas agudos / activos', S.sintesis.agudos], ['Problemas crónicos clave', S.sintesis.cronicos], ['Estables (conciliación y vigilancia)', S.sintesis.estables]]) || ''}
  ${H('Problemas de salud')}
  ${T(['Diagnóstico', 'CIE-10', 'Curso', 'Severidad', 'Control', 'Estado', 'Hallazgos del paciente', 'Factores de riesgo'], S.dx.map(d => [d.nombre, d.cie, d.curso, d.severidad, d.control, d.estado, d.hallazgos, d.factores]))}
  ${H('Paraclínicos')}
  ${T(['Paraclínico', 'Valor', 'Referencia', 'Estado', 'Fecha', 'Asociación', 'Interpretación e implicación'], S.labs.map(l => [l.nombre, `${l.valor} ${l.unidad}`.trim(), [l.min, l.max].filter(x => x !== '').join(' – '), labFlag(l), l.fecha, l.asociacion, l.interpretacion]))}
  ${H('Conciliación de medicamentos')}
  <p>Medicamentos activos: <b>${act.length}</b> (${polyCat(act.length)}). Discrepancias no justificadas: <b>${S.meds.filter(m => DISC_NO_JUST.includes(m.discrepancia)).length}</b>. Alto riesgo: ${esc(act.filter(isHighRisk).map(m => m.nombre).join(', ') || 'ninguno')}.</p>
  ${T(['Medicamento', 'Domicilio', 'Actual / ingreso', 'Fuente', 'Indicación', 'Decisión', 'Discrepancia', 'Justificación', 'Notas para el alta'], S.meds.filter(m => m.nombre.trim()).map(m => [m.nombre + (isHighRisk(m) ? ' (alto riesgo)' : ''), m.casa, m.hosp, m.fuente, m.indicacion, m.decision, m.discrepancia, m.justificacion, m.alta]))}
  ${crib.length ? H('Evaluación sistemática por medicamento') + `<table><thead><tr><th>Pregunta</th>${crib.map(m => `<th>${esc(m.nombre)}</th>`).join('')}</tr></thead><tbody>${PREGUNTAS.map(([q], qi) => `<tr><td>${qi + 1}. ${esc(q)}</td>${crib.map(m => `<td>${esc(S.cribado[`${m.id}|${qi}`] || '')}</td>`).join('')}</tr>`).join('')}<tr><td><b>Comentario</b></td>${crib.map(m => `<td>${nl(S.cribado[m.id + '|c'] || '')}</td>`).join('')}</tr></tbody></table>` : ''}
  ${H('Problemas relacionados con medicamentos (PRM)')}
  <p>Total de PRM: <b>${S.prm.length}</b>${S.prm.length ? ' — ' + Object.keys(PRM_TAX).map(k => `${k}: ${S.prm.filter(x => x.categoria === k).length}`).join(' · ') : ''}.</p>
  ${T(['N.º', 'Medicamento', 'Clasificación', 'Descripción y evidencia', 'Severidad / prioridad', 'RNM'], S.prm.map((r, i) => [`PRM-${pad2(i + 1)}`, r.med, [r.categoria, r.tipo, r.causa].filter(Boolean).join(' › ') + (r.estado ? ` (${r.estado.toLowerCase()})` : ''), [r.descripcion, r.evidencia && 'Evidencia: ' + r.evidencia].filter(Boolean).join('\n'), [r.severidad, r.prioridad && 'Prioridad ' + r.prioridad.toLowerCase()].filter(Boolean).join(' · '), r.rnm]))}
  ${H('Plan de atención para PRM')}
  ${T(['N.º', 'Objetivo', 'Intervención', 'Tipo / comunicada a', 'Monitoreo (parámetro, meta, frecuencia)', 'Aceptación', '¿Se cumplió?'], S.prm.map((r, i) => [`PRM-${pad2(i + 1)}`, r.objetivo, r.intervencion, [r.tipoInt, r.comunicado].filter(Boolean).join(' · '), [r.parametro, r.meta && 'Meta: ' + r.meta, r.frecuencia].filter(Boolean).join('\n'), r.aceptada, r.cumplido]))}
  ${H('Plan de atención por problema de salud (PAF)')}
  ${T(['Problema de salud', 'Objetivo farmacoterapéutico', 'Terapia recomendada', 'Parámetro', 'Resultado esperado', 'Frecuencia'], S.paf.map(x => [x.dx, x.oft, x.terapia, x.parametro, x.meta, x.frecuencia]))}
  ${H('Monitoreo y seguimiento')}
  ${T(['Parámetro', 'Meta', 'Frecuencia', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'], S.monitoreo.map(x => [x.parametro, x.meta, x.frecuencia, x.r1, x.r2, x.r3, x.r4, x.r5, x.r6]))}
  ${H('Plan de egreso')}
  ${T(['Medicamento', 'Dosis', 'Horario', '¿Para qué sirve?', 'Efectos adversos importantes', '¿Cuándo consultar?'], S.egreso.map(e => [e.med, e.dosis, e.horario, e.paraQue, e.ram, e.consultar]))}
  ${KV([['Dieta y estilo de vida', S.recomendaciones.dieta], ['Señales de alarma', S.recomendaciones.alarma], ['Uso de medicamentos', S.recomendaciones.medicamentos]])}
  ${H('Nota farmacéutica SOAP')}
  ${KV([['S — Subjetivo', S.soap.s], ['O — Objetivo', S.soap.o], ['A — Análisis', S.soap.a], ['P — Plan', S.soap.p]])}
  ${al.length ? H('Alertas automáticas al momento del informe (orientativas)') + T(['Nivel', 'Tipo', 'Alerta'], al.map(a => [a.nivel, a.tipo, a.msg])) : ''}
  ${p.rol === 'En formación' ? H('Revisión del tutor') + KV([['Estado', S.revision.estado], ['Retroalimentación', S.revision.comentarios || '—']]) : ''}
  <table style="margin-top:36pt;border:0"><tr><td style="border:0;border-top:1px solid #333;text-align:center;width:45%">${esc(p.farmaceutico || 'Químico farmacéutico')}<br><span class="muted">${esc(p.rol || '')}</span></td><td style="border:0;width:10%"></td><td style="border:0;border-top:1px solid #333;text-align:center;width:45%">${esc(p.tutor || 'Tutor / supervisor')}<br><span class="muted">Revisión</span></td></tr></table>
  <p class="disc">Generado con HC Farmacéutica el ${new Date().toLocaleString('es-CO')}. Las alertas automáticas son orientativas y no sustituyen el juicio clínico ni la consulta de fuentes especializadas.</p>
  </div>`;
}
function wordDoc() {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Historia clínica farmacéutica</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>@page WordSection1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:1.5cm}div.WordSection1{page:WordSection1}${REPORT_CSS}</style></head>
  <body><div class="WordSection1">${buildReport()}</div></body></html>`;
}

/* ───────────────────────── Caso de ejemplo (ficticio) ───────────────────────── */

function exampleCase() {
  const e = emptyCase();
  Object.assign(e.paciente, {
    nombre: 'Paciente de ejemplo (ficticio)', documento: 'EJ-0001', edad: '72', sexo: 'Femenino', peso: '58', talla: '155', servicio: 'Medicina interna', cama: '304B', aseguradora: 'Ejemplo EPS',
    fechaIngreso: today(-2), fechaValoracion: today(), gestacion: 'No aplica',
    motivo: 'Fiebre, tos productiva y disnea de 3 días de evolución.',
    enfermedadActual: 'Cuadro de 3 días de fiebre no cuantificada, tos con expectoración amarilla y disnea de pequeños esfuerzos. Se automedicó con ibuprofeno. Refiere edema leve de miembros inferiores.',
    antecedentes: 'HTA; diabetes mellitus tipo 2; insuficiencia cardiaca con FEVI 35 %; fibrilación auricular permanente anticoagulada con warfarina; insomnio crónico.',
    alergias: 'Penicilina (exantema en la infancia).',
    habitos: 'No fuma, no consume alcohol. Dieta sin restricción de sal. Sedentaria.',
    social: 'Vive con su hija, que es su cuidadora. Primaria incompleta. Usa pastillero y olvida con frecuencia la dosis de la noche.',
    pas: '104', pad: '62', fc: '98', fr: '24', temp: '38.4', sat: '89', dolor: '2', scr: '1.6', hepatica: 'Normal',
    farmaceutico: 'Estudiante de QF (ejemplo)', rol: 'En formación', tutor: 'QF tutor (ejemplo)', institucion: 'Hospital de ejemplo'
  });
  e.sintesis = {
    agudos: 'Neumonía adquirida en la comunidad con hipoxemia; lesión renal aguda sobre función renal disminuida; INR supraterapéutico.',
    cronicos: 'Insuficiencia cardiaca con FEVI reducida; fibrilación auricular con warfarina; DM2 con metformina.',
    estables: 'HTA (cifras bajas actualmente); insomnio crónico. Se manejan con conciliación y vigilancia.'
  };
  e.dx = [
    { nombre: 'Neumonía adquirida en la comunidad', cie: 'J18.9', curso: 'Agudo', severidad: 'Moderada', control: 'En progresión', estado: 'Activo', hallazgos: 'T 38,4 °C, SatO₂ 89 %, FR 24, leucocitos 15.200, PCR 12 mg/dL, consolidación basal derecha.', factores: 'Edad > 65 años, IC, DM2' },
    { nombre: 'Lesión renal aguda', cie: 'N17.9', curso: 'Agudo', severidad: 'Moderada', control: 'No controlada', estado: 'Activo', hallazgos: 'Creatinina 1,6 mg/dL (basal 1,1); K+ 5,6 mEq/L.', factores: 'AINE, IECA, espironolactona, sepsis' },
    { nombre: 'Insuficiencia cardiaca', cie: 'I50.9', curso: 'Crónico', severidad: 'Moderada', control: 'Controlada', estado: 'Activo', hallazgos: 'Edema leve en miembros inferiores. FEVI 35 %.', factores: 'HTA, FA' },
    { nombre: 'Fibrilación auricular', cie: 'I48.2', curso: 'Crónico', severidad: 'Moderada', control: 'No controlada', estado: 'Activo', hallazgos: 'FC 98 lpm; INR 3,8.', factores: 'Edad, HTA, IC' },
    { nombre: 'Diabetes mellitus tipo 2', cie: 'E11.9', curso: 'Crónico', severidad: 'Moderada', control: 'No controlada', estado: 'Activo', hallazgos: 'Glucemia 210 mg/dL.', factores: 'Sedentarismo' },
    { nombre: 'Hipertensión arterial', cie: 'I10', curso: 'Crónico', severidad: 'Leve', control: 'Controlada', estado: 'Estable', hallazgos: 'PA 104/62 mmHg.', factores: '' },
    { nombre: 'Insomnio', cie: 'G47.0', curso: 'Crónico', severidad: 'Leve', control: 'Controlada', estado: 'Estable', hallazgos: '', factores: '' }
  ].map(d => ({ ...ROW.dx(), ...d }));
  e.labs = [
    ['Creatinina', '1.6', 'mg/dL', '0.5', '1.1', 'Lesión renal aguda', 'Ajustar dosis según CrCl; suspender nefrotóxicos.'],
    ['Potasio', '5.6', 'mEq/L', '3.5', '5.1', 'Enalapril + espironolactona + LRA', 'Suspender espironolactona; controlar K+ diario.'],
    ['INR', '3.8', '', '2', '3', 'Warfarina + claritromicina', 'Omitir dosis y monitorizar INR diario.'],
    ['Glucosa', '210', 'mg/dL', '70', '140', 'Diabetes mellitus tipo 2', 'Esquema de insulina hospitalaria.'],
    ['Leucocitos', '15.2', 'x10³/µL', '4.5', '11', 'Neumonía adquirida en la comunidad', 'Control a las 48–72 h.'],
    ['PCR', '12', 'mg/dL', '0', '0.5', 'Neumonía adquirida en la comunidad', 'Control a las 48–72 h.'],
    ['Hemoglobina', '11.8', 'g/dL', '12', '16', '', 'Vigilar por anticoagulación.']
  ].map(([nombre, valor, unidad, min, max, asociacion, interpretacion]) => ({ ...ROW.labs(), nombre, valor, unidad, min, max, fecha: today(), asociacion, interpretacion }));
  const M = (nombre, casa, hosp, indicacion, decision, discrepancia = '', justificacion = '', fuente = 'Varias fuentes', alta = '') => ({ ...ROW.meds(), nombre, casa, hosp, indicacion, decision, discrepancia, justificacion, fuente, alta });
  e.meds = [
    M('Metformina', '850 mg VO c/12 h', '850 mg VO c/12 h', 'Diabetes mellitus tipo 2', 'Continuar', 'Sin discrepancia'),
    M('Enalapril', '10 mg VO c/12 h', '10 mg VO c/12 h', 'Insuficiencia cardiaca', 'Continuar', 'Sin discrepancia'),
    M('Espironolactona', '25 mg VO c/24 h', '25 mg VO c/24 h', 'Insuficiencia cardiaca', 'Continuar', 'Sin discrepancia'),
    M('Furosemida', '40 mg VO c/24 h', '', 'Insuficiencia cardiaca', ''),
    M('Warfarina', '5 mg VO c/24 h', '5 mg VO c/24 h', 'Fibrilación auricular', 'Continuar', 'Sin discrepancia'),
    M('Alprazolam', '0,5 mg VO noche', '0,5 mg VO noche', 'Insomnio', 'Continuar', 'Sin discrepancia'),
    M('Omeprazol', '20 mg VO c/24 h', '20 mg VO c/24 h', '', 'Continuar', 'Sin discrepancia'),
    M('Ibuprofeno', '400 mg VO c/8 h (automedicación)', '', '', 'Suspender', 'Discrepancia justificada', 'Automedicación; contraindicado por LRA, IC y uso de warfarina.', 'Paciente', 'No reiniciar. Educar sobre analgesia segura.'),
    M('Ceftriaxona', '', '1 g IV c/24 h', 'Neumonía adquirida en la comunidad', 'Iniciar (nuevo)', '', '', 'Historia clínica'),
    M('Claritromicina', '', '500 mg VO c/12 h', 'Neumonía adquirida en la comunidad', 'Iniciar (nuevo)', '', '', 'Historia clínica'),
    M('Enoxaparina', '', '40 mg SC c/24 h', 'Profilaxis TEV', 'Iniciar (nuevo)', '', '', 'Historia clínica')
  ];
  const w = e.meds[4];
  e.cribado[`${w.id}|0`] = 'Sí'; e.cribado[`${w.id}|1`] = 'Sí'; e.cribado[`${w.id}|2`] = 'No'; e.cribado[`${w.id}|7`] = 'Sí';
  e.cribado[`${w.id}|c`] = 'INR 3,8 con claritromicina concomitante.';
  e.prm = [{
    ...ROW.prm(), med: 'Warfarina + Claritromicina', categoria: 'Seguridad', tipo: 'Dosis demasiado alta', causa: 'Interacción con medicamentos', estado: 'Real', rnm: 'Seguridad: inseguridad cuantitativa',
    descripcion: 'INR supraterapéutico por interacción warfarina–claritromicina (inhibición de CYP3A4) en paciente con LRA.', evidencia: 'INR 3,8 (meta 2–3). Hb 11,8 g/dL, sin sangrado activo.',
    severidad: 'Moderada', prioridad: 'Alta', objetivo: 'INR 2–3 sin eventos hemorrágicos.',
    intervencion: 'Omitir la dosis de warfarina hoy y reiniciar con dosis reducida según INR. Sugerir cambiar claritromicina por azitromicina 500 mg VO c/24 h por 3–5 días.', tipoInt: 'Sustituir medicamento', comunicado: 'Médico tratante', aceptada: 'Pendiente',
    parametro: 'INR y signos de sangrado', meta: 'INR 2–3', frecuencia: 'Diario hasta estabilizar', cumplido: 'Pendiente'
  }];
  e.paf = [{ dx: 'Neumonía adquirida en la comunidad', oft: 'Defervescencia y SatO₂ ≥ 92 % en 72 h.', terapia: 'Ceftriaxona 1 g IV c/24 h + macrólido 5–7 días; oxígeno suplementario; reevaluar a las 48–72 h.', parametro: 'Temperatura, SatO₂, FR, leucocitos, PCR', meta: 'T < 37,8 °C; SatO₂ ≥ 92 %; PCR en descenso', frecuencia: 'Signos vitales c/6 h; paraclínicos c/48 h' }];
  e.monitoreo = [
    { ...ROW.monitoreo(), parametro: 'INR', meta: '2–3', frecuencia: 'Diario', r1: `${today()} – 3,8` },
    { ...ROW.monitoreo(), parametro: 'Potasio', meta: '3,5–5,0 mEq/L', frecuencia: 'Diario', r1: `${today()} – 5,6` },
    { ...ROW.monitoreo(), parametro: 'Creatinina', meta: '≤ 1,1 mg/dL', frecuencia: 'Diario', r1: `${today()} – 1,6` }
  ];
  e.recomendaciones = {
    dieta: 'Restringir la sal. Mantener un consumo estable de verduras de hoja verde (vitamina K) para no alterar la warfarina.',
    alarma: 'Ir a urgencias si presenta sangrado (encías, orina, heces negras), dificultad para respirar, fiebre persistente o hinchazón súbita de las piernas.',
    medicamentos: 'No tomar ibuprofeno, naproxeno ni otros antiinflamatorios. No cambiar dosis sin indicación médica. Llevar a los controles el carné de INR.'
  };
  return e;
}

/* ───────────────────────── Eventos ───────────────────────── */

document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.bind) return;
  setPath(t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
  touch();
  if (t.tagName === 'TEXTAREA') autosize(t);
  updateLive();
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.bind) return;
  setPath(t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
  // al cambiar categoría o tipo de PRM se limpian los campos dependientes
  const m = t.dataset.bind.match(/^prm\.(\d+)\.(categoria|tipo)$/);
  if (m) { const r = S.prm[+m[1]]; if (m[2] === 'categoria') { r.tipo = ''; r.causa = ''; } else r.causa = ''; }
  touch();
  if (t.hasAttribute('data-re')) render();
});
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]'); if (nav) return go(nav.dataset.nav);
  const add = e.target.closest('[data-add]'); if (add) { addRow(add.dataset.add); render(); const rows = $$(`[data-bind^="${add.dataset.add}.${S[add.dataset.add].length - 1}."]`); rows[0]?.focus(); return; }
  const del = e.target.closest('[data-del]');
  if (del) {
    const [k, i] = del.dataset.del.split('.'); const row = S[k][+i];
    const filled = row && Object.entries(row).some(([kk, v]) => kk !== 'id' && kk !== 'estado' && kk !== 'aceptada' && kk !== 'cumplido' && v && v !== true);
    if (filled && !confirm('¿Eliminar este registro?')) return;
    S[k].splice(+i, 1); touch(); render(); return;
  }
  const act = e.target.closest('[data-act]'); if (act && ACTIONS[act.dataset.act]) return ACTIONS[act.dataset.act](act);
  const menu = $('details.menu'); if (menu && menu.open && !e.target.closest('details.menu')) menu.removeAttribute('open');
});
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { const data = JSON.parse(rd.result); if (!data || typeof data !== 'object' || !data.paciente) throw new Error('formato'); S = hydrate(data); store(STORE_KEY, S); go('paciente'); toast('Caso cargado'); }
    catch (err) { toast('El archivo no es un respaldo válido de HC Farmacéutica'); }
  };
  rd.readAsText(f); e.target.value = '';
});
window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });

render(false);
