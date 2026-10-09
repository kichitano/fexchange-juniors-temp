import { Injectable, computed, inject, signal } from '@angular/core';
import { RetiroCaja } from '../models/cambio.model';
import { PersistenciaService } from './persistencia.service';

const CLAVE_RETIROS = 'casa-cambio-retiros';
const CLAVE_PANEL_VISIBLE = 'casa-cambio-panel-caja-visible';

/**
 * Contabilidad en vivo de la caja. Por ahora solo lleva CLP: entra a caja el
 * monto ingresado de cada operación CLP → PEN con operador dividir (los pesos
 * que el cliente entrega), y sale lo que el operador registra como retiro.
 * Los ingresos se derivan del historial, así que borrar un registro del
 * historial también lo quita de la caja.
 */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly persistencia = inject(PersistenciaService);

  readonly retiros = signal<RetiroCaja[]>(leerJson<RetiroCaja[]>(CLAVE_RETIROS, []));
  readonly panelVisible = signal<boolean>(leerJson<boolean>(CLAVE_PANEL_VISIBLE, true));

  readonly operacionesClp = computed(() =>
    this.persistencia
      .historial()
      .filter(
        (cambio) =>
          cambio.monedaOrigen === 'CLP' &&
          cambio.monedaDestino === 'PEN' &&
          cambio.operador === 'dividir',
      ),
  );

  readonly retirosClp = computed(() => this.retiros().filter((retiro) => retiro.moneda === 'CLP'));

  readonly totalIngresosClp = computed(() =>
    this.operacionesClp().reduce((suma, cambio) => suma + cambio.montoIngresado, 0),
  );

  readonly totalRetirosClp = computed(() =>
    this.retirosClp().reduce((suma, retiro) => suma + retiro.monto, 0),
  );

  readonly montoEnCajaClp = computed(() => this.totalIngresosClp() - this.totalRetirosClp());

  alternarPanel(): void {
    this.panelVisible.update((valor) => !valor);
    escribirJson(CLAVE_PANEL_VISIBLE, this.panelVisible());
  }

  registrarRetiroClp(monto: number, nota: string): void {
    const ahora = new Date();
    const retiro: RetiroCaja = {
      id: crypto.randomUUID(),
      fecha: ahora.toLocaleDateString('es-CL'),
      hora: ahora.toLocaleTimeString('es-CL'),
      moneda: 'CLP',
      monto,
      nota: nota.trim(),
    };
    this.retiros.update((actual) => [retiro, ...actual]);
    escribirJson(CLAVE_RETIROS, this.retiros());
  }

  eliminarRetiro(id: string): void {
    this.retiros.update((actual) => actual.filter((retiro) => retiro.id !== id));
    escribirJson(CLAVE_RETIROS, this.retiros());
  }
}

function leerJson<T>(clave: string, porDefecto: T): T {
  if (typeof localStorage === 'undefined') {
    return porDefecto;
  }
  try {
    const crudo = localStorage.getItem(clave);
    return crudo === null ? porDefecto : (JSON.parse(crudo) as T);
  } catch {
    return porDefecto;
  }
}

function escribirJson(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: el estado vive solo en memoria.
  }
}
