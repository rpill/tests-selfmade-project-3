import i18next from 'i18next';

const render = (errors) => {
  console.log('\x1b[1;31m%s\x1b[0m', 'Исправьте ошибки:');
  errors.forEach((error, index) => console.log(`${index + 1}. ${i18next.t(error.id, error.values)}`));
};

export default render;
