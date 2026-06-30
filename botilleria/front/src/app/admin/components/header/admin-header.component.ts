import { Component, inject, output } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  templateUrl: './admin-header.component.html',
  styleUrl: './admin-header.component.scss'
})
export class AdminHeaderComponent {
  protected readonly auth = inject(AuthService);
  readonly toggleSidebar = output<void>();
}
