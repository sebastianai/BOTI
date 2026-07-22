import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PortalConfigService } from '../../../core/portal-config.service';
import { ClienteAuthService } from '../../services/cliente-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly clienteAuth = inject(ClienteAuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly portalConfig = inject(PortalConfigService);

  protected readonly cargando = signal(false);
  protected readonly errorMsg = signal('');

  protected readonly form = this.fb.group({
    rut: ['', Validators.required],
    contrasena: ['', Validators.required]
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorMsg.set('');
    const { rut, contrasena } = this.form.value;
    this.clienteAuth.login(rut!, contrasena!).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/portal-cliente']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set(err?.error?.error || 'Error al iniciar sesión');
      }
    });
  }

  protected volver(): void {
    this.router.navigate(['/portal-cliente']);
  }

  protected irARegistro(): void {
    this.router.navigate(['/portal-cliente/registro']);
  }
}
