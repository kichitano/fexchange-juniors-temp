import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/pantalla-principal/pantalla-principal').then((m) => m.PantallaPrincipal),
  },
  {
    path: 'pantalla-secundaria',
    loadComponent: () =>
      import('./features/pantalla-secundaria/pantalla-secundaria').then(
        (m) => m.PantallaSecundaria,
      ),
  },
  { path: '**', redirectTo: '' },
];
