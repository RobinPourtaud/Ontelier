import { test,expect } from '@playwright/test';
test.beforeEach(async ({page}) => { await page.setViewportSize({width:1512,height:982}); await page.goto('/',{waitUntil:'domcontentloaded',timeout:20_000}); await page.waitForFunction(() => window.ontelier?.getState().ready); });
test('visual entity creation, editing, undo/redo and persistence update actual RDF',async ({page}) => {
  await page.getByRole('button',{name:'Add entity',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Label',{exact:true}).fill('VisitingProfessor');
  await dialog.getByRole('button',{name:'Create entity'}).click(); await expect(dialog).toBeHidden();
  await page.locator('.inspector').getByLabel('Description',{exact:true}).fill('A temporary appointment.');
  await page.locator('.inspector').getByLabel('Description',{exact:true}).press('Tab');
  await expect.poll(() => page.evaluate(() => window.ontelier.getState().project?.source.includes('A temporary appointment.'))).toBe(true);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.ontelier.getState().project?.source.includes('A temporary appointment.'))).toBe(false);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.ontelier.getState().project?.source.includes('A temporary appointment.'))).toBe(true);
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  await page.reload(); await page.waitForFunction(() => window.ontelier?.getState().ready);
  expect(await page.evaluate(() => window.ontelier.getState().project?.source.includes('A temporary appointment.'))).toBe(true);
});
test('structured restrictions create an OWL blank node rather than a misleading class edge',async ({page}) => {
  await page.getByRole('button',{name:'Build a logical expression'}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Property',{exact:true}).selectOption('https://example.org/academy#worksAt');
  await dialog.getByLabel('Class',{exact:true}).selectOption('https://example.org/academy#University');
  await dialog.getByRole('button',{name:'Add expression'}).click(); await expect(dialog).toBeHidden();
  const correct = await page.evaluate(() => window.ontelier.query('ASK { :Researcher rdfs:subClassOf [a owl:Restriction; owl:onProperty :worksAt; owl:someValuesFrom :University] }'));
  expect(correct.boolean).toBe(true); await expect(page.locator('.node-expression')).toContainText('works at some University');
});
test('class, property and individual creation produce the correct RDF declarations',async ({page}) => {
  for (const [kind,label] of [['class','AClass'],['object','anObjectProperty'],['data','aDataProperty'],['individual','AnIndividual']]) {
    await page.getByRole('button',{name:'Add entity',exact:true}).click(); const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Entity type').selectOption(kind); await dialog.getByLabel('Label',{exact:true}).fill(label);
    await dialog.getByRole('button',{name:'Create entity'}).click(); await expect(dialog).toBeHidden();
  }
  const result = await page.evaluate(() => window.ontelier.query('ASK { :AClass a owl:Class . :anObjectProperty a owl:ObjectProperty . :aDataProperty a owl:DatatypeProperty . :AnIndividual a owl:NamedIndividual }'));
  expect(result.boolean).toBe(true);
});
test('Monaco loads locally, SPARQL shows results, command palette and theme work',async ({page}) => {
  const external:string[] = []; page.on('request',request => { if (!request.url().startsWith('http://127.0.0.1:5178') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.getByRole('tab',{name:'SPARQL',exact:true}).click(); await expect(page.locator('.monaco-editor')).toBeVisible();
  await page.getByRole('button',{name:'Run query',exact:true}).click(); await expect(page.locator('.result-summary')).toContainText('8 rows');
  await page.getByRole('button',{name:'Toggle theme'}).click(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.keyboard.press('Meta+k'); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByLabel('Search commands and entities').fill('Alice'); await page.getByRole('dialog').getByRole('button',{name:'Alice individual'}).click(); await expect(page.locator('.inspector h2')).toHaveText('Alice');
  expect(external).toEqual([]); await page.screenshot({path:'test-results/ontelier-dark.png'});
});
test('invalid Turtle leaves the current ontology intact',async ({page}) => {
  const original = await page.evaluate(() => window.ontelier.getState().project?.source);
  await page.evaluate(() => window.ontelier.loadTurtle('this is not valid Turtle <<<<'));
  await expect(page.getByRole('alert')).toBeVisible(); expect(await page.evaluate(() => window.ontelier.getState().project?.source)).toBe(original);
});
