// Pantalla de caja fuerte (encargado): recaudación y fondo de cambio por separado, libro y recuentos.
import { eur, esc, fdate, parseImporte, totalPiezas } from '../lib/calculos.js?v=1793972486';
import { rpc, tokenDeURL } from '../lib/api.js?v=1793972486';
import { montarPiezas } from '../lib/piezas.js?v=1793972486';
import { reducirImagen } from '../lib/fotos.js?v=1793972486';
import { botonInstalar } from '../lib/acceso.js?v=1793972486';
import { toast, modal, cerrarModal, uuid, money } from '../lib/ui.js?v=1793972486';

const app = document.getElementById('app');
const token = tokenDeURL();
let D;  // caja_fuerte()

const TIPO = { saldo_inicial: 'Saldo inicial', entrada_cierre: 'Entrada de cierre', gasto: 'Gasto / pago', ingreso_banco: 'Ingreso en banco',
  compra_cambio: 'Compra de cambio', traer_cambio: 'Cambio del banco', dar_cambio: 'Cambio a caja', reposicion_fondo: 'Reposición de fondo',
  salida_divisa: 'Salida de divisa' };
const CON_JUSTIFICANTE = ['gasto', 'ingreso_banco', 'traer_cambio', 'salida_divisa'];

function sinAcceso(msg) {
  app.innerHTML = `<div class="aviso card"><h2>Este PC no tiene acceso a la caja fuerte</h2><p>${esc(msg || 'Pide el enlace a la oficina.')}</p></div>`;
}

const cuadra = r => Math.round((r.contado - r.teorico) * 100) === 0;
const recBox = r => r ? `<div class="help" style="margin-top:6px">Último recuento ${fdate(r.created_at)} (${esc(r.quien)}): contado ${eur(r.contado)} · ${cuadra(r) ? '<span class="tag green">cuadra</span>'
  : `<span class="tag red">${r.contado > r.teorico ? 'sobran' : 'faltan'} ${eur(Math.abs(r.contado - r.teorico))}</span>`}</div>` : '<div class="help">Sin recuentos todavía.</div>';

