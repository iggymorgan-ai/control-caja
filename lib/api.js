// Cliente de Supabase: llamadas del puesto (con su token) y del panel (con login).
const C = window.CFG;
export const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

// Token del puesto: viene en el enlace (?p=...) y se recuerda por pantalla (caja/ y fuerte/ pueden tener enlaces distintos).
export function tokenDeURL() {
  const clave = 'ccpb_token' + location.pathname.replace(/index\.html$/, '');
  const p = new URLSearchParams(location.search).get('p');
  if (p) { localStorage.setItem(clave, p); return p; }
  return localStorage.getItem(clave);
}

const esRed = m => /Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(m || '');

// Llama a una función de la BD. Sin red lanza Error('SIN_CONEXION'); si no, el mensaje de la BD.
export async function rpc(fn, args = {}) {
  if (navigator.onLine === false) throw new Error('SIN_CONEXION');
  let r;
  try { r = await sb.rpc(fn, args); } catch (e) { throw new Error(esRed(e.message) ? 'SIN_CONEXION' : e.message); }
  if (r.error) throw new Error(esRed(r.error.message) ? 'SIN_CONEXION' : r.error.message);
  return r.data;
}

export async function login(email, pass) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message);
  return data.user;
}
export const logout = () => sb.auth.signOut();
export async function sesion() { return (await sb.auth.getSession()).data.session?.user || null; }
