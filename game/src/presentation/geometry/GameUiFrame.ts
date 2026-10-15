export const GAME_UI_WIDTH = 1440
export const GAME_UI_HEIGHT = 810

export function fitGameUiFrame(viewportWidth: number, viewportHeight: number) {
  const scale = Math.max(0, Math.min(viewportWidth / GAME_UI_WIDTH, viewportHeight / GAME_UI_HEIGHT))
  const width = GAME_UI_WIDTH * scale
  const height = GAME_UI_HEIGHT * scale
  return { x: (viewportWidth - width) / 2, y: (viewportHeight - height) / 2, width, height, scale }
}

export function readGameUiFrame() {
  return fitGameUiFrame(window.innerWidth, window.innerHeight)
}
