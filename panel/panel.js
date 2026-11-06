// Panel de Javier: la cadena del efectivo contra SU Proxium y SU extracto, configuración y puestos.
import { porDia, conciliarIngresos, conciliarTarjetas, cadenaEfectivo, alertas, parseExtracto, gastosTodos, ultimoRecuento,
         saldo, eur, esc, fdate, parseImporte } from '../lib/calculos.js?v=1793972486';
import { rpc, login, logout, sesion } from '../lib/api.js?v=1793972486';
import { toast, modal, cerrarModal, hoyCanarias, money } from '../lib/ui.js?v=1793972486';
import { textoBat, descargarBat } from '../lib/acceso.js?v=1793972486';

const C = window.CFG;
const T = C.TERMINAL;
const app = document.getElementById('app');
const dia = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const dayName = d => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(d + 'T12:00').getDay()];
const num = v => v == null ? '' : String(v).replace('.', ',');
let periodo = { desde: dia(hoyCanarias(), -6), hasta: hoyCanarias() };
let D;  // caja_datos

const TIPO = { saldo_inicial: 'Saldo inicial', entrada_cierre: 'Entrada de cierre', gasto: 'Gasto / pago', ingreso_banco: 'Ingreso en banco',
  compra_cambio: 'Compra de cambio', traer_cambio: 'Cambio del banco', dar_cambio: 'Cambio a caja', reposicion_fondo: 'Reposición de fondo',
  salida_divisa: 'Salida de divisa' };

const fallo = e => alert(e.message === 'SIN_CONEXION' ? 'Sin conexión. Revisa internet.' : e.message);

// ───────────────────────────── login
function pintarLogin(msg) {
  document.getElementById('tabs').style.display = 'none';
  document.getElementById('salir').style.display = 'none';
  app.innerHTML = `<div class="aviso card" style="text-align:left">
    <h2>Panel de control</h2><p class="help">Entra con tu email y contraseña de administrador.</p>
    <form id="fLogin"><div class="lbl">Email</div><input id="lEmail" type="email" autocomplete="username" required>
    <div class="lbl">Contraseña</div><input id="lPass" type="password" autocomplete="current-password" required>
    ${msg ? `<p class="bad">${esc(msg)}</p>` : ''}
    <button class="btn pri" style="margin-top:14px">Entrar</button></form></div>`;
  document.getElementById('fLogin').onsubmit = async e => {
    e.preventDefault();
    try { await login(document.getElementById('lEmail').value.trim(), document.getElementById('lPass').value); arrancar(); }
    catch (err) { pintarLogin(err.message); }
  };
}

// ───────────────────────────── panel
async function cargar() { D = await rpc('caja_datos', { p_terminal: T, p_desde: periodo.desde, p_hasta: periodo.hasta }); }

function calcularTodo() {
  const tasas = D.terminal.divisas || {};
  const dias = porDia(D.arqueos, D.proxium, tasas);
  const conc = conciliarIngresos(D.movs, D.extracto);
  const tarj = conciliarTarjetas(D.proxium, D.extracto);
  const cad = cadenaEfectivo({ ...D, tasas });
  const gastos = gastosTodos(D.arqueos, D.movs);
  const A = alertas({ dias, conc, tarj, recuentos: D.recuentos, arqueos: D.arqueos, movs: D.movs, umbral: D.terminal.umbral });
  return { tasas, dias, conc, tarj, cad, gastos, A };
}

