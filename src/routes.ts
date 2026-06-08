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
    log.info(`Extracting list items from ${request.loadedUrl}`);

    const items = await page.evaluate(() => {
        const listElements = document.querySelectorAll('li');
        return Array.from(listElements).map((li) => {
            const link = li.querySelector('a');
            return {
                text: li.textContent?.trim() || '',
                url: link ? link.href : undefined,
            };
        }).filter((item) => item.text.length > 0);
    });

    log.info(`Found ${items.length} list items`);

    await pushData({
        url: request.loadedUrl,
        listItems: items,
    });
});
