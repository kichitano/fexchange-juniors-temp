import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { SyncService } from '../../core/services/sync.service';
import { PanelPrecioFijo } from './components/panel-precio-fijo/panel-precio-fijo';
import { SliderPublicidad } from './components/slider-publicidad/slider-publicidad';
import { VistaEnVivoCliente } from './components/vista-en-vivo-cliente/vista-en-vivo-cliente';

const INACTIVIDAD_MS = 6 * 60 * 1000;

@Component({
  selector: 'app-pantalla-secundaria',
  standalone: true,
  imports: [SliderPublicidad, VistaEnVivoCliente, PanelPrecioFijo],
  templateUrl: './pantalla-secundaria.html',
  styleUrl: './pantalla-secundaria.scss',
})
export class PantallaSecundaria {
  private readonly sync = inject(SyncService);

  private readonly ahora = signal(Date.now());
  private readonly publicidadForzada = signal(false);

  protected readonly tipeando = computed(() => this.sync.vistaEnVivo()?.tipeando ?? false);

  private readonly inactivo6Min = computed(
    () => this.ahora() - this.sync.ultimaActividad() >= INACTIVIDAD_MS,
  );

  protected readonly modo = computed<'vista-en-vivo' | 'publicidad' | 'reposo'>(() => {
    // Forzar publicidad manda incluso sobre una operación en curso: al
    // presionarlo, publicidadForzada pasa a true sin importar el valor
    // actual de tipeando, así que el orden de estos checks es lo que decide
    // quién gana mientras ambos son ciertos a la vez.
    if (this.publicidadForzada()) {
      return 'publicidad';
    }
    if (this.tipeando()) {
      return 'vista-en-vivo';
    }
    if (this.inactivo6Min()) {
      return 'publicidad';
    }
    return 'reposo';
  });

  protected readonly reiniciarSlider = this.sync.cambioConfirmadoTick;

  constructor(destroyRef: DestroyRef) {
    const intervalo = setInterval(() => this.ahora.set(Date.now()), 1000);
    destroyRef.onDestroy(() => clearInterval(intervalo));

    this.sync.enviarPopupReady();
    const notificarCierre = () => this.sync.enviarPopupClosing();
    window.addEventListener('pagehide', notificarCierre);
    window.addEventListener('beforeunload', notificarCierre);
    destroyRef.onDestroy(() => {
      notificarCierre();
      window.removeEventListener('pagehide', notificarCierre);
      window.removeEventListener('beforeunload', notificarCierre);
    });

    let primeraEjecucionForzar = true;
    effect(() => {
      this.sync.forzarPublicidadTick();
      if (primeraEjecucionForzar) {
        primeraEjecucionForzar = false;
        return;
      }
      this.publicidadForzada.set(true);
    });

    // Cualquier actividad nueva del operador (no solo que "tipeando" pase de
    // false a true) cancela el forzado: si ya estaba tipeando cuando forzó
    // la publicidad, "tipeando" se mantiene en true todo el tiempo y nunca
    // "cambia" de valor, así que no sirve como disparador acá. La marca de
    // tiempo de actividad, en cambio, cambia con cada tecla.
    let primeraEjecucionActividad = true;
    effect(() => {
      this.sync.ultimaActividad();
      if (primeraEjecucionActividad) {
        primeraEjecucionActividad = false;
        return;
      }
      this.publicidadForzada.set(false);
    });
  }
}
