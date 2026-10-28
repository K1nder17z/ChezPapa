/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_MENU_URL?: string
  readonly VITE_RESTAURANT_ADDRESS?: string
  readonly VITE_RESTAURANT_PHONE?: string
  readonly VITE_RESTAURANT_HOURS?: string
  readonly VITE_RESTAURANT_MAPS_URL?: string
  readonly VITE_RESTAURANT_REVIEWS_URL?: string
  readonly VITE_RESTAURANT_INSTAGRAM?: string
  readonly VITE_RESTAURANT_FACEBOOK?: string
  readonly VITE_SALLE_CODE?: string
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
