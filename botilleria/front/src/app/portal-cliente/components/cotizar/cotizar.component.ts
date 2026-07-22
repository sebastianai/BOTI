import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cotizar',
  standalone: true,
  imports: [],
  templateUrl: './cotizar.component.html',
  styleUrl: './cotizar.component.scss'
})
export class CotizarComponent {
  private readonly router = inject(Router);

  protected volver(): void {
    this.router.navigate(['/portal-cliente']);
  }
}
