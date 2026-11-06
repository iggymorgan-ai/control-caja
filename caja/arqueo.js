// Pantalla de arqueo (empleado): recuento por piezas, tarjetas, salidas, Proxium → guardar online e imprimir.
import { calcularArqueo, parseImporte, eur, esc, fdate } from '../lib/calculos.js?v=1793972486';
import { rpc, tokenDeURL } from '../lib/api.js?v=1793972486';
import { montarPiezas } from '../lib/piezas.js?v=1793972486';
import { textoTicket, imprimir } from '../lib/ticket.js?v=1793972486';
import { reducirImagen } from '../lib/fotos.js?v=1793972486';
import { botonInstalar } from '../lib/acceso.js?v=1793972486';
import { toast, hoyCanarias, horaCanarias, uuid } from '../lib/ui.js?v=1793972486';

const BORRADOR = 'ccpb_borrador';
const app = document.getElementById('app');
const token = tokenDeURL();
let P;            // datos del puesto y la terminal (caja_puesto)
let F;            // formulario en curso
let guardando = false, sinConexion = false;

const ayer = () => { const d = new Date(hoyCanarias() + 'T12:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const tasas = () => P.terminal.divisas || {};

function nuevoForm() {
  F = { client_id: uuid(), tipo: 'cierre', barco: '', fecha: hoyCanarias(), caja: P.terminal.cajas[0], quien: '', fondo: P.terminal.fondo,
        piezas: {}, divisas: Object.fromEntries(Object.keys(tasas()).map(d => [d, 0])),
        tarjetas: [{ nombre: 'Datáfono 1', importe: null }], salidas: [], pxEf: null, pxTj: null, obs: '' };
}
const guardarBorrador = () => { try { localStorage.setItem(BORRADOR, JSON.stringify(F)); } catch { /* fotos muy grandes: el borrador sigue en pantalla */ } };
function cargarBorrador() {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR));
    if (b && b.client_id) { F = b; if (F.fecha < ayer()) F.fecha = hoyCanarias(); return true; }
  } catch { /* borrador roto: se empieza de cero */ }
  return false;
}
const calc = () => calcularArqueo({ piezas: F.piezas, fondo: F.fondo, divisas: F.tipo === 'cierre' ? F.divisas : {}, tasas: tasas(),
  tarjetas: F.tipo === 'cierre' ? F.tarjetas : [], salidas: F.tipo === 'cierre' ? F.salidas : [], pxEf: F.tipo === 'cierre' ? F.pxEf : null });
const num = v => v == null ? '' : String(v).replace('.', ',');
const nombreDivisa = d => ({ USD: '🇺🇸 Dólares', GBP: '🇬🇧 Libras' }[d] || d);

function sinAcceso(msg) {
  app.innerHTML = `<div class="aviso card"><h2>Este PC no tiene acceso</h2><p>${esc(msg || 'Pide el enlace a la oficina.')}</p></div>`;
}

