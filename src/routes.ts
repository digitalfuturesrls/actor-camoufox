import { createPlaywrightRouter } from '@crawlee/playwright';

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ request, page, log, pushData }) => {
    const warmupUrl = request.url;
    const targetUrl = request.userData?.targetUrl as string | undefined;

    log.info(`Warmup on first URL: ${warmupUrl}`);

    // Warmup: scroll naturale e comportamento umano sulla pagina corrente
    await page.evaluate(async () => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const totalHeight = document.body.scrollHeight;
        const step = totalHeight / 8;

        // Scendi lentamente
        for (let i = 1; i <= 8; i++) {
            window.scrollTo({ top: i * step, behavior: 'smooth' });
            await delay(400 + Math.random() * 600);
        }

        // Pausa di lettura
        await delay(1000 + Math.random() * 2000);

        // Risali
        for (let i = 7; i >= 0; i--) {
            window.scrollTo({ top: i * step, behavior: 'smooth' });
            await delay(300 + Math.random() * 400);
        }
    });

    log.info('Warmup completed');

    // Se non c'e una seconda URL, termina qui
    if (!targetUrl) {
        log.info('No targetUrl provided, warmup only');
        await pushData({
            sourceUrl: warmupUrl,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    // Naviga alla seconda pagina con goto
    log.info(`Navigating to target URL: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Attesa casuale per simulare lettura pagina
    await page.waitForTimeout(1500 + Math.random() * 2500);

    // Progressive multi-step scroll to trigger lazy-loaded content
    const scrollStep = 600;
    const maxScrolls = 20;
    let scrollCount = 0;
    let lastHeight = await page.evaluate(() => document.body.scrollHeight);
    let stalledCount = 0;
    let finalScrollY = 0;

    try {
        for (let i = 0; i < maxScrolls; i++) {
            await page.evaluate(
                (step) => window.scrollBy(0, step),
                scrollStep,
            );
            await page.waitForTimeout(500);

            const { scrollY, scrollHeight, innerHeight } = await page.evaluate(() => ({
                scrollY: window.scrollY,
                scrollHeight: document.body.scrollHeight,
                innerHeight: window.innerHeight,
            }));

            finalScrollY = scrollY;
            scrollCount++;

            // Break if bottom reached
            if (scrollY + innerHeight >= scrollHeight) {
                log.info(`Scroll ${scrollCount}: bottom reached at scrollY=${scrollY}`);
                break;
            }

            // Break if content height hasn't increased for 3 consecutive scrolls
            if (scrollHeight === lastHeight) {
                stalledCount++;
                if (stalledCount >= 3) {
                    log.info(`Scroll ${scrollCount}: content stalled, breaking`);
                    break;
                }
            } else {
                stalledCount = 0;
                lastHeight = scrollHeight;
            }
        }

        log.info(`Scroll complete: ${scrollCount} scrolls, final scrollY=${finalScrollY}`);
    } catch (err) {
        log.warning(`Progressive scroll failed, falling back to single scroll: ${err}`);
        try {
            const fallback = await page.evaluate(() => document.body.scrollHeight);
            const fallbackScroll = Math.min(fallback * 0.3, 800);
            await page.evaluate((y) => window.scrollTo(0, y), fallbackScroll);
            await page.waitForTimeout(1000);
        } catch {
            // ignore
        }
    }

    // ─── DEBUG: page state (for targetUrl) ─────────────────
    console.log('\u{1F50D} Page URL:', targetUrl);
    console.log('\u{1F4D0} Scroll position:', await page.evaluate(() => window.scrollY));
    console.log('\u{1F4CF} Page height:', await page.evaluate(() => document.body.scrollHeight));

    // ─── DEBUG: page body HTML (targetUrl) ───────────────
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('\u{1F4C4} Body HTML (full) for targetUrl:\n', bodyHTML);

    // Screenshot for visual inspection
    try {
        await page.screenshot({ path: 'screenshots/debug-fullpage.png', fullPage: true });
        console.log('\u{1F4F7} Screenshot saved: screenshots/debug-fullpage.png');
    } catch (err) {
        console.warn('\u{26A0} Screenshot failed:', err);
    }

    // ─── DEBUG: link extraction ──────────────────────────
    log.info('Extracting announcements with xpath...');
    const annunciLinks = await page.locator('xpath=//a[contains(@href, "annunci")]').evaluateAll(
        (els) =>
            els.map((el) => ({
                href: el.getAttribute('href') ?? '',
                text: el.textContent?.trim() ?? '',
            })),
    );

    const annunciCount = annunciLinks.length;
    console.log(`\u{1F50D} Annunci links found (href contains 'annunci'): ${annunciCount}`);
    if (annunciCount > 0) {
        console.log(`\u{1F4A1} First ${Math.min(10, annunciCount)} annunci links:`);
        annunciLinks.slice(0, 10).forEach((l, i) =>
            console.log(`  [${i + 1}] href=${l.href}  text=${l.text?.substring(0, 80).replace(/\s+/g, ' ')}`), // eslint-disable-line no-console
        );
    }

    // Use hrefs (correct extraction) for dataset push
    const hrefs = annunciLinks.map((l) => l.href);

    log.info(`Found ${hrefs.length} links with href containing "annunci"`);

    await pushData({
        warmupUrl,
        targetUrl,
        announcementLinks: hrefs,
        extractedAt: new Date().toISOString(),
    });
});
