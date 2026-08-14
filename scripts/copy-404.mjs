// Copia index.html a 404.html dentro del build de salida.
// GitHub Pages no soporta rewrites del lado del servidor: al recargar o entrar
// directo a una ruta como /pantalla-secundaria, sirve el 404.html tal cual
// exista. Si ese 404.html es una copia de index.html, el Router de Angular
// arranca igual y resuelve la ruta correcta del lado del cliente.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const carpetaBrowser = join(__dirname, '..', 'dist', 'casa-cambio', 'browser');
const origen = join(carpetaBrowser, 'index.html');
const destino = join(carpetaBrowser, '404.html');

if (!existsSync(origen)) {
  console.error(`No se encontró ${origen}. ¿Corriste el build antes de este script?`);
  process.exit(1);
}

copyFileSync(origen, destino);
console.log(`404.html generado a partir de index.html en ${carpetaBrowser}`);
