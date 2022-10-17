import fs from 'fs';

const getFileData = (filePath) => fs.readFileSync(filePath, 'utf8');

export {
  getFileData,
};
