export function formatearMonto(valor: number): string {
  const negativo = valor < 0;
  const fijo = Math.abs(valor).toFixed(2);
  const [entero, decimales] = fijo.split('.');
  const enteroConEspacios = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negativo ? '-' : ''}${enteroConEspacios},${decimales}`;
}

/** Entero sin decimales, con espacio como separador de miles. Para el campo de monto. */
export function formatearEntero(valor: number): string {
  const negativo = valor < 0;
  const entero = Math.abs(Math.round(valor)).toString();
  const enteroConEspacios = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negativo ? '-' : ''}${enteroConEspacios}`;
}

/** Hasta 2 decimales, sin ceros de más: 275 en vez de 275.00, 275.5 en vez de 275.5000. */
export function formatearTasa(valor: number): string {
  const redondeada = Math.round(valor * 100) / 100;
  return Number.isInteger(redondeada) ? String(redondeada) : redondeada.toFixed(2);
}

/** Cuenta cuántos dígitos hay antes de `posicion` dentro de `texto`. */
export function contarDigitosAntesDe(texto: string, posicion: number): number {
  return texto.slice(0, posicion).replace(/\D/g, '').length;
}

/** Inversa de contarDigitosAntesDe: encuentra la posición de caret tras N dígitos en `texto`. */
export function posicionParaDigitos(texto: string, digitos: number): number {
  if (digitos <= 0) {
    return 0;
  }
  let contados = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i])) {
      contados++;
      if (contados === digitos) {
        return i + 1;
      }
    }
  }
  return texto.length;
}
