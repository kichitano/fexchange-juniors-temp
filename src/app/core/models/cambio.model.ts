export type Moneda = 'CLP' | 'PEN' | 'USD';

export type Operador = 'multiplicar' | 'dividir';

export interface TipoCambioConfig {
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  operador: Operador;
  tasa: number;
}

export interface CambioConfirmado {
  id: string;
  fecha: string;
  hora: string;
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  operador: Operador;
  tasa: number;
  montoIngresado: number;
  montoResultado: number;
}

export const PARES_DISPONIBLES: ReadonlyArray<{ origen: Moneda; destino: Moneda }> = [
  { origen: 'CLP', destino: 'PEN' },
  { origen: 'PEN', destino: 'CLP' },
  { origen: 'USD', destino: 'PEN' },
  { origen: 'PEN', destino: 'USD' },
];

export function claveTipoCambio(origen: Moneda, destino: Moneda): string {
  return `${origen}_${destino}`;
}