function pintar() {
  const sRec = D.saldos.rec.EUR || 0, sCam = D.saldos.cam.EUR || 0;
  const divs = Object.entries(D.saldos.rec).filter(([d, v]) => d !== 'EUR' && v);
  const difCam = Math.round((sCam - D.fondo_cambio) * 100) / 100;
  app.innerHTML = `
  <div class="wrap">
    <div class="grid2">
      <div class="card bote">
        <h3>💰 Recaudación pendiente de ingresar</h3>
        <p class="help">Lo que entra de los cierres y espera a ir al banco. Debería haber:</p>
        <div class="saldo">${eur(sRec)}</div>
        ${divs.map(([d, v]) => `<div><b>+ ${money(v, d)}</b> <span class="help">(${eur(v * (D.divisas[d] || 0))} al cambio fijado)</span></div>`).join('')}
        ${sRec > D.umbral ? `<div class="tag red" style="margin-top:6px">Más de ${eur(D.umbral)} sin ingresar</div>` : ''}
        ${recBox(D.recuentos.rec)}
        <div class="acts">
          <button class="btn sm" data-act="gasto">🧾 Gasto / pago a tercero</button>
          <button class="btn sm" data-act="ingreso">🏦 Ingreso en banco</button>
          ${Object.keys(D.divisas).length ? '<button class="btn sm" data-act="divisa">💱 Salida de divisa</button>' : ''}
          <button class="btn sm pri" data-act="recontar-rec">🔢 Recontar</button>
        </div>
      </div>
      <div class="card bote">
        <h3>🪙 Fondo de cambio</h3>
        <p class="help">Monedas y billetes pequeños para las cajas. <b>Separado físicamente</b> de la recaudación. Objetivo: ${eur(D.fondo_cambio)}.</p>
        <div class="saldo ${difCam ? 'warn' : ''}">${eur(sCam)}</div>
        ${difCam ? `<div class="help">${difCam < 0 ? 'Faltan ' + eur(-difCam) + ' para el objetivo: hay que traer cambio.' : 'Hay ' + eur(difCam) + ' por encima del objetivo.'}</div>` : ''}
        ${recBox(D.recuentos.cam)}
        <div class="acts">
          <button class="btn sm" data-act="darcambio">🔁 Dar cambio a una caja</button>
          <button class="btn sm" data-act="traercambio">🏦 Traer cambio del banco</button>
          <button class="btn sm pri" data-act="recontar-cam">🔢 Recontar</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <h3>Libro de la caja fuerte</h3>
      <p class="help">Todos los movimientos, del más reciente al más antiguo. No se pueden borrar: si hay un error, la oficina hace una corrección.</p>
      <table><tr><th>Fecha</th><th>Bote</th><th>Movimiento</th><th>Detalle</th><th>Quién</th><th>Justificante</th><th class="n">Importe</th></tr>
      ${D.movimientos.map(m => `<tr style="${m.anulado ? 'opacity:.45;text-decoration:line-through' : ''}"><td>${fdate(m.fecha)}</td><td>${m.bote === 'rec' ? 'Recaudación' : 'Cambio'}</td>
        <td>${TIPO[m.tipo] || m.tipo}${m.anulado ? ' <span class="tag grey">anulado</span>' : ''}</td><td>${esc(m.detalle || '')}${m.partida ? `<br><span class="help">${esc(m.partida)} · ${esc(m.aquien || '')}</span>` : ''}</td>
        <td>${esc(m.quien || '')}</td>
        <td>${CON_JUSTIFICANTE.includes(m.tipo) ? (m.tiene_foto ? '<span class="tag green">📎</span>'
          : `<label class="tag amber" style="cursor:pointer">📷 pendiente · añadir<input type="file" accept="image/*,application/pdf" data-foto="${m.id}" hidden></label>`) : ''}</td>
        <td class="n ${m.importe < 0 ? 'bad' : ''}">${m.tipo === 'dar_cambio' ? 'neto 0' : money(m.importe, m.divisa)}</td></tr>`).join('')}
      </table>
    </div>
  </div>`;
  app.querySelectorAll('[data-act]').forEach(b => b.onclick = () => accion(b.dataset.act));
  app.querySelectorAll('[data-foto]').forEach(i => i.onchange = async () => {
    if (!i.files[0]) return;
    try { await subirFoto(Number(i.dataset.foto), i.files[0]); toast('Justificante añadido ✓'); await recargar(); }
    catch (e) { alert(e.message === 'SIN_CONEXION' ? 'Sin conexión. Inténtalo cuando vuelva internet.' : e.message); }
  });
}

async function subirFoto(movId, file) {
  const f = await reducirImagen(file);
  await rpc('caja_adjuntar', { p_token: token, p_ref_tabla: 'movimiento', p_ref_id: movId, p_ref_idx: null, p_nombre: f.nombre, p_mime: f.mime, p_data: f.data });
}

