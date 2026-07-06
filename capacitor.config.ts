import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pihai.concertmap',
  appName: '台灣演唱會地圖',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
