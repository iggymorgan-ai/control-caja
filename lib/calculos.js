// Lógica pura del cuadre: sin DOM ni red. Todas las sumas en céntimos enteros.

export const MONEDAS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
export const BILLETES = [5, 10, 20, 50, 100, 200, 500];

export const toCents = n => Math.round((Number(n) || 0) * 100);
export const fromCents = c => c / 100;
const sumC = (arr, f = x => x) => arr.reduce((s, x) => s + toCents(f(x)), 0);

// «1.234,56» · «12,5» · «12.5» · 12.5 → número; vacío o texto → null
export function parseImporte(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t = String(s ?? '').trim().replace(/\s|€/g, '');
  if (!t) return null;
  if (t.includes(',') || /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');  // «1.500» = mil quinientos
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const FMT = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
export const eur = n => FMT.format(Number(n) || 0) + ' €';

export const totalPiezas = piezas =>
  fromCents(Object.entries(piezas || {}).reduce((s, [v, n]) => s + toCents(v) * (Number(n) || 0), 0));

export function calcularArqueo({ piezas, fondo, divisas = {}, tasas = {}, tarjetas = [], salidas = [], pxEf = null }) {
  const contadoC = toCents(totalPiezas(piezas));
  const fondoC = toCents(fondo);
  const efCajaC = contadoC - fondoC;
  const divC = Object.entries(divisas || {}).reduce((s, [d, v]) => s + Math.round(toCents(v) * (Number(tasas[d]) || 0)), 0);
  const salC = sumC(salidas, x => x.importe);
  const declC = efCajaC + divC + salC;
  const tarjC = sumC(tarjetas, x => x.importe);
  return {
    contado: fromCents(contadoC),
    efCaja: fromCents(efCajaC),
    divEur: fromCents(divC),
    sal: fromCents(salC),
    declarado: fromCents(declC),
    tarj: fromCents(tarjC),
    desc: pxEf == null ? null : fromCents(declC - toCents(pxEf)),
    total: fromCents(declC + tarjC),
    aCajaFuerte: fromCents(Math.max(0, efCajaC)),
    faltaFondo: fromCents(Math.max(0, fondoC - contadoC)),
  };
}

// ---------------- panel ----------------
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fdate = d => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return dd + '/' + m + '/' + y.slice(2); };
const vivos = xs => (xs || []).filter(x => !x.anulado);
const dias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5);
const divEurC = (divisas, tasas) => Object.entries(divisas || {}).reduce((s, [d, v]) => s + Math.round(toCents(v) * (Number(tasas[d]) || 0)), 0);

export const saldo = (movs, bote, divisa = 'EUR') =>
  fromCents(sumC(vivos(movs).filter(m => m.bote === bote && (m.divisa || 'EUR') === divisa), m => m.importe));

export function porDia(arqueos, proxium, tasas) {
  const D = {};
  const ensure = f => D[f] ||= { fecha: f, barcos: new Set(), cierres: 0, aperturas: 0, declEf: 0, declTj: 0, sal: 0, pxEfEmpleado: 0 };
  for (const a of vivos(arqueos)) {
    const d = ensure(a.fecha);
    d.barcos.add(a.barco);
    if (a.tipo === 'apertura') { d.aperturas++; continue; }
    d.cierres++;
    const salC = sumC(a.salidas || [], s => s.importe);
    d.declEf += toCents(a.contado) - toCents(a.fondo) + divEurC(a.divisas, tasas) + salC;
    d.sal += salC;
    d.declTj += sumC(a.tarjetas || [], t => t.importe);
    d.pxEfEmpleado += toCents(a.px_ef);
  }
  Object.keys(proxium || {}).forEach(ensure);
  return Object.values(D).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(d => {
    const px = proxium?.[d.fecha] || null;
    return {
      fecha: d.fecha, barcos: [...d.barcos], cierres: d.cierres, aperturas: d.aperturas,
      declEf: fromCents(d.declEf), declTj: fromCents(d.declTj), sal: fromCents(d.sal), pxEfEmpleado: fromCents(d.pxEfEmpleado), px,
      dEf: px ? fromCents(d.declEf - toCents(px.ef)) : null,
      dTj: px ? fromCents(d.declTj - toCents(px.tj)) : null,
    };
  });
}

// Ingresos declarados ↔ extracto: primero mismo importe a ±diasMax, si no el más cercano en fecha.
export function conciliarIngresos(movs, extracto, diasMax = 3) {
  const usados = new Set();
  const lineas = (extracto || []).filter(e => e.tipo === 'ingreso');
  const res = vivos(movs).filter(m => m.tipo === 'ingreso_banco').sort((a, b) => a.fecha.localeCompare(b.fecha)).map(mov => {
    const imp = -mov.importe;
    let linea = lineas.find(e => !usados.has(e.id) && dias(e.fecha, mov.fecha) <= diasMax && toCents(e.importe) === toCents(imp));
    if (linea) { usados.add(linea.id); return { mov, imp, linea, estado: 'ok' }; }
    linea = lineas.filter(e => !usados.has(e.id) && dias(e.fecha, mov.fecha) <= diasMax)
      .sort((a, b) => dias(a.fecha, mov.fecha) - dias(b.fecha, mov.fecha))[0];
    if (linea) { usados.add(linea.id); return { mov, imp, linea, estado: 'distinto' }; }
    return { mov, imp, linea: null, estado: 'falta' };
  });
  return { res, sueltas: lineas.filter(e => !usados.has(e.id)) };
}

