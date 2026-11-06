// Ticket de 80 mm para la Epson (40 caracteres por línea).
import { eur, fdate } from './calculos.js?v=1793972486';

const ANCHO = 40;
const L = (a, b) => { b = String(b); a = String(a).slice(0, ANCHO - b.length - 1); return a.padEnd(ANCHO - b.length, ' ') + b; };
const RAYA = '-'.repeat(ANCHO);
const centro = s => ' '.repeat(Math.max(0, Math.floor((ANCHO - s.length) / 2))) + s;

export function textoTicket(a, c, terminalNombre) {
  const out = [centro('COMERCIANTS DEL PORT · CPB'), centro('ARQUEO DE CAJA · ' + a.tipo.toUpperCase())];
  if (a.id == null) out.push(centro('*** BORRADOR – NO GUARDADO ***'));
  out.push(RAYA, L(terminalNombre, a.caja), 'Barco: ' + a.barco, `Fecha: ${fdate(a.fecha)}  ${a.hora || ''}`.trimEnd(), 'Cuenta: ' + a.quien, RAYA);
  out.push(L('Efectivo contado', eur(c.contado)), L('- Fondo de caja', eur(a.fondo)));
  if (a.tipo === 'cierre') {
    out.push(L('= Efectivo de ventas', eur(c.efCaja)));
    for (const [d, v] of Object.entries(a.divisas || {})) if (Number(v)) out.push(L(`+ ${d} ${v}`, eur(v * (a.tasas?.[d] || 0))));
    out.push(L('+ Salidas de caja', eur(c.sal)));
    for (const s of a.salidas || []) out.push(L('   ' + s.partida + ' · ' + s.aquien, eur(s.importe) + (s.foto ? '  ' : ' *')));
    out.push(L('= Efectivo vendido', eur(c.declarado)), L('Segun Proxium', a.px_ef == null ? '—' : eur(a.px_ef)),
      L('DESCUADRE', c.desc == null ? '—' : eur(c.desc)));
    for (const t of a.tarjetas || []) if (Number(t.importe)) out.push(L('   ' + t.nombre, eur(t.importe)));
    out.push(L('Tarjetas', eur(c.tarj)), L('TOTAL VENTAS', eur(c.total)), RAYA, L('A caja fuerte', eur(c.aCajaFuerte)));
    if ((a.salidas || []).some(s => !s.foto)) out.push('* justificante pendiente');
  } else {
    out.push(L(c.faltaFondo > 0 ? 'Falta para el fondo' : 'Fondo completo', c.faltaFondo > 0 ? eur(c.faltaFondo) : 'OK'));
  }
  if (a.obs) { out.push(RAYA); for (let i = 0, s = 'Obs: ' + a.obs; i < s.length; i += ANCHO) out.push(s.slice(i, i + ANCHO)); }
  out.push(RAYA, '', '', 'Firma: ______________________', '', a.id == null ? 'SIN GUARDAR' : 'Ref. ' + a.id);
  return out.join('\n');
}

// Imprime el ticket. Con Chrome en --kiosk-printing sale directo en la Epson.
export function imprimir(texto) {
  let el = document.getElementById('printArea');
  if (!el) { el = document.createElement('div'); el.id = 'printArea'; document.body.appendChild(el); }
  el.textContent = texto;
  window.print();
}
