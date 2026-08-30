import { Component, inject } from '@angular/core';
import { ImpresionService } from '../../../../core/services/impresion.service';
import { formatearEntero, formatearMontoTicket } from '../../../../shared/utils/formato-monto';

@Component({
  selector: 'app-ticket-imprimible',
  standalone: true,
  templateUrl: './ticket-imprimible.html',
  styleUrl: './ticket-imprimible.scss',
})
export class TicketImprimible {
  protected readonly impresion = inject(ImpresionService);

  protected montoTexto(): string {
    const datos = this.impresion.datosTicket();
    return datos ? formatearEntero(datos.monto) : '';
  }

  protected precioTexto(): string {
    const datos = this.impresion.datosTicket();
    if (!datos) {
      return '';
    }
    return `${datos.operador === 'multiplicar' ? 'x' : '/'} ${datos.precio}`;
  }

  protected totalTexto(): string {
    const datos = this.impresion.datosTicket();
    return datos ? formatearMontoTicket(datos.total) : '';
  }

  protected fechaTexto(): string {
    const fecha = this.impresion.fechaImpresion();
    return fecha ? fecha.toLocaleDateString('es-CL') : '';
  }

  protected horaTexto(): string {
    const fecha = this.impresion.fechaImpresion();
    return fecha ? fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
  }
}