function accion(act) {
  const quienF = `<div class="lbl">Quién lo hace</div><input id="mQuien" placeholder="Nombre" value="${esc(localStorage.ccpb_quien || '')}">`;
  const fotoF = (que = 'del justificante') => `<div class="lbl">Foto ${que}</div><input type="file" id="mFoto" accept="image/*,application/pdf"><p class="help">Si ahora no la tienes, se guarda igual y queda como <b>pendiente</b>.</p>`;
  const pie = `<div class="btns2"><button class="btn pri" id="mOk">Guardar</button><button class="btn" data-cerrar>Cancelar</button></div>`;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const client_id = uuid();  // uno por ventana: si se pulsa dos veces o se reintenta, no se duplica

  async function enviar(p, conFoto) {
    const imp = parseImporte(val('mImp'));
    if (!val('mQuien')) return alert('Falta quién lo hace.');
    if (imp === null || imp <= 0) return alert('Pon un importe mayor que cero.');
    const ok = document.getElementById('mOk'); ok.disabled = true;
    localStorage.ccpb_quien = val('mQuien');
    try {
      const ids = await rpc('caja_mover', { p_token: token, p: { client_id, quien: val('mQuien'), importe: imp, ...p } });
      const file = conFoto && document.getElementById('mFoto')?.files[0];
      let aviso = 'Apuntado en el libro ✓';
      if (file) { try { await subirFoto(ids[0], file); } catch { aviso += ' (la foto no se subió: queda pendiente)'; } }
      cerrarModal(); toast(aviso); await recargar();
    } catch (e) {
      ok.disabled = false;
      // Sin respuesta puede haberse guardado: se bloquean los datos y solo se puede reintentar lo mismo
      if (e.message === 'SIN_CONEXION') document.querySelectorAll('#modal input, #modal select').forEach(el => { el.disabled = true; });
      alert(e.message === 'SIN_CONEXION' ? 'Sin conexión. Puede que NO se haya guardado. Pulsa Guardar otra vez cuando vuelva internet (no se duplica).' : 'No se ha guardado: ' + e.message);
    }
  }

  if (act === 'gasto') {
    modal(`<h3>🧾 Gasto o pago a tercero (desde la caja fuerte)</h3>
      <div class="lbl">Partida</div><select id="mPart">${D.partidas.map(p => `<option>${esc(p)}</option>`).join('')}</select>
      <div class="lbl">A quién se paga</div><input id="mAq" placeholder="Proveedor o persona">
      <div class="lbl">Importe</div><input id="mImp" class="num" placeholder="0,00">
      <div class="lbl">Concepto</div><input id="mDet" placeholder="Qué se ha pagado">
      ${quienF}${fotoF()}${pie}`);
    document.getElementById('mOk').onclick = () => {
      if (!val('mAq')) return alert('Falta a quién se paga.');
      enviar({ tipo: 'gasto', partida: val('mPart'), aquien: val('mAq'), detalle: val('mDet') }, true);
    };
  }
  if (act === 'ingreso') {
    modal(`<h3>🏦 Ingreso en banco</h3><p class="help">Dinero que sale de la recaudación para ingresarlo en la cuenta. La oficina lo comprueba con el extracto.</p>
      <div class="lbl">Importe ingresado</div><input id="mImp" class="num" placeholder="0,00">
      <div class="lbl">Oficina / forma</div><input id="mDet" value="Ingreso en ventanilla">
      ${quienF}${fotoF('del resguardo del banco')}${pie}`);
    document.getElementById('mOk').onclick = () => enviar({ tipo: 'ingreso_banco', detalle: val('mDet') }, true);
  }
  if (act === 'divisa') {
    modal(`<h3>💱 Salida de divisa</h3><p class="help">Divisas que salen de la caja fuerte (ingresadas en el banco o cambiadas a euros).</p>
      <div class="lbl">Divisa</div><select id="mDiv">${Object.keys(D.divisas).map(d => `<option>${esc(d)}</option>`).join('')}</select>
      <div class="lbl">Importe (en la divisa)</div><input id="mImp" class="num" placeholder="0,00">
      <div class="lbl">Qué se ha hecho</div><select id="mDet"><option>Ingresada en el banco</option><option>Cambiada a euros</option></select>
      ${quienF}${fotoF('del resguardo')}${pie}`);
    document.getElementById('mOk').onclick = () => enviar({ tipo: 'salida_divisa', divisa: val('mDiv'), detalle: val('mDet') }, true);
  }
  if (act === 'darcambio') {
    modal(`<h3>🔁 Dar cambio a una caja</h3><p class="help">La caja entrega billetes y recibe monedas por el mismo importe. El total no cambia, pero queda apuntado.</p>
      <div class="lbl">Caja</div><select id="mCaja">${D.cajas.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <div class="lbl">Importe cambiado</div><input id="mImp" class="num" placeholder="0,00">${quienF}${pie}`);
    document.getElementById('mOk').onclick = () => enviar({ tipo: 'dar_cambio', caja: val('mCaja') }, false);
  }
  if (act === 'traercambio') {
    modal(`<h3>🏦 Traer cambio del banco</h3>
      <div class="lbl">Importe en cambio</div><input id="mImp" class="num" placeholder="0,00">
      <div class="lbl">¿Cómo se ha pagado?</div>
      <select id="mPago"><option value="rec">Con efectivo de la recaudación (sale de la caja fuerte)</option><option value="cuenta">Cargo en la cuenta del banco</option></select>
      ${quienF}${fotoF('del resguardo')}${pie}`);
    document.getElementById('mOk').onclick = () => enviar({ tipo: 'traer_cambio', pago_con: val('mPago') }, true);
  }
  if (act.startsWith('recontar')) recontar(act.endsWith('rec') ? 'rec' : 'cam');
}

