import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'be.chezpapa.salle',
  appName: 'Chez Papa Salle',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    url: 'https://chezpapa-beta.vercel.app/salle',
    androidScheme: 'https',
    allowNavigation: ['chezpapa-beta.vercel.app'],
  },
}

export default config
