import { createPlaywrightRouter } from '@crawlee/playwright';

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ enqueueLinks, log }) => {
    log.info(`enqueueing new URLs`);
    await enqueueLinks({
        globs: ['https://apify.com/*'],
        label: 'detail',
    });
});

router.addHandler('detail', async ({ request, page, log, pushData }) => {
    const title = await page.title();
    log.info(`${title}`, { url: request.loadedUrl });

    await pushData({
        url: request.loadedUrl,
        title,
    });
});

router.addHandler('list', async ({ request, page, log, pushData }) => {
    log.info(`Extracting announcement links from ${request.loadedUrl}`);

    const hrefs = await page.locator('xpath=//a[contains(@href, "annunci")]/@href').evaluateAll(
        (els) => els.map((el) => (el as unknown as Attr).value)
    );

    log.info(`Found ${hrefs.length} links containing "annunci"`);

    await pushData({
        url: request.loadedUrl,
        announcementLinks: hrefs,
    });
});
