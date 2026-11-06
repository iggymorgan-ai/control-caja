// Instalador del puesto: un .bat que crea en el escritorio el acceso directo de Chrome
// (modo app + impresión directa en la Epson) con el icono propio de la pantalla.
// El icono va dentro del .bat (base64 → certutil), sin descargar nada.
import { CAJA, FUERTE } from './iconos/iconos-b64.js?v=1793972486';

export function textoBat(url, nombre) {
  const lnk = nombre.replace(/[\\/:*?"<>|]/g, '');
  const tipo = /\/fuerte\//.test(url) ? 'fuerte' : 'caja';
  const b64 = (tipo === 'fuerte' ? FUERTE : CAJA).match(/.{1,76}/g);
  const ico = `%LOCALAPPDATA%\\CPB\\${tipo}.ico`;
  const app = url.split('#')[0] + '#app';  // #app: abierto desde el acceso directo (sin «&», que el .bat rompería)
  return ['@echo off',
    'set "C=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not exist "%C%" set "C=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not exist "%C%" set "C=%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not exist "%C%" (echo No encuentro Google Chrome en este PC.& pause & exit /b)',
    'if not exist "%LOCALAPPDATA%\\CPB" mkdir "%LOCALAPPDATA%\\CPB"',
    'del "%TEMP%\\cpb-icono.b64" 2>nul',
    ...b64.map(l => `>>"%TEMP%\\cpb-icono.b64" echo ${l}`),
    `certutil -f -decode "%TEMP%\\cpb-icono.b64" "${ico}" >nul`,
    'del "%TEMP%\\cpb-icono.b64" 2>nul',
    `powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop')+'\\${lnk}.lnk'; Remove-Item -Force -ErrorAction SilentlyContinue $d;` +
    `$s=(New-Object -ComObject WScript.Shell).CreateShortcut($d);` +
    `$s.TargetPath='%C%';` +
    `$s.Arguments='--user-data-dir=\\"%LOCALAPPDATA%\\CPB\\ArqueoCaja\\" --app=${app} --kiosk-printing --no-first-run --no-default-browser-check';` +
    `if (Test-Path '${ico}') { $s.IconLocation='${ico},0' };` +
    `$s.Description='${lnk} CPB';$s.Save()"`,
    'ie4uinit.exe -show >nul 2>&1',
    'echo Acceso directo creado en el escritorio.& pause', ''].join('\r\n');
}

export function descargarBat(url, nombre, archivo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([textoBat(url, nombre)], { type: 'application/octet-stream' }));
  a.download = archivo; a.click();
}

// Botón «Instalar en este PC» en la barra de la pantalla del puesto (caja/ o fuerte/).
// No sale si ya se ha abierto desde el acceso directo.
export function botonInstalar(token, nombre) {
  const nav = document.querySelector('.topnav');
  if (!nav || !token || location.hash === '#app') return;
  const b = document.createElement('button');
  b.textContent = '📌 Instalar en este PC';
  b.title = 'Descarga un archivo que crea el acceso directo en el escritorio (con impresión directa en la Epson)';
  b.onclick = () => descargarBat(location.origin + location.pathname + '?p=' + token, nombre, `Instalar ${nombre}.bat`);
  nav.appendChild(b);
}
