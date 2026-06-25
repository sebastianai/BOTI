import { Component } from '@angular/core';
import { AjusteManualProductosComponent } from './ajuste-manual-productos/ajuste-manual-productos.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [AjusteManualProductosComponent],
  template: `<app-ajuste-manual-productos />`
})
export class AdminComponent {}
