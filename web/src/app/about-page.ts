import { Component, inject, signal } from '@angular/core';
import { FinderApi } from './finder-api';
import { formatDate } from './format';

@Component({
  selector: 'app-about-page',
  templateUrl: './about-page.html',
})
export class AboutPage {
  readonly asOf = signal<string | null>(null);
  readonly formatDate = formatDate;

  constructor() {
    inject(FinderApi).meta().subscribe((meta) => this.asOf.set(meta.dataAsOf));
  }
}
