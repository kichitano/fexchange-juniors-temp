import { Component, computed, inject, signal } from '@angular/core';
import { PersistenciaService } from '../../../../core/services/persistencia.service';
import { formatearMonto } from '../../../../shared/utils/formato-monto';

@Component({
  selector: 'app-historial-cambios',
  standalone: true,
  templateUrl: './historial-cambios.html',
  styleUrl: './historial-cambios.scss',
})
export class HistorialCambios {
  protected readonly persistencia = inject(PersistenciaService);

  protected readonly visible = signal(false);
  protected readonly fechaSeleccionada = signal<string>(this.fechaHoyIso());

  protected readonly fechaLocalSeleccionada = computed(() =>
    this.fechaIsoAFechaLocal(this.fechaSeleccionada()),
  );

  protected readonly historialFiltrado = computed(() =>
    this.persistencia
      .historial()
      .filter((cambio) => cambio.fecha === this.fechaLocalSeleccionada()),
  );

  protected readonly formatearMonto = formatearMonto;

  protected alternarVisible(): void {
    this.visible.update((valor) => !valor);
  }

  protected onFechaSeleccionadaInput(evento: Event): void {
    this.fechaSeleccionada.set((evento.target as HTMLInputElement).value);
  }

  protected exportar(): void {
    this.persistencia.exportarJson(this.fechaLocalSeleccionada());
  }

  protected eliminarCambio(id: string): void {
    this.persistencia.eliminarCambio(id);
  }

  protected async conectarArchivo(): Promise<void> {
    await this.persistencia.conectarArchivoLocal();
  }

  private fechaIsoAFechaLocal(fechaIso: string): string {
    const [anio, mes, dia] = fechaIso.split('-');
    return new Date(Number(anio), Number(mes) - 1, Number(dia)).toLocaleDateString('es-CL');
  }

  private fechaHoyIso(): string {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
