import { Component, inject } from '@angular/core';
import { ConfiguracionCambioService } from '../../../../core/services/configuracion-cambio.service';
import { SyncService } from '../../../../core/services/sync.service';

@Component({
  selector: 'app-selector-tipo-cambio',
  standalone: true,
  templateUrl: './selector-tipo-cambio.html',
  styleUrl: './selector-tipo-cambio.scss',
})
export class SelectorTipoCambio {
  protected readonly configuracion = inject(ConfiguracionCambioService);
  private readonly sync = inject(SyncService);

  protected esActivo(origen: string, destino: string): boolean {
    const activo = this.configuracion.parActivo();
    return activo.origen === origen && activo.destino === destino;
  }

  protected seleccionar(origen: 'CLP' | 'PEN' | 'USD', destino: 'CLP' | 'PEN' | 'USD'): void {
    this.configuracion.seleccionarPar(origen, destino);
    this.sync.enviarActividad();
  }
}
