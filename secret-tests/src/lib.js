import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { request } from 'undici';
import stylelint from 'stylelint';
import dirTree from 'directory-tree';
import {
  isDirectory,
} from '@hexlet/immutable-fs-trees';
import * as csstree from 'css-tree';
import compareImages from 'resemblejs/compareImages.js';
import { getFileData } from './utils.js';
import {
  hasElementBySelectors,
  getStyles,
} from './puppeteer.js';
import stylelintConfig from './config/stylelint.config.js';

const checkStructure = (projectPath, expectedTree) => {
  const projectTree = dirTree(projectPath, { attributes: ['type'] });

  const search = (canonicalTree, actualTree) => {
    const errors = canonicalTree.reduce((acc, item) => {
      const found = actualTree.find(({ name, type }) => item.name === name && item.type === type);
      if (!found) {
        return [...acc, {
          id: `structure.${item.type}`,
          values: {
            name: item.name,
          },
        }];
      }

      if (isDirectory(item) && found) {
        return [...acc, ...search(item.children, found.children)];
      }

      return acc;
    }, []);

    return errors;
  };

  return search(expectedTree.children, projectTree.children);
};

const checkW3C = async (htmlPath) => {
  const html = getFileData(htmlPath);
  const fileName = path.basename(htmlPath);
  const { body } = await request('https://validator.w3.org/nu/?out=json', {
    body: html,
    method: 'POST',
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'user-agent': 'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion',
    },
  });
  const response = await body.json();
  const errors = response.messages.filter((item) => item.type === 'error').map((item) => ({
    id: 'w3c',
    values: {
      fileName,
      line: item.lastLine,
      message: item.message,
    },
  }));

  return errors;
};

const checkCSS = async (cssPath) => {
  const response = await stylelint.lint({
    config: stylelintConfig,
    files: `${cssPath.split(path.sep).join(path.posix.sep)}**/*.css`, // заменить на `${cssPath}**/*.css`
  });

  const errors = response.results.reduce((errorsAcc, result) => {
    const fileName = path.basename(result.source);
    const errorsInFile = result.warnings.map((warning) => ({
      id: `stylelint.${warning.rule}`,
      values: {
        fileName,
        line: warning.line,
        column: warning.column,
        text: warning.text,
      },
    }));

    return errorsAcc.concat(errorsInFile);
  }, []);

  return errors;
};

const checkOrderStylesheetLinks = async (page, files) => {
  const selectors = files.map((file) => `link[href*="${file}"]`).join(' ~ ');
  const isCorrect = await hasElementBySelectors(page, selectors);

  if (!isCorrect) {
    return [{
      id: 'orderStylesheetLinks',
    }];
  }

  return [];
};

const checkAlternativeFonts = (cssPath, fonts) => {
  const errors = [];
  const cssCode = getFileData(cssPath);
  const ast = csstree.parse(cssCode);

  const fontsDeclarations = csstree.findAll(ast, (node) => node.type === 'Declaration' && node.property === 'font-family');
  const fontsProperties = fontsDeclarations.map((decl) => csstree.generate(decl));
  const alternativeFonts = fontsProperties.filter((property) => (
    !fonts.some((font) => property.includes(font))
  ));

  if (alternativeFonts.length) {
    errors.push({
      id: 'alternativeFonts',
      values: {
        fonts: fonts.join(', '),
      },
    });
  }

  return errors;
};

const checkBodyElements = async (page, tags) => {
  const errors = [];
  const found = await page.evaluate(() => (
    Array.from(window.document.body.childNodes)
      .filter((node) => node.nodeName !== '#text')
      .map(({ tagName }) => tagName.toLowerCase())
  ));
  const missingTagNames = tags.filter((tagName) => !found.includes(tagName));
  const extraTagNames = found.filter((tagName) => !tags.includes(tagName));

  if (missingTagNames.length) {
    errors.push({
      id: 'bodyTagsMissing',
      values: {
        names: missingTagNames.join(', '),
      },
    });
  }

  if (extraTagNames.length) {
    errors.push({
      id: 'bodyTagsExtra',
      values: {
        names: extraTagNames.join(', '),
      },
    });
  }

  return errors;
};

