// A cache warm cannot repair an <img> element that already failed to load.
// Re-select that element's source, then decode before exposing its scene.
export async function prepareRenderedImage(image: HTMLImageElement | null, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Image preparation aborted', 'AbortError')
  if (!image) throw new Error('Required scene image is not mounted')
  if (image.complete && image.naturalWidth === 0) image.src = image.src
  await new Promise<void>((resolve, reject) => {
    const abort = () => reject(new DOMException('Image preparation aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    const cleanup = () => signal.removeEventListener('abort', abort)
    try {
      void image.decode().then(() => {
        cleanup()
        if (signal.aborted) abort()
        else resolve()
      }, (error: unknown) => { cleanup(); reject(error) })
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
