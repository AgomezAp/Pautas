import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Register Chart.js global theme, plugins, and defaults
import './app/config/chart-theme';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
