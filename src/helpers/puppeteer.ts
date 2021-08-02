import puppeteer from 'puppeteer';

const options = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36',
  ],
  headless: true,
  ignoreHTTPSErrors: true,
  userDataDir: './tmp',
};

export default async function (): Promise<puppeteer.Browser> {
  const puppeteerWSEndpoint = process.env.PUPPETEER_WS_ENDPOINT;

  let browser: puppeteer.Browser;
  if (puppeteerWSEndpoint) {
    browser = await puppeteer.connect({
      browserWSEndpoint: puppeteerWSEndpoint,
    });
  } else {
    browser = await puppeteer.launch(options);
  }
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    await browser.close();
  }, 30000);

  return browser;
}
