import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBuild } from './check-build.mjs';

const page = ({ title = 'Home', image = 'https://medium.mv/images/x.jpg', root = '<main>Hi</main>' } = {}) => `<!doctype html>
<html><head>
<title>${title}</title>
<meta name="description" content="A page">
<link rel="canonical" href="https://medium.mv/">
<meta property="og:image" content="${image}">
</head><body><div id="root">${root}</div></body></html>`;

const routes = [{ path: '/' }, { path: '/about' }];
let dir;

function makeDist(files) {
  dir = mkdtempSync(join(tmpdir(), 'dist-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

const valid = () => ({
  'index.html': page({ title: 'Home' }),
  'about/index.html': page({ title: 'About' }),
  'sitemap.xml': '<urlset/>',
  'robots.txt': 'User-agent: *',
  '404.html': '<title>Page not found</title><meta name="robots" content="noindex"><div id="root"><main>Not found</main></div></body>',
});

afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

describe('checkBuild', () => {
  it('passes a complete build', () => {
    expect(checkBuild(makeDist(valid()), routes)).toEqual([]);
  });

  it('flags a missing page', () => {
    const files = valid();
    delete files['about/index.html'];
    expect(checkBuild(makeDist(files), routes).join('\n')).toMatch(/\/about/);
  });

  it('flags a page without an absolute og:image', () => {
    const files = { ...valid(), 'about/index.html': page({ title: 'About', image: '/images/x.jpg' }) };
    const problems = checkBuild(makeDist(files), routes);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/\/about.*og:image/);
  });

  it('flags duplicate titles', () => {
    const files = { ...valid(), 'about/index.html': page({ title: 'Home' }) };
    expect(checkBuild(makeDist(files), routes).join('\n')).toMatch(/title/i);
  });

  it('flags an empty app root', () => {
    const files = { ...valid(), 'about/index.html': page({ title: 'About', root: '' }) };
    expect(checkBuild(makeDist(files), routes).join('\n')).toMatch(/\/about.*root/i);
  });

  it('flags a missing or indexable 404 page', () => {
    const files = valid();
    delete files['404.html'];
    expect(checkBuild(makeDist(files), routes).join('\n')).toMatch(/404\.html/);
    const indexable = { ...valid(), '404.html': '<title>Page not found</title><div id="root"><main>x</main></div></body>' };
    expect(checkBuild(makeDist(indexable), routes).join('\n')).toMatch(/404\.html.*noindex/);
  });

  it('flags missing sitemap and robots', () => {
    const files = valid();
    delete files['sitemap.xml'];
    delete files['robots.txt'];
    const problems = checkBuild(makeDist(files), routes).join('\n');
    expect(problems).toMatch(/sitemap\.xml/);
    expect(problems).toMatch(/robots\.txt/);
  });
});
