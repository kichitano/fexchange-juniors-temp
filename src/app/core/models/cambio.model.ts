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

/** Dinero sacado físicamente de la caja (para guardar, aligerar la carga, etc.). */
export interface RetiroCaja {
  id: string;
  fecha: string;
  hora: string;
  moneda: Moneda;
  monto: number;
  nota: string;
}

/**
 * Monto con el que arranca la caja de un día. Al fijarlo, la caja de ese día
 * se "limpia": las operaciones y retiros que ya existían en ese momento
 * (idsExcluidos) dejan de sumarse.
 */
export interface SaldoInicialCaja {
  fecha: string;
  hora: string;
  moneda: Moneda;
  monto: number;
  idsExcluidos: string[];
}
