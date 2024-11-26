import { existsSync } from 'fs';
import { join } from 'path';

const requiredFiles = [
  'src/public/index.html',
  'src/public/styles.css',
  'src/public/app.js'
];

console.log('Проверка наличия файлов:');
requiredFiles.forEach(file => {
  const exists = existsSync(join(process.cwd(), file));
  console.log(`${file}: ${exists ? '✅' : '❌'}`);
}); 