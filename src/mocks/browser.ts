import { setupWorker } from "msw/browser"
import { handlers } from "./handlers"

const isBrowser = typeof window !== "undefined"
const supportsServiceWorker =
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  navigator.serviceWorker !== undefined &&
  typeof navigator.serviceWorker.addEventListener === "function"

export const worker = isBrowser && supportsServiceWorker ? setupWorker(...handlers) : undefined