// Tarjetas de Proxium ↔ abonos del datáfono: 1..diasMax días después, comisión hasta comisionMax.
export function conciliarTarjetas(proxium, extracto, { diasMax = 3, comisionMax = 0.015 } = {}) {
  const usados = new Set();
  return Object.entries(proxium || {}).filter(([, p]) => p.tj > 0).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, p]) => {
    const tjC = toCents(p.tj);
    const linea = (extracto || []).find(e => e.tipo === 'tpv' && !usados.has(e.id) && e.fecha > fecha && dias(e.fecha, fecha) <= diasMax
      && toCents(e.importe) <= tjC && toCents(e.importe) >= Math.floor(tjC * (1 - comisionMax)));
    if (linea) { usados.add(linea.id); return { fecha, tj: p.tj, linea, comision: fromCents(tjC - toCents(linea.importe)), estado: 'ok' }; }
    return { fecha, tj: p.tj, linea: null, comision: 0, estado: 'falta' };
  });
}

// Dónde debería estar el efectivo, contado con el Proxium y el extracto de Javier.
export function cadenaEfectivo({ arqueos, movs, proxium, extracto, tasas }) {
  const mv = vivos(movs);
  const tot = (f) => sumC(mv.filter(f), m => m.importe);
  const aEur = m => Math.round(toCents(m.importe) * ((m.divisa || 'EUR') === 'EUR' ? 1 : (Number(tasas?.[m.divisa]) || 0)));
  const sumEur = f => mv.filter(f).reduce((s, m) => s + aEur(m), 0);
  // saldo inicial (o anterior al periodo) de la recaudación, divisas incluidas al cambio fijado
  const sIni = sumEur(m => m.bote === 'rec' && m.tipo === 'saldo_inicial');
  const salidaDivisas = -sumEur(m => m.bote === 'rec' && m.tipo === 'salida_divisa');
  const pxEf = sumC(Object.values(proxium || {}), p => p.ef);
  const salCajas = sumC(vivos(arqueos).filter(a => a.tipo === 'cierre'), a => fromCents(sumC(a.salidas || [], s => s.importe)));
  const gastosFuerte = -tot(m => m.tipo === 'gasto');
  const ingConf = sumC(conciliarIngresos(mv, extracto).res, r => r.linea ? r.linea.importe : 0);
  const cambioRec = -tot(m => m.bote === 'rec' && m.tipo === 'compra_cambio');
  const reposiciones = -tot(m => m.tipo === 'reposicion_fondo');
  const deberia = sIni + pxEf - salCajas - gastosFuerte - ingConf - cambioRec + reposiciones - salidaDivisas;
  const divisas = [...new Set(mv.filter(m => m.bote === 'rec' && (m.divisa || 'EUR') !== 'EUR').map(m => m.divisa))];
  const enLibro = toCents(saldo(mv, 'rec')) + divisas.reduce((s, d) => s + Math.round(toCents(saldo(mv, 'rec', d)) * (Number(tasas?.[d]) || 0)), 0);
  const F = fromCents;
  return { sIni: F(sIni), pxEf: F(pxEf), salCajas: F(salCajas), gastosFuerte: F(gastosFuerte), ingConf: F(ingConf), cambioRec: F(cambioRec), salidaDivisas: F(salidaDivisas),
    reposiciones: F(reposiciones), deberia: F(deberia), enLibro: F(enLibro), sinJustificar: F(deberia - enLibro) };
}

