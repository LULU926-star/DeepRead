import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

const SHOT_DIR = 'tests/e2e/shots';
const BACKEND = 'http://127.0.0.1:8000';

async function errorsOf(page: Page): Promise<ConsoleMessage[]> {
  const errs: ConsoleMessage[] = [];
  page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) errs.push(msg); });
  page.on('pageerror', (e) => errs.push({
    type: () => 'pageerror',
    text: () => `[pageerror] ${e.message}`,
    args: () => [], location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
  } as unknown as ConsoleMessage & { __kind?: string }));
  return errs;
}

test.describe('DeepRead Workspace', () => {
  test('1. Workspace chrome renders and is interactive', async ({ page }) => {
    const errors = await errorsOf(page);
    await page.goto('/');
    await page.waitForSelector('.workspace-header', { timeout: 10_000 });

    await expect(page.locator('.session-sidebar')).toBeVisible();
    await expect(page.locator('.workspace-header .eyebrow')).toContainText('当前研究');
    const tabLabels = ['对话', '检索', '综合综述', '方法对比', 'BibTeX', '相似论文'];
    for (const label of tabLabels) {
      await expect(page.locator('.workspace-tabs button').filter({ hasText: label })).toBeVisible();
    }
    const activeCount = await page.locator('.workspace-tabs button.is-active').count();
    expect(activeCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: `${SHOT_DIR}/01_initial_load.png`, fullPage: true });
    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e) => e.text()).join('\n')).toHaveLength(0);
  });

  test('2. Create a fresh session via API + see it in sidebar', async ({ page, request }) => {
    const errors = await errorsOf(page);
    const sig = `e2e-${Date.now()}`;
    const created = await request.post(`${BACKEND}/api/sessions`, { data: { name: sig } });
    expect(created.status()).toBe(201);
    const sessionId = (await created.json()).id;

    await page.goto('/');
    await page.waitForSelector('.workspace-header', { timeout: 10_000 });
    // New session should appear in the sidebar (search by name)
    await expect(page.locator(`.session-sidebar`).getByText(sig, { exact: false })).toBeVisible({ timeout: 5000 });

    // Click the new session and verify active tab stays clickable
    await page.locator(`.session-sidebar`).getByText(sig, { exact: false }).first().click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${SHOT_DIR}/02_after_create.png`, fullPage: true });
    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e) => e.text()).join('\n')).toHaveLength(0);

    // Cleanup
    await request.delete(`${BACKEND}/api/sessions/${sessionId}`);
  });

  test('3. Walk through every tab without crashing', async ({ page }) => {
    const errors = await errorsOf(page);
    await page.goto('/');
    await page.waitForSelector('.workspace-tabs button.is-active', { timeout: 10_000 });

    const tabs = ['对话', '检索', '综合综述', '方法对比', 'BibTeX', '相似论文'];
    const seen: string[] = [];
    for (const label of tabs) {
      await page.locator(`.workspace-tabs button:has-text("${label}")`).click();
      await page.waitForFunction(
        (l) => {
          const btn = [...document.querySelectorAll('.workspace-tabs button')].find((b) => (b.textContent || '').includes(l));
          return btn?.classList.contains('is-active');
        }, label, { timeout: 5_000 }
      );
      await page.waitForTimeout(180);
      const body = await page.locator('body').textContent();
      seen.push(`${label}=${(body || '').slice(0, 100).replace(/\s+/g, ' ')}`);
    }
    console.log('panels:\n  ' + seen.join('\n  '));

    await page.screenshot({ path: `${SHOT_DIR}/03_tabs_walkthrough.png`, fullPage: true });
    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e) => e.text()).join('\n')).toHaveLength(0);
  });

  test('4. POST/GET smoke against the backend (no chat-level flows)', async ({ request }) => {
    const health = await request.get(`${BACKEND}/api/health`);
    expect(health.ok()).toBe(true);
    expect(await health.json()).toMatchObject({ status: 'ok', version: '1.3.0' });

    const list = await request.get(`${BACKEND}/api/sessions`);
    expect(list.ok()).toBe(true);

    const sig = `e2e-smoke-${Date.now()}`;
    const created = await request.post(`${BACKEND}/api/sessions`, { data: { name: sig } });
    expect(created.status()).toBe(201);
    const sessionId = (await created.json()).id;

    // list papers on a freshly created session should be 200 with []
    const papers = await request.get(`${BACKEND}/api/sessions/${sessionId}/papers`);
    expect(papers.ok()).toBe(true);

    // conversation CRUD
    const c = await request.post(`${BACKEND}/api/sessions/${sessionId}/conversations`, { data: { title: 'smoke conv' } });
    expect(c.status()).toBe(201);
    const cid = (await c.json()).id;

    // share creation rejects extra fields (we tested this in pytest, double-check here)
    const bad = await request.post(
      `${BACKEND}/api/sessions/${sessionId}/conversations/${cid}/shares`,
      { data: { expires_in_days: 7, raw_pdf: true } },
    );
    expect(bad.status()).toBe(422);

    // public share endpoint with unknown token must 404 with our error envelope
    const notFound = await request.get(`${BACKEND}/api/public/shares/unknown-token-xyz`);
    expect(notFound.status()).toBe(404);
    const body = await notFound.json();
    expect(body).toEqual({ error: { code: 'share_not_found', message: 'Share not found' } });

    // cleanup
    await request.delete(`${BACKEND}/api/sessions/${sessionId}`);
  });
});

test.describe('DeepRead Workspace', () => {
  test('5. Upload + index a real PDF + verify workspace widens', async ({ page, request }) => {
    const errors = await errorsOf(page);
    const BACKEND = 'http://127.0.0.1:8000';
    // 1. create a session
    const sig = `e2e-upload-${Date.now()}`;
    const created = await request.post(`${BACKEND}/api/sessions`, { data: { name: sig } });
    expect(created.status()).toBe(201);
    const sessionId = (await created.json()).id;

    // 2. upload PDF (multipart). The PDF must live on local FS for backend to copy.
    const pdfPath = '/Users/lulu/Documents/Codex/2026-08-16/https-github-com-lulu926-star-deepread/work/deepread-agent/bench/papers/arxiv_2401_cs_attention.pdf';
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(pdfPath);
    const up = await request.post(`${BACKEND}/api/sessions/${sessionId}/papers?filename=attention.pdf`, {
      headers: { 'Content-Type': 'application/pdf' },
      data: buf,
    });
    expect(up.status()).toBeGreaterThanOrEqual(200);
    const upBody = await up.json();
    expect(upBody.paper_id).toBeTruthy();
    const paperId = upBody.paper_id;
    const jobId = upBody.job_id;
    console.log(`[upload] paper_id=${paperId} job_id=${jobId}`);

    // 3. poll get_progress for completion
    const start = Date.now();
    let lastProgress = 0;
    while (Date.now() - start < 60_000) {
      const prog = await request.get(`${BACKEND}/api/jobs/${jobId}`);
      expect(prog.ok()).toBe(true);
      const pj = await prog.json();
      lastProgress = pj.progress || 0;
      if (pj.status === 'completed' || pj.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 600));
    }
    console.log(`[upload] final progress=${lastProgress}`);

    // 4. trigger index
    const idx = await request.post(`${BACKEND}/api/sessions/${sessionId}/papers/${paperId}/index`);
    expect(idx.status()).toBeGreaterThanOrEqual(200);
    const idxBody = await idx.json();
    console.log(`[index] status=${idxBody.status}`);

    // 5. poll job until index done
    let idxJobId = idxBody.job_id;
    if (!idxJobId) {
      // the v1.2 endpoint may return index_status directly; poll papers
      const ps = await request.get(`${BACKEND}/api/sessions/${sessionId}/papers`);
      const papers = await ps.json();
      const paper = papers.find((p: any) => p.paper_id === paperId);
      expect(paper?.index_status).toBe('ready');
    } else {
      const idxStart = Date.now();
      while (Date.now() - idxStart < 90_000) {
        const p = await request.get(`${BACKEND}/api/jobs/${idxJobId}`);
        const pj = await p.json();
        if (pj.status === 'completed') break;
        if (pj.status === 'failed') throw new Error('index failed');
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // 6. open the workspace in the browser and verify the paper shows up
    await page.goto('/');
    await page.waitForSelector('.workspace-header', { timeout: 10_000 });
    // Session should be visible in sidebar
    await expect(page.locator('.session-sidebar').getByText(sig, { exact: false })).toBeVisible({ timeout: 8000 });
    await page.locator('.session-sidebar').getByText(sig, { exact: false }).first().click();
    await page.waitForTimeout(500);

    // After activation the header should show "1 篇可检索"
    await expect(page.locator('.workspace-meta')).toContainText(/1 篇可检索/, { timeout: 10_000 });

    // The chat composer should be enabled (not disabled) since now ready paper exists
    const sendBtn = page.locator('button:has-text("发送")');
    await expect(sendBtn).toBeVisible();

    await page.screenshot({ path: `${SHOT_DIR}/05_after_upload.png`, fullPage: true });
    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e) => e.text()).join('\n')).toHaveLength(0);

    // Cleanup
    await request.delete(`${BACKEND}/api/sessions/${sessionId}`);
  });
});

test.describe('DeepRead Workspace — real chat', () => {
  test('6. End-to-end chat: upload paper → ask real question → see answer + citations', async ({ request }) => {
    test.setTimeout(180_000);
    const BACKEND = 'http://127.0.0.1:8000';
    const fs = await import('node:fs/promises');

    // Create session
    const sig = `e2e-chat-${Date.now()}`;
    const created = await request.post(`${BACKEND}/api/sessions`, { data: { name: sig } });
    expect(created.status()).toBe(201);
    const sessionId = (await created.json()).id;

    // Upload + index the (real) Quantum Supremacy supplementary
    const pdfPath = '/Users/lulu/Documents/Codex/2026-08-16/https-github-com-lulu926-star-deepread/work/deepread-agent/bench/papers/arxiv_2402_quantum.pdf';
    const buf = await fs.readFile(pdfPath);
    const up = await request.post(`${BACKEND}/api/sessions/${sessionId}/papers?filename=sycamore.pdf`, {
      headers: { 'Content-Type': 'application/pdf' }, data: buf,
    });
    expect(up.ok()).toBe(true);
    const { paper_id: paperId, job_id: uploadJobId } = await up.json();

    // Poll upload parse
    const start = Date.now();
    while (Date.now() - start < 90_000) {
      const p = await request.get(`${BACKEND}/api/jobs/${uploadJobId}`);
      const pj = await p.json();
      if (pj.status === 'completed' || pj.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 600));
    }

    // Trigger + wait for index
    const idx = await request.post(`${BACKEND}/api/sessions/${sessionId}/papers/${paperId}/index`);
    const idxBody = await idx.json();
    let idxJobId = idxBody.job_id;
    let papers: any[] = (await (await request.get(`${BACKEND}/api/sessions/${sessionId}/papers`)).json()) as any[];
    if (!idxJobId) {
      // poll papers list for index_status=ready
      const t0 = Date.now();
      while (Date.now() - t0 < 180_000) {
        const ps = await (await request.get(`${BACKEND}/api/sessions/${sessionId}/papers`)).json();
        if ((ps as any[]).some((p: any) => p.index_status === 'ready')) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } else {
      const t0 = Date.now();
      while (Date.now() - t0 < 180_000) {
        const p = await (await request.get(`${BACKEND}/api/jobs/${idxJobId}`)).json();
        if (p.status === 'completed' || p.status === 'failed') break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    papers = await (await request.get(`${BACKEND}/api/sessions/${sessionId}/papers`)).json() as any[];
    expect(papers.some((p: any) => p.index_status === 'ready')).toBe(true);

    // Create conversation
    const cv = await request.post(`${BACKEND}/api/sessions/${sessionId}/conversations`, { data: { title: 'real e2e chat' } });
    expect(cv.status()).toBe(201);
    const convId = (await cv.json()).id;

    // Ask a question about the Sycamore paper
    const question = 'How many qubits does Sycamore use and what sampling task demonstrates quantum supremacy?';
    const turnP = await request.post(`${BACKEND}/api/sessions/${sessionId}/conversations/${convId}/turns`, {
      data: { query: question, client_request_id: `e2e-turn-${Date.now()}` },
    });
    expect(turnP.status()).toBe(202);
    const turnBody = await turnP.json();
    const { turn_id: turnId, job_id: jobId } = turnBody;

    // Poll the job
    let jobStatus: string = 'pending';
    const t0 = Date.now();
    while (Date.now() - t0 < 120_000) {
      const j = await request.get(`${BACKEND}/api/jobs/${jobId}`);
      const jj = await j.json();
      jobStatus = jj.status;
      console.log(`[chat] job ${jobId} stage=${jj.stage ?? '?'} status=${jobStatus} progress=${jj.progress}`);
      if (jobStatus === 'completed' || jobStatus === 'failed' || jobStatus === 'cancelled') break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(jobStatus).toBe('completed');

    // Fetch the turn
    const tr = await request.get(`${BACKEND}/api/sessions/${sessionId}/conversations/${convId}/turns/${turnId}`);
    expect(tr.ok()).toBe(true);
    const turn = await tr.json();

    console.log(`[chat] turn status=${turn.status} answer_len=${(turn.answer_markdown || '').length} citations=${(turn.citations || []).length}`);

    // Assertions: answer exists, mentions key concepts, has citations, with grounded page_index
    expect(turn.status).toBe('completed');
    expect(turn.answer_markdown).toBeTruthy();
    expect(turn.answer_markdown.length).toBeGreaterThan(50);
    const lower = turn.answer_markdown.toLowerCase();
    expect(lower).toMatch(/sycamore/);
    expect(lower).toMatch(/qubit/);
    expect(lower).toMatch(/supremacy|sampl/);
    expect(Array.isArray(turn.citations)).toBe(true);
    expect(turn.citations.length).toBeGreaterThanOrEqual(1);
    for (const c of turn.citations) {
      expect(typeof c.page_index === 'number' || c.page_index === null).toBe(true);
      expect(typeof c.snippet).toBe('string');
    }

    // Cleanup
    await request.delete(`${BACKEND}/api/sessions/${sessionId}`);
    console.log(`[chat] all assertions passed`);
  });
});

test.describe('Auto-open PDF viewer after upload (T4)', () => {
  test('7. After in-app PDF upload, pdf-shell auto-opens to .is-open', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await errorsOf(page);

    const BACKEND = 'http://127.0.0.1:8000';
    const sig = `e2e-autoopen-${Date.now()}`;
    const created = await page.request.post(`${BACKEND}/api/sessions`, { data: { name: sig } });
    expect(created.status()).toBe(201);
    const sessionId = (await created.json()).id;

    await page.goto('/');
    await page.waitForSelector('.workspace-header');
    await page.locator('.session-sidebar').getByText(sig, { exact: false }).first().click();
    await page.waitForTimeout(700);

    await expect(page.locator('.pdf-shell.is-open')).toHaveCount(0);

    // Switch to Search tab so PaperPane renders directly (chat view wraps it in context pane)
    await page.locator('.workspace-tabs button:has-text("检索")').click();
    await page.waitForTimeout(400);

    const addBtn = page.locator('button[aria-label="添加 PDF"]').first();
    await expect(addBtn).toBeVisible({ timeout: 5_000 });

    const pdfPath = '/Users/lulu/Documents/Codex/2026-08-16/https-github-com-lulu926-star-deepread/work/deepread-agent/bench/papers/arxiv_2401_cs_attention.pdf';
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5_000 }),
      addBtn.click(),
    ]);
    await chooser.setFiles(pdfPath);

    await expect(page.locator('.workspace-meta')).toContainText(/1 篇可检索/, { timeout: 30_000 });

    // Critical assertion: after upload completes the PDF viewer must auto-open
    await expect(page.locator('.pdf-shell.is-open')).toHaveCount(1, { timeout: 5_000 });

    await page.screenshot({ path: `${SHOT_DIR}/07_auto_pdf_open.png`, fullPage: true });

    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e: any) => e.text()).join('\n')).toHaveLength(0);

    await page.request.delete(`${BACKEND}/api/sessions/${sessionId}`);
  });
});

test.describe('PDF / Markdown export end-to-end (T10)', () => {
  test('8. Export Markdown and PDF via REST; verify download bytes', async ({ page, request }) => {
    test.setTimeout(180_000);
    const errors = await errorsOf(page);
    const BACKEND = 'http://127.0.0.1:8000';
    const fs = await import('node:fs/promises');

    // Create session
    const sig = `e2e-export-${Date.now()}`;
    const created = await request.post(`${BACKEND}/api/sessions`, { data: { name: sig } });
    expect(created.status()).toBe(201);
    const sessionId = (await created.json()).id;

    // Upload + index a real PDF
    const pdfPath = '/Users/lulu/Documents/Codex/2026-08-16/https-github-com-lulu926-star-deepread/work/deepread-agent/bench/papers/arxiv_2401_cs_attention.pdf';
    const buf = await fs.readFile(pdfPath);
    const up = await request.post(`${BACKEND}/api/sessions/${sessionId}/papers?filename=attention.pdf`, {
      headers: { 'Content-Type': 'application/pdf' }, data: buf,
    });
    expect(up.ok()).toBe(true);
    const { paper_id: paperId, job_id: uploadJobId } = await up.json();

    // Poll parse
    const t1 = Date.now();
    while (Date.now() - t1 < 90_000) {
      const p = await request.get(`${BACKEND}/api/jobs/${uploadJobId}`);
      const pj = await p.json();
      if (pj.status === 'completed' || pj.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 600));
    }

    // Trigger + wait for index
    const idx = await request.post(`${BACKEND}/api/sessions/${sessionId}/papers/${paperId}/index`);
    const t2 = Date.now();
    while (Date.now() - t2 < 90_000) {
      const ps = await request.get(`${BACKEND}/api/sessions/${sessionId}/papers`);
      const papers = await ps.json() as any[];
      if (papers.some((p: any) => p.index_status === 'ready')) break;
      await new Promise((r) => setTimeout(r, 800));
    }

    // Create a conversation
    const cv = await request.post(`${BACKEND}/api/sessions/${sessionId}/conversations`,
      { data: { title: 'e2e export demo' } });
    expect(cv.status()).toBe(201);
    const convId = (await cv.json()).id;

    // Request Markdown export
    const mdExport = await request.post(`${BACKEND}/api/sessions/${sessionId}/exports`, {
      data: {
        source_type: 'conversation',
        source_id: convId,
        format: 'markdown',
        expires_in_hours: 1,
      },
    });
    expect(mdExport.status()).toBe(201);
    const mdBody = await mdExport.json();
    expect(mdBody.status).toBe('completed');
    expect(mdBody.format).toBe('markdown');
    expect(mdBody.size_bytes).toBeGreaterThan(0);
    expect(mdBody.sha256).toMatch(/^[0-9a-f]{64}$/);

    // Request PDF export
    const pdfExport = await request.post(`${BACKEND}/api/sessions/${sessionId}/exports`, {
      data: {
        source_type: 'conversation',
        source_id: convId,
        format: 'pdf',
        expires_in_hours: 1,
      },
    });
    expect(pdfExport.status()).toBe(201);
    const pdfBody = await pdfExport.json();
    expect(pdfBody.status).toBe('completed');
    expect(pdfBody.format).toBe('pdf');
    expect(pdfBody.size_bytes).toBeGreaterThan(1000);

    // List
    const listing = await request.get(`${BACKEND}/api/sessions/${sessionId}/exports`);
    expect(listing.status()).toBe(200);
    const listed = await listing.json();
    expect(listed.length).toBeGreaterThanOrEqual(2);
    const listedIds = listed.map((a: any) => a.id);
    expect(listedIds).toContain(mdBody.id);
    expect(listedIds).toContain(pdfBody.id);

    // Download Markdown
    const mdDl = await request.get(`${BACKEND}/api/sessions/${sessionId}/exports/${mdBody.id}/download`);
    expect(mdDl.status()).toBe(200);
    expect(mdDl.headers()['content-type']).toMatch(/text\/markdown/);
    const mdText = await mdDl.text();
    expect(mdText.startsWith('---')).toBe(true);
    expect(mdText).toContain('e2e export demo');
    expect(mdText).not.toMatch(/\/Users\//);

    // Download PDF
    const pdfDl = await request.get(`${BACKEND}/api/sessions/${sessionId}/exports/${pdfBody.id}/download`);
    expect(pdfDl.status()).toBe(200);
    expect(pdfDl.headers()['content-type']).toMatch(/application\/pdf/);
    const pdfBytes = await pdfDl.body();
    expect(pdfBytes.slice(0, 5).toString()).toBe('%PDF-');
    expect(pdfBytes.length).toBeGreaterThan(500);

    // Delete Markdown (PDF stays)
    const del = await request.delete(`${BACKEND}/api/sessions/${sessionId}/exports/${mdBody.id}`);
    expect([204, 404]).toContain(del.status());

    // Re-list and confirm MD is gone, PDF remains
    const listing2 = await request.get(`${BACKEND}/api/sessions/${sessionId}/exports`);
    const remaining = await listing2.json();
    expect(remaining.some((a: any) => a.id === pdfBody.id)).toBe(true);
    expect(remaining.some((a: any) => a.id === mdBody.id)).toBe(false);

    // Cleanup conversation session
    await request.delete(`${BACKEND}/api/sessions/${sessionId}`);

    await page.screenshot({ path: `${SHOT_DIR}/08_export.png`, fullPage: false });
    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e: any) => e.text()).join('\\n')).toHaveLength(0);
  });
});
