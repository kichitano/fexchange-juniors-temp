import { Injectable, signal } from '@angular/core';
import { Moneda, Operador } from '../models/cambio.model';

export interface DatosTicket {
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  operador: Operador;
  precio: number;
  monto: number;
  total: number;
}

type EstadoConfiguracion = 'sin-configurar' | 'configurada' | 'omitida';

const CLAVE_LOCAL_STORAGE = 'casa-cambio-impresion-directa';

/**
 * Ningún sitio web puede saltarse el diálogo de impresión del navegador por
 * su cuenta (protección de seguridad, no algo desactivable desde el código).
 * La única forma real de imprimir sin diálogo es que el propio operador abra
 * el navegador con la bandera --kiosk-printing — algo que esta app no puede
 * activar por sí sola, solo ayudar a configurar una vez (ver
 * descargarAccesoDirecto). A partir de ahí, window.print() se comporta
 * exactamente igual en el código; es el navegador el que decide, de forma
 * transparente, si muestra el diálogo o no.
 */
@Injectable({ providedIn: 'root' })
export class ImpresionService {
  readonly datosTicket = signal<DatosTicket | null>(null);
  /** Se fija en imprimirTicket(), no reactivamente: el ticket debe mostrar el
   * momento real de la impresión, no la última vez que cambió algún campo. */
  readonly fechaImpresion = signal<Date | null>(null);
  private readonly estadoConfiguracion = signal<EstadoConfiguracion>(this.leerEstado());
  readonly mostrarOnboarding = signal(this.estadoConfiguracion() === 'sin-configurar');
  readonly directaConfigurada = signal(this.estadoConfiguracion() === 'configurada');

  actualizarDatosTicket(datos: DatosTicket): void {
    this.datosTicket.set(datos);
  }

  abrirConfiguracion(): void {
    this.mostrarOnboarding.set(true);
  }

  cerrarConfiguracion(): void {
    this.mostrarOnboarding.set(false);
  }

  marcarOmitida(): void {
    this.estadoConfiguracion.set('omitida');
    this.directaConfigurada.set(false);
    this.escribirEstado('omitida');
    this.mostrarOnboarding.set(false);
  }

  /** Genera el acceso directo (.bat) que abre Chrome con --kiosk-printing apuntando a esta app. */
  descargarAccesoDirecto(): void {
    const url = new URL('', document.baseURI).toString();
    const contenido = ['@echo off', `start "" chrome --kiosk-printing "${url}"`, ''].join('\r\n');
    const blob = new Blob([contenido], { type: 'text/plain' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = 'abrir-casa-cambio-impresion-directa.bat';
    enlace.click();
    URL.revokeObjectURL(enlace.href);

    this.estadoConfiguracion.set('configurada');
    this.directaConfigurada.set(true);
    this.escribirEstado('configurada');
    this.mostrarOnboarding.set(false);
  }

  imprimirTicket(): void {
    if (!this.datosTicket()) {
      return;
    }
    this.fechaImpresion.set(new Date());
    // Se difiere para dar tiempo a que Angular renderice la fecha/hora recién
    // fijada antes de que se dispare el diálogo/impresión — llamarlo en el
    // mismo tick puede imprimir con el DOM todavía sin actualizar.
    setTimeout(() => window.print());
  }

  private leerEstado(): EstadoConfiguracion {
    if (typeof localStorage === 'undefined') {
      return 'sin-configurar';
    }
    const valor = localStorage.getItem(CLAVE_LOCAL_STORAGE);
    return valor === 'configurada' || valor === 'omitida' ? valor : 'sin-configurar';
  }

  private escribirEstado(estado: EstadoConfiguracion): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(CLAVE_LOCAL_STORAGE, estado);
  }
}