// Todos los gastos en efectivo: salidas de las cajas + gastos de caja fuerte.
export function gastosTodos(arqueos, movs) {
  const g = [];
  vivos(arqueos).filter(a => a.tipo === 'cierre').forEach(a => (a.salidas || []).forEach((s, idx) =>
    g.push({ fecha: a.fecha, origen: a.caja, partida: s.partida, aquien: s.aquien, importe: Number(s.importe) || 0, foto: !!s.foto, quien: a.quien, ref: { tabla: 'arqueo', id: a.id, idx } })));
  vivos(movs).filter(m => m.tipo === 'gasto').forEach(m =>
    g.push({ fecha: m.fecha, origen: 'Caja fuerte', partida: m.partida, aquien: m.aquien, importe: -m.importe, foto: !!m.tiene_foto, quien: m.quien, ref: { tabla: 'movimiento', id: m.id, idx: null } }));
  return g.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const ultimoRecuento = (recuentos, bote, divisa = 'EUR') => (recuentos || []).filter(r => !r.anulado && r.bote === bote && (r.divisa || 'EUR') === divisa)
  .sort((a, b) => String(b.created_at || b.fecha).localeCompare(String(a.created_at || a.fecha)))[0] || null;

// Alertas: texto con HTML ya escapado (los datos del personal pasan por esc()).
export function alertas({ dias: D, conc, tarj, recuentos, arqueos, movs, umbral }) {
  const A = [];
  const grave = t => A.push({ nivel: 'grave', texto: t }), revisar = t => A.push({ nivel: 'revisar', texto: t });
  D.forEach(d => {
    if (!d.px && d.cierres) revisar(`${fdate(d.fecha)}: falta meter las ventas de Proxium de ese día.`);
    if (d.dEf !== null && Math.abs(d.dEf) >= 1) grave(`${fdate(d.fecha)} (${d.barcos.map(esc).join(', ')}): ${d.dEf < 0 ? 'faltan' : 'sobran'} <b>${eur(Math.abs(d.dEf))}</b> de efectivo frente a Proxium.`);
    if (d.dTj !== null && Math.abs(d.dTj) >= 1) grave(`${fdate(d.fecha)}: tarjetas de los cierres ${eur(d.declTj)} vs Proxium ${eur(d.px.tj)}.`);
  });
  D.forEach(d => {
    if (!d.px || !d.cierres) return;
    if (Math.abs(d.pxEfEmpleado - d.px.ef) >= 1) grave(`${fdate(d.fecha)}: el «Según Proxium» que tecleó el personal (${eur(d.pxEfEmpleado)}) no coincide con tu Proxium (${eur(d.px.ef)}). Revisa los cierres de ese día.`);
  });
  const ab = {};
  vivos(arqueos).forEach(a => { const k = a.fecha + '|' + a.barco + '|' + a.caja; ab[k] ||= { a: 0, c: 0, x: a }; ab[k][a.tipo === 'apertura' ? 'a' : 'c']++; });
  Object.values(ab).filter(v => v.a > v.c).forEach(v => revisar(`${fdate(v.x.fecha)} · ${esc(v.x.barco)} · ${esc(v.x.caja)}: apertura sin cierre.`));
  (conc?.res || []).forEach(r => {
    if (r.estado === 'falta') grave(`Ingreso declarado el ${fdate(r.mov.fecha)} de <b>${eur(r.imp)}</b> (${esc(r.mov.quien)}) <b>no aparece</b> en el extracto.`);
    if (r.estado === 'distinto') grave(`Ingreso del ${fdate(r.mov.fecha)}: declarado <b>${eur(r.imp)}</b> (${esc(r.mov.quien)}), en el banco <b>${eur(r.linea.importe)}</b>. Diferencia ${eur(fromCents(toCents(r.linea.importe) - toCents(r.imp)))}.`);
  });
  (tarj || []).filter(t => t.estado === 'falta').forEach(t => revisar(`Tarjetas del ${fdate(t.fecha)} (${eur(t.tj)}): no veo el abono del datáfono en el extracto.`));
  ['rec', 'cam'].forEach(b => {
    const r = ultimoRecuento(recuentos, b);
    const dif = r ? fromCents(toCents(r.contado) - toCents(r.teorico)) : 0;
    if (r && dif !== 0) grave(`Recuento de ${b === 'rec' ? 'recaudación' : 'fondo de cambio'} del ${fdate(r.fecha || r.created_at)} (${esc(r.quien)}): ${dif < 0 ? 'faltan' : 'sobran'} <b>${eur(Math.abs(dif))}</b>.`);
  });
  const sp = gastosTodos(arqueos, movs).filter(g => !g.foto);
  if (sp.length) revisar(`${sp.length} gasto(s) sin justificante: ${sp.map(g => esc(g.aquien) + ' ' + eur(g.importe)).join(', ')}.`);
  const sRec = saldo(movs, 'rec');
  if (umbral != null && sRec > umbral) revisar(`Hay ${eur(sRec)} en la caja fuerte sin ingresar (umbral ${eur(umbral)}).`);
  return A;
}

// Extracto pegado o CSV: «fecha;concepto;importe» (o tabulador). Líneas que no encajan se ignoran.
export function parseExtracto(texto) {
  const out = [];
  for (const raw of String(texto || '').split(/\r?\n/)) {
    const c = raw.split(/[;\t]/).map(s => s.trim().replace(/^"|"$/g, ''));
    if (c.length < 3) continue;
    let f = c[0], m;
    if ((m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) f = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
    const importe = parseImporte(c[c.length - 1]);
    if (importe === null) continue;
    const concepto = c.slice(1, -1).join(' ').trim();
    const tipo = /TPV|DATAFONO|DATÁFONO|TARJ/i.test(concepto) ? 'tpv' : importe < 0 ? 'cargo' : 'ingreso';
    out.push({ fecha: f, concepto, importe, tipo });
  }
  return out;
}
