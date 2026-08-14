import { Moneda, Operador } from './cambio.model';

export const CANAL_SYNC = 'casa-cambio-sync';

export interface VistaEnVivoPayload {
  tipo: 'vista-en-vivo';
  tipeando: boolean;
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  operador: Operador;
  tasa: number;
  montoIngresado: number;
  montoResultado: number;
}

/** Precio del día para CLP → PEN, independiente del tipo de cambio activo en pantalla. */
export interface PrecioDelDiaPayload {
  tipo: 'precio-dia-actualizado';
  operador: Operador;
  tasa: number;
}

export interface ActividadPayload {
  tipo: 'actividad';
}

export interface ForzarPublicidadPayload {
  tipo: 'forzar-publicidad';
}

export interface CambioConfirmadoPayload {
  tipo: 'cambio-confirmado';
}

export interface PopupReadyPayload {
  tipo: 'popup-ready';
}

export interface PopupClosingPayload {
  tipo: 'popup-closing';
}

export type MensajeSync =
  | VistaEnVivoPayload
  | PrecioDelDiaPayload
  | ActividadPayload
  | ForzarPublicidadPayload
  | CambioConfirmadoPayload
  | PopupReadyPayload
  | PopupClosingPayload;
