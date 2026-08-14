import { Component, computed, inject } from '@angular/core';
import { SyncService } from '../../../../core/services/sync.service';
import { AutoFitTextoDirective } from '../../../../shared/directives/auto-fit-texto.directive';
import { formatearPrecioDelDia } from '../../../../shared/utils/formato-monto';

@Component({
  selector: 'app-panel-precio-fijo',
  standalone: true,
  imports: [AutoFitTextoDirective],
  templateUrl: './panel-precio-fijo.html',
  styleUrl: './panel-precio-fijo.scss',
})
export class PanelPrecioFijo {
  private readonly sync = inject(SyncService);

  protected readonly simboloOperador = computed(() =>
    this.sync.precioDelDia()?.operador === 'dividir' ? '÷' : '×',
  );

  protected readonly tasaTexto = computed(() =>
    formatearPrecioDelDia(this.sync.precioDelDia()?.tasa ?? 0),
  );
}
