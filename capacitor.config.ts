import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.kabelmanager.app',
  appName: 'Kabel Manager',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
