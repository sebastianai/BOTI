import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { PortalConfigService } from './core/portal-config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly titleService = inject(Title);
  private readonly portalConfig = inject(PortalConfigService);

  constructor() {
    effect(() => {
      if (!this.portalConfig.cargado()) return;
      const cfg = this.portalConfig.config();
      this.titleService.setTitle(cfg.nombre_pestana);
      this.actualizarFavicon(this.portalConfig.logoUrl(cfg.logo_url));
    });
  }

  private actualizarFavicon(url: string): void {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.removeAttribute('type');
    link.href = url;
  }
}
