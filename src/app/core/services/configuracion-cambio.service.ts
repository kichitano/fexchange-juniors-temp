import { Injectable, computed, signal } from '@angular/core';
import {
  Moneda,
  Operador,
  PARES_DISPONIBLES,
  TipoCambioConfig,
  claveTipoCambio,
} from '../models/cambio.model';

const TASA_INICIAL = 1;

function crearConfigsIniciales(): Record<string, TipoCambioConfig> {
  const configs: Record<string, TipoCambioConfig> = {};
  for (const { origen, destino } of PARES_DISPONIBLES) {
    configs[claveTipoCambio(origen, destino)] = {
      monedaOrigen: origen,
      monedaDestino: destino,
      operador: 'multiplicar',
      tasa: TASA_INICIAL,
    };
  }
  return configs;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionCambioService {
  readonly pares = PARES_DISPONIBLES;

  private readonly configs = signal<Record<string, TipoCambioConfig>>(crearConfigsIniciales());

  readonly parActivo = signal<{ origen: Moneda; destino: Moneda }>(PARES_DISPONIBLES[0]);

  readonly configActiva = computed<TipoCambioConfig>(() => {
    const { origen, destino } = this.parActivo();
    return this.configs()[claveTipoCambio(origen, destino)];
  });

  /**
   * Precio del día para CLP → PEN, con estado propio e independiente del par
   * activo en pantalla: solo cambia cuando el operador edita específicamente
   * CLP → PEN (ver actualizarConfigActiva), nunca al alternar entre pares.
   */
  readonly precioDelDiaClpPen = signal<{ operador: Operador; tasa: number }>({
    operador: 'multiplicar',
    tasa: TASA_INICIAL,
  });

  seleccionarPar(origen: Moneda, destino: Moneda): void {
    this.parActivo.set({ origen, destino });
  }

  /** Avanza al siguiente par de PARES_DISPONIBLES, en loop infinito. */
  siguientePar(): void {
    const actual = this.parActivo();
    const indiceActual = PARES_DISPONIBLES.findIndex(
      (p) => p.origen === actual.origen && p.destino === actual.destino,
    );
    const siguiente = PARES_DISPONIBLES[(indiceActual + 1) % PARES_DISPONIBLES.length];
    this.parActivo.set({ origen: siguiente.origen, destino: siguiente.destino });
  }

  actualizarTasa(tasa: number): void {
    this.actualizarConfigActiva((config) => ({ ...config, tasa }));
  }

  actualizarOperador(operador: Operador): void {
    this.actualizarConfigActiva((config) => ({ ...config, operador }));
  }

  calcularResultado(monto: number, config: TipoCambioConfig): number {
    if (config.operador === 'multiplicar') {
      return monto * config.tasa;
    }
    return config.tasa === 0 ? 0 : monto / config.tasa;
  }

  /** Inversa de calcularResultado: dado un resultado deseado, qué monto lo produce. */
  calcularMontoInverso(resultado: number, config: TipoCambioConfig): number {
    if (config.operador === 'multiplicar') {
      return config.tasa === 0 ? 0 : resultado / config.tasa;
    }
    return resultado * config.tasa;
  }

  private actualizarConfigActiva(actualizar: (config: TipoCambioConfig) => TipoCambioConfig): void {
    const { origen, destino } = this.parActivo();
    const clave = claveTipoCambio(origen, destino);
    const nuevaConfig = actualizar(this.configs()[clave]);

    this.configs.update((actual) => ({
      ...actual,
      [clave]: nuevaConfig,
    }));

    if (origen === 'CLP' && destino === 'PEN') {
      this.precioDelDiaClpPen.set({ operador: nuevaConfig.operador, tasa: nuevaConfig.tasa });
    }
  }
}
