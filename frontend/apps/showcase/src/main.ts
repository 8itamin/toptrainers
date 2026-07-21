import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

void bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  console.error('TopTrainers showcase bootstrap failed', error);
});
