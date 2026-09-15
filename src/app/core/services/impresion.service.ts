import { Injectable, signal } from '@angular/core';
import { Moneda, Operador } from '../models/cambio.model';
import { formatearEntero, formatearMontoTicket, formatearTasa } from '../../shared/utils/formato-monto';

export interface DatosTicket {
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  operador: Operador;
  precio: number;
  monto: number;
  total: number;
}

// WebUSB no viene en los tipos estándar de TypeScript/DOM — se declara acá
// el subconjunto mínimo que se usa.
interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
}
interface USBAlternateInterface {
  endpoints: USBEndpoint[];
}
interface USBInterface {
  interfaceNumber: number;
  alternates: USBAlternateInterface[];
}
interface USBConfiguration {
  interfaces: USBInterface[];
}
interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  configuration: USBConfiguration | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array<ArrayBufferLike>): Promise<{ status: string }>;
}
interface USB {
  requestDevice(options: { filters: unknown[] }): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}
declare global {
  interface Navigator {
    usb?: USB;
  }
}

type EstadoConfiguracion = 'sin-configurar' | 'configurada' | 'omitida';

interface DispositivoGuardado {
  vendorId: number;
  productId: number;
}

const CLAVE_ESTADO = 'casa-cambio-impresion-estado';
const CLAVE_DISPOSITIVO = 'casa-cambio-impresion-dispositivo';

const ZADIG_URL = 'https://zadig.akeo.ie/';

/**
 * Impresión directa por WebUSB: se le mandan los bytes ESC/POS al dispositivo
 * por USB, sin pasar por el driver de Windows ni por el diálogo de impresión
 * del navegador — por eso es la única forma real de imprimir "sin diálogo".
 * Requisito: Windows NO debe tener un driver de impresora reteniendo la
 * interfaz USB (si lo tiene, claimInterface() falla con acceso denegado /
 * interfaz ocupada). Para eso hay que reemplazar el driver por WinUSB con
 * Zadig una vez — ver formatearError().
 */
@Injectable({ providedIn: 'root' })
export class ImpresionService {
  readonly datosTicket = signal<DatosTicket | null>(null);

  private readonly estadoConfiguracion = signal<EstadoConfiguracion>(this.leerEstado());
  readonly mostrarOnboarding = signal(this.estadoConfiguracion() === 'sin-configurar');
  readonly impresoraSeleccionada = signal(this.estadoConfiguracion() === 'configurada');
  readonly conectada = signal(false);
  readonly nombreImpresora = signal<string | null>(null);
  readonly conectando = signal(false);
  readonly ultimoError = signal<string | null>(null);

  private device: USBDevice | null = null;
  private endpointOut: number | null = null;

  constructor() {
    void this.reconectarSiHayGuardada();
  }

  abrirConfiguracion(): void {
    this.ultimoError.set(null);
    this.mostrarOnboarding.set(true);
  }

  cerrarConfiguracion(): void {
    this.mostrarOnboarding.set(false);
  }

  continuarSinImpresora(): void {
    this.estadoConfiguracion.set('omitida');
    this.impresoraSeleccionada.set(false);
    this.escribirEstado('omitida', null);
    this.mostrarOnboarding.set(false);
  }

