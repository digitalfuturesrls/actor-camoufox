/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

// For more information, see https://crawlee.dev
import { PlaywrightCrawler } from '@crawlee/playwright';
// For more information, see https://docs.apify.com/sdk/js
import { Actor, log } from 'apify';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';
import { firefox } from 'playwright';

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
import { router } from './routes.js';

// Common desktop viewport sizes for fingerprint randomization
const COMMON_VIEWPORTS: [number, number][] = [
    [1920, 1080],
    [1366, 768],
    [1440, 900],
    [1536, 864],
    [1280, 720],
];

function getRandomViewport(): [number, number] {
    return COMMON_VIEWPORTS[Math.floor(Math.random() * COMMON_VIEWPORTS.length)];
}

// Tracker and analytics domains to block
const BLOCKED_PATTERNS = [
    /doubleclick\.net/,
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /facebook\.net/,
    /amazon-adsystem\.com/,
    /scorecardresearch\.com/,
    /hotjar\.com/,
    /mouseflow\.com/,
    /newrelic\.com/,
];


interface Input {
    startUrls: Array<{ url: string; tag?: string }>;
    maxRequestsPerCrawl: number;
}

// Initialize the Apify SDK
await Actor.init();

// Structure of input is defined in input_schema.json
const { startUrls = [{ url: 'https://apify.com' }], maxRequestsPerCrawl = 100 } =
    (await Actor.getInput<Input>()) ?? ({} as Input);

// `checkAccess` flag ensures the proxy credentials are valid, but the check can take a few hundred milliseconds.
// Disable it for short runs if you are sure your proxy configuration is correct
const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: 'IT',
    checkAccess: true
});

// Randomize viewport and use virtual headless mode for enhanced stealth
const viewport = getRandomViewport();
const useVirtualDisplay = process.env.HEADLESS_VIRTUAL !== 'false';
console.log(`Using viewport ${viewport[0]}×${viewport[1]} and headless mode: ${useVirtualDisplay ? 'virtual' : 'standard'}`);

const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl,
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 5 },
    maxConcurrency: 1,
    maxRequestRetries: 3,
    requestHandler: router,
    preNavigationHooks: [
        // Human-like behavior: random delay before navigation
        async ({ page }, _context) => {
            try {
                // Random delay 1-4 seconds to simulate human hesitation
                await page.waitForTimeout(1000 + Math.random() * 3000);
            } catch (err) {
                log.warning('Pre-navigation delay interrupted', { error: String(err) });
            }

            // Simulate cookie consent acceptance
            try {
                await page.evaluate(() => {
                    document.cookie = 'cookie_consent=true; path=/; max-age=3600';
                });
            } catch (err) {
                log.warning('Cookie consent simulation failed', { error: String(err) });
            }
        },
        // Block trackers and analytics domains
        async ({ page }) => {
            await page.route('**/*', async (route) => {
                const url = route.request().url();
                const shouldBlock = BLOCKED_PATTERNS.some((pattern) => pattern.test(url));
                if (shouldBlock) {
                    await route.abort('blockedbyclient');
                } else {
                    await route.continue();
                }
            });
        },
    ],
    postNavigationHooks: [
        // Human-like behavior: simulate reading after page load
        async ({ page }) => {
            try {
                // Progressive scroll: 10 steps with 300ms intervals
                await page.evaluate(async () => {
                    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
                    const totalHeight = document.body.scrollHeight;
                    const step = totalHeight / 10;
                    for (let i = 1; i <= 10; i++) {
                        window.scrollTo(0, i * step);
                        await delay(300);
                    }
                });

                // Mouse emulation: move mouse to random positions
                const viewport = page.viewportSize() || { width: 1280, height: 720 };
                for (let i = 0; i < 3; i++) {
                    await page.mouse.move(
                        Math.random() * viewport.width,
                        Math.random() * viewport.height
                    );
                    await page.waitForTimeout(500);
                }

                // Reading wait: simulate reading time (2-5 seconds)
                await page.waitForTimeout(2000 + Math.random() * 3000);
            } catch (err) {
                log.warning('Post-navigation hooks interrupted', { error: String(err) });
            }
        },
    ],
    proxyConfiguration,
    launchContext: {
        launcher: firefox,
        launchOptions: await camoufoxLaunchOptions({
            headless: true,
            //window: viewport,
            proxy: await proxyConfiguration?.newUrl(),
            geoip: true,
            locale: "it-IT",
            env: { TZ: 'Europe/Rome' },
            humanize: true, // enable realistic mouse movement to reduce bot detection
            // fonts: ['Times New Roman'] // <- custom Camoufox options
        }),
    },
});

// Map input to requests with labels from tags
log.info('Mapping input to requests with labels...', { count: startUrls.length });

const requests = startUrls.map((item, index, arr) => {
    const label = item.tag && item.tag.trim() ? item.tag.trim() : undefined;

    if (!item.url) {
        log.warning('Missing url in startUrl entry', { item });
    }

    // Se ci sono almeno 2 URL e questo e il primo, passa il secondo URL nel userData
    // cosi il handler puo fare goto alla pagina target dopo il warmup
    const userData: Record<string, unknown> = {};
    if (index === 0 && arr.length >= 2) {
        userData.targetUrl = arr[1].url;
    }

    return {
        url: item.url,
        label,
        userData,
    };
}).filter((_req, index) => {
    // Se ci sono 2 URL, skippa il secondo perche ci navighiamo via goto dal primo
    return !(startUrls.length >= 2 && index === 1);
});

log.info('Starting crawl with requests...', { requests });

await crawler.run(requests);

// Exit successfully
await Actor.exit();
