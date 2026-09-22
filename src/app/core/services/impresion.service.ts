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

// Web Serial no viene en los tipos estándar de TypeScript/DOM — se declara
// acá el subconjunto mínimo que se usa.
interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}
interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
}
interface SerialPort {
  writable: WritableStream<Uint8Array<ArrayBufferLike>> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
}
interface Serial {
  requestPort(options?: { filters?: unknown[] }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}
declare global {
  interface Navigator {
    serial?: Serial;
  }
}

type EstadoConfiguracion = 'sin-configurar' | 'configurada' | 'omitida';

interface PuertoGuardado {
  usbVendorId?: number;
  usbProductId?: number;
}

const CLAVE_ESTADO = 'casa-cambio-impresion-estado';
const CLAVE_PUERTO = 'casa-cambio-impresion-puerto';

// Default típico de impresoras ESC/POS por serial. Si la impresión sale con
// caracteres corridos/basura, es la primera cifra a revisar/ajustar (según
// los switches DIP o configuración de la impresora).
const BAUD_RATE = 9600;

/**
 * Impresión directa por el puerto serial (Web Serial API, vía el cable
 * serial→USB) — no por el puerto USB de la impresora. Se eligió serial en
 * vez de WebUSB a propósito: el puerto USB de esta impresora ya está
 * compartido en Windows para otro sistema (uno en PHP) con su driver
 * original, y WebUSB necesita reemplazar ese driver (con Zadig) para poder
 * usarlo, lo que rompe la impresión normal de Windows para ese otro
 * sistema. El puerto serial es una interfaz física aparte de la misma
 * impresora — Windows lo ve como un simple puerto COM genérico, sin ningún
 * driver de impresora de por medio, así que no hay nada que reclamar ni
 * ningún conflicto: los dos sistemas conviven sin tocarse.
 */
@Injectable({ providedIn: 'root' })
export class ImpresionService {
  readonly datosTicket = signal<DatosTicket | null>(null);

  private readonly estadoConfiguracion = signal<EstadoConfiguracion>(this.leerEstado());
  readonly mostrarOnboarding = signal(this.estadoConfiguracion() === 'sin-configurar');
  readonly impresoraSeleccionada = signal(this.estadoConfiguracion() === 'configurada');
  readonly conectada = signal(false);
  readonly conectando = signal(false);
  readonly ultimoError = signal<string | null>(null);

  private port: SerialPort | null = null;

  constructor() {
    void this.reconectarSiHayGuardado();
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

  /** Abre el selector nativo de puertos serial del navegador y conecta el elegido. */
  async seleccionarImpresora(): Promise<void> {
    this.ultimoError.set(null);
    if (!navigator.serial) {
      this.ultimoError.set(
        'Este navegador no soporta selección directa de puertos serial. Usa Chrome o Edge de escritorio.',
      );
      return;
    }
    this.conectando.set(true);
    try {
      const port = await navigator.serial.requestPort();
      await this.conectarPuerto(port);
      const info = port.getInfo();
      this.escribirEstado('configurada', {
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId,
      });
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
    if (!this.port || !this.port.writable) {
      this.ultimoError.set('No hay impresora conectada — usa "Seleccionar impresora" primero.');
      return;
    }
    const writer = this.port.writable.getWriter();
    try {
      const bytes = this.construirTicketEscPos(datos);
      await writer.write(bytes);
    } catch (err) {
      this.ultimoError.set(this.formatearError(err));
      this.conectada.set(false);
    } finally {
      writer.releaseLock();
    }
  }

  // ---------- Conexión ----------

  private async reconectarSiHayGuardado(): Promise<void> {
    if (!navigator.serial) {
      return;
    }
    const guardado = this.leerPuertoGuardado();
    if (!guardado) {
      return;
    }
    try {
      const puertos = await navigator.serial.getPorts();
      const encontrado = puertos.find((p) => {
        const info = p.getInfo();
        return info.usbVendorId === guardado.usbVendorId && info.usbProductId === guardado.usbProductId;
      });
      if (encontrado) {
        await this.conectarPuerto(encontrado);
      }
    } catch (err) {
      this.ultimoError.set(this.formatearError(err));
    }
  }

  private async conectarPuerto(port: SerialPort): Promise<void> {
    await port.open({ baudRate: BAUD_RATE, dataBits: 8, parity: 'none', stopBits: 1 });
    this.port = port;
    this.conectada.set(true);
  }

  private formatearError(err: unknown): string {
    const mensaje = err instanceof Error ? err.message : String(err);
    if (/ocupad|busy|already open|in use/i.test(mensaje)) {
      return `No se pudo conectar (${mensaje}). El puerto ya está abierto por otra pestaña/programa — ciérralo e intenta de nuevo.`;
    }
    return `No se pudo conectar: ${mensaje}. Si el ticket sale con caracteres corridos, puede ser la velocidad (baudios) configurada en la impresora.`;
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

  private leerPuertoGuardado(): PuertoGuardado | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const crudo = localStorage.getItem(CLAVE_PUERTO);
      return crudo ? (JSON.parse(crudo) as PuertoGuardado) : null;
    } catch {
      return null;
    }
  }

  private escribirEstado(estado: EstadoConfiguracion, puerto: PuertoGuardado | null): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(CLAVE_ESTADO, estado);
    if (puerto) {
      localStorage.setItem(CLAVE_PUERTO, JSON.stringify(puerto));
    } else {
      localStorage.removeItem(CLAVE_PUERTO);
    }
  }
}
