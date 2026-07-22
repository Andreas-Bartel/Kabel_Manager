import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cableguy.app',
  appName: 'Cable Guy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
