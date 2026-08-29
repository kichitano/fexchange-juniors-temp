import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CambioConfirmado, Operador } from '../../../../core/models/cambio.model';
import { ConfiguracionCambioService } from '../../../../core/services/configuracion-cambio.service';
import { PersistenciaService } from '../../../../core/services/persistencia.service';
import { SyncService } from '../../../../core/services/sync.service';
import { AutoFitTextoDirective } from '../../../../shared/directives/auto-fit-texto.directive';
import { HoldToConfirmDirective } from '../../../../shared/directives/hold-to-confirm.directive';
import {
  contarDigitosAntesDe,
  formatearEntero,
  formatearMonto,
  formatearTasa,
  posicionParaDigitos,
} from '../../../../shared/utils/formato-monto';

const DURACION_CONFIRMACION_MS = 1000;
const DURACION_ESCAPE_MS = 1000;

@Component({
  selector: 'app-formula-cambio',
  standalone: true,
  imports: [HoldToConfirmDirective, AutoFitTextoDirective],
  templateUrl: './formula-cambio.html',
  styleUrl: './formula-cambio.scss',
})
export class FormulaCambio {
  protected readonly configuracion = inject(ConfiguracionCambioService);
  private readonly persistencia = inject(PersistenciaService);
  private readonly sync = inject(SyncService);

  protected readonly duracionMs = DURACION_CONFIRMACION_MS;
  protected readonly duracionEscapeMs = DURACION_ESCAPE_MS;
  protected readonly monto = signal(0);
  protected readonly tasaBuffer = signal('');
  protected readonly resultadoBuffer = signal('');
  protected readonly progreso = signal(0);
  protected readonly progresoEscape = signal(0);

  protected readonly config = this.configuracion.configActiva;

  private readonly campoMontoRef = viewChild<ElementRef<HTMLInputElement>>('campoMonto');
  private readonly campoTasaRef = viewChild<ElementRef<HTMLInputElement>>('campoTasa');
  private readonly campoResultadoRef = viewChild<ElementRef<HTMLInputElement>>('campoResultado');

  // Puesto en true justo antes de recalcular `monto` a partir de lo que el
  // operador tipeó en el campo resultado: evita que el efecto de abajo pise
  // ese texto con el resultado "hacia adelante" (con decimales) mientras
  // todavía está escribiendo.
  private ignorarProximaSincronizacionResultado = false;

