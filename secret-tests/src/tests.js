import path from 'path';
import {
  mkfile,
  mkdir,
} from '@hexlet/immutable-fs-trees';
import {
  checkStructure,
  checkW3C,
  checkCSS,
  checkOrderStylesheetLinks,
  checkAlternativeFonts,
  checkBodyElements,
  checkLang,
  checkTitleEmmet,
  checkElementsBySelectors,
  checkPropertiesByElement,
  checkVideoAttributes,
  checkPseudoElements,
  checkLayout,
} from './lib.js';
import initPuppeteer from './puppeteer.js';

const runTests = async (projectPath, lang) => {
  const tree = mkdir('project', [
    mkfile('index.html'),
    mkdir('styles', [
      mkfile('style.css'),
    ]),
    mkdir('fonts', [
      mkfile('font.css'),
    ]),
    mkdir('video'),
    mkdir('images'),
  ]);

  const structureErrors = checkStructure(projectPath, tree);

  if (structureErrors.length) {
    return structureErrors;
  }

  const { browser, page } = await initPuppeteer(path.join(projectPath, 'index.html'));

  const metaTags = [
    {
      name: 'description',
      selector: 'meta[name="description"][content]:not([content=""])',
    },
    {
      name: 'og:url',
      selector: 'meta[property="og:url"][content]:not([content=""])',
    },
    {
      name: 'og:title',
      selector: 'meta[property="og:title"][content]:not([content=""])',
    },
    {
      name: 'og:description',
      selector: 'meta[property="og:description"][content]:not([content=""])',
    },
    {
      name: 'og:image',
      selector: 'meta[property="og:image"][content]:not([content=""])',
    },
    {
      name: 'twitter:card',
      selector: 'meta[property="twitter:card"][content]:not([content=""])',
    },
  ];

  const favicons = [
    {
      name: 'ico',
      selector: 'link[rel="icon"][href$=".ico"]',
    },
    {
      name: 'svg',
      selector: 'link[rel="icon"][href$=".svg"]',
    },
  ];

  const mobileFavicons = [
    { name: 'apple-touch-icon', selector: 'link[rel="apple-touch-icon"]' },
  ];

  const errors = (await Promise.all([
    checkW3C(path.join(projectPath, 'index.html')),
    checkCSS(projectPath),
    checkOrderStylesheetLinks(page, ['font.css', 'style.css']),
    checkAlternativeFonts(path.join(projectPath, 'styles', 'style.css'), ['Mulish']),
    checkBodyElements(page, ['video', 'h1']),
    checkLang(page, lang),
    checkTitleEmmet(page),
    checkElementsBySelectors(page, metaTags, 'metaTagsMissing'),
    checkElementsBySelectors(page, favicons, 'faviconsMissing'),
    checkElementsBySelectors(page, mobileFavicons, 'mobileFaviconMissing'),
    checkPropertiesByElement(page, 'body', { margin: '0px', width: '800px' }),
    checkVideoAttributes(page, ['muted', 'autoplay', 'poster', 'loop'], ['controls']),
    checkPseudoElements(path.join(projectPath, 'styles', 'style.css')),
    checkLayout(page),
  ])).flat();

  await browser.close();

  return errors;
};

export default runTests;
