// Justificantes: las fotos se reducen en el navegador (≤1280 px, JPEG) antes de subirlas.
const MAX_BYTES = 2 * 1024 * 1024;

const leerBase64 = blob => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = () => ko(new Error('No se pudo leer el archivo'));
  r.readAsDataURL(blob);
});

export async function reducirImagen(file, maxLado = 1280, calidad = 0.7) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('El archivo es demasiado grande');
    return { nombre: file.name, mime: file.type, data: await leerBase64(file) };
  }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', calidad));
  if (blob.size > MAX_BYTES) throw new Error('El archivo es demasiado grande');
  return { nombre: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data: await leerBase64(blob) };
}
