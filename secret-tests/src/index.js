import i18next from 'i18next';
import fs from 'fs';
import ru from './locales/ru.js';
import runTests from './tests.js';

const [,, PROJECT_PATH, LANG = 'ru'] = process.argv;

const app = async (projectPath, lang) => {
  await i18next.init({
    lng: lang,
    resources: {
      ru,
    },
  });

  try {
    const errors = await runTests(projectPath, lang);

    if (errors.length) {
      const errorsText = errors.map((error, index) => `${index + 1}. ${i18next.t(error.id, error.values)}`).join('\r\n');
      fs.writeFileSync('./result.txt', errorsText);
    }
  } catch (error) {
    console.log(error);
  }
};

app(PROJECT_PATH, LANG);
