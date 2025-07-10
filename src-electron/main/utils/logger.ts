export function getLogger(name: string) {
  return {
    info: (message: string, ...args: any[]) => {
      console.log(`[${name}] ${message}`, ...args)
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${name}] ${message}`, ...args)
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${name}] ${message}`, ...args)
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[${name}] ${message}`, ...args)
      }
    },
  }
}