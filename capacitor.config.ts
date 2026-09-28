import type { CapacitorConfig } from "@capacitor/cli";

// Native store wrapper. Loads the live published app, so web updates ship
// instantly without a store release. The native launch screen is plain
// Oventric dark and hands off straight to the animated in-app splash.
const config: CapacitorConfig = {
  appId: "com.oventric.app",
  appName: "Oventric",
  webDir: "public",
  backgroundColor: "#151619",
  server: {
    url: "https://oventric.com/?mode=app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#151619",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0B",
      overlaysWebView: false,
    },
  },
};

export default config;
