import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

@Directive({
  selector: '[appAutoFitTexto]',
  standalone: true,
})
export class AutoFitTextoDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly tamanoMinimoPx = input(22, { alias: 'appAutoFitTextoMin' });

  private observadorMutacion: MutationObserver | null = null;
  private observadorResize: ResizeObserver | null = null;
  private readonly onInputNativo = () => this.ajustar();

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.ajustar();

    // Para <div>: los cambios de texto son mutaciones de DOM detectables.
    this.observadorMutacion = new MutationObserver(() => this.ajustar());
    this.observadorMutacion.observe(el, { childList: true, characterData: true, subtree: true });

    // Para <input>: el valor no genera mutaciones de DOM, solo el evento 'input'.
    el.addEventListener('input', this.onInputNativo);

    this.observadorResize = new ResizeObserver(() => this.ajustar());
    this.observadorResize.observe(el);
  }

  ngOnDestroy(): void {
    this.observadorMutacion?.disconnect();
    this.observadorResize?.disconnect();
    this.host.nativeElement.removeEventListener('input', this.onInputNativo);
  }

  private ajustar(): void {
    const el = this.host.nativeElement;
    // Volver al tamaño declarado por CSS (clamp responsivo) antes de medir,
    // así el cálculo siempre parte del tamaño "natural" para el viewport actual.
    el.style.fontSize = '';
    const tamanoNatural = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(tamanoNatural) || el.scrollWidth <= el.clientWidth) {
      return;
    }

    const minimo = this.tamanoMinimoPx();
    let actual = tamanoNatural;
    let intentos = 0;
    while (el.scrollWidth > el.clientWidth && actual > minimo && intentos < 60) {
      actual -= 1;
      el.style.fontSize = `${actual}px`;
      intentos++;
    }
  }
}
