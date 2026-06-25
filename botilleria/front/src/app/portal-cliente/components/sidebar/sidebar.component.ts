import { Component, input, output, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { CategoriasService, Categoria } from '../../services/categorias.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  readonly abierto = input(false);
  readonly categoriaActiva = input('Todos');

  readonly seleccionarCategoria = output<string>();
  readonly cerrar = output<void>();

  private readonly categoriasService = inject(CategoriasService);

  private readonly categoriasDb = toSignal(
    this.categoriasService.obtenerCategorias().pipe(catchError(() => of<Categoria[]>([]))),
    { initialValue: [] as Categoria[] }
  );

  protected readonly categorias = computed<Categoria[]>(() => [
    { id: 'Todos', nombre: 'Todos los productos', emoji: '🏪' },
    ...this.categoriasDb()
  ]);

  onSeleccionar(categoriaId: string): void {
    this.seleccionarCategoria.emit(categoriaId);
  }
}
