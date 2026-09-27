import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-missing-page',
  imports: [RouterLink],
  template: `
    <h2>That page is not in the directory</h2>
    <p><a routerLink="/">Back to search</a></p>
  `,
})
export class MissingPage {}
