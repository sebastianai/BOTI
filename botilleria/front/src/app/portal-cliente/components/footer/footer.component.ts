import { Component, inject } from '@angular/core';
import { PortalConfigService } from '../../../core/portal-config.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  protected readonly portalConfig = inject(PortalConfigService);
  protected readonly anioActual = new Date().getFullYear();
  protected readonly logoFooter = 'assets/img/logo-4vasos-blanco.png';
}
