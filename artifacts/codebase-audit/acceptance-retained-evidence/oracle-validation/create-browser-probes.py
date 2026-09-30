from pathlib import Path

source = Path('e2e/duel-smoke.spec.ts').read_text()

def replace_once(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new)

slow = replace_once(source,
    '          capture.events.push(structuredClone(event.data));',
    '''          capture.events.push(structuredClone(event.data));
          if (event.data?.type === "state") {
            const until = performance.now() + 120;
            while (performance.now() < until) { /* controlled slow ingress */ }
          }''')
slow = replace_once(slow,
    '    // Hash navigation unmounts the duel without replacing its instrumented document.',
    '''    test.fail();
    await page.evaluate(() => { URL.revokeObjectURL = () => undefined; });
    // Hash navigation unmounts the duel without replacing its instrumented document.''')
slow = replace_once(slow, '  expect(updatePaint.p95).toBeLessThan(50);',
    '  test.fail();\n  expect(updatePaint.p95).toBeLessThan(50);')
missing = replace_once(source, 'data: { type: "state", state },',
    'data: { type: "state", state: previous.state },')
missing = replace_once(missing, '  for (let run = 0; run < 5; run += 1) {',
    '  test.fail();\n  for (let run = 0; run < 5; run += 1) {')
restored = replace_once(source,
    '    await expect(page.locator(\'[data-cy="main-menu-title"]\')).toBeVisible();',
    '''    await expect(page.locator('[data-cy="main-menu-title"]')).toBeVisible();
    // Positive control: an unrelated destination lease must not fail teardown.
    await page.evaluate(() => URL.createObjectURL(new Blob(["destination lease"])));''')
for name, text in [('oracle-slow-leak.spec.ts', slow), ('oracle-missing-update.spec.ts', missing), ('zz-oracle-restored.spec.ts', restored)]:
    path = Path('e2e') / name
    # These exact disposable copies are worker-owned; never target production files.
    if path.exists():
        prior = path.read_text()
        assert prior.startswith(source[:200])
    path.write_text(text)