function pintar() {
  const c = calc(), T = P.terminal, cierre = F.tipo === 'cierre', falta = c.faltaFondo > 0;
  const pill = falta ? `<span class="pill red">Faltan ${eur(c.faltaFondo)} para completar el fondo de ${eur(F.fondo)}</span>`
                     : `<span class="pill green">Fondo de ${eur(F.fondo)} completo</span>`;
  const monedas = Object.entries(F.piezas).filter(([k]) => Number(k) <= 2), billetes = Object.entries(F.piezas).filter(([k]) => Number(k) >= 5);
  const sub = xs => eur(xs.reduce((s, [k, n]) => s + Number(k) * n, 0));
  app.innerHTML = `
  <div class="hdr"><div class="small">Efectivo contado</div><div class="big" id="hdrTotal">${eur(c.contado)}</div>
    <div class="small">Monedas ${sub(monedas)}<br>Billetes ${sub(billetes)}</div><div style="flex:1"></div>${pill}</div>
  <div class="wrap grid3">
    <div class="card" id="pzbox"></div>
    <div>
      <div class="card">
        <div class="seg"><button data-tipo="apertura" class="${!cierre ? 'on' : ''}">☀️ Apertura</button><button data-tipo="cierre" class="${cierre ? 'on' : ''}">🌙 Cierre</button></div>
        <div class="lbl">Terminal</div>
        <div class="terms"><button class="on" disabled style="opacity:1">${esc(T.nombre)}</button></div>
        <div class="grid2" style="gap:10px">
          <div><div class="lbl">Barco (escala)</div><select id="fBarco"><option value="">— Elige el barco —</option>${T.barcos.map(b => `<option ${b === F.barco ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
          <div><div class="lbl">Fecha</div><input type="date" id="fFecha" value="${F.fecha}" min="${ayer()}" max="${hoyCanarias()}"></div>
          <div><div class="lbl">Caja</div><select id="fCaja">${T.cajas.map(b => `<option ${b === F.caja ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
          <div><div class="lbl">Cuenta la caja</div><input id="fQuien" placeholder="Nombre de quien cuenta" value="${esc(F.quien)}"></div>
        </div>
        <h4>Fondo de caja</h4>
        <div class="row"><div>Lo que debe quedar siempre en caja<br><span class="help">Se deja para el día siguiente</span></div><input id="fFondo" class="num" style="flex:0 0 120px" value="${num(F.fondo)}"></div>
      </div>
      ${cierre ? `
      <div class="card" style="margin-top:14px">
        ${Object.keys(tasas()).length ? `<div class="sechead">Moneda extranjera <span>${eur(c.divEur)}</span></div>
        <p class="help">Lo cobrado en otras divisas (se cuenta aparte, no va en las monedas y billetes de euro). Cambio fijado por la oficina.</p>
        ${Object.entries(tasas()).map(([d, t]) => `<div class="row"><div>${nombreDivisa(d)} <span class="help">· 1 ${esc(d)} = ${num(t)} €</span></div>
          <input class="num" data-div="${esc(d)}" style="flex:0 0 120px" value="${num(F.divisas[d] || 0)}"><div class="help" style="flex:0 0 90px;text-align:right">${eur((Number(F.divisas[d]) || 0) * t)}</div></div>`).join('')}` : ''}
        <div class="sechead" style="margin-top:14px">Tarjetas <span>${eur(c.tarj)}</span></div>
        <p class="help">Total de cobros con tarjeta según el datáfono (cierre de lote). Una línea por datáfono.</p>
        ${F.tarjetas.map((t, i) => `<div class="row"><input data-tn="${i}" value="${esc(t.nombre)}"><input class="num" data-ti="${i}" style="flex:0 0 120px" value="${num(t.importe)}" placeholder="0,00"><button class="x" data-tx="${i}">×</button></div>`).join('')}
        <button class="add" id="addT">+ Añadir datáfono</button>
        <div class="sechead" style="margin-top:14px">Salidas de caja · gastos y pagos a terceros <span>${eur(c.sal)}</span></div>
        <p class="help">Pagos hechos con dinero de la caja. Cada uno con partida, a quién y foto del ticket (si no la tienes ahora, se queda pendiente).</p>
        ${F.salidas.length ? '' : '<p class="help" style="padding:8px 0">Sin salidas de caja.</p>'}
        ${F.salidas.map((s, i) => `<div class="row">
            <select data-sp="${i}">${T.partidas.map(p => `<option ${p === s.partida ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
            <input data-sa="${i}" placeholder="A quién" value="${esc(s.aquien)}">
            <input class="num" data-si="${i}" style="flex:0 0 90px" placeholder="0,00" value="${num(s.importe)}">
            <label class="foto ${s.foto ? 'ok' : 'pend'}">${s.foto ? '📎 ' + esc(s.foto.nombre).slice(0, 10) : '📷 Añadir foto'}<input type="file" accept="image/*,application/pdf" data-sf="${i}" hidden></label>
            <button class="x" data-sx="${i}">×</button></div>`).join('')}
        <button class="add" id="addS">+ Añadir salida</button>
        <div class="sechead" style="margin-top:14px">Según Proxium ${T.proxium_obligatorio ? `<span class="bad">obligatorio en ${esc(T.nombre.replace(/^Terminal /, ''))}</span>` : ''}</div>
        <p class="help">Lo que dice el cierre de Proxium para esta caja. Se calcula el descuadre.</p>
        <div class="row"><div>Ventas en efectivo</div><input id="fPxEf" class="num" style="flex:0 0 140px" value="${num(F.pxEf)}" placeholder="0,00"></div>
        <div class="row"><div>Ventas con tarjeta</div><input id="fPxTj" class="num" style="flex:0 0 140px" value="${num(F.pxTj)}" placeholder="0,00"></div>
      </div>` : `
      <div class="card" style="margin-top:14px"><h3>Apertura</h3><p class="help">Cuenta el fondo de la caja antes de abrir. Debe haber ${eur(F.fondo)}. Si falta, se repone desde el fondo de cambio de la caja fuerte y queda apuntado.</p></div>`}
    </div>
    <div>
      <div class="card">
        <h3>Resultado</h3>
        <div class="res">
          <div><span>Efectivo contado</span><b>${eur(c.contado)}</b></div>
          <div class="sub"><span>− Fondo de caja</span><span>${eur(F.fondo)}</span></div>
          ${cierre ? `
          <div><span>= Efectivo de ventas en caja</span><b class="${c.efCaja < 0 ? 'bad' : ''}">${eur(c.efCaja)}</b></div>
          <div class="sub"><span>+ Moneda extranjera (en €)</span><span>${eur(c.divEur)}</span></div>
          <div class="sub"><span>+ Salidas de caja</span><span>${eur(c.sal)}</span></div>
          <div><span>= Efectivo vendido</span><b>${eur(c.declarado)}</b></div>
          <div class="sub"><span>Según Proxium</span><span>${F.pxEf == null ? '—' : eur(F.pxEf)}</span></div>
          <div class="b"><span>DESCUADRE EFECTIVO</span><span class="${c.desc === null ? '' : c.desc === 0 ? 'good' : 'bad'}">${c.desc === null ? 'falta Proxium' : c.desc === 0 ? '0,00 € ✓' : (c.desc > 0 ? '+' : '') + eur(c.desc)}</span></div>
          <div><span>Ventas con tarjeta</span><b>${eur(c.tarj)}</b></div>
          <div class="b"><span>TOTAL VENTAS</span><span>${eur(c.total)}</span></div>` : `
          <div class="b"><span>${falta ? 'Falta para completar el fondo' : 'Fondo completo'}</span><span class="${falta ? 'bad' : 'good'}">${falta ? eur(c.faltaFondo) : '✓'}</span></div>`}
        </div>
        ${cierre && c.aCajaFuerte > 0 ? `<div class="note">Al guardar, <b>${eur(c.aCajaFuerte)}</b> en euros${c.divEur ? ' y las divisas' : ''} pasan a la <b>caja fuerte</b> (recaudación) y quedan apuntados a tu nombre.</div>` : ''}
        <h4>Observaciones</h4>
        <textarea id="fObs" rows="3" placeholder="Incidencias, vales, cambio traído del banco...">${esc(F.obs)}</textarea>
        ${(sinConexion || F.enviado) && !guardando ? `<div class="offline">Sin conexión. El arqueo NO está guardado. Reintenta cuando vuelva internet.<br><button class="btn sm pri" id="bReintentar" style="margin-top:8px">Reintentar</button></div>` : ''}
        <div class="btns2"><button class="btn pri" id="bGuardarImp" ${guardando ? 'disabled' : ''}>✅ Guardar e imprimir</button><button class="btn" id="bGuardar" ${guardando ? 'disabled' : ''}>💾 Solo guardar</button></div>
        <button class="btn" id="bBorrador">🖨 Imprimir sin guardar</button>
        <button class="btn danger" style="margin-top:10px" id="bCero">Empezar de cero</button>
        <p class="help" style="margin-top:10px">Lo guardado <b>no se puede borrar ni modificar</b>. Si hay un error, la oficina hace una corrección con motivo y quedan los dos.</p>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Últimos arqueos (${esc(T.nombre.replace(/^Terminal /, ''))})</h3>
        <table><tr><th>Fecha</th><th>Barco · caja</th><th class="n">Descuadre</th></tr>
        ${P.ultimos.slice(0, 8).map(x => { const d = x.desc == null ? null : Math.round(x.desc * 100) / 100;
          return `<tr><td>${fdate(x.fecha)}</td><td>${esc(x.barco)} · ${esc(x.caja)}<br><span class="help">${esc(x.quien)}</span></td><td class="n ${d === 0 ? 'good' : 'bad'}">${d === null ? '—' : d === 0 ? '✓' : eur(d)}</td></tr>`; }).join('')}
        </table>
      </div>
    </div>
  </div>`;
  montarPiezas(document.getElementById('pzbox'), F.piezas, () => { guardarBorrador(); repintarConFoco(); });
  enlazar();
  // Enviado sin respuesta: puede estar guardado ya. Hasta reintentar o empezar de cero no se toca nada,
  // para que el ticket y la base de datos digan siempre lo mismo.
  if (F.enviado && !guardando) app.querySelectorAll('input, select, textarea, button').forEach(el => {
    if (el.id !== 'bReintentar' && el.id !== 'bCero') el.disabled = true;
  });
}

// Repinta todo menos el contador (que ya se ha repintado solo y conserva el foco)
function repintarConFoco() {
  const foco = document.activeElement?.closest('#pzbox') ? [...document.querySelectorAll('#pzbox input')].indexOf(document.activeElement) : -1;
  const scroll = window.scrollY;
  pintar();
  if (foco >= 0) document.querySelectorAll('#pzbox input')[foco]?.focus();
  window.scrollTo(0, scroll);
}

function enlazar() {
  const $ = id => document.getElementById(id);
  const cambio = (repinta = true) => { guardarBorrador(); if (repinta) repintarConFoco(); };
  app.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { F.tipo = b.dataset.tipo; cambio(); });
  const texto = (id, k) => { const el = $(id); if (el) el.onchange = () => { F[k] = el.value; cambio(false); }; };
  texto('fBarco', 'barco'); texto('fFecha', 'fecha'); texto('fCaja', 'caja'); texto('fQuien', 'quien'); texto('fObs', 'obs');
  const importe = (id, k) => { const el = $(id); if (el) el.onchange = () => { F[k] = parseImporte(el.value); cambio(); }; };
  importe('fFondo', 'fondo'); importe('fPxEf', 'pxEf'); importe('fPxTj', 'pxTj');
  app.querySelectorAll('[data-div]').forEach(i => i.onchange = () => { F.divisas[i.dataset.div] = parseImporte(i.value) || 0; cambio(); });
  app.querySelectorAll('[data-tn]').forEach(i => i.onchange = () => { F.tarjetas[+i.dataset.tn].nombre = i.value; cambio(false); });
  app.querySelectorAll('[data-ti]').forEach(i => i.onchange = () => { F.tarjetas[+i.dataset.ti].importe = parseImporte(i.value); cambio(); });
  app.querySelectorAll('[data-tx]').forEach(b => b.onclick = () => { F.tarjetas.splice(+b.dataset.tx, 1); cambio(); });
  app.querySelectorAll('[data-sp]').forEach(i => i.onchange = () => { F.salidas[+i.dataset.sp].partida = i.value; cambio(false); });
  app.querySelectorAll('[data-sa]').forEach(i => i.onchange = () => { F.salidas[+i.dataset.sa].aquien = i.value; cambio(false); });
  app.querySelectorAll('[data-si]').forEach(i => i.onchange = () => { F.salidas[+i.dataset.si].importe = parseImporte(i.value); cambio(); });
  app.querySelectorAll('[data-sf]').forEach(i => i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try { F.salidas[+i.dataset.sf].foto = await reducirImagen(f); cambio(); } catch (e) { alert(e.message); }
  });
  app.querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { F.salidas.splice(+b.dataset.sx, 1); cambio(); });
  $('addT') && ($('addT').onclick = () => { F.tarjetas.push({ nombre: 'Datáfono ' + (F.tarjetas.length + 1), importe: null }); cambio(); });
  $('addS') && ($('addS').onclick = () => { F.salidas.push({ partida: P.terminal.partidas[0], aquien: '', importe: null, foto: null }); cambio(); });
  $('bCero').onclick = () => { if (confirm('¿Borrar lo que llevas contado? (no afecta a lo ya guardado)')) { nuevoForm(); sinConexion = false; guardarBorrador(); pintar(); } };
  $('bGuardar').onclick = () => guardar(false);
  $('bGuardarImp').onclick = () => guardar(true);
  $('bReintentar') && ($('bReintentar').onclick = () => guardar(true));
  $('bBorrador').onclick = () => imprimir(textoTicket(arqueoParaTicket(null), calc(), P.terminal.nombre));
}

// Lee lo que haya escrito en un campo sin haber salido de él
function volcarCampos() { document.activeElement?.dispatchEvent?.(new Event('change')); }

function arqueoParaTicket(id) {
  const cierre = F.tipo === 'cierre';
  return { id, tipo: F.tipo, fecha: F.fecha, hora: horaCanarias(), caja: F.caja, barco: F.barco, quien: F.quien.trim(), fondo: F.fondo,
    divisas: cierre ? F.divisas : {}, tasas: tasas(), tarjetas: cierre ? F.tarjetas : [],
    salidas: cierre ? F.salidas.map(s => ({ ...s, foto: !!s.foto })) : [], px_ef: cierre ? F.pxEf : null, obs: F.obs };
}

async function guardar(conTicket) {
  if (guardando) return;
  volcarCampos();
  const cierre = F.tipo === 'cierre';
  const faltan = [];
  if (!F.barco) faltan.push('el barco');
  if (!F.quien.trim()) faltan.push('quién cuenta');
  if (cierre && P.terminal.proxium_obligatorio && F.pxEf == null) faltan.push('las ventas en efectivo según Proxium');
  if (cierre && F.salidas.some(s => !String(s.aquien || '').trim() || !s.importe)) faltan.push('a quién y el importe de cada salida');
  if (faltan.length) { alert('Falta: ' + faltan.join(', ') + '.'); return; }
  const importes = [F.fondo, F.pxEf, F.pxTj, ...F.tarjetas.map(t => t.importe), ...F.salidas.map(s => s.importe), ...Object.values(F.divisas)];
  if (importes.some(v => v != null && v < 0)) { alert('Hay un importe negativo. Revísalo.'); return; }

  const c = calc();
  const p = { client_id: F.client_id, tipo: F.tipo, fecha: F.fecha, barco: F.barco, caja: F.caja, quien: F.quien.trim(), fondo: F.fondo ?? 0,
    piezas: F.piezas, divisas: cierre ? Object.fromEntries(Object.entries(F.divisas).filter(([, v]) => v > 0)) : {},
    tarjetas: cierre ? F.tarjetas.filter(t => t.importe).map(t => ({ nombre: t.nombre, importe: t.importe })) : [],
    salidas: cierre ? F.salidas.map(s => ({ partida: s.partida, aquien: s.aquien.trim(), importe: s.importe, foto: !!s.foto })) : [],
    px_ef: cierre ? F.pxEf : null, px_tj: cierre ? F.pxTj : null, obs: F.obs };
  guardando = true; F.enviado = true; guardarBorrador(); pintar();
  let r;
  try {
    r = await rpc('caja_guardar_arqueo', { p_token: token, p });
  } catch (e) {
    guardando = false;
    if (e.message === 'SIN_CONEXION') { sinConexion = true; pintar(); return; }
    F.enviado = false; guardarBorrador();  // la BD lo ha rechazado: no está guardado y se puede corregir
    pintar(); alert('No se ha guardado: ' + e.message); return;
  }
  // Fotos de las salidas: si alguna no sube, queda como justificante pendiente
  let pendientes = 0;
  for (const [i, s] of (cierre ? F.salidas : []).entries()) {
    if (!s.foto) continue;
    try { await rpc('caja_adjuntar', { p_token: token, p_ref_tabla: 'arqueo', p_ref_id: r.id, p_ref_idx: i, p_nombre: s.foto.nombre, p_mime: s.foto.mime, p_data: s.foto.data }); }
    catch { pendientes++; }
  }
  if (conTicket) imprimir(textoTicket(arqueoParaTicket(r.id), c, P.terminal.nombre));
  if (r.repetido) toast('Ya estaba guardado antes del corte ✓');
  else toast(pendientes ? `Guardado ✓ (${pendientes} foto(s) no se subieron: quedan pendientes)` : 'Guardado ✓');
  guardando = false; sinConexion = false;
  nuevoForm(); guardarBorrador();
  try { P = await rpc('caja_puesto', { p_token: token }); } catch { /* la lista de últimos se refresca la próxima vez */ }
  pintar();
}

async function arrancar() {
  if (!token) return sinAcceso();
  try { P = await rpc('caja_puesto', { p_token: token }); }
  catch (e) { return sinAcceso(e.message === 'SIN_CONEXION' ? 'No hay conexión a internet. Revisa la red y recarga la página.' : e.message); }
  document.getElementById('puesto').textContent = `${P.puesto.nombre} · ${P.terminal.nombre}`;
  botonInstalar(token, 'Arqueo de caja');
  if (!cargarBorrador()) nuevoForm();
  pintar();
}
window.addEventListener('online', () => { if (sinConexion) toast('Ha vuelto la conexión: pulsa Reintentar'); });
arrancar();
