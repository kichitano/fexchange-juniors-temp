import { Component, computed, inject } from '@angular/core';
import { SyncService } from '../../../../core/services/sync.service';
import { AutoFitTextoDirective } from '../../../../shared/directives/auto-fit-texto.directive';
import { formatearEntero, formatearMonto, formatearTasa } from '../../../../shared/utils/formato-monto';
import { nombreMoneda } from '../../../../shared/utils/nombre-moneda';

@Component({
  selector: 'app-vista-en-vivo-cliente',
  standalone: true,
  imports: [AutoFitTextoDirective],
  templateUrl: './vista-en-vivo-cliente.html',
  styleUrl: './vista-en-vivo-cliente.scss',
})
export class VistaEnVivoCliente {
  private readonly sync = inject(SyncService);

  protected readonly vista = this.sync.vistaEnVivo;

  readonly nombreOrigen = computed(() =>
    this.vista() ? nombreMoneda(this.vista()!.monedaOrigen) : '',
  );
  protected readonly nombreDestino = computed(() =>
    this.vista() ? nombreMoneda(this.vista()!.monedaDestino) : '',
  );

  protected readonly montoTexto = computed(() => formatearEntero(this.vista()?.montoIngresado ?? 0));
  protected readonly tasaTexto = computed(() => formatearTasa(this.vista()?.tasa ?? 0));
  protected readonly resultadoTexto = computed(() =>
    formatearMonto(this.vista()?.montoResultado ?? 0),
  );
}
