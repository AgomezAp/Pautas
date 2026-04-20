import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pautas.app',
  appName: 'Reportes',
  webDir: 'dist/pautas-frontend/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
