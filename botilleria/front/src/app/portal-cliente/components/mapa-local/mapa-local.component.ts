import { Component, inject, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PortalConfigService } from '../../../core/portal-config.service';

@Component({
  selector: 'app-mapa-local',
  standalone: true,
  templateUrl: './mapa-local.component.html',
  styleUrl: './mapa-local.component.scss'
})
export class MapaLocalComponent {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly portalConfig = inject(PortalConfigService);

  protected readonly mapaUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.portalConfig.config().mapa_url;
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
}
