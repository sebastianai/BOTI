import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PortalConfigService } from '../../../core/portal-config.service';
import { GOOGLE_MAPS_EMBED_API_KEY } from '../../../core/api.config';
import { SucursalesService, Sucursal } from '../../services/sucursales.service';

@Component({
  selector: 'app-mapa-local',
  standalone: true,
  templateUrl: './mapa-local.component.html',
  styleUrl: './mapa-local.component.scss'
})
export class MapaLocalComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly sucursalesService = inject(SucursalesService);
  protected readonly portalConfig = inject(PortalConfigService);

  protected readonly sucursales = signal<Sucursal[]>([]);
  protected readonly sucursalSeleccionadaId = signal<number | null>(null);

  protected readonly sucursalSeleccionada = computed(() =>
    this.sucursales().find(s => s.id === this.sucursalSeleccionadaId()) ?? this.sucursales()[0] ?? null
  );

  protected readonly mapaUrl = computed<SafeResourceUrl | null>(() => {
    const sucursal = this.sucursalSeleccionada();
    if (!sucursal) return null;
    const q = encodeURIComponent(sucursal.direccion);
    const url = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_EMBED_API_KEY}&q=${q}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  ngOnInit(): void {
    this.sucursalesService.obtenerTodas().subscribe(data => this.sucursales.set(data));
  }

  protected seleccionarSucursal(id: number): void {
    this.sucursalSeleccionadaId.set(id);
  }
}
