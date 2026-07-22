import { Component, model, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

type VistaContacto = 'opciones' | 'invitado';

@Component({
  selector: 'app-paso-contacto',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paso-contacto.component.html',
  styleUrls: ['../_rc-comun.scss', './paso-contacto.component.scss']
})
export class PasoContactoComponent {
  readonly quieroFactura = model(false);
  readonly avanzarAEntrega = output<void>();

  protected readonly vistaContacto = signal<VistaContacto>('opciones');
  protected readonly rut = signal('');
  protected readonly contrasena = signal('');
  protected readonly mostrarProximamente = signal(false);

  protected readonly correo = signal('');
  protected readonly nombre = signal('');
  protected readonly apellido = signal('');
  protected readonly telefono = signal('+56');
  protected readonly rutInvitado = signal('');
  protected readonly razonSocial = signal('');
  protected readonly rutEmpresa = signal('');
  protected readonly intentoEnviar = signal(false);

  protected readonly datosInvitadoValidos = computed(() =>
    this.correo().trim() !== '' &&
    this.nombre().trim() !== '' &&
    this.apellido().trim() !== '' &&
    this.telefono().trim() !== '' &&
    this.rutInvitado().trim() !== ''
  );

  protected continuar(): void {
    this.mostrarProximamente.set(true);
  }

  protected continuarComoInvitado(): void {
    this.vistaContacto.set('invitado');
    this.mostrarProximamente.set(false);
  }

  protected volverAOpciones(): void {
    this.vistaContacto.set('opciones');
    this.intentoEnviar.set(false);
    this.mostrarProximamente.set(false);
  }

  protected toggleFactura(): void {
    this.quieroFactura.update(v => !v);
  }

  protected continuarDatosInvitado(): void {
    this.intentoEnviar.set(true);
    if (!this.datosInvitadoValidos()) return;
    this.mostrarProximamente.set(false);
    this.avanzarAEntrega.emit();
  }

  reset(): void {
    this.mostrarProximamente.set(false);
    this.vistaContacto.set('opciones');
    this.intentoEnviar.set(false);
  }
}