function pintarPanel() {
  const { tasas, dias, conc, tarj, cad, gastos, A } = calcularTodo();
  const pxTj = dias.reduce((s, d) => s + (d.px?.tj || 0), 0), pxEf = cad.pxEf, ventas = pxEf + pxTj;
  const ingDecl = -D.movs.filter(m => !m.anulado && m.tipo === 'ingreso_banco').reduce((s, m) => s + m.importe, 0);
  const divEur = Math.round((cad.enLibro - saldo(D.movs, 'rec')) * 100) / 100;
  const ur = ultimoRecuento(D.recuentos, 'rec');
  const sinJ = cad.sinJustificar, okJ = Math.abs(sinJ) < 1;
  const porPartida = {}; gastos.forEach(g => porPartida[g.partida] = (porPartida[g.partida] || 0) + g.importe);
  const partidas = Object.entries(porPartida).sort((a, b) => b[1] - a[1]); const top = partidas[0]?.[1] || 1;
  const graves = A.filter(a => a.nivel === 'grave').length;
  const anulado = r => r.anulado ? ' style="opacity:.45;text-decoration:line-through"' : '';
  app.innerHTML = `
  <div class="wrap">
    <div class="card" style="margin-bottom:18px;display:flex;gap:12px;align-items:end;flex-wrap:wrap">
      <div><div class="lbl" style="margin-top:0">Desde</div><input type="date" id="pDesde" value="${periodo.desde}"></div>
      <div><div class="lbl" style="margin-top:0">Hasta</div><input type="date" id="pHasta" value="${periodo.hasta}"></div>
      <button class="btn sm" data-rango="7">Últimos 7 días</button><button class="btn sm" data-rango="mes">Este mes</button>
      <button class="btn sm pri" id="pVer">Ver</button>
      <span class="help" style="margin-left:auto">${esc(D.terminal.nombre)}</span>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="k">Ventas según Proxium</div><div class="v">${eur(ventas)}</div><div class="s">${dias.filter(d => d.px).length} días con datos</div></div>
      <div class="kpi"><div class="k">· en efectivo</div><div class="v">${eur(pxEf)}</div><div class="s">${Math.round(pxEf / (ventas || 1) * 100)} %</div></div>
      <div class="kpi"><div class="k">· con tarjeta</div><div class="v">${eur(pxTj)}</div><div class="s">${Math.round(pxTj / (ventas || 1) * 100)} %</div></div>
      <div class="kpi"><div class="k">Ingresado en banco</div><div class="v">${eur(cad.ingConf)}</div><div class="s">declarado ${eur(ingDecl)}</div></div>
      <div class="kpi"><div class="k">En caja fuerte (teórico)</div><div class="v">${eur(cad.enLibro)}</div><div class="s">incl. divisas ${eur(divEur)}</div></div>
      <div class="kpi" style="${graves ? 'border-color:#f0b6bf;background:var(--redbg)' : ''}"><div class="k">Alertas</div><div class="v ${graves ? 'bad' : 'good'}">${A.length}</div><div class="s">${graves} graves</div></div>
    </div>
    <div class="grid2">
      <div class="card">
        <h3>¿Dónde está el efectivo?</h3>
        <p class="help">Cuenta hecha con <b>tu Proxium</b> y <b>tu extracto</b>, no con lo que declara el personal.</p>
        <div class="chain">
          <div class="st"><span>Saldo de caja fuerte al empezar el periodo</span><b>${eur(cad.sIni)}</b></div>
          <div class="st"><span>+ Efectivo vendido (Proxium)</span><b>${eur(cad.pxEf)}</b></div>
          <div class="st"><span>− Gastos pagados desde las cajas</span><b>${eur(cad.salCajas)}</b></div>
          <div class="st"><span>− Gastos y pagos desde caja fuerte</span><b>${eur(cad.gastosFuerte)}</b></div>
          <div class="st"><span>− Ingresado en el banco (según extracto)</span><b>${eur(cad.ingConf)}</b></div>
          <div class="st"><span>− Cambio comprado con recaudación</span><b>${eur(cad.cambioRec)}</b></div>
          <div class="st"><span>+ Fondo repuesto desde el cambio</span><b>${eur(cad.reposiciones)}</b></div>
          ${cad.salidaDivisas ? `<div class="st"><span>− Divisas ingresadas o cambiadas (al cambio fijado)</span><b>${eur(cad.salidaDivisas)}</b></div>` : ''}
          <div class="st tot"><span>= Debería haber en caja fuerte</span><span>${eur(cad.deberia)}</span></div>
          <div class="st"><span>Según el libro de caja fuerte</span><b>${eur(cad.enLibro)}</b></div>
          ${ur ? `<div class="st"><span>Último recuento físico (${fdate(ur.fecha)})</span><b>${eur(ur.contado)}</b></div>` : ''}
          <div class="st ${okJ ? 'ok' : 'alert'}"><span>${okJ ? 'Todo justificado' : 'Efectivo SIN JUSTIFICAR'}</span><span>${eur(sinJ)}</span></div>
        </div>
        <p class="help" style="margin-top:8px">El «sin justificar» junta: descuadres de cajas, diferencias entre lo que dijeron que ingresaron y lo que llegó al banco, y lo que pudiera faltar en la caja fuerte.</p>
      </div>
      <div class="card">
        <h3>Alertas</h3>
        ${A.length ? `<ul class="alerts" style="padding-left:18px">${A.map(a => `<li><span class="tag ${a.nivel === 'grave' ? 'red' : 'amber'}">${a.nivel}</span> ${a.texto}</li>`).join('')}</ul>` : '<p class="good">Todo cuadra ✓</p>'}
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>Día a día · cierres contra Proxium</h3>
      <p class="help">Las columnas de Proxium las rellenas <b>tú</b>. Escribe la cifra y pulsa Intro (o sal de la casilla). Para un día sin cierres, añádelo abajo.</p>
      <table><tr><th>Día</th><th>Barcos</th><th class="n">Cierres/aperturas</th><th class="n">Proxium efectivo</th><th class="n">Efectivo cierres</th><th class="n">Descuadre</th><th class="n">Proxium tarjeta</th><th class="n">Tarjeta cierres</th><th class="n">Descuadre</th></tr>
      ${dias.map(d => `<tr><td>${dayName(d.fecha)} ${fdate(d.fecha)}</td><td>${d.barcos.map(esc).join('<br>')}</td><td class="n">${d.cierres}/${d.aperturas}</td>
        <td class="n"><input class="pin" data-px="${d.fecha}" data-k="ef" value="${d.px ? num(d.px.ef) : ''}" placeholder="—"></td><td class="n">${eur(d.declEf)}</td>
        <td class="n ${d.dEf === null ? '' : Math.abs(d.dEf) < 1 ? 'good' : 'bad'}">${d.dEf === null ? '—' : Math.abs(d.dEf) < 1 ? '✓' : eur(d.dEf)}</td>
        <td class="n"><input class="pin" data-px="${d.fecha}" data-k="tj" value="${d.px ? num(d.px.tj) : ''}" placeholder="—"></td><td class="n">${eur(d.declTj)}</td>
        <td class="n ${d.dTj === null ? '' : Math.abs(d.dTj) < 1 ? 'good' : 'bad'}">${d.dTj === null ? '—' : Math.abs(d.dTj) < 1 ? '✓' : eur(d.dTj)}</td></tr>`).join('')}
      </table>
      <div class="row" style="max-width:520px;margin-top:10px"><input type="date" id="pxDia" min="${periodo.desde}" max="${periodo.hasta}"><input id="pxEf" class="num" placeholder="Efectivo"><input id="pxTj" class="num" placeholder="Tarjeta"><button class="btn sm" id="pxAdd">Añadir día</button></div>
    </div>

    <div class="grid2" style="margin-top:20px">
      <div class="card">
        <h3>Conciliación bancaria</h3>
        <h4>Ingresos de efectivo</h4>
        <table><tr><th>Declarado</th><th>Quién</th><th class="n">Importe</th><th>En el extracto</th></tr>
        ${conc.res.map(r => `<tr><td>${fdate(r.mov.fecha)}</td><td>${esc(r.mov.quien)}</td><td class="n">${eur(r.imp)}</td>
          <td>${r.estado === 'ok' ? `<span class="tag green">✓ ${fdate(r.linea.fecha)}</span>` : r.estado === 'distinto' ? `<span class="tag red">${eur(r.linea.importe)} el ${fdate(r.linea.fecha)}</span>` : '<span class="tag red">no aparece</span>'}</td></tr>`).join('')}
        ${conc.sueltas.map(e => `<tr><td colspan="2"><span class="help">En el extracto sin declarar</span></td><td class="n">${eur(e.importe)}</td><td><span class="tag amber">${fdate(e.fecha)} ${esc(e.concepto)}</span></td></tr>`).join('')}
        </table>
        <h4>Tarjetas (abonos del datáfono)</h4>
        <table><tr><th>Ventas del</th><th class="n">Proxium</th><th class="n">Abonado</th><th class="n">Comisión</th><th></th></tr>
        ${tarj.map(t => `<tr><td>${fdate(t.fecha)}</td><td class="n">${eur(t.tj)}</td><td class="n">${t.linea ? eur(t.linea.importe) : '—'}</td><td class="n">${t.linea ? eur(t.comision) : ''}</td><td>${t.linea ? '<span class="tag green">✓</span>' : '<span class="tag amber">sin abono</span>'}</td></tr>`).join('')}
        </table>
      </div>
      <div class="card">
        <h3>Gastos y pagos a terceros en efectivo</h3>
        ${partidas.map(([p, v]) => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>${esc(p)}</span><b>${eur(v)}</b></div><div class="bar" style="width:${Math.max(4, v / top * 100)}%"></div></div>`).join('') || '<p class="help">Sin gastos en el periodo.</p>'}
        <h4>Detalle</h4>
        <table><tr><th>Fecha</th><th>Partida · a quién</th><th>Desde</th><th class="n">Importe</th><th></th></tr>
        ${gastos.map(g => `<tr><td>${fdate(g.fecha)}</td><td>${esc(g.partida)}<br><span class="help">${esc(g.aquien)} · ${esc(g.quien)}</span></td><td>${esc(g.origen)}</td><td class="n">${eur(g.importe)}</td>
          <td>${g.foto ? `<button class="tag green" style="border:0" data-ver="${g.ref.tabla}|${g.ref.id}|${g.ref.idx ?? ''}">📎 ver</button>` : '<span class="tag amber">sin foto</span>'}</td></tr>`).join('')}
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>Extracto bancario</h3>
      <p class="help">Lo descargas tú de tu banca. Pega las líneas (<code>fecha;concepto;importe</code>, una por línea, fecha AAAA-MM-DD o DD/MM/AAAA) o sube el fichero .csv. Pegar dos veces lo mismo no duplica.</p>
      <textarea id="extTxt" rows="3" placeholder="2026-11-02;INGRESO EFECTIVO OF. 2104;8000"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><button class="btn sm pri" id="extAdd">Añadir al extracto</button>
        <label class="btn sm">📄 Subir .csv<input type="file" id="extFile" accept=".csv,.txt,text/csv,text/plain" hidden></label></div>
      <table style="margin-top:12px"><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="n">Importe</th><th></th></tr>
      ${[...D.extracto].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(e => `<tr><td>${fdate(e.fecha)}</td><td>${esc(e.concepto)}</td><td>${{ ingreso: 'Ingreso efectivo', tpv: 'Abono datáfono', cargo: 'Cargo' }[e.tipo]}</td><td class="n ${e.importe < 0 ? 'bad' : ''}">${eur(e.importe)}</td><td><button class="x" data-ext="${e.id}" title="Quitar línea">×</button></td></tr>`).join('')}
      </table>
    </div>

    <div class="grid2" style="margin-top:20px">
      <div class="card">
        <h3>Arqueos del periodo</h3>
        <p class="help">Lo guardado no se borra. «Corregir» lo anula con un motivo y deja el rastro; el personal repite el arqueo bien hecho.</p>
        <table><tr><th>Fecha</th><th>Caja · barco</th><th>Quién</th><th class="n">Contado</th><th></th></tr>
        ${[...D.arqueos].reverse().map(a => `<tr${anulado(a)}><td>${fdate(a.fecha)}<br><span class="help">${a.tipo}</span></td><td>${esc(a.caja)} · ${esc(a.barco)}</td><td>${esc(a.quien)}</td><td class="n">${eur(a.contado)}</td>
          <td>${a.anulado ? '<span class="tag grey">anulado</span>' : `<button class="btn sm" data-anular="arqueo|${a.id}">Corregir</button>`}</td></tr>`).join('')}
        </table>
      </div>
      <div class="card">
        <h3>Libro de la caja fuerte</h3>
        <table><tr><th>Fecha</th><th>Movimiento</th><th>Quién</th><th class="n">Importe</th><th></th></tr>
        ${[...D.movs].reverse().map(m => `<tr${anulado(m)}><td>${fdate(m.fecha)}</td><td>${TIPO[m.tipo] || m.tipo} <span class="help">· ${m.bote === 'rec' ? 'recaudación' : 'cambio'}</span><br><span class="help">${esc(m.detalle || '')}${m.aquien ? ' · ' + esc(m.aquien) : ''}</span></td>
          <td>${esc(m.quien || '')}</td><td class="n ${m.importe < 0 ? 'bad' : ''}">${m.tipo === 'dar_cambio' ? 'neto 0' : money(m.importe, m.divisa)}</td>
          <td>${m.id == null ? '' : m.anulado ? '<span class="tag grey">anulado</span>' : `${m.tiene_foto ? `<button class="tag green" style="border:0" data-ver="movimiento|${m.id}|">📎</button> ` : ''}<button class="btn sm" data-anular="movimiento|${m.id}">Corregir</button>`}</td></tr>`).join('')}
        </table>
      </div>
    </div>
  </div>`;
  enlazarPanel();
}

function enlazarPanel() {
  const $ = id => document.getElementById(id);
  $('pVer').onclick = () => { periodo = { desde: $('pDesde').value, hasta: $('pHasta').value }; refrescar(); };
  app.querySelectorAll('[data-rango]').forEach(b => b.onclick = () => {
    const h = hoyCanarias();
    periodo = b.dataset.rango === 'mes' ? { desde: h.slice(0, 8) + '01', hasta: h } : { desde: dia(h, -6), hasta: h };
    refrescar();
  });
  app.querySelectorAll('[data-px]').forEach(i => {
    const guardar = async () => {
      const v = parseImporte(i.value);
      if (v === null && i.value.trim() !== '') return alert('Importe no válido');
      try {
        await rpc('caja_guardar_proxium', { p_terminal: T, p_fecha: i.dataset.px, p_ef: i.dataset.k === 'ef' ? (v ?? 0) : null, p_tj: i.dataset.k === 'tj' ? (v ?? 0) : null });
        await refrescar(); toast('Proxium guardado ✓');
      } catch (e) { fallo(e); }
    };
    i.onchange = guardar;
    i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } };
  });
  $('pxAdd').onclick = async () => {
    if (!$('pxDia').value) return alert('Elige el día');
    try {
      await rpc('caja_guardar_proxium', { p_terminal: T, p_fecha: $('pxDia').value, p_ef: parseImporte($('pxEf').value) ?? 0, p_tj: parseImporte($('pxTj').value) ?? 0 });
      await refrescar(); toast('Proxium guardado ✓');
    } catch (e) { fallo(e); }
  };
  const cargarExtracto = async texto => {
    const lineas = parseExtracto(texto);
    if (!lineas.length) return alert('No he encontrado líneas con el formato fecha;concepto;importe.');
    try { const n = await rpc('caja_cargar_extracto', { p_terminal: T, p_lineas: lineas }); await refrescar(); toast(`${n} línea(s) nuevas (de ${lineas.length})`); }
    catch (e) { fallo(e); }
  };
  $('extAdd').onclick = () => cargarExtracto($('extTxt').value);
  $('extFile').onchange = async () => { const f = $('extFile').files[0]; if (f) cargarExtracto(await leerTexto(f)); };
  app.querySelectorAll('[data-ext]').forEach(b => b.onclick = async () => {
    if (!confirm('¿Quitar esta línea del extracto?')) return;
    try { await rpc('caja_borrar_extracto', { p_id: Number(b.dataset.ext) }); await refrescar(); } catch (e) { fallo(e); }
  });
  app.querySelectorAll('[data-ver]').forEach(b => b.onclick = async () => {
    const [tabla, id, idx] = b.dataset.ver.split('|');
    try {
      const f = await rpc('caja_foto', { p_ref_tabla: tabla, p_ref_id: Number(id), p_ref_idx: idx === '' ? null : Number(idx) });
      if (!f) return alert('No encuentro la foto.');
      // Se monta con propiedades del DOM, nunca pegando el contenido en el HTML
      const m = modal(`<h3>${esc(f.nombre || 'Justificante')}</h3><div id="fotoSitio"></div><button class="btn" data-cerrar>Cerrar</button>`, true);
      const mime = ['image/jpeg', 'image/png', 'application/pdf'].includes(f.mime) ? f.mime : 'application/octet-stream';
      const src = `data:${mime};base64,${String(f.data).replace(/[^A-Za-z0-9+/=]/g, '')}`;
      let el;
      if (mime === 'application/pdf') { el = document.createElement('a'); el.href = src; el.download = f.nombre || 'justificante.pdf'; el.textContent = 'Descargar PDF'; }
      else { el = document.createElement('img'); el.className = 'foto-grande'; el.src = src; }
      m.querySelector('#fotoSitio').appendChild(el);
    } catch (e) { fallo(e); }
  });
  app.querySelectorAll('[data-anular]').forEach(b => b.onclick = () => {
    const [tabla, id] = b.dataset.anular.split('|');
    modal(`<h3>Corregir ${tabla === 'arqueo' ? 'arqueo' : 'movimiento'}</h3>
      <p class="help">Queda anulado (no se borra) con el motivo y tu nombre. ${tabla === 'arqueo' ? 'También se anula lo que ese cierre metió en la caja fuerte.' : ''}</p>
      <div class="lbl">Motivo</div><input id="mMotivo" placeholder="Ej.: caja equivocada, importe mal tecleado…">
      <div class="btns2"><button class="btn pri danger" id="mOk">Anular</button><button class="btn" data-cerrar>Cancelar</button></div>`);
    document.getElementById('mOk').onclick = async () => {
      const motivo = document.getElementById('mMotivo').value.trim();
      if (!motivo) return alert('Falta el motivo.');
      try { await rpc('caja_anular', { p_tabla: tabla, p_id: Number(id), p_motivo: motivo }); cerrarModal(); await refrescar(); toast('Anulado ✓'); }
      catch (e) { fallo(e); }
    };
  });
}

// Los CSV de los bancos españoles suelen venir en Windows-1252: si no es UTF-8 válido, se relee así
async function leerTexto(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

async function refrescar() {
  const y = window.scrollY;
  try { await cargar(); pintarPanel(); window.scrollTo(0, y); } catch (e) { fallo(e); }
}

// ───────────────────────────── configuración
function pintarConfig() {
  const t = D.terminal;
  app.innerHTML = `
  <div class="wrap grid2">
    <div class="card">
      <h3>${esc(t.nombre)}</h3>
      <div class="lbl">Fondo por caja (€)</div><input id="cFondo" class="num" value="${num(t.fondo)}">
      <div class="lbl">Cajas (una por línea)</div><textarea id="cCajas" rows="3">${t.cajas.map(esc).join('\n')}</textarea>
      <div class="lbl">Fondo de cambio objetivo (€)</div><input id="cCambio" class="num" value="${num(t.fondo_cambio)}">
      <div class="lbl">Avisar si la recaudación sin ingresar supera (€)</div><input id="cUmbral" class="num" value="${num(t.umbral)}">
      <label class="row" style="justify-content:flex-start;gap:8px;margin-top:12px"><input type="checkbox" id="cPx" style="width:auto;flex:0" ${t.proxium_obligatorio ? 'checked' : ''}> «Según Proxium» obligatorio en los cierres</label>
      <h4>Moneda extranjera · cambio fijo</h4>
      <p class="help">Provisional: falta confirmar qué divisas y a qué cambio las registra Proxium. Una por línea: <code>USD=0,92</code>. Vacío = no se aceptan.</p>
      <textarea id="cDiv" rows="3">${Object.entries(t.divisas || {}).map(([d, v]) => `${esc(d)}=${num(v)}`).join('\n')}</textarea>
      <h4>Saldo inicial de la caja fuerte</h4>
      <p class="help">Solo el primer día (lo que haya en la caja fuerte al empezar a usar esto). Queda apuntado en el libro.</p>
      <div class="row"><select id="sBote"><option value="rec">Recaudación</option><option value="cam">Fondo de cambio</option></select><input id="sImp" class="num" placeholder="0,00"><button class="btn sm" id="sOk">Apuntar</button></div>
    </div>
    <div class="card">
      <h3>Listas</h3>
      <div class="lbl">Partidas de gasto (una por línea)</div><textarea id="cPart" rows="8">${t.partidas.map(esc).join('\n')}</textarea>
      <div class="lbl">Barcos (una por línea)</div><textarea id="cBarcos" rows="8">${t.barcos.map(esc).join('\n')}</textarea>
      <button class="btn pri" id="cSave" style="margin-top:12px">Guardar configuración</button>
    </div>
  </div>`;
  const $ = id => document.getElementById(id);
  const lineas = id => $(id).value.split('\n').map(s => s.trim()).filter(Boolean);
  $('cSave').onclick = async () => {
    const divisas = {};
    for (const l of lineas('cDiv')) {
      const [d, v] = l.split('='); const n = parseImporte(v);
      if (!d || n === null || n <= 0) return alert('Divisa mal escrita: ' + l + ' (ejemplo: USD=0,92)');
      divisas[d.trim().toUpperCase()] = n;
    }
    const p = { fondo: parseImporte($('cFondo').value), cajas: lineas('cCajas'), fondo_cambio: parseImporte($('cCambio').value), umbral: parseImporte($('cUmbral').value),
      proxium_obligatorio: $('cPx').checked, divisas, partidas: lineas('cPart'), barcos: lineas('cBarcos') };
    if (!p.cajas.length || !p.partidas.length || !p.barcos.length) return alert('Las listas de cajas, partidas y barcos no pueden quedar vacías.');
    try { await rpc('caja_guardar_config', { p_terminal: T, p }); await cargar(); toast('Configuración guardada ✓'); } catch (e) { fallo(e); }
  };
  $('sOk').onclick = async () => {
    const v = parseImporte($('sImp').value);
    if (v === null) return alert('Pon el importe.');
    if (!confirm(`¿Apuntar ${eur(v)} como saldo inicial de ${$('sBote').value === 'rec' ? 'la recaudación' : 'el fondo de cambio'}?`)) return;
    try { await rpc('caja_saldo_inicial', { p_terminal: T, p_bote: $('sBote').value, p_importe: v }); $('sImp').value = ''; toast('Saldo inicial apuntado ✓'); }
    catch (e) { fallo(e); }
  };
}

// ───────────────────────────── puestos
const enlace = p => `${C.WEB}${p.rol === 'encargado' ? 'fuerte' : 'caja'}/?p=${p.token}`;

async function pintarPuestos() {
  let lista;
  try { lista = await rpc('caja_puestos_lista', { p_terminal: T }); } catch (e) { return fallo(e); }
  app.innerHTML = `
  <div class="wrap grid2">
    <div class="card">
      <h3>Puestos de ${esc(D.terminal.nombre)}</h3>
      <p class="help">Cada PC entra con su enlace. Si un PC se pierde o alguien deja la empresa, revoca su enlace y crea otro.</p>
      <table><tr><th>Nombre</th><th>Pantalla</th><th>Enlace</th><th></th></tr>
      ${lista.map(p => `<tr style="${p.activo ? '' : 'opacity:.45'}"><td>${esc(p.nombre)}</td><td>${p.rol === 'encargado' ? 'Caja fuerte' : 'Arqueo'}</td>
        <td>${p.activo ? `<button class="btn sm" data-copiar="${esc(enlace(p))}">Copiar enlace</button> <button class="btn sm" data-bat="${p.id}">Descargar acceso directo</button>` : '<span class="tag grey">revocado</span>'}</td>
        <td>${p.activo ? `<button class="btn sm danger" data-revocar="${p.id}">Revocar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="help">Todavía no hay puestos.</td></tr>'}
      </table>
    </div>
    <div class="card">
      <h3>Nuevo puesto</h3>
      <div class="lbl">Nombre</div><input id="nNombre" placeholder="Ej.: Caja 1, PC encargado">
      <div class="lbl">Pantalla</div><select id="nRol"><option value="caja">Arqueo de caja (empleados)</option><option value="encargado">Caja fuerte (encargado)</option></select>
      <button class="btn pri" id="nOk" style="margin-top:12px">Crear enlace</button>
      <div class="note">En el PC de la tienda: descarga el acceso directo, ábrelo (doble clic) y aparece «Arqueo de caja» en el escritorio con impresión directa en la Epson, como el de ahora.</div>
    </div>
  </div>`;
  app.querySelectorAll('[data-copiar]').forEach(b => b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.copiar); toast('Enlace copiado ✓'); });
  app.querySelectorAll('[data-bat]').forEach(b => b.onclick = () => {
    const p = lista.find(x => x.id === b.dataset.bat);
    const nombre = p.rol === 'encargado' ? 'Caja fuerte' : 'Arqueo de caja';
    descargarBat(enlace(p), nombre, `${nombre} - ${p.nombre}.bat`);
  });
  app.querySelectorAll('[data-revocar]').forEach(b => b.onclick = async () => {
    if (!confirm('¿Revocar este enlace? Ese PC dejará de poder entrar.')) return;
    try { await rpc('caja_revocar_puesto', { p_id: b.dataset.revocar }); pintarPuestos(); } catch (e) { fallo(e); }
  });
  document.getElementById('nOk').onclick = async () => {
    const nombre = document.getElementById('nNombre').value.trim();
    if (!nombre) return alert('Pon un nombre al puesto.');
    try { await rpc('caja_crear_puesto', { p_terminal: T, p_nombre: nombre, p_rol: document.getElementById('nRol').value }); toast('Puesto creado ✓'); pintarPuestos(); }
    catch (e) { fallo(e); }
  };
}

// ───────────────────────────── arranque
function vista() {
  const v = (location.hash || '#panel').slice(1);
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  if (v === 'config') pintarConfig(); else if (v === 'puestos') pintarPuestos(); else pintarPanel();
}

async function arrancar() {
  const u = await sesion();
  if (!u) return pintarLogin();
  try { await cargar(); }
  catch (e) {
    if (e.message === 'No autorizado') { await logout(); return pintarLogin('Esta cuenta no es de administrador.'); }
    app.innerHTML = `<div class="aviso card"><h2>No se puede cargar</h2><p>${esc(e.message === 'SIN_CONEXION' ? 'Sin conexión a internet.' : e.message)}</p></div>`; return;
  }
  document.getElementById('tabs').style.display = '';
  document.getElementById('quien').textContent = u.email || '';
  const salir = document.getElementById('salir');
  salir.style.display = ''; salir.onclick = async () => { await logout(); pintarLogin(); };
  vista();
}
window.addEventListener('hashchange', () => { if (D) vista(); });
arrancar();
