async (page) => {
  const errors = [];
  const networkFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => networkFailures.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) networkFailures.push(response.status() + ' ' + response.url()); });
  const check = (value, message) => { if (!value) throw new Error(message); };
  const ready = () => page.getByText('Plan ready', { exact: true }).waitFor();
  await page.reload(); await ready();
  await page.getByText('Draft saved on this device', { exact: true }).waitFor();
  await page.reload(); await ready();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Scenario gallery' }).click();
  await page.getByRole('button', { name: /City delivery/ }).click(); await ready();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByRole('button', { name: 'Load sheet', exact: true }).first().click();
  await page.evaluate(() => {
    window.__qaNativeOpen = window.open;
    window.open = (...args) => {
      const popup = window.__qaNativeOpen.apply(window, args);
      if (popup) popup.print = () => { popup.__qaPrintCalled = true; };
      return popup;
    };
  });
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Print / save PDF' }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(() => window.__qaPrintCalled === true);
  check((await popup.locator('body').innerText()).includes('40 / 40'), 'Printable window must contain the current load sheet.');
  await popup.close();
  await page.evaluate(() => { window.open = window.__qaNativeOpen; delete window.__qaNativeOpen; });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('tab', { name: 'Cargo', exact: true }).click();
  await page.getByText('CSV format & example', { exact: true }).click();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Production layout overflow at ' + width + 'px.');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  const tools = await page.locator('.ct-scene-toolbar').boundingBox();
  check(tools.width > tools.height, 'Mobile scene tools must use a labeled toolbar outside the canvas.');
  await page.screenshot({ path: 'output/playwright/studio-mobile-final.png' });
  await page.getByText('CSV format & example', { exact: true }).click();
  await page.evaluate(() => scrollTo(0, document.getElementById('ct-inputs').getBoundingClientRect().top + scrollY - 16));
  await page.screenshot({ path: 'output/playwright/studio-mobile-setup-final.png' });
  await page.locator('.ct-workflow button').nth(2).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'output/playwright/studio-mobile-scene-final.png' });
  await page.locator('.ct-display-settings summary').click();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile display settings must fit.');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/studio-desktop-final.png' });
  check(errors.length === 0, 'Production page errors: ' + errors.join('; '));
  check(networkFailures.length === 0, 'Production network failures: ' + networkFailures.join('; '));
  return 'PASS: production assets and packing worker; current printable window and print invocation; five viewport widths; mobile tool row; final screenshots. Zero page errors or failed asset requests.';
}
