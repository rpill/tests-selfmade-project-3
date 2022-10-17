import puppeteer from 'puppeteer';
import fileUrl from 'file-url';

export default async (htmlPath) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(fileUrl(htmlPath), { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000);

  return { browser, page };
};

const hasElementBySelectors = async (page, selectors) => {
  const result = await page.evaluate((slctrs) => (
    !!document.querySelector(slctrs)
  ), selectors);

  return result;
};

const getElement = async (page, selectors) => {
  const result = await page.evaluate((slctrs) => (
    document.querySelector(slctrs)
  ), selectors);

  return result;
};

const getStyles = async (page, selectors, properties) => {
  const result = await page.evaluate((slctrs, props) => {
    const element = document.querySelector(slctrs);

    return Object.fromEntries(props.map((property) => ([
      property,
      window.getComputedStyle(element).getPropertyValue(property),
    ])));
  }, selectors, properties);

  return result;
};

export {
  hasElementBySelectors,
  getElement,
  getStyles,
};
