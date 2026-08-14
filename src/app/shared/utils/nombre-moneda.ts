import { Moneda } from '../../core/models/cambio.model';

const NOMBRES_MONEDA: Record<Moneda, string> = {
  CLP: 'Peso Chileno',
  PEN: 'Sol Peruano',
  USD: 'Dólar Estadounidense',
};

export function nombreMoneda(codigo: Moneda): string {
  return NOMBRES_MONEDA[codigo];
}
