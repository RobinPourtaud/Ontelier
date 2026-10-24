import { test, expect } from '@playwright/test';
test('real browser RDF → SPARQL → Konclude WASM → asserted export pipeline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.ontelier?.getState().ready);
  await expect(page.getByRole('button',{name:'Run reasoner',exact:true}).first()).toBeEnabled();
  const result = await page.evaluate(async () => {
    await window.ontelier.runReasoner();
    const result = await window.ontelier.query('SELECT ?s WHERE { ?s a owl:Class }');
    return {...window.ontelier.getState(),queryCount:result.rows.length};
  });
  expect(result.error).toBe('');
  expect(result.inference?.consistent).toBe(true);
  expect(result.queryCount).toBe(8);
  expect(result.inference?.triples.some(q => q.includes('Alice') && q.includes('Person>'))).toBe(true);
  expect(result.inference?.triples.some(q => q.includes('Professor') && q.includes('subClassOf') && q.includes('Person>'))).toBe(true);
  expect(result.project?.source).not.toContain('urn:konclude:inferred');
  expect(errors).toEqual([]);
  await page.setViewportSize({width:1512,height:982});
  await page.screenshot({path:'test-results/ontelier-workshop.png',fullPage:true});
});
