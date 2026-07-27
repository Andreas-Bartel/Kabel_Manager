import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cableguy.app',
  appName: 'Kabel Manager',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
