import { Component, inject, signal } from '@angular/core';
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

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.mapFirst.set(isSearch(event.urlAfterRedirects));
    });
  }
}

function isSearch(url: string): boolean {
  const path = url.split('?')[0];
  return path === '/' || path === '';
}
