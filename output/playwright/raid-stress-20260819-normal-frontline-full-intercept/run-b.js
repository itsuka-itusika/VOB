async page => {
  const scenarioIds = [
    "raid-stress-autonomous-settlement-normal",
    "raid-stress-heresy-prosperous-village-normal",
    "raid-stress-heresy-autonomous-settlement-normal"
  ];
  const sourceFragment = `  return {\n    front: scale.stage === 3 ? 5 : 6,\n    middle: Math.max(1, maximumShooters - 1),\n    rear: 2\n  };`;
  const replacement = `  return {\n    front: scale.stage === 3 ? 7 : 8,\n    middle: Math.max(1, maximumShooters - 1),\n    rear: 2\n  };`;
  await page.route("**/tools/balance/scenarioDefinitions.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    if (!source.includes(sourceFragment)) throw new Error("stress_role_fragment_missing");
    await route.fulfill({ response, body: source.replace(sourceFragment, replacement) });
  });
  await page.goto("http://127.0.0.1:4173/tools/balance/index.html?variant=frontline-full-intercept-b");
  await page.waitForFunction(() => Boolean(window.__vobBalanceRunner), null, { timeout: 15000 });
  const outputDir = "C:/Users/JUN SHIMOKAWA/Desktop/VOB/output/playwright/raid-stress-20260819-normal-frontline-full-intercept";
  const results = [];
  for (const scenarioId of scenarioIds) {
    await page.locator("#scenario").selectOption(scenarioId);
    await page.locator("#startSeed").fill("1");
    await page.locator("#runCount").fill("20");
    await page.locator("#startButton").click();
    await page.waitForFunction(
      () => document.getElementById("progress")?.textContent.includes("完了しました"),
      null,
      { timeout: 300000 }
    );
    const info = await page.evaluate(() => {
      const batch = window.__vobBalanceRunner.getLastBatch();
      return {
        scenarioId: batch.config.scenarioId,
        completed: batch.summary.completed,
        errors: batch.summary.errors,
        cancelled: batch.cancelled,
        frontCounts: [...new Set(batch.results.flatMap(result => result.raidStress.modules.map(module => module.roleCounts.front)))]
      };
    });
    if (info.completed !== 20 || info.errors !== 0 || info.cancelled || info.frontCounts.length !== 1 || ![7, 8].includes(info.frontCounts[0])) {
      throw new Error(JSON.stringify(info));
    }
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#downloadButton").click();
    const download = await downloadPromise;
    await download.saveAs(`${outputDir}/vob-balance-${scenarioId}-frontline-full-intercept-1.json`);
    results.push(info);
  }
  return results;
}
