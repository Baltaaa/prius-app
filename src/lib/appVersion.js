import pkg from '../../package.json'

// Única fuente real de la versión mostrada en el footer/sidebar — nunca un
// número hardcodeado a mano en el JSX.
export const APP_VERSION = pkg.version
