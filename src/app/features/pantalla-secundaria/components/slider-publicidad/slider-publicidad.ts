import { Component, DestroyRef, effect, input, signal } from '@angular/core';

const IMAGENES = ['assets/ads/ad-1.jpg', 'assets/ads/ad-2.jpg', 'assets/ads/ad-3.jpg'];

const INTERVALO_MS = 7000;

@Component({
  selector: 'app-slider-publicidad',
  standalone: true,
  templateUrl: './slider-publicidad.html',
  styleUrl: './slider-publicidad.scss',
})
export class SliderPublicidad {
  readonly reiniciarEn = input<number>(0);

  protected readonly imagenes = IMAGENES;
  protected readonly indiceActual = signal(0);

  constructor(destroyRef: DestroyRef) {
    const intervalo = setInterval(() => {
      this.indiceActual.update((valor) => (valor + 1) % IMAGENES.length);
    }, INTERVALO_MS);
    destroyRef.onDestroy(() => clearInterval(intervalo));

    effect(() => {
      this.reiniciarEn();
      this.indiceActual.set(0);
    });
  }
}
