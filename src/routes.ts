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

    // Scroll casuale sulla pagina target
    await page.evaluate(async () => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const totalHeight = document.body.scrollHeight;
        const scrollTo = Math.min(totalHeight * 0.3, 800);
        window.scrollTo({ top: scrollTo, behavior: 'smooth' });
        await delay(500 + Math.random() * 1000);
    });

    // Estrazione annunci con xpath
    log.info('Extracting announcements with xpath...');
    const hrefs = await page.locator('xpath=//a[@href]').evaluateAll(
        (els) => els.map((el) => (el as unknown as Attr).value),
    );

    log.info(`Found ${hrefs.length} links containing "annunci"`);

    await pushData({
        warmupUrl,
        targetUrl,
        announcementLinks: hrefs,
        extractedAt: new Date().toISOString(),
    });
});
