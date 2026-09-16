import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dungeon.guardian',
  appName: '던전 수호자',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // Avoid UIKit scroll insets resizing the fixed Phaser viewport twice.
    // CSS env() plus the native-iOS fallback in main.ts owns the safe frame.
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a0f00',
      showSpinner: false,
    },
  },
};

export default config;
