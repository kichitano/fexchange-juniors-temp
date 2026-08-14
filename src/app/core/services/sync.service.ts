import { Injectable, OnDestroy, signal } from '@angular/core';
import {
  ActividadPayload,
  CANAL_SYNC,
  CambioConfirmadoPayload,
  ForzarPublicidadPayload,
  MensajeSync,
  PopupClosingPayload,
  PopupReadyPayload,
  PrecioDelDiaPayload,
  VistaEnVivoPayload,
} from '../models/sync.model';

@Injectable({ providedIn: 'root' })
export class SyncService implements OnDestroy {
  private readonly canal = new BroadcastChannel(CANAL_SYNC);

  readonly vistaEnVivo = signal<VistaEnVivoPayload | null>(null);
  readonly precioDelDia = signal<PrecioDelDiaPayload | null>(null);
  readonly ultimaActividad = signal<number>(Date.now());
  readonly forzarPublicidadTick = signal(0);
  readonly cambioConfirmadoTick = signal(0);
  readonly popupReadyTick = signal(0);
  readonly popupClosingTick = signal(0);

  constructor() {
    this.canal.onmessage = (evento: MessageEvent<MensajeSync>) => this.recibir(evento.data);
  }

  private recibir(mensaje: MensajeSync): void {
    switch (mensaje.tipo) {
      case 'vista-en-vivo':
        this.vistaEnVivo.set(mensaje);
        break;
      case 'precio-dia-actualizado':
        this.precioDelDia.set(mensaje);
        break;
      case 'actividad':
        this.ultimaActividad.set(Date.now());
        break;
      case 'forzar-publicidad':
        this.forzarPublicidadTick.update((valor) => valor + 1);
        break;
      case 'cambio-confirmado':
        this.cambioConfirmadoTick.update((valor) => valor + 1);
        break;
      case 'popup-ready':
        this.popupReadyTick.update((valor) => valor + 1);
        break;
      case 'popup-closing':
        this.popupClosingTick.update((valor) => valor + 1);
        break;
    }
  }

  enviarVistaEnVivo(payload: Omit<VistaEnVivoPayload, 'tipo'>): void {
    this.emitir({ tipo: 'vista-en-vivo', ...payload });
  }

  enviarPrecioDelDia(payload: Omit<PrecioDelDiaPayload, 'tipo'>): void {
    this.emitir({ tipo: 'precio-dia-actualizado', ...payload });
  }

  enviarActividad(): void {
    this.emitir({ tipo: 'actividad' } satisfies ActividadPayload);
  }

  enviarForzarPublicidad(): void {
    this.emitir({ tipo: 'forzar-publicidad' } satisfies ForzarPublicidadPayload);
  }

  enviarCambioConfirmado(): void {
    this.emitir({ tipo: 'cambio-confirmado' } satisfies CambioConfirmadoPayload);
  }

  enviarPopupReady(): void {
    this.emitir({ tipo: 'popup-ready' } satisfies PopupReadyPayload);
  }

  enviarPopupClosing(): void {
    this.emitir({ tipo: 'popup-closing' } satisfies PopupClosingPayload);
  }

  private emitir(mensaje: MensajeSync): void {
    this.canal.postMessage(mensaje);
  }

  ngOnDestroy(): void {
    this.canal.close();
  }
}
