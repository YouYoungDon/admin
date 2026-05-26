import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const files = ['index.html', 'styles.css'];

await mkdir('dist', { recursive: true });

for (const file of files) {
  const target = join('dist', file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join('src', file), target);
}
