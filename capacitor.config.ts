import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dungeon.guardian',
  appName: '던전 수호자',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // 'never' lets env(safe-area-inset-*) report real notch insets inside the
    // WebView — index.html pads <body> with them so the canvas avoids the
    // Dynamic Island/home bar. ('always' zeroes env() via scroll insets.)
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