  /** Abre el selector nativo de dispositivos USB del navegador y conecta el elegido. */
  async seleccionarImpresora(): Promise<void> {
    this.ultimoError.set(null);
    if (!navigator.usb) {
      this.ultimoError.set(
        'Este navegador no soporta selección directa de impresoras USB. Usa Chrome o Edge de escritorio.',
      );
      return;
    }
    this.conectando.set(true);
    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      await this.conectarDispositivo(device);
      this.escribirEstado('configurada', { vendorId: device.vendorId, productId: device.productId });
      this.estadoConfiguracion.set('configurada');
      this.impresoraSeleccionada.set(true);
      this.mostrarOnboarding.set(false);
    } catch (err) {
      this.ultimoError.set(this.formatearError(err));
    } finally {
      this.conectando.set(false);
    }
  }

  actualizarDatosTicket(datos: DatosTicket): void {
    this.datosTicket.set(datos);
  }

  async imprimirTicket(): Promise<void> {
    const datos = this.datosTicket();
    if (!datos) {
      return;
    }
    if (!this.device || this.endpointOut === null) {
      this.ultimoError.set('No hay impresora conectada — usa "Seleccionar impresora" primero.');
      return;
    }
    try {
      const bytes = this.construirTicketEscPos(datos);
      await this.device.transferOut(this.endpointOut, bytes);
    } catch (err) {
      this.ultimoError.set(this.formatearError(err));
      this.conectada.set(false);
    }
  }

  // ---------- Conexión ----------

  private async reconectarSiHayGuardada(): Promise<void> {
    if (!navigator.usb) {
      return;
    }
    const guardado = this.leerDispositivoGuardado();
    if (!guardado) {
      return;
    }
    try {
      const dispositivos = await navigator.usb.getDevices();
      const encontrado = dispositivos.find(
        (d) => d.vendorId === guardado.vendorId && d.productId === guardado.productId,
      );
      if (encontrado) {
        await this.conectarDispositivo(encontrado);
      }
    } catch (err) {
      this.ultimoError.set(this.formatearError(err));
    }
  }

  private async conectarDispositivo(device: USBDevice): Promise<void> {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    // Prueba todas las interfaces con endpoint de salida, no solo la primera:
    // si Windows retiene una con su driver, puede haber otra libre.
    const candidatas = (device.configuration?.interfaces ?? []).filter((i) =>
      i.alternates[0].endpoints.some((e) => e.direction === 'out'),
    );
    let ifaceUsada: USBInterface | null = null;
    let ultimoError: unknown = null;
    for (const iface of candidatas) {
      try {
        await device.claimInterface(iface.interfaceNumber);
        ifaceUsada = iface;
        break;
      } catch (err) {
        ultimoError = err;
      }
    }
    if (!ifaceUsada) {
      throw ultimoError ?? new Error('No se encontró una interfaz USB con endpoint de salida.');
    }
    const endpoint = ifaceUsada.alternates[0].endpoints.find((e) => e.direction === 'out');
    this.endpointOut = endpoint ? endpoint.endpointNumber : null;
    this.device = device;
    this.conectada.set(true);
    this.nombreImpresora.set(device.productName || 'Impresora USB');
  }

  private formatearError(err: unknown): string {
    const mensaje = err instanceof Error ? err.message : String(err);
    if (/acceso|denied|access|ocupad|busy|claim/i.test(mensaje)) {
      return (
        `No se pudo conectar (${mensaje}). Windows tiene un driver reteniendo el puerto USB de la ` +
        `impresora — hay que reemplazarlo una vez por el driver genérico WinUSB con la herramienta ` +
        `Zadig (${ZADIG_URL}) para que esta app pueda usarla directo. Ojo: después de ese cambio, ` +
        `Windows ya no podrá imprimir a esta impresora por su cuenta (por ejemplo desde Word) — solo esta app.`
      );
    }
    return `No se pudo conectar: ${mensaje}`;
  }

  // ---------- Ticket ESC/POS ----------
  // Mismo formato que la herramienta de diagnóstico standalone
  // (public/diagnostico-impresora-pos-d-tp3000.html): columnas calibradas a
  // ojo contra impresiones reales de la POS-D TP-300 PRO (ver ancho más
  // abajo), punto decimal (no coma, confunde a los clientes) y aviso de que
  // no es comprobante legal.

  private comando(...bytes: number[]): Uint8Array {
    return Uint8Array.from(bytes);
  }

  private textoAscii(str: string): Uint8Array {
    const limpio = this.quitarAcentos(str);
    return Uint8Array.from(Array.from(limpio).map((c) => c.charCodeAt(0) & 0xff));
  }

  private quitarAcentos(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ñ/gi, (m) => (m === 'ñ' ? 'n' : 'N'));
  }

  private concatBytes(partes: Uint8Array[]): Uint8Array {
    const total = partes.reduce((acc, p) => acc + p.length, 0);
    const resultado = new Uint8Array(total);
    let offset = 0;
    for (const p of partes) {
      resultado.set(p, offset);
      offset += p.length;
    }
    return resultado;
  }

  private filaFija(izquierda: string, derecha: string, ancho: number): string {
    const espacio = Math.max(1, ancho - izquierda.length - derecha.length);
    return izquierda + ' '.repeat(espacio) + derecha;
  }

  private construirTicketEscPos(datos: DatosTicket): Uint8Array {
    // 56 en vez de 48: con 48 el contenido quedaba corto del borde derecho
    // real del papel (más margen en blanco a la derecha que a la
    // izquierda) en una impresión de prueba — 56 se acerca más al ancho
    // real. Si todavía no llega justo al borde, seguir subiendo de a poco.
    const ancho = 56;
    const separador = this.textoAscii('-'.repeat(ancho) + '\n');

    const init = this.comando(0x1b, 0x40); // ESC @: inicializar
    const centrar = this.comando(0x1b, 0x61, 0x01);
    const izquierda = this.comando(0x1b, 0x61, 0x00);
    const negritaOn = this.comando(0x1b, 0x45, 0x01);
    const negritaOff = this.comando(0x1b, 0x45, 0x00);
    const avanceFinal = this.comando(0x1b, 0x64, 0x06); // ESC d 6: margen antes del corte
    const cortar = this.comando(0x1d, 0x56, 0x01); // GS V 1: corte parcial

    const ahora = new Date();
    const fechaTexto = ahora.toLocaleDateString('es-CL');
    const horaTexto = ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    // Solo el número, sin el símbolo de operador (x/÷) — el cliente no
    // necesita saber si la casa multiplica o divide para llegar al total.
    const precioTexto = formatearTasa(datos.precio);

    return this.concatBytes([
      init,
      centrar,
      negritaOn,
      this.textoAscii('CASA DE CAMBIO JUNIORS\n'),
      negritaOff,
      separador,
      izquierda,
      this.textoAscii(this.filaFija(fechaTexto, horaTexto, ancho) + '\n'),
      separador,
      this.textoAscii(
        this.filaFija('Monto', `${formatearEntero(datos.monto)} ${datos.monedaOrigen}`, ancho) + '\n',
      ),
      this.textoAscii(this.filaFija('Precio', precioTexto, ancho) + '\n'),
      separador,
      negritaOn,
      this.textoAscii(
        this.filaFija('Total', `${formatearMontoTicket(datos.total)} ${datos.monedaDestino}`, ancho) + '\n',
      ),
      negritaOff,
      separador,
      centrar,
      this.textoAscii('Gracias por su cambio!\n'),
      this.textoAscii('Ticket sin validez legal\n'),
      avanceFinal,
      cortar,
    ]);
  }

  // ---------- Persistencia ----------

  private leerEstado(): EstadoConfiguracion {
    if (typeof localStorage === 'undefined') {
      return 'sin-configurar';
    }
    const valor = localStorage.getItem(CLAVE_ESTADO);
    return valor === 'configurada' || valor === 'omitida' ? valor : 'sin-configurar';
  }

  private leerDispositivoGuardado(): DispositivoGuardado | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const crudo = localStorage.getItem(CLAVE_DISPOSITIVO);
      return crudo ? (JSON.parse(crudo) as DispositivoGuardado) : null;
    } catch {
      return null;
    }
  }

  private escribirEstado(estado: EstadoConfiguracion, dispositivo: DispositivoGuardado | null): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(CLAVE_ESTADO, estado);
    if (dispositivo) {
      localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(dispositivo));
    } else {
      localStorage.removeItem(CLAVE_DISPOSITIVO);
    }
  }
}
