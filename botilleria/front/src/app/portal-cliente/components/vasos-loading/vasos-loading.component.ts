import { Component, input } from '@angular/core';

@Component({
  selector: 'app-vasos-loading',
  standalone: true,
  templateUrl: './vasos-loading.component.html',
  styleUrl: './vasos-loading.component.scss'
})
export class VasosLoadingComponent {
  dark = input(false);
  mensaje = input('Cargando...');

  protected readonly vasos = [
    { claro: 'assets/img/vino-negro.png',      oscuro: 'assets/img/vino-blanco.png' },
    { claro: 'assets/img/mug-negro.png',        oscuro: 'assets/img/mug-blanco.png' },
    { claro: 'assets/img/whisky-negro.png',     oscuro: 'assets/img/whisky-blanco.png' },
    { claro: 'assets/img/martini-negro.png',    oscuro: 'assets/img/martini-blanco.png' },
    { claro: 'assets/img/champan-negro.png',    oscuro: 'assets/img/champan-blanco.png' },
    { claro: 'assets/img/coupe-negro.png',      oscuro: 'assets/img/coupe-blanco.png' },
    { claro: 'assets/img/balon-negro.png',      oscuro: 'assets/img/balon-blanco.png' },
  ];
}
