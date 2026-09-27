import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinderApi, MetaResponse, ProviderDetail } from './finder-api';
import { formatDate, phoneText, placeCase } from './format';

@Component({
  selector: 'app-provider-page',
  imports: [RouterLink],
  templateUrl: './provider-page.html',
})
export class ProviderPage {
  private readonly api = inject(FinderApi);
  readonly detail = signal<ProviderDetail | null>(null);
  readonly meta = signal<MetaResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  readonly placeCase = placeCase;
  readonly phoneText = phoneText;
  readonly formatDate = formatDate;

  constructor() {
    const npi = inject(ActivatedRoute).snapshot.paramMap.get('npi') ?? '';
    this.api.meta().subscribe((meta) => this.meta.set(meta));
    this.api.detail(npi).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 404 ? 'No provider has that NPI in this directory.' : 'The directory did not respond.');
      },
    });
  }

  address(detail: ProviderDetail): string {
    return [detail.addressLine1, detail.addressLine2, detail.city, 'OR', detail.zip5].filter(Boolean).join(', ');
  }

  mapsUrl(detail: ProviderDetail): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.address(detail));
  }

  async copyAddress(detail: ProviderDetail) {
    const text = this.address(detail);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    this.copied.set(true);
  }
}