  constructor() {
    effect(() => {
      this.configuracion.parActivo();
      const tasaInicial = untracked(() => this.config().tasa);
      this.monto.set(0);
      this.tasaBuffer.set(formatearTasa(tasaInicial));
    });

    effect(() => {
      const config = this.config();
      const monto = this.monto();
      const resultado = this.resultadoActual();
      this.sync.enviarVistaEnVivo({
        tipeando: monto > 0,
        monedaOrigen: config.monedaOrigen,
        monedaDestino: config.monedaDestino,
        operador: config.operador,
        tasa: config.tasa,
        montoIngresado: monto,
        montoResultado: resultado,
      });
    });

    effect(() => {
      const texto = this.resultadoTexto();
      if (this.ignorarProximaSincronizacionResultado) {
        this.ignorarProximaSincronizacionResultado = false;
        return;
      }
      this.resultadoBuffer.set(texto);
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydownGlobal(evento: KeyboardEvent): void {
    if (evento.ctrlKey || evento.altKey || evento.metaKey) {
      return;
    }
    const activo = document.activeElement;
    const campoMonto = this.campoMontoRef()?.nativeElement;
    const campoTasa = this.campoTasaRef()?.nativeElement;
    const campoResultado = this.campoResultadoRef()?.nativeElement;
    const enCampoPropio = activo === campoMonto || activo === campoTasa || activo === campoResultado;
    const enOtroControl =
      !enCampoPropio &&
      activo instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName);
    if (enOtroControl) {
      return;
    }

    const tecla = evento.key.toLowerCase();
    if (tecla === 'm') {
      evento.preventDefault();
      this.enfocarYSeleccionar(campoMonto);
    } else if (tecla === 't') {
      evento.preventDefault();
      this.enfocarYSeleccionar(campoTasa);
    } else if (tecla === 'r') {
      evento.preventDefault();
      this.enfocarYSeleccionar(campoResultado);
    }
  }

  protected resultadoActual(): number {
    return this.configuracion.calcularResultado(this.monto(), this.config());
  }

  protected montoTexto(): string {
    return formatearEntero(this.monto());
  }

  protected resultadoTexto(): string {
    return formatearMonto(this.resultadoActual());
  }

  protected onMontoInput(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const posicionAnterior = input.selectionStart ?? input.value.length;
    const digitosAntes = contarDigitosAntesDe(input.value, posicionAnterior);
    const soloDigitos = input.value.replace(/\D/g, '');
    const valorNumerico = soloDigitos === '' ? 0 : Number(soloDigitos);

    const textoFormateado = formatearEntero(valorNumerico);
    input.value = textoFormateado;
    const nuevaPosicion = posicionParaDigitos(textoFormateado, digitosAntes);
    input.setSelectionRange(nuevaPosicion, nuevaPosicion);

    this.monto.set(valorNumerico);
    this.sync.enviarActividad();
  }

  protected onFocoConSeleccion(evento: FocusEvent): void {
    (evento.target as HTMLInputElement).select();
  }

  protected cambiarOperador(operador: Operador): void {
    this.configuracion.actualizarOperador(operador);
    this.sync.enviarActividad();
  }

  protected onTasaInput(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.tasaBuffer.set(input.value);
    const numero = Number(input.value.replace(',', '.'));
    if (Number.isFinite(numero)) {
      const limitada = Math.round(numero * 100) / 100;
      this.configuracion.actualizarTasa(limitada);
    }
    this.sync.enviarActividad();
  }

  protected onTasaBlur(): void {
    this.tasaBuffer.set(formatearTasa(this.config().tasa));
  }

  /**
   * Campo resultado editable: permite que el operador escriba directamente
   * el monto deseado en la moneda de destino (p. ej. un cliente que pregunta
   * "¿cuánto son 100 soles en pesos?") y calcula hacia atrás el monto de
   * origen que produce ese resultado, con la operación invertida.
   */
  protected onResultadoInput(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.resultadoBuffer.set(input.value);
    const numero = Number(input.value.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(numero)) {
      this.ignorarProximaSincronizacionResultado = true;
      this.monto.set(this.configuracion.calcularMontoInverso(numero, this.config()));
    }
    this.sync.enviarActividad();
  }

  protected onResultadoBlur(): void {
    this.resultadoBuffer.set(this.resultadoTexto());
  }

  /**
   * Escape sostenido 1s: limpia el monto en curso y fuerza publicidad en la
   * Pantalla Secundaria (igual que el botón "Forzar publicidad" del control
   * del popup). No envía actividad — enviarla cancelaría el forzado apenas
   * se aplica, ver el efecto de ultimaActividad en PantallaSecundaria.
   */
  protected onConfirmadoEscape(): void {
    this.progresoEscape.set(0);
    this.monto.set(0);
    this.sync.enviarForzarPublicidad();
  }

  protected onConfirmado(): void {
    this.progreso.set(0);
    const monto = this.monto();
    if (monto <= 0) {
      return;
    }
    const config = this.config();
    const ahora = new Date();
    const registro: CambioConfirmado = {
      id: crypto.randomUUID(),
      fecha: ahora.toLocaleDateString('es-CL'),
      hora: ahora.toLocaleTimeString('es-CL'),
      monedaOrigen: config.monedaOrigen,
      monedaDestino: config.monedaDestino,
      operador: config.operador,
      tasa: config.tasa,
      montoIngresado: monto,
      montoResultado: this.resultadoActual(),
    };
    this.persistencia.guardarCambio(registro);
    this.sync.enviarCambioConfirmado();
    this.monto.set(0);
  }

  private enfocarYSeleccionar(el: HTMLInputElement | undefined): void {
    if (!el) {
      return;
    }
    // Se difiere al siguiente tick: llamar focus()/select() de forma síncrona
    // desde el keydown de M/T (mientras ese evento todavía se está
    // procesando) hace que el foco no "pegue" de forma confiable en algunos
    // navegadores, y el primer dígito tipeado justo después se pierde.
    setTimeout(() => {
      el.focus();
      el.select();
    });
  }
}
