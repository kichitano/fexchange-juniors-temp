import { Injectable, signal } from '@angular/core';
import { CambioConfirmado } from '../models/cambio.model';

const CLAVE_LOCAL_STORAGE = 'casa-cambio-historial';

declare global {
  interface Window {
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
  }
}

@Injectable({ providedIn: 'root' })
export class PersistenciaService {
  readonly historial = signal<CambioConfirmado[]>(this.leerLocalStorage());
  readonly archivoConectado = signal(false);

  private handleArchivo: FileSystemFileHandle | null = null;
  private readonly soportaFileSystemAccess =
    typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

  get soportaArchivoLocal(): boolean {
    return this.soportaFileSystemAccess;
  }

  guardarCambio(cambio: CambioConfirmado): void {
    const actualizado = [cambio, ...this.historial()];
    this.historial.set(actualizado);
    this.escribirLocalStorage(actualizado);
    void this.escribirArchivoConectado(actualizado);
  }

  eliminarCambio(id: string): void {
    const actualizado = this.historial().filter((cambio) => cambio.id !== id);
    this.historial.set(actualizado);
    this.escribirLocalStorage(actualizado);
    void this.escribirArchivoConectado(actualizado);
  }

  async conectarArchivoLocal(): Promise<void> {
    if (!this.soportaFileSystemAccess || !window.showSaveFilePicker) {
      return;
    }
    try {
      this.handleArchivo = await window.showSaveFilePicker({
        suggestedName: 'cambios.json',
        types: [
          {
            description: 'Historial de cambios (JSON)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      this.archivoConectado.set(true);
      await this.escribirArchivoConectado(this.historial());
    } catch {
      this.archivoConectado.set(false);
    }
  }

  exportarJson(fecha: string | null): void {
    const registros = fecha
      ? this.historial().filter((cambio) => cambio.fecha === fecha)
      : this.historial();

    const blob = new Blob([JSON.stringify(registros, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = fecha ? `cambios_${fecha}.json` : 'cambios_completo.json';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  private leerLocalStorage(): CambioConfirmado[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const crudo = localStorage.getItem(CLAVE_LOCAL_STORAGE);
      return crudo ? (JSON.parse(crudo) as CambioConfirmado[]) : [];
    } catch {
      return [];
    }
  }

  private escribirLocalStorage(registros: CambioConfirmado[]): void {
    localStorage.setItem(CLAVE_LOCAL_STORAGE, JSON.stringify(registros));
  }

  private async escribirArchivoConectado(registros: CambioConfirmado[]): Promise<void> {
    if (!this.handleArchivo) {
      return;
    }
    try {
      const escritor = await this.handleArchivo.createWritable();
      await escritor.write(JSON.stringify(registros, null, 2));
      await escritor.close();
    } catch {
      this.archivoConectado.set(false);
      this.handleArchivo = null;
    }
  }
}
