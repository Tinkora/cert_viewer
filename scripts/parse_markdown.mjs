import process from 'node:process';

import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

const input = await new Promise((resolve, reject) => {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => resolve(data));
  process.stdin.on('error', reject);
});

const { markdown } = JSON.parse(input);
if (typeof markdown !== 'string') {
  throw new TypeError('markdown must be a string');
}

const parser = new MarkdownIt({ html: false, linkify: false, typographer: false });
const tokens = parser.parse(markdown, {});
const links = [];
const anchors = [];
const paragraphs = [];
const slugger = new GithubSlugger();

function inlineText(children) {
  return children.map((token) => {
    if (token.type === 'text' || token.type === 'code_inline') return token.content;
    if (token.type === 'image') return token.content;
    if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
    return '';
  }).join('');
}

for (let index = 0; index < tokens.length; index += 1) {
  const token = tokens[index];
  if (token.type === 'inline' && token.children) {
    const paragraph = token.content.replace(/\s+/gu, ' ').trim();
    if (paragraph) paragraphs.push(paragraph);
    for (const child of token.children) {
      if (child.type === 'link_open') links.push(child.attrGet('href'));
      if (child.type === 'image') links.push(child.attrGet('src'));
    }
  }

  if (token.type === 'heading_open') {
    const inline = tokens[index + 1];
    if (inline?.type === 'inline') anchors.push(slugger.slug(inlineText(inline.children ?? [])));
  }
}

process.stdout.write(JSON.stringify({ links, anchors, paragraphs }));
