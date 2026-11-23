// Oyunun web dosyalarını www/ klasörüne kopyalar (Android paketi bu klasörden yapılır).
// Kaynak görseller (img/kaynak) ve geliştirme dosyaları pakete girmez.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
for (const p of ['index.html', 'css', 'js', 'img/binalar', 'img/ui']) {
  cpSync(p, `www/${p}`, { recursive: true, filter: src => !src.endsWith('.md') });
}
console.log('www/ hazır');
