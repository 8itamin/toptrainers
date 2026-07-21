import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { SERVER_ROUTES } from './app.routes.server';

const serverOnlyConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(SERVER_ROUTES))],
};

export const serverConfig = mergeApplicationConfig(appConfig, serverOnlyConfig);
