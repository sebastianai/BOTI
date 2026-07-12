import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss'
})
export class BreadcrumbComponent {
  items = input<BreadcrumbItem[]>([
    { label: 'Inicio', path: '/portal-cliente' }
  ]);

  constructor(private router: Router) {}

  navigate(path: string) {
    if (path) {
      this.router.navigate([path]);
    }
  }
}
