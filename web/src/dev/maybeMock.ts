// La importación dinámica dentro del `if` permite que Vite elimine el mock del build de producción.
if (import.meta.env.DEV && import.meta.env.VITE_MOCK === '1') {
  const { installMock } = await import('./mock')
  installMock()
}
export {}