const checkLang = async (page, lang) => {
  const isFound = await hasElementBySelectors(page, `html[lang*=${lang}]`);

  if (!isFound) {
    return [{
      id: 'langAttrMissing',
      values: {
        lang,
      },
    }];
  }

  return [];
};

const checkTitleEmmet = async (page) => {
  const text = 'Document';
  const title = await page.evaluate(() => document.title);

  if (title === text) {
    return [{
      id: 'titleEmmet',
    }];
  }

  return [];
};

const checkElementsBySelectors = async (page, search, errorId) => {
  const found = await Promise.all(search.map(async ({ name, selector }) => {
    const isFound = await hasElementBySelectors(page, selector);

    return {
      name,
      isMissing: !isFound,
    };
  }));
  const missing = found.filter(({ isMissing }) => isMissing);
  const missingNames = missing.map(({ name }) => name);

  if (missingNames.length) {
    return [{
      id: errorId,
      values: {
        names: missingNames.join(', '),
      },
    }];
  }

  return [];
};

const checkPropertiesByElement = async (page, selector, properties) => {
  // const styles = await getStyles(page, selector, Object.keys(properties));
  // const res = Object.entries(properties).filter(([name, value]) => (
  //   !styles.some((property) => property.name === name && property.value === value)
  // ));
  // console.log(res);

  const styles = await getStyles(page, selector, Object.keys(properties));
  const incorrectProperties = Object.entries(properties)
    .filter(([name, value]) => styles[name] !== value)
    .map(([name, value]) => `${name}: ${value}`);

  if (incorrectProperties) {
    return [{
      id: 'elementProperties',
      values: {
        name: selector,
        properties: incorrectProperties.join('; '),
      },
    }];
  }

  return [];
};

const checkVideoAttributes = async (page, requiredAttributes, excludeAttributes) => {
  const errors = [];
  const attributes = await page.evaluate(() => (
    Array.from(document.querySelector('video').attributes)
      .map(({ name }) => name)
  ));
  const missingAttributes = requiredAttributes.filter((name) => !attributes.includes(name));
  const extraAttributes = excludeAttributes.filter((name) => attributes.includes(name));

  if (missingAttributes.length) {
    errors.push({
      id: 'videoAttributesMissing',
      values: {
        names: missingAttributes.join(', '),
      },
    });
  }

  if (extraAttributes.length) {
    errors.push({
      id: 'videoAttributesExtra',
      values: {
        names: extraAttributes.join(', '),
      },
    });
  }

  return errors;
};

const checkPseudoElements = (cssPath) => {
  const cssCode = getFileData(cssPath);
  const ast = csstree.parse(cssCode);

  const found = csstree.findAll(ast, (node) => node.type === 'PseudoClassSelector' || node.type === 'PseudoElementSelector');

  if (found.length < 3) {
    return [{ id: 'countPseudoElements' }];
  }

  return [];
};

const checkLayout = async (page) => {
  await page.hover('h1');
  await page.screenshot({ path: 'layout.jpg', fullPage: true });

  const options = {
    output: {
      errorColor: {
        red: 255,
        green: 0,
        blue: 255,
      },
      errorType: 'movement',
      transparency: 0.3,
      largeImageThreshold: 0,
      useCrossOrigin: false,
      outputDiff: true,
    },
    scaleToSameSize: true,
    ignore: 'antialiasing',
  };

  const data = await compareImages(fs.readFileSync('./layout-canonical.jpg'), fs.readFileSync('./layout.jpg'), options);
  fs.writeFileSync('./output.jpg', data.getBuffer(true));

  if (data.misMatchPercentage > 10) {
    return [{
      id: 'layoutDifferent',
    }];
  }

  return [];
};

export {
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
};
