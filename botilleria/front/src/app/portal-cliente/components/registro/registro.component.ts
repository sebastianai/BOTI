import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PortalConfigService } from '../../../core/portal-config.service';
import { ClientesService } from '../../services/clientes.service';

type Genero = 'femenino' | 'masculino' | 'no_decir';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.scss'
})
export class RegistroComponent {
  private readonly router = inject(Router);
  private readonly clientesService = inject(ClientesService);
  protected readonly portalConfig = inject(PortalConfigService);

  protected readonly nombre = signal('');
  protected readonly apellido = signal('');
  protected readonly rut = signal('');
  protected readonly correo = signal('');
  protected readonly telefono = signal('+56');
  protected readonly fechaNacimiento = signal('');
  protected readonly contrasena = signal('');
  protected readonly confirmarContrasena = signal('');
  protected readonly genero = signal<Genero | null>(null);
  protected readonly aceptaTerminos = signal(false);
  protected readonly noRobot = signal(false);

  protected readonly intentoEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal(false);

  protected readonly formularioValido = computed(() =>
    this.nombre().trim() !== '' &&
    this.apellido().trim() !== '' &&
    this.rut().trim() !== '' &&
    this.correo().trim() !== '' &&
    this.telefono().trim() !== '' &&
    this.fechaNacimiento().trim() !== '' &&
    this.contrasena().length >= 8 &&
    this.contrasena() === this.confirmarContrasena() &&
    this.genero() !== null &&
    this.aceptaTerminos()
  );

  protected seleccionarGenero(g: Genero): void {
    this.genero.set(g);
  }

  protected toggleTerminos(): void {
    this.aceptaTerminos.update(v => !v);
  }

  protected toggleNoRobot(): void {
    this.noRobot.update(v => !v);
  }

  protected volver(): void {
    this.router.navigate(['/portal-cliente']);
  }

  protected irALogin(): void {
    this.router.navigate(['/portal-cliente/login']);
  }

  protected registrar(): void {
    this.intentoEnviar.set(true);
    this.error.set(null);
    if (!this.formularioValido()) return;

    this.enviando.set(true);
    this.clientesService.registrar({
      nombre: this.nombre(),
      apellido: this.apellido(),
      rut: this.rut(),
      correo: this.correo(),
      telefono: this.telefono(),
      fechaNacimiento: this.fechaNacimiento(),
      genero: this.genero()!,
      contrasena: this.contrasena()
    }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.exito.set(true);
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err?.error?.error || 'No pudimos completar tu registro. Intenta nuevamente.');
      }
    });
  }
}
