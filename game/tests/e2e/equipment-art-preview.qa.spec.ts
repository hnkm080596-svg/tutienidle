import { test, expect } from './fixtures'

test('equipment art keeps its paperdoll fixed across four independent mock workspaces', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto('/ui-landscape-design.html?example=home')
  const initialStorage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  )
  await page.locator('.home-independent-navigation button[aria-label="equipment"]').click()
  const panel = page.getByTestId('home-equipment-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.equipment-panel-tabs button')).toHaveCount(4)
  await expect(panel.locator('.equipment-bag-filters button')).toHaveCount(4)
  await expect(page.getByTestId('equipment-filter-other')).toHaveCount(0)
  await expect(panel.locator('.equipment-equipped-slot')).toHaveCount(6)
  const left = page.getByTestId('equipment-fixed-left')
  const bounds = await left.boundingBox()
  const paperdollText = await left.textContent()
  await page.getByTestId('equipment-filter-weapon').click()
  await expect(panel.locator('.equipment-bag-grid button:not(:disabled)')).toHaveCount(3)
  await page.getByTestId('equipment-filter-all').click()
  await expect(panel.locator('.equipment-bag-grid button:not(:disabled)')).toHaveCount(18)
  await page.getByTestId('equipment-equipped-ring').click()
  for (const tab of ['enhance', 'wash', 'refine'] as const) {
    await page.getByTestId(`equipment-tab-${tab}`).click()
    await expect(page.getByTestId(`equipment-forge-${tab}`)).toBeVisible()
    await expect(page.getByTestId('equipment-equipped-ring')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await left.boundingBox()).toEqual(bounds)
    expect(await left.textContent()).toEqual(paperdollText)
    expect(
      await panel
        .locator('.equipment-right-workspace img')
        .evaluateAll((images) =>
          images.some((image) => (image as HTMLImageElement).src.includes('/equipment/items/')),
        ),
    ).toBe(false)
    await page.getByTestId(`equipment-action-${tab}`).click()
    await expect(panel.getByRole('status')).toBeVisible()
  }
  await page.getByTestId('equipment-tab-wash').click()
  await expect(page.getByTestId('equipment-keep-result')).toBeDisabled()
  await page.getByTestId('equipment-lock-attack').click()
  await expect(page.getByTestId('equipment-lock-attack')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('equipment-action-wash').click()
  await expect(page.getByTestId('equipment-keep-result')).toBeEnabled()
  await page.getByTestId('equipment-keep-result').click()
  await expect(page.getByTestId('equipment-keep-result')).toBeDisabled()
  await page.getByTestId('equipment-equipped-boots').click()
  await expect(panel.locator('.equipment-right-workspace')).toHaveAttribute(
    'data-selected-equipment',
    'boots',
  )
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  )
  expect(storage).toBe(initialStorage)
  expect(errors).toEqual([])
})

test('equipment art fits the shared scene rectangle and energy honors reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/ui-landscape-design.html?example=home')
  await page.locator('.home-independent-navigation button[aria-label="character"]').click()
  const characterBounds = await page.getByTestId('home-character-panel').boundingBox()
  await page.locator('.home-independent-navigation button[aria-label="equipment"]').click()
  const panel = page.getByTestId('home-equipment-panel')
  expect(await panel.boundingBox()).toEqual(characterBounds)
  await page.getByTestId('equipment-tab-refine').click()
  const overflow = await panel.evaluate((element) =>
    [
      ...element.querySelectorAll<HTMLElement>(
        '.equipment-right-workspace, .equipment-forge-workspace, .equipment-refinement-rows',
      ),
    ]
      .filter((node) => node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.className),
  )
  expect(overflow).toEqual([])
  const tube = panel.locator('.equipment-energy-tube i').first()
  expect(
    await tube.evaluate((element) => getComputedStyle(element, '::after').animationName),
  ).toMatch(/^equipment-energy-flow(?:-|$)/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await tube.evaluate((element) => getComputedStyle(element, '::after').animationName)).toBe(
    'none',
  )
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((image) => image.decode()))
  })
  const unloaded = await page.evaluate(() =>
    [...document.images].filter((image) => !image.naturalWidth).map((image) => image.src),
  )
  expect(unloaded).toEqual([])
})
