import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Configuración web del proyecto de Firebase (no es secreta: la base solo se puede leer)
const db = getFirestore(initializeApp({
  apiKey: "AIzaSyAQ2IYB4dWpYN9cd2QVOaGM6qV3VNKS1ZE",
  authDomain: "tablero-envios-pncm.firebaseapp.com",
  projectId: "tablero-envios-pncm",
  storageBucket: "tablero-envios-pncm.firebasestorage.app",
  messagingSenderId: "451578736279",
  appId: "1:451578736279:web:fc61c6f9ee23564bee43d2"
}));

const $ = s => document.querySelector(s);
const SHELL = [...document.body.children].filter(n => n.tagName !== 'SCRIPT').map(n => n.outerHTML).join('');
let AC = new AbortController(), app = null, Dact = null;
let mes = null, meta = null, uts = null, montado = false, tEspera = 0, nSus = 0;
let subs = [];
const DET = {}, DETP = {};          // detalle de cada envío (no cambia: se descarga una sola vez)
window.__MESES = []; window.__ENVVIG = {};

function estado(txt, ok) { const e = $('#hVivo'); if (e) e.innerHTML = '<span class="pv' + (ok ? ' ok' : '') + '"></span>' + txt; }
let AVISOS = [];                    // últimos envíos avisados por la recepción (documento tablero/vivo)
const hhmm = t => t.slice(11, 16);
function estadoOk() {
  const D = Dact; if (!D) return;
  const ya = new Set(D.ult || []);
  const nuevos = AVISOS.filter(x => x.per === mes && !ya.has(x.id) && x.t.slice(0, 16) >= (D.corte || ''));
  if (!nuevos.length) { estado('En vivo: la página se actualiza sola con cada envío', true); return; }
  const u = nuevos[0];
  const e = $('#hVivo'); if (!e) return;
  e.innerHTML = '<span class="pv nuevo"></span><span>' + (nuevos.length === 1 ? 'Nuevo envío recibido: ' : nuevos.length + ' envíos nuevos recibidos; el último: ') +
    '<b>' + u.sa.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) + '</b> (' + u.ut.replace(/[&<>"]/g, '') + '), ' + hhmm(u.t) + ' h · el tablero se actualiza en un momento</span>';
}
const vistaAct = () => !$('#vMen') || $('#vMen').hidden ? ($('#vEnv') && !$('#vEnv').hidden ? 'env' : 'res') : 'menu';

/* detalle de un servicio (menú semanal y recetario): true si ya está, o una promesa */
window.__cargarDet = cui => {
  const D = Dact; if (!D) return Promise.reject(new Error('sin datos'));
  if (D._det[cui]) return true;
  const s = D.sa.find(x => x.cui === cui);
  if (!s || !s.det) { Armar.agregarDet(D, cui, {}); return true; }
  const id = s.det;
  if (DET[id]) { Armar.agregarDet(D, cui, DET[id]); return true; }
  if (!DETP[id]) DETP[id] = getDoc(doc(db, 'periodos', mes, 'env', id)).then(sn => (DET[id] = sn.exists() ? JSON.parse(sn.data().d) : {}))
    .catch(err => { delete DETP[id]; throw err; });
  return DETP[id].then(det => { const D2 = Dact, s2 = D2 && D2.sa.find(x => x.cui === cui); if (s2 && s2.det === id && !D2._det[cui]) Armar.agregarDet(D2, cui, det); });
};

/* arma el tablero con los datos recibidos; al actualizar en vivo conserva la vista, los filtros y la posición */
function montar(conservar) {
  if (!meta || !uts) return;
  const vista = vistaAct(), y = window.scrollY, E = (conservar && app) ? app.estado() : null;
  const D = Armar.armarD(JSON.parse(meta), [...uts.values()].flatMap(t => JSON.parse(t).sa));
  Dact = D;
  AC.abort(); AC = new AbortController();
  [...document.body.children].filter(n => n.tagName !== 'SCRIPT').forEach(n => n.remove());
  document.body.insertAdjacentHTML('afterbegin', SHELL); document.body.style.overflow = '';
  if (montado) try { history.replaceState(null, '', vista === 'menu' ? '#menu-semanal' : vista === 'env' ? '#envios' : '#resumen'); } catch (_) {}
  app = APP(D, AC, E);
  if (conservar) window.scrollTo(0, y);
  montado = true;
  estadoOk();
}
/* espera a que el usuario no esté con una receta abierta ni eligiendo en una lista */
function programar(inmediato) {
  clearTimeout(tEspera);
  tEspera = setTimeout(function intento() {
    const ocupado = (!$('#rcOv') || !$('#rcOv').hidden) && montado || (document.activeElement && document.activeElement.tagName === 'SELECT');
    if (ocupado && montado) { estado('Hay datos nuevos: se mostrarán al cerrar la ventana abierta', true); tEspera = setTimeout(intento, 1500); return; }
    montar(montado);
  }, inmediato ? 0 : 1200);
}

function suscribirMes(p, conservarVista) {
  subs.forEach(u => u()); subs = [];
  mes = p; meta = null; uts = null; const n = ++nSus;
  const primero = !montado;
  if (!primero) { montado = false; estado('Cargando ' + p + '…'); }
  const listo = () => { if (n !== nSus || !meta || !uts) return; if (!montado) { montar(false); const f = $('#fMes'); if (f && !primero) f.focus(); } else programar(false); };
  subs.push(onSnapshot(doc(db, 'periodos', p), sn => { if (!sn.exists()) { estado('Todavía no hay datos publicados para ' + p); return; } meta = sn.data().d; listo(); }, err => estado('No se pudo leer la base de datos: ' + err.message)));
  subs.push(onSnapshot(collection(db, 'periodos', p, 'ut'), qs => { const m = new Map(); qs.forEach(d => m.set(d.id, d.data().d)); uts = m; listo(); }, err => estado('No se pudo leer la base de datos: ' + err.message)));
}

window.__cambiarMes = p => {
  if (!(p in window.__ENVVIG)) return;
  const vista = vistaAct();
  try { localStorage.setItem('envios_mes', p); } catch (_) {}
  try { history.replaceState(null, '', vista === 'menu' ? '#menu-semanal' : vista === 'env' ? '#envios' : '#resumen'); } catch (_) {}
  suscribirMes(p);
};

estado('Conectando con la base de datos…');
onSnapshot(doc(db, 'tablero', 'vivo'), sn => { try { AVISOS = sn.exists() ? (JSON.parse(sn.data().d).lista || []) : []; } catch (_) { AVISOS = []; } if (montado) estadoOk(); }, () => {});
onSnapshot(doc(db, 'tablero', 'meses'), sn => {
  if (!sn.exists()) { estado('Todavía no hay datos publicados.'); return; }
  const L = JSON.parse(sn.data().d);                     // [[AAAA-MM, envíos vigentes], ...]
  window.__MESES = L.map(x => x[0]).sort().reverse();
  window.__ENVVIG = Object.fromEntries(L.map(x => [x[0], x[1]]));
  const f = $('#fMes');
  if (f && montado) { const v = f.value; f.innerHTML = window.__MESES.map(p => '<option value="' + p + '">' + p + '</option>').join(''); f.value = v;
    [...f.options].forEach(o => { const p = o.value, M = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
      o.textContent = (M[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4)).replace(/^./, c => c.toUpperCase()) + ' (' + (window.__ENVVIG[p] || 0) + ')'; }); }
  if (!mes || !(mes in window.__ENVVIG)) {
    let m = window.__MESES[0];
    const h = new Date(), k = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0'); if (k in window.__ENVVIG) m = k;
    try { const g = localStorage.getItem('envios_mes'); if (g && g in window.__ENVVIG) m = g; } catch (_) {}
    if (m) suscribirMes(m);
  }
}, err => estado('No se pudo leer la base de datos: ' + err.message));

// En pantallas angostas la barra de filtros se oculta al bajar y reaparece al subir
const mqBar = window.matchMedia('(max-width: 760px)');
let yPrev = window.scrollY, tick = false;
window.addEventListener('scroll', () => {
  if (tick) return; tick = true;
  requestAnimationFrame(() => {
    tick = false;
    const bar = document.querySelector('.bar'); if (!bar) return;
    const y = window.scrollY, dy = y - yPrev; yPrev = y;
    const enUso = bar.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';
    if (!mqBar.matches || y < 140 || enUso) { bar.classList.remove('oculta'); return; }
    if (dy > 6) bar.classList.add('oculta'); else if (dy < -6) bar.classList.remove('oculta');
  });
}, { passive: true });
mqBar.addEventListener('change', () => { const bar = document.querySelector('.bar'); if (bar) bar.classList.remove('oculta'); });
document.addEventListener('focusin', e => { const bar = document.querySelector('.bar'); if (bar && bar.contains(e.target)) bar.classList.remove('oculta'); });
