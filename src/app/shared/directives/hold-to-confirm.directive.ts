import { Directive, HostListener, input, output } from '@angular/core';

@Directive({
  selector: '[appHoldToConfirm]',
  standalone: true,
})
export class HoldToConfirmDirective {
  readonly duracionMs = input(2000, { alias: 'appHoldToConfirm' });

  readonly progreso = output<number>();
  readonly confirmado = output<void>();
  readonly cancelado = output<void>();

  private activo = false;
  private inicioMs = 0;
  private frameId: number | null = null;

  @HostListener('keydown.enter', ['$event'])
  protected onKeydownEnter(evento: Event): void {
    evento.preventDefault();
    // Ignorar los keydown repetidos que dispara el sistema operativo al mantener
    // la tecla presionada: solo el primer disparo (repeat === false) debe iniciar
    // el cronómetro, para que el conteo no dependa del delay/cadencia de auto-repeat.
    if ((evento as KeyboardEvent).repeat || this.activo) {
      return;
    }
    this.activo = true;
    this.inicioMs = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  @HostListener('keyup.enter')
  protected onKeyupEnter(): void {
    this.cancelar();
  }

  @HostListener('blur')
  protected onBlur(): void {
    this.cancelar();
  }

  private readonly tick = (ahora: number): void => {
    if (!this.activo) {
      return;
    }
    const transcurrido = ahora - this.inicioMs;
    const fraccion = Math.min(transcurrido / this.duracionMs(), 1);
    this.progreso.emit(fraccion);

    if (fraccion >= 1) {
      this.activo = false;
      this.frameId = null;
      this.confirmado.emit();
      return;
    }
    this.frameId = requestAnimationFrame(this.tick);
  };

  private cancelar(): void {
    if (!this.activo) {
      return;
    }
    this.activo = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.progreso.emit(0);
    this.cancelado.emit();
  }
}
