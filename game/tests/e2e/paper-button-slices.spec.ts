import { expect, test, type Locator } from './fixtures'
import { createCharacterThroughUi, enterHome } from './helpers'

async function expectDrawableCenter(controls: Locator): Promise<void> {
  await expect(controls.first()).toBeVisible()
  const geometry = await controls.evaluateAll(async nodes => Promise.all(nodes.map(async node => {
    const css = getComputedStyle(node, '::before')
    const url = /^url\(["']?(.*?)["']?\)$/.exec(css.borderImageSource)?.[1]
    if (!url) throw new Error('Missing button border image')
    const image = new Image()
    image.src = url
    await image.decode()
    const raw = css.borderImageSlice.replace('fill', '').trim().split(/\s+/)
    const expanded = raw.length === 1 ? [raw[0]!, raw[0]!, raw[0]!, raw[0]!] : raw.length === 2 ? [raw[0]!, raw[1]!, raw[0]!, raw[1]!] : raw.length === 3 ? [raw[0]!, raw[1]!, raw[2]!, raw[1]!] : raw
    const cuts = expanded.map((value, index) => parseFloat(value!) * (value!.endsWith('%') ? (index % 2 === 0 ? image.naturalHeight : image.naturalWidth) / 100 : 1))
    return { width: image.naturalWidth, height: image.naturalHeight, horizontal: cuts[1]! + cuts[3]!, vertical: cuts[0]! + cuts[2]! }
  })))
  for (const item of geometry) {
    expect(item.horizontal, 'Source image must retain its center width').toBeLessThan(item.width)
    expect(item.vertical, 'Source image must retain its center height').toBeLessThan(item.height)
  }
}

for (const viewport of [{ width: 1600, height: 900 }, { width: 1366, height: 768 }]) {
 test('Paper button art keeps a drawable center after asset resizing at ' + viewport.width, async ({ page }, testInfo) => {
  await page.setViewportSize(viewport)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('auth-screen').waitFor()
  await page.getByTestId('auth-guest-button').click()
  await createCharacterThroughUi(page, 'Slice QA')
  await enterHome(page)
  await expectDrawableCenter(page.locator('[data-currency-id].pc-paper-button'))
  await page.screenshot({ path: testInfo.outputPath('home-buttons.png') })
  await page.locator('.home-navigation-toggle').click()
  await page.getByRole('button', { name: 'Luyện Đan', exact: true }).click()
  await expectDrawableCenter(page.locator('.recipe-row'))
  await page.screenshot({ path: testInfo.outputPath('alchemy-buttons.png') })
  await page.getByRole('button', { name: 'Trang Bị', exact: true }).click()
  await expectDrawableCenter(page.locator('.equipment-tabs button'))
  const tabs = page.locator('.equipment-tabs button:not(:disabled)')
  await tabs.last().click()
  await expectDrawableCenter(page.locator('.equipment-tabs button'))
  await tabs.first().hover()
  await page.screenshot({ path: testInfo.outputPath('equipment-buttons.png') })
  expect(errors).toEqual([])
})
}

