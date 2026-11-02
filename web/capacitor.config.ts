import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.golangqq.mobile',
  appName: 'Golang QQ',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
