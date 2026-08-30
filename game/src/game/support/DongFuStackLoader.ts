import type { DongFuLayerDescriptor } from './DongFuArt'

export type DongFuImageLoader = (url: string) => Promise<void>

function loadBrowserImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Unable to load Dong Fu layer: ${url}`))
    image.src = url
  })
}

export async function preloadDongFuStack(
  layers: readonly DongFuLayerDescriptor[],
  loadImage: DongFuImageLoader = loadBrowserImage,
): Promise<readonly DongFuLayerDescriptor[]> {
  await Promise.all(layers.map((layer) => loadImage(layer.url)))
  return layers
}