function recontar(bote) {
  const piezas = {};
  const divisas = bote === 'rec' ? Object.keys(D.divisas) : [];
  const m = modal(`<h3>🔢 Recontar ${bote === 'rec' ? 'la recaudación' : 'el fondo de cambio'}</h3>
    <p class="help">Cuenta lo que hay físicamente. El sistema no te dice antes cuánto debería haber.</p>
    <div style="max-height:46vh;overflow:auto" id="rPz"></div>
    <div class="res" style="margin-top:12px"><div class="b"><span>Total contado (euros)</span><span id="rTot">${eur(0)}</span></div></div>
    ${divisas.map(d => `<div class="row"><div>${esc(d)} contados (importe)</div><input class="num" data-rdiv="${esc(d)}" style="flex:0 0 140px" placeholder="0,00"></div>`).join('')}
    <div class="lbl">Quién cuenta</div><input id="mQuien" placeholder="Nombre" value="${esc(localStorage.ccpb_quien || '')}">
    <div class="btns2"><button class="btn pri" id="mOk">Guardar recuento</button><button class="btn" data-cerrar>Cancelar</button></div>`, true);
  montarPiezas(m.querySelector('#rPz'), piezas, () => { m.querySelector('#rTot').textContent = eur(totalPiezas(piezas)); });
  m.querySelector('#mOk').onclick = async () => {
    const quien = m.querySelector('#mQuien').value.trim();
    if (!quien) return alert('Falta quién cuenta.');
    m.querySelector('#mOk').disabled = true;
    localStorage.ccpb_quien = quien;
    try {
      const res = [['EUR', await rpc('caja_recontar', { p_token: token, p_bote: bote, p_divisa: 'EUR', p_piezas: piezas, p_importe: null, p_quien: quien })]];
      for (const i of m.querySelectorAll('[data-rdiv]')) {
        const v = parseImporte(i.value);
        if (v !== null) res.push([i.dataset.rdiv, await rpc('caja_recontar', { p_token: token, p_bote: bote, p_divisa: i.dataset.rdiv, p_piezas: {}, p_importe: v, p_quien: quien })]);
      }
      cerrarModal(); await recargar();
      const malos = res.filter(([, r]) => Math.round(r.diferencia * 100) !== 0);
      alert(!malos.length ? 'Recuento guardado. Cuadra ✓'
        : 'Recuento guardado. ' + malos.map(([d, r]) => `${r.diferencia > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(r.diferencia), d)}`).join(' · ') + '. Queda registrado y se avisa a la oficina.');
    } catch (e) {
      m.querySelector('#mOk').disabled = false;
      alert(e.message === 'SIN_CONEXION' ? 'Sin conexión. NO se ha guardado.' : 'No se ha guardado: ' + e.message);
    }
  };
}

async function recargar() { D = await rpc('caja_fuerte', { p_token: token }); pintar(); }

async function arrancar() {
  if (!token) return sinAcceso();
  try {
    const P = await rpc('caja_puesto', { p_token: token });
    document.getElementById('puesto').textContent = `${P.puesto.nombre} · ${P.terminal.nombre}`;
    botonInstalar(token, 'Caja fuerte');
    await recargar();
  } catch (e) { sinAcceso(e.message === 'SIN_CONEXION' ? 'No hay conexión a internet. Revisa la red y recarga la página.' : e.message === 'No autorizado' ? 'Este enlace es de una caja, no de la caja fuerte.' : e.message); }
}
arrancar();
