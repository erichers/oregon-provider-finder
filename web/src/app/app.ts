import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  readonly mapFirst = signal(isSearch(this.router.url));
  readonly menuOpen = signal(false);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.mapFirst.set(isSearch(event.urlAfterRedirects));
      this.menuOpen.set(false);
    });
  }

  @HostListener('document:keydown.escape')
  closeMenu() {
    this.menuOpen.set(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  closeMenuFromOutside(event: PointerEvent) {
    const node = event.target as HTMLElement | null;
    if (!node?.closest('.mast')) {
      this.menuOpen.set(false);
    }
  }
}

function isSearch(url: string): boolean {
  const path = url.split('?')[0];
  return path === '/' || path === '';
}
