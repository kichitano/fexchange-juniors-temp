import { Injectable, computed, inject, signal } from '@angular/core';
import { CambioConfirmado, RetiroCaja, SaldoInicialCaja } from '../models/cambio.model';
import { PersistenciaService } from './persistencia.service';

const CLAVE_RETIROS = 'casa-cambio-retiros';
const CLAVE_SALDOS_INICIALES = 'casa-cambio-saldos-iniciales';
const CLAVE_PANEL_VISIBLE = 'casa-cambio-panel-caja-visible';
const INTERVALO_CAMBIO_DE_DIA_MS = 30_000;

/**
 * Contabilidad en vivo de la caja, por día. Por ahora solo lleva CLP:
 *   caja = saldo inicial del día
 *        + monto ingresado de las operaciones CLP → PEN con operador dividir
 *        − retiros
 * contando solo lo registrado hoy y después de fijar el saldo inicial. Los
 * ingresos se derivan del historial, así que borrar un registro del historial
 * también lo quita de la caja.
 */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly persistencia = inject(PersistenciaService);

  readonly retiros = signal<RetiroCaja[]>(leerJson<RetiroCaja[]>(CLAVE_RETIROS, []));
  readonly saldosIniciales = signal<Record<string, SaldoInicialCaja>>(
    leerJson<Record<string, SaldoInicialCaja>>(CLAVE_SALDOS_INICIALES, {}),
  );
  readonly panelVisible = signal<boolean>(leerJson<boolean>(CLAVE_PANEL_VISIBLE, true));

  /** Fecha de hoy en el mismo formato que usa el historial; se actualiza sola al pasar medianoche. */
  readonly fechaHoy = signal(fechaLocal(new Date()));

  readonly saldoInicialHoyClp = computed<SaldoInicialCaja | null>(
    () => this.saldosIniciales()[claveSaldo(this.fechaHoy())] ?? null,
  );

  readonly operacionesHoyClp = computed(() => this.operacionesDe(this.fechaHoy()));
  readonly retirosHoyClp = computed(() => this.retirosDe(this.fechaHoy()));

  readonly totalIngresosHoyClp = computed(() => sumar(this.operacionesHoyClp(), (c) => c.montoIngresado));
  readonly totalRetirosHoyClp = computed(() => sumar(this.retirosHoyClp(), (r) => r.monto));

  readonly montoEnCajaClp = computed(
    () =>
      (this.saldoInicialHoyClp()?.monto ?? 0) +
      this.totalIngresosHoyClp() -
      this.totalRetirosHoyClp(),
  );

  /** Cierre del último día anterior a hoy con movimientos, para usarlo como saldo inicial. */
  readonly cierreAnteriorClp = computed<{ fecha: string; monto: number } | null>(() => {
    const hoy = this.fechaHoy();
    const fechas = new Set<string>([
      ...this.persistencia.historial().filter(esIngresoClp).map((c) => c.fecha),
      ...this.retiros().filter((r) => r.moneda === 'CLP').map((r) => r.fecha),
      ...Object.values(this.saldosIniciales())
        .filter((s) => s.moneda === 'CLP')
        .map((s) => s.fecha),
    ]);
    const anteriores = [...fechas]
      .filter((fecha) => ordenFecha(fecha) < ordenFecha(hoy))
      .sort((a, b) => ordenFecha(b) - ordenFecha(a));
    if (anteriores.length === 0) {
      return null;
    }
    const fecha = anteriores[0];
    return { fecha, monto: this.cierreDe(fecha) };
  });

  constructor() {
    setInterval(() => {
      const hoy = fechaLocal(new Date());
      if (hoy !== this.fechaHoy()) {
        this.fechaHoy.set(hoy);
      }
    }, INTERVALO_CAMBIO_DE_DIA_MS);
  }

  alternarPanel(): void {
    this.panelVisible.update((valor) => !valor);
    escribirJson(CLAVE_PANEL_VISIBLE, this.panelVisible());
  }

  /**
   * Fija el saldo inicial de hoy y "limpia" la caja: todo lo registrado hoy
   * hasta este momento deja de sumarse; desde aquí la caja parte de `monto`.
   */
  fijarSaldoInicialHoyClp(monto: number): void {
    const ahora = new Date();
    const fecha = fechaLocal(ahora);
    const idsExcluidos = [
      ...this.persistencia
        .historial()
        .filter((c) => c.fecha === fecha && esIngresoClp(c))
        .map((c) => c.id),
      ...this.retiros()
        .filter((r) => r.fecha === fecha && r.moneda === 'CLP')
        .map((r) => r.id),
    ];
    const saldo: SaldoInicialCaja = {
      fecha,
      hora: ahora.toLocaleTimeString('es-CL'),
      moneda: 'CLP',
      monto,
      idsExcluidos,
    };
    this.fechaHoy.set(fecha);
    this.saldosIniciales.update((actual) => ({ ...actual, [claveSaldo(fecha)]: saldo }));
    escribirJson(CLAVE_SALDOS_INICIALES, this.saldosIniciales());
  }

  registrarRetiroClp(monto: number, nota: string): void {
    const ahora = new Date();
    const retiro: RetiroCaja = {
      id: crypto.randomUUID(),
      fecha: fechaLocal(ahora),
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

  private operacionesDe(fecha: string): CambioConfirmado[] {
    const excluidos = this.idsExcluidosDe(fecha);
    return this.persistencia
      .historial()
      .filter((c) => c.fecha === fecha && esIngresoClp(c) && !excluidos.has(c.id));
  }

  private retirosDe(fecha: string): RetiroCaja[] {
    const excluidos = this.idsExcluidosDe(fecha);
    return this.retiros().filter(
      (r) => r.fecha === fecha && r.moneda === 'CLP' && !excluidos.has(r.id),
    );
  }

  private cierreDe(fecha: string): number {
    return (
      (this.saldosIniciales()[claveSaldo(fecha)]?.monto ?? 0) +
      sumar(this.operacionesDe(fecha), (c) => c.montoIngresado) -
      sumar(this.retirosDe(fecha), (r) => r.monto)
    );
  }

  private idsExcluidosDe(fecha: string): Set<string> {
    return new Set(this.saldosIniciales()[claveSaldo(fecha)]?.idsExcluidos ?? []);
  }
}

function esIngresoClp(cambio: CambioConfirmado): boolean {
  return (
    cambio.monedaOrigen === 'CLP' &&
    cambio.monedaDestino === 'PEN' &&
    cambio.operador === 'dividir'
  );
}

function claveSaldo(fecha: string): string {
  return `CLP_${fecha}`;
}

function sumar<T>(elementos: T[], valor: (elemento: T) => number): number {
  return elementos.reduce((suma, elemento) => suma + valor(elemento), 0);
}

/** Mismo formato que el campo `fecha` del historial (dd-mm-aaaa en es-CL). */
function fechaLocal(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL');
}

/** Convierte "dd-mm-aaaa" en un número ordenable (aaaammdd). */
function ordenFecha(fecha: string): number {
  const partes = fecha.match(/\d+/g);
  if (!partes || partes.length < 3) {
    return 0;
  }
  const [dia, mes, anio] = partes.map(Number);
  return anio * 10_000 + mes * 100 + dia;
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
