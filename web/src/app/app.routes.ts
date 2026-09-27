import { Routes } from '@angular/router';
import { AboutPage } from './about-page';
import { MissingPage } from './missing-page';
import { ProviderPage } from './provider-page';
import { SearchPage } from './search-page';

export const routes: Routes = [
  { path: '', component: SearchPage },
  { path: 'provider/:npi', component: ProviderPage },
  { path: 'about-data', component: AboutPage },
  { path: '**', component: MissingPage },
];
