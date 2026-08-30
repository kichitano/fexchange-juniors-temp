import { Component, effect, inject, untracked } from '@angular/core';
import { ConfiguracionCambioService } from '../../core/services/configuracion-cambio.service';
import { SyncService } from '../../core/services/sync.service';
import { ControlPopup } from './components/control-popup/control-popup';
import { FormulaCambio } from './components/formula-cambio/formula-cambio';
import { HistorialCambios } from './components/historial-cambios/historial-cambios';
import { SelectorTipoCambio } from './components/selector-tipo-cambio/selector-tipo-cambio';

@Component({
  selector: 'app-pantalla-principal',
  standalone: true,
  imports: [SelectorTipoCambio, FormulaCambio, HistorialCambios, ControlPopup],
  templateUrl: './pantalla-principal.html',
  styleUrl: './pantalla-principal.scss',
})
export class PantallaPrincipal {
  private readonly configuracion = inject(ConfiguracionCambioService);
  private readonly sync = inject(SyncService);

  constructor() {
    effect(() => {
      const precioDelDia = this.configuracion.precioDelDiaClpPen();
      this.sync.enviarPrecioDelDia({
        operador: precioDelDia.operador,
        tasa: precioDelDia.tasa,
      });
    });

    // La Pantalla Secundaria arranca sin estado propio cada vez que se abre
    // (ventana nueva = SyncService nuevo): en cuanto avisa que está lista,
    // le reenviamos el precio del día vigente para que no se quede en 0.
    let primeraEjecucionPopupReady = true;
    effect(() => {
      this.sync.popupReadyTick();
      if (primeraEjecucionPopupReady) {
        primeraEjecucionPopupReady = false;
        return;
      }
      const precioDelDia = untracked(() => this.configuracion.precioDelDiaClpPen());
      this.sync.enviarPrecioDelDia({
        operador: precioDelDia.operador,
        tasa: precioDelDia.tasa,
      });
    });
  }
}
