import { Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { SyncService } from '../../../../core/services/sync.service';

const CARACTERISTICAS_POPUP = 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no';
const NOMBRE_VENTANA = 'pantalla-secundaria';
const INTERVALO_POLLING_MS = 500;
const ESPERA_MONTAJE_POPUP_MS = 400;

@Component({
  selector: 'app-control-popup',
  standalone: true,
  templateUrl: './control-popup.html',
  styleUrl: './control-popup.scss',
})
export class ControlPopup implements OnInit {
  private readonly sync = inject(SyncService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly popupAbierto = signal(false);
  protected readonly bloqueadoPorNavegador = signal(false);

  private ventana: Window | null = null;

  constructor() {
    const readyBase = this.sync.popupReadyTick();
    const closingBase = this.sync.popupClosingTick();

    effect(() => {
      if (this.sync.popupReadyTick() > readyBase) {
        this.popupAbierto.set(true);
        this.bloqueadoPorNavegador.set(false);
      }
    });

    effect(() => {
      if (this.sync.popupClosingTick() > closingBase) {
        this.limpiar();
      }
    });

    const intervaloPolling = setInterval(() => {
      if (this.ventana && this.ventana.closed) {
        this.limpiar();
      }
    }, INTERVALO_POLLING_MS);
    this.destroyRef.onDestroy(() => clearInterval(intervaloPolling));
  }

  ngOnInit(): void {
    this.intentarAbrir();
  }

  protected alternar(): void {
    if (this.popupAbierto()) {
      this.cerrar();
      return;
    }
    this.abrirOFocalizar();
  }

  protected forzarPublicidad(): void {
    if (!this.popupAbierto()) {
      this.abrirOFocalizar();
      setTimeout(() => this.sync.enviarForzarPublicidad(), ESPERA_MONTAJE_POPUP_MS);
      return;
    }
    this.sync.enviarForzarPublicidad();
  }

  private abrirOFocalizar(): void {
    if (this.ventana && !this.ventana.closed) {
      this.ventana.focus();
      this.popupAbierto.set(true);
      return;
    }
    this.intentarAbrir();
  }

  private cerrar(): void {
    if (this.ventana && !this.ventana.closed) {
      this.ventana.close();
    }
    this.limpiar();
  }

  private intentarAbrir(): void {
    // Ruta relativa resuelta contra document.baseURI: respeta el <base href>
    // real de la app (p. ej. "/" en local, "/fexchange-juniors-temp/" en
    // GitHub Pages) en vez de asumir una ruta absoluta hardcodeada.
    const url = new URL('pantalla-secundaria', document.baseURI).toString();
    const ventana = window.open(url, NOMBRE_VENTANA, CARACTERISTICAS_POPUP);
    if (!ventana) {
      this.bloqueadoPorNavegador.set(true);
      this.popupAbierto.set(false);
      return;
    }
    this.bloqueadoPorNavegador.set(false);
    this.ventana = ventana;
    this.popupAbierto.set(true);
  }

  private limpiar(): void {
    this.ventana = null;
    this.popupAbierto.set(false);
  }
}
