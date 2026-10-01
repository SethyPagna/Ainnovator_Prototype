async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (value, message) => { if (!value) throw new Error(message); };
  const ready = () => page.getByText('Plan ready', { exact: true }).waitFor();
  await page.reload(); await ready();
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const view of ['Top', 'Side', '3D']) await page.getByRole('button', { name: view, exact: true }).click();
  await page.locator('.ct-display-settings summary').click();
  for (const name of ['Show transport walls', 'Show cargo labels', 'Separate cargo for inspection', 'Show weight center']) {
    const control = page.getByRole('checkbox', { name, exact: true });
    const previous = await control.isChecked(); await control.click();
    check(await control.isChecked() !== previous, name + ' must change state.'); await control.click();
  }
  await page.getByRole('combobox', { name: 'Color cargo by' }).selectOption('weight');
  check(await page.getByText('Weight per piece · relative to heaviest packed').isVisible(), 'Weight coloring needs a meaningful legend.');
  await page.getByRole('combobox', { name: 'Color cargo by' }).selectOption('handling');
  check(await page.locator('.ct-scene-legend.handling').isVisible(), 'Handling coloring needs a legend.');
  await page.getByRole('combobox', { name: 'Color cargo by' }).selectOption('cargo');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.getByRole('button', { name: 'Play loading sequence' }).click(); await page.waitForTimeout(1350);
  await page.getByRole('button', { name: 'Pause loading sequence' }).click();
  const shown = Number(await page.getByRole('slider', { name: 'Loading sequence step' }).inputValue());
  check(shown > 0 && shown < 40, 'Replay must progressively show cargo.');
  await page.getByRole('slider', { name: 'Loading sequence step' }).press('End');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const firstPiece = page.getByRole('button', { name: /^Piece / }).first();
  await firstPiece.focus(); await firstPiece.press('Enter');
  await page.getByRole('button', { name: 'Close cargo details' }).waitFor();
  const selectedBefore = await page.locator('.ct-piece-details .ct-eyebrow').innerText();
  await firstPiece.press('ArrowRight');
  const selectedAfter = await page.locator('.ct-piece-details .ct-eyebrow').innerText();
  check(selectedBefore !== selectedAfter, 'Map arrow navigation must select another piece.');
  await page.getByRole('button', { name: 'Close cargo details' }).click();
  await page.screenshot({ path: 'output/playwright/studio-map.png' });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.locator('.ct-scene canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByText('3D view unavailable on this device').waitFor();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  check(await page.getByRole('group', { name: /^Interactive top view/ }).isVisible(), 'The map must remain usable after WebGL context loss.');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('tab', { name: 'Load space', exact: true }).click();
  for (const mode of ['Road', 'Sea', 'Air', 'Rail', 'Custom']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await page.locator('.ct-pack-button').click(); await ready();
    check(await page.locator('.ct-scene canvas').isVisible(), mode + ' scene must render.');
    await page.screenshot({ path: 'output/playwright/studio-' + mode.toLowerCase() + '.png' });
  }
  await page.getByRole('spinbutton', { name: 'Width cm', exact: true }).fill('0');
  await page.locator('.ct-pack-button').click();
  await page.getByText('Check inputs', { exact: true }).waitFor();
  check(await page.getByRole('alert').first().isVisible(), 'Invalid dimensions must produce input errors.');
  await page.getByRole('button', { name: 'Undo edit' }).click();
  await page.locator('.ct-pack-button').click(); await ready();
  await page.evaluate(() => { window.__qaOriginalWorker = window.Worker; window.Worker = class { constructor() { throw new Error('QA worker blocked'); } }; });
  await page.locator('.ct-pack-button').click();
  await page.getByText('The packing worker could not start. Reload the page and try again.').first().waitFor();
  await page.evaluate(() => { window.Worker = window.__qaOriginalWorker; delete window.__qaOriginalWorker; });
  await page.locator('.ct-pack-button').click(); await ready();
  await page.getByRole('button', { name: 'Scenario gallery' }).click();
  await page.getByRole('button', { name: /City delivery/ }).click(); await ready();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page must not overflow horizontally at ' + width + 'px.');
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/studio-mobile.png' });
  const toolbar = page.getByRole('navigation', { name: 'Project tools' });
  for (const name of ['Projects', 'Import project JSON', 'Export files', 'Save project']) check(await toolbar.getByRole('button', { name, exact: true }).isVisible(), 'Mobile toolbar needs accessible ' + name + '.');
  await page.getByRole('button', { name: 'Scenario gallery' }).click();
  check(await page.evaluate(() => document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth), 'Mobile scenario dialog must fit.');
  await page.keyboard.press('Escape'); check(await page.getByRole('dialog').count() === 0, 'Escape must close the dialog.');
  await page.getByRole('button', { name: 'Help and shortcuts' }).click(); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('tab', { name: 'Cargo', exact: true }).click();
  await page.getByRole('tab', { name: 'Load insights', exact: true }).click(); await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/studio-final.png' });
  check(errors.length === 0, 'Browser page errors: ' + errors.join('; '));
  return 'PASS: camera views; shell/labels/explode/CG; weight/handling legends; replay; map selection and keyboard navigation; WebGL-loss fallback; all five transports; invalid dimensions; blocked worker recovery; widths 1440/1024/768/390/320; mobile buttons/dialogs; Escape. Zero page errors.';
}

