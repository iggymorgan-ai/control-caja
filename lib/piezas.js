// Contador de monedas y billetes: − / + / teclear, Intro salta a la siguiente. Igual que la beta.
import { MONEDAS, BILLETES, eur, totalPiezas } from './calculos.js?v=1793972486';

const COLOR = { 5: '#8a96a3', 10: '#d6334a', 20: '#2f6fd0', 50: '#ef8a1f', 100: '#1f9d55', 200: '#c9a227', 500: '#8a4fc9' };

export function montarPiezas(el, piezas, onChange) {
  const linea = (v, billete) => {
    const k = String(v), n = piezas[k] || 0;
    const etiqueta = billete ? v + '€' : (v < 1 ? Math.round(v * 100) + 'c' : v + '€');
    const cls = billete ? 'chip bill' : 'chip coin' + (v < 0.1 ? ' cu' : '');
    return `<div class="pz"><div class="${cls}" ${billete ? `style="background:${COLOR[v]}"` : ''}>${etiqueta}</div>
      <button type="button" data-k="${k}" data-d="-1">−</button>
      <input data-k="${k}" value="${n}" inputmode="numeric">
      <button type="button" data-k="${k}" data-d="1">+</button>
      <div class="sub">${eur(totalPiezas({ [k]: n }))}</div></div>`;
  };
  const resumen = vals => {
    const sub = Object.fromEntries(vals.map(v => [String(v), piezas[String(v)] || 0]));
    return `${vals.reduce((s, v) => s + (piezas[String(v)] || 0), 0)} uds. · ${eur(totalPiezas(sub))}`;
  };
  function pintar(foco) {
    el.innerHTML = `<div class="sechead">Monedas <span>${resumen(MONEDAS)}</span></div>${MONEDAS.map(v => linea(v, false)).join('')}
      <div class="sechead" style="margin-top:16px">Billetes <span>${resumen(BILLETES)}</span></div>${BILLETES.map(v => linea(v, true)).join('')}`;
    el.querySelectorAll('button[data-d]').forEach(b => b.onclick = () => {
      const k = b.dataset.k; piezas[k] = Math.max(0, (piezas[k] || 0) + Number(b.dataset.d));
      if (!piezas[k]) delete piezas[k];
      pintar(); onChange(piezas);
    });
    const ins = [...el.querySelectorAll('input[data-k]')];
    ins.forEach((i, ix) => {
      i.onfocus = () => i.select();
      const fijar = (salto) => {
        const n = Math.max(0, parseInt(i.value, 10) || 0);
        if (n) piezas[i.dataset.k] = n; else delete piezas[i.dataset.k];
        pintar(salto ? ix + 1 : undefined); onChange(piezas);
      };
      i.onchange = () => fijar(false);
      i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.onchange = null; fijar(true); } };
    });
    if (foco !== undefined && ins[foco]) el.querySelectorAll('input[data-k]')[foco]?.focus();
  }
  pintar();
  return { repintar: () => pintar() };
}
