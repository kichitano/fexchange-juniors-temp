import {
  Component,
  ElementRef,
  WritableSignal,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CajaService } from '../../../../core/services/caja.service';
import {
  contarDigitosAntesDe,
  formatearEntero,
  posicionParaDigitos,
} from '../../../../shared/utils/formato-monto';

type Formulario = 'retiro' | 'saldo';

@Component({
  selector: 'app-panel-caja',
  standalone: true,
  templateUrl: './panel-caja.html',
  styleUrl: './panel-caja.scss',
})
export class PanelCaja {
  protected readonly caja = inject(CajaService);

  protected readonly formularioAbierto = signal<Formulario | null>(null);
  protected readonly montoRetiro = signal(0);
  protected readonly notaRetiro = signal('');
  protected readonly montoSaldo = signal(0);
  protected readonly intentoConfirmar = signal(false);

  protected readonly errorRetiro = computed(() => {
    const monto = this.montoRetiro();
    if (monto <= 0) {
      return 'Ingresa un monto mayor a 0.';
    }
    if (monto > this.caja.montoEnCajaClp()) {
      return 'El retiro supera el monto en caja.';
    }
    return null;
  });

  protected readonly formatearEntero = formatearEntero;

  private readonly campoMontoRef = viewChild<ElementRef<HTMLInputElement>>('campoMonto');

  protected abrirFormulario(formulario: Formulario): void {
    this.montoRetiro.set(0);
    this.notaRetiro.set('');
    this.montoSaldo.set(0);
    this.intentoConfirmar.set(false);
    this.formularioAbierto.set(formulario);
    setTimeout(() => this.campoMontoRef()?.nativeElement.focus());
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(null);
  }

  protected textoMonto(monto: number): string {
    return monto === 0 ? '' : formatearEntero(monto);
  }

  protected onMontoInput(evento: Event, destino: WritableSignal<number>): void {
    const input = evento.target as HTMLInputElement;
    const posicionAnterior = input.selectionStart ?? input.value.length;
    const digitosAntes = contarDigitosAntesDe(input.value, posicionAnterior);
    const soloDigitos = input.value.replace(/\D/g, '');
    const valorNumerico = soloDigitos === '' ? 0 : Number(soloDigitos);

    const textoFormateado = this.textoMonto(valorNumerico);
    input.value = textoFormateado;
    const nuevaPosicion = posicionParaDigitos(textoFormateado, digitosAntes);
    input.setSelectionRange(nuevaPosicion, nuevaPosicion);

    destino.set(valorNumerico);
  }

  protected onNotaRetiroInput(evento: Event): void {
    this.notaRetiro.set((evento.target as HTMLInputElement).value);
  }

  /**
   * Escape dentro de un formulario solo lo cierra: se detiene la propagación
   * para que no llegue al Escape sostenido global de la fórmula (que limpia
   * el monto en curso y fuerza publicidad).
   */
  protected onKeydownFormulario(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      this.cerrarFormulario();
    }
  }

  protected usarCierreAnterior(): void {
    this.montoSaldo.set(Math.max(0, Math.round(this.caja.cierreAnteriorClp()?.monto ?? 0)));
    // De vuelta al campo, para que Enter confirme el formulario en vez de
    // volver a pulsar este botón.
    this.campoMontoRef()?.nativeElement.focus();
  }

  protected confirmarRetiro(evento: Event): void {
    evento.preventDefault();
    this.intentoConfirmar.set(true);
    if (this.errorRetiro()) {
      return;
    }
    this.caja.registrarRetiroClp(this.montoRetiro(), this.notaRetiro());
    this.cerrarFormulario();
  }

  protected confirmarSaldo(evento: Event): void {
    evento.preventDefault();
    this.caja.fijarSaldoInicialHoyClp(this.montoSaldo());
    this.cerrarFormulario();
  }

  protected eliminarRetiro(id: string): void {
    this.caja.eliminarRetiro(id);
  }
}
