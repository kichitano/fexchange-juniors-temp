import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CajaService } from '../../../../core/services/caja.service';
import {
  contarDigitosAntesDe,
  formatearEntero,
  posicionParaDigitos,
} from '../../../../shared/utils/formato-monto';

@Component({
  selector: 'app-panel-caja',
  standalone: true,
  templateUrl: './panel-caja.html',
  styleUrl: './panel-caja.scss',
})
export class PanelCaja {
  protected readonly caja = inject(CajaService);

  protected readonly formularioAbierto = signal(false);
  protected readonly montoRetiro = signal(0);
  protected readonly notaRetiro = signal('');
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

  private readonly campoMontoRetiroRef =
    viewChild<ElementRef<HTMLInputElement>>('campoMontoRetiro');

  protected abrirFormulario(): void {
    this.montoRetiro.set(0);
    this.notaRetiro.set('');
    this.intentoConfirmar.set(false);
    this.formularioAbierto.set(true);
    setTimeout(() => this.campoMontoRetiroRef()?.nativeElement.focus());
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
  }

  protected onMontoRetiroInput(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const posicionAnterior = input.selectionStart ?? input.value.length;
    const digitosAntes = contarDigitosAntesDe(input.value, posicionAnterior);
    const soloDigitos = input.value.replace(/\D/g, '');
    const valorNumerico = soloDigitos === '' ? 0 : Number(soloDigitos);

    const textoFormateado = valorNumerico === 0 ? '' : formatearEntero(valorNumerico);
    input.value = textoFormateado;
    const nuevaPosicion = posicionParaDigitos(textoFormateado, digitosAntes);
    input.setSelectionRange(nuevaPosicion, nuevaPosicion);

    this.montoRetiro.set(valorNumerico);
  }

  protected onNotaRetiroInput(evento: Event): void {
    this.notaRetiro.set((evento.target as HTMLInputElement).value);
  }

  /**
   * Escape dentro del formulario solo lo cierra: se detiene la propagación
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

  protected confirmarRetiro(evento: Event): void {
    evento.preventDefault();
    this.intentoConfirmar.set(true);
    if (this.errorRetiro()) {
      return;
    }
    this.caja.registrarRetiroClp(this.montoRetiro(), this.notaRetiro());
    this.cerrarFormulario();
  }

  protected eliminarRetiro(id: string): void {
    this.caja.eliminarRetiro(id);
  }
}
