/*
 * Arma, en el navegador, el objeto de datos de un mes con la forma que usa el tablero
 * a partir de los documentos publicados en Firestore:
 *   periodos/{AAAA-MM}            -> meta (totales, avance, cortes)
 *   periodos/{AAAA-MM}/ut/{UT}    -> servicios alimentarios de la UT (con su aporte ya calculado)
 *   periodos/{AAAA-MM}/env/{ID}   -> detalle de un envío (menú semanal, recetario), solo al abrirlo
 */
(function (raiz) {
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  function armarD(meta, saList) {
    const D = Object.assign({}, meta);
    D.sa = saList.slice().sort((a, b) => a.o - b.o);
    const gm = meta.gmap || {};
    const al = new Set(); D.sa.forEach(s => (s.food || []).forEach(f => al.add(f[0])));
    const alimentos = [...al].sort(cmp);
    const grupos = [...new Set(alimentos.map(a => gm[a] || 'OTROS'))].sort(cmp);
    const gidx = {}; grupos.forEach((g, i) => { gidx[g] = i; });
    const aidx = {}; alimentos.forEach((a, i) => { aidx[a] = i; });
    D.alimentos = alimentos.map(a => [a, gidx[gm[a] || 'OTROS']]);
    D.grupos = grupos;
    D.food = [];
    D.sa.slice().sort((a, b) => cmp(a.cui, b.cui)).forEach(s => (s.food || []).forEach(f => D.food.push([s.cui, aidx[f[0]], f[1], f[2], f[3]])));
    D.menuW = {}; D.recs = {}; D.precioIng = {}; D.equiv = {}; D.menu = []; D.preps = []; D.ing = [];
    D._det = {}; D._pidx = {}; D._iidx = {};
    return D;
  }

  /** Incorpora el detalle de un servicio (documento env/{ID}) al objeto del mes. */
  function agregarDet(D, cui, det) {
    if (D._det[cui]) return;
    const gp = (det.pr || []).map(p => (p in D._pidx) ? D._pidx[p] : (D._pidx[p] = D.preps.push(p) - 1));
    const gi = (det.ig || []).map(m => (m[0] in D._iidx) ? D._iidx[m[0]] : (D._iidx[m[0]] = D.ing.push(m) - 1));
    if (det.mw && det.mw.length) D.menuW[cui] = det.mw.map(r => [r[0], r[1], r[2], r[3], gp[r[4]]]);
    (det.mn || []).forEach(r => D.menu.push([cui, r[0], gp[r[1]], r[2]]));
    if (det.rc && Object.keys(det.rc).length) {
      const rc = {}; Object.keys(det.rc).forEach(k => { const o = det.rc[k]; rc[k] = [o[0], o[1].map(row => [gi[row[0]]].concat(row.slice(1)))]; });
      D.recs[cui] = rc;
    }
    const pi = {}; Object.keys(det.pi || {}).forEach(k => { pi[gi[+k]] = det.pi[k]; }); D.precioIng[cui] = pi;
    if (det.eq && Object.keys(det.eq).length) { const eq = {}; Object.keys(det.eq).forEach(k => { eq[gi[+k]] = det.eq[k]; }); D.equiv[cui] = eq; }
    D._det[cui] = true;
  }

  /** Aporte nutricional ya calculado (forma compacta) -> forma de evaluarAporte. */
  function expandirAporte(ap) {
    const F = ap.F;
    const bits = (m, n) => { const r = []; for (let j = 0; j < n; j++) if (m & (1 << j)) r.push(j); return r; };
    return {
      dias: ap.d,
      malos: ap.m.map(([fi, s, nm, gm]) => ({ f: F[fi], s, nut: bits(nm, 5), gr: bits(gm, 4) })),
      porNut: ap.pn.slice(), grupos: ap.g.slice(),
      mac: ap.mac.map(([n, suma, fuera, df, vals]) => ({ n, suma: suma.slice(), fuera: fuera.slice(), diasFuera: df, vals: vals.map(([fi, s, a, b, c]) => ({ p: [a, b, c], f: F[fi], s })) })),
      cob: ap.cob.map(([n, suma]) => ({ n, suma: suma.slice() })),
      cobDias: ap.cd.map(L => L.map(([fi, s, m]) => ({ f: F[fi], s, bajo: [0, 1, 2, 3, 4].map(j => !!(m & (1 << j))) })))
    };
  }

  const API = { armarD, agregarDet, expandirAporte };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.Armar = API;
})(typeof window !== 'undefined' ? window : this);
