import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.489591018d8c447c983ee008c8d273e9',
  appName: 'trucker-pathfinder-buddy',
  webDir: 'dist',
  server: {
    url: 'https://48959101-8d8c-447c-983e-e008c8d273e9.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    // Background location for continuous navigation
    BackgroundRunner: {
      label: 'com.truckerpath.background',
      src: 'background.js',
      event: 'locationUpdate',
      repeat: true,
      interval: 1,
      autoStart: false,
    },
  },
  ios: {
    // Enable background location updates
    backgroundColor: '#000000',
    contentInset: 'automatic',
    scheme: 'TruckerPath',
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
  },
};

export default config;
