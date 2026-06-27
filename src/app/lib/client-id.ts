export type ClientIDPrefix = 'batch' | 'item'

export function createClientID(
  prefix: ClientIDPrefix,
  randomUUID: () => string = crypto.randomUUID.bind(crypto)
): string {
  return `${prefix}_${randomUUID()}`
}
