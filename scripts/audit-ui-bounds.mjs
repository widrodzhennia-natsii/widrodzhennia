import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const errors = [];

// 1. Check Global CSS containment invariants
const componentsCss = fs.readFileSync(path.join(SRC_DIR, 'styles/components.css'), 'utf8');
const resetCss = fs.readFileSync(path.join(SRC_DIR, 'styles/reset.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(SRC_DIR, 'styles/layout.css'), 'utf8');

if (!/\.btn\s*\{[\s\S]*?white-space:\s*normal;[\s\S]*?max-width:\s*100%;/.test(componentsCss)) {
  errors.push('src/styles/components.css: `.btn` must declare `white-space: normal` and `max-width: 100%` so buttons wrap inside narrow frames.');
}
if (!/\.card\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/.test(componentsCss)) {
  errors.push('src/styles/components.css: `.card` must declare `min-width: 0` and `max-width: 100%`.');
}
if (!/overflow-x:\s*clip/.test(resetCss)) {
  errors.push('src/styles/reset.css: root containers must declare `overflow-x: clip`.');
}
if (!/\.main-container\s*\{[\s\S]*?min-width:\s*0;/.test(layoutCss)) {
  errors.push('src/styles/layout.css: `.main-container` must declare `min-width: 0`.');
}

// 2. Scan JSX/TSX for multi-button flex containers with shrink-0 or unwrappable inline-flex
for (const file of walk(SRC_DIR)) {
  if (!file.endsWith('.tsx')) continue;
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, idx) => {
    const t = line.trim();
    const ln = idx + 1;

    // Contradictory flex-wrap + shrink-0 on button/control wrapper
    if (/flex-wrap/.test(t) && /\bshrink-0\b/.test(t)) {
      errors.push(`${rel}:${ln}: Avoid combining \`flex-wrap\` with \`shrink-0\` (blocks wrapping inside narrower parent frames).`);
    }

    // Hero/multi-button row with shrink-0 holding >2 buttons
    if (/<div[^>]*\bshrink-0\b/.test(t) && !/avatar|icon|dialogue-avatar|emote|w-\d+/.test(t)) {
      const lookahead = lines.slice(idx, idx + 20).join('\n');
      const btnMatches = lookahead.match(/<Button|<button/g) || [];
      if (btnMatches.length >= 3) {
        errors.push(`${rel}:${ln}: Multi-button container (${btnMatches.length} buttons) should not use \`shrink-0\`; use \`flex-wrap min-w-0 max-w-full\`.`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error('UI bounds audit failed:\n' + errors.map((e) => ` - ${e}`).join('\n'));
  process.exit(1);
}

console.log('UI bounds audit passed: zero button-group shrink-0 overflow risks detected.');
