import { Component, inject } from '@angular/core';
import { ImpresionService } from '../../../../core/services/impresion.service';

@Component({
  selector: 'app-configurar-impresion',
  standalone: true,
  templateUrl: './configurar-impresion.html',
  styleUrl: './configurar-impresion.scss',
})
export class ConfigurarImpresion {
  protected readonly impresion = inject(ImpresionService);
}
