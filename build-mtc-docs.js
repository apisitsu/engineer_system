#!/usr/bin/env node
'use strict';

/**
 * build-mtc-docs.js - Bundle the MTC project's markdown docs into ONE standalone
 * HTML file (mtc-docs.html) with a sticky table of contents, embedded CSS, and no
 * external/network dependencies. Pure Node, no npm packages.
 *
 *   node build-mtc-docs.js        -> writes ./mtc-docs.html
 *
 * Re-run any time the source markdown changes.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Source docs in reading order. { file, title }.
const SOURCES = [
  { file: 'CLAUDE.md',                          title: 'Project Overview (CLAUDE.md)' },
  { file: '.claude/rules/mtc-tooling.md',       title: 'MTC Tooling Pipeline (V1 reference)' },
  { file: '.claude/rules/tooling-select.md',    title: 'Tooling Select V2 (active)' },
  { file: '.claude/rules/formula-reference.md', title: 'Formula Reference (per machine)' },
  { file: '.claude/rules/machine-conditions.md', title: 'Machine Grinding Conditions' },
  { file: '.claude/rules/sds-pipeline.md',      title: 'SDS Pipeline & Coupling' },
  { file: '.claude/rules/sds-reference.md',     title: 'SDS v2 API Reference' },
  { file: '.claude/rules/db-patterns.md',       title: 'DB / Bulk / PDF Patterns' },
  { file: '.claude/rules/backend-gotchas.md',   title: 'Backend Gotchas' },
  { file: '.claude/rules/agent-alignment.md',   title: 'Multi-Agent Coordination' },
];

// -- Minimal, pragmatic Markdown -> HTML --------------------------------------
// Covers the constructs these docs actually use: ATX headings, fenced code,
// GFM pipe tables, ul/ol lists (nested), blockquotes, hr, and inline
// bold/italic/strike/code/links. Underscores are treated LITERALLY (identifiers
// like od_bf_max / tooling_spec_process must survive), so emphasis uses * / **.

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Private-Use-Area sentinels wrap protected inline-code spans. These code points
// never occur in the source docs, so restoring them can't collide with ordinary
// text - a naive " N " placeholder would clash with real numbers ("top 2 rows").
const C0 = '';
const C1 = '';
const RESTORE = new RegExp(C0 + '(\\d+)' + C1, 'g');

function inline(text) {
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return C0 + (codes.length - 1) + C1; });
  text = esc(text);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
    '<a href="' + u.replace(/"/g, '&quot;') + '">' + t + '</a>');
  text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, '<em>$1</em>');
  text = text.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  text = text.replace(RESTORE, (_, i) => '<code>' + esc(codes[Number(i)]) + '</code>');
  return text;
}

const _slugSeen = {};
function slug(s) {
  const base = s.toLowerCase().replace(/[^\w฀-๿]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  if (_slugSeen[base] == null) { _slugSeen[base] = 0; return base; }
  return base + '-' + (++_slugSeen[base]);
}

// Render one markdown document -> { html, headings:[{level,text,id}] }
function renderDoc(md, docId) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let i = 0;

  const isTableSep = (s) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(s) && s.includes('-');

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const lang = fence[1].trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre class="code"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }

    // ATX heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].replace(/\s+#*\s*$/, '');
      const id = docId + '--' + slug(text);
      if (level <= 3) headings.push({ level, text, id });
      out.push('<h' + level + ' id="' + id + '">' + inline(text) + '<a class="anchor" href="#' + id + '">#</a></h' + level + '>');
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1\1+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // GFM table
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const parseRow = (s) => s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const header = parseRow(line);
      const aligns = parseRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(':'), r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
      });
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { body.push(parseRow(lines[i])); i++; }
      let t = '<div class="tablewrap"><table><thead><tr>';
      header.forEach((c, ci) => { t += '<th' + (aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : '') + '>' + inline(c) + '</th>'; });
      t += '</tr></thead><tbody>';
      for (const row of body) {
        t += '<tr>';
        for (let ci = 0; ci < header.length; ci++) {
          t += '<td' + (aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : '') + '>' + inline(row[ci] == null ? '' : row[ci]) + '</td>';
        }
        t += '</tr>';
      }
      t += '</tbody></table></div>';
      out.push(t);
      continue;
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>' + renderDoc(buf.join('\n'), docId).html + '</blockquote>');
      continue;
    }

    // Lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d+\./.test(m[2]), text: m[3] });
        i++;
        while (i < lines.length && lines[i].trim() !== '' && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) && /^\s+\S/.test(lines[i])) {
          items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        }
      }
      out.push(buildList(items, 0));
      continue;
    }

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Paragraph
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^\s*(#{1,6}\s|```|>|([-*+]|\d+\.)\s)/.test(lines[i]) &&
           !/^\s*([-*_])\1\1+\s*$/.test(lines[i]) &&
           !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      buf.push(lines[i]); i++;
    }
    out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }

  return { html: out.join('\n'), headings };
}

// Recursive nested list builder from flat items with indent levels.
function buildList(items, start) {
  const baseIndent = items[start].indent;
  const ordered = items[start].ordered;
  let html = ordered ? '<ol>' : '<ul>';
  let i = start;
  while (i < items.length && items[i].indent >= baseIndent) {
    if (items[i].indent > baseIndent) break;
    let li = '<li>' + inline(items[i].text);
    if (i + 1 < items.length && items[i + 1].indent > baseIndent) {
      const childStart = i + 1;
      let j = childStart;
      while (j < items.length && items[j].indent > baseIndent) j++;
      li += buildList(items.slice(childStart, j), 0);
      i = j - 1;
    }
    html += li + '</li>';
    i++;
  }
  html += ordered ? '</ol>' : '</ul>';
  return html;
}

// -- Build --------------------------------------------------------------------
const sections = [];
const toc = [];
for (const src of SOURCES) {
  const full = path.join(ROOT, src.file);
  if (!fs.existsSync(full)) { console.warn('skip (missing): ' + src.file); continue; }
  const md = fs.readFileSync(full, 'utf8');
  const docId = slug(src.title);
  const { html, headings } = renderDoc(md, docId);
  sections.push('<section class="doc" id="' + docId + '"><div class="doc-src">' + esc(src.file) + '</div>\n' + html + '\n</section>');
  toc.push({ title: src.title, id: docId, headings });
}

const tocHtml = toc.map((d) => {
  const subs = d.headings
    .filter((hh) => hh.level >= 2 && hh.level <= 3)
    .map((hh) => '<a class="lvl' + hh.level + '" href="#' + hh.id + '">' + esc(hh.text) + '</a>')
    .join('\n');
  return '<div class="toc-group"><a class="toc-doc" href="#' + d.id + '">' + esc(d.title) + '</a>' + (subs ? '<div class="toc-subs">' + subs + '</div>' : '') + '</div>';
}).join('\n');

const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');

const HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
+ '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
+ '<title>MTC Documentation - EngineerSystem</title>\n<style>\n'
+ ':root{--bg:#0f1419;--panel:#161b22;--text:#d7dde4;--muted:#8b949e;--accent:#58a6ff;--border:#2a3138;--code:#0d1117;--th:#1c2530;}\n'
+ '*{box-sizing:border-box;}\nhtml{scroll-behavior:smooth;}\n'
+ 'body{margin:0;font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;background:var(--bg);color:var(--text);}\n'
+ '#layout{display:flex;max-width:1500px;margin:0 auto;}\n'
+ '#sidebar{width:320px;flex:0 0 320px;height:100vh;position:sticky;top:0;overflow-y:auto;padding:20px 14px;border-right:1px solid var(--border);background:var(--panel);}\n'
+ '#sidebar h1{font-size:16px;margin:0 0 4px;color:#fff;}\n'
+ '#sidebar .sub{font-size:12px;color:var(--muted);margin-bottom:14px;}\n'
+ '#search{width:100%;padding:7px 10px;margin-bottom:14px;background:var(--code);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;}\n'
+ '.toc-group{margin-bottom:6px;}\n'
+ '.toc-doc{display:block;font-weight:600;color:#fff;text-decoration:none;padding:6px 8px;border-radius:6px;font-size:13.5px;}\n'
+ '.toc-doc:hover{background:var(--code);}\n'
+ '.toc-subs{margin:2px 0 6px 6px;border-left:1px solid var(--border);}\n'
+ '.toc-subs a{display:block;color:var(--muted);text-decoration:none;padding:3px 10px;font-size:12.5px;border-radius:4px;}\n'
+ '.toc-subs a:hover{color:var(--accent);background:var(--code);}\n'
+ '.toc-subs a.lvl3{padding-left:22px;font-size:12px;opacity:.85;}\n'
+ '#content{flex:1;min-width:0;padding:32px 44px 120px;}\n'
+ '.doc{border-bottom:1px solid var(--border);padding-bottom:28px;margin-bottom:28px;}\n'
+ '.doc-src{font:12px/1 ui-monospace,Menlo,Consolas,monospace;color:var(--muted);background:var(--code);display:inline-block;padding:4px 8px;border-radius:5px;margin-bottom:10px;border:1px solid var(--border);}\n'
+ 'h1,h2,h3,h4,h5,h6{color:#fff;line-height:1.3;margin:1.4em 0 .5em;scroll-margin-top:16px;}\n'
+ 'h1{font-size:26px;border-bottom:2px solid var(--border);padding-bottom:8px;}\n'
+ 'h2{font-size:21px;border-bottom:1px solid var(--border);padding-bottom:5px;}\n'
+ 'h3{font-size:17px;} h4{font-size:15px;color:var(--accent);}\n'
+ 'a{color:var(--accent);}\n'
+ '.anchor{opacity:0;margin-left:8px;color:var(--muted);text-decoration:none;font-weight:400;}\n'
+ 'h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{opacity:1;}\n'
+ 'p{margin:.6em 0;}\n'
+ 'code{font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;background:var(--code);padding:2px 5px;border-radius:4px;border:1px solid var(--border);}\n'
+ 'pre.code{background:var(--code);border:1px solid var(--border);border-radius:8px;padding:14px 16px;overflow-x:auto;position:relative;}\n'
+ 'pre.code code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.55;color:#c9d1d9;}\n'
+ 'pre.code[data-lang]::before{content:attr(data-lang);position:absolute;top:0;right:0;font:11px ui-monospace,monospace;color:var(--muted);background:var(--th);padding:2px 8px;border-radius:0 8px 0 8px;}\n'
+ '.tablewrap{overflow-x:auto;margin:1em 0;}\n'
+ 'table{border-collapse:collapse;width:100%;font-size:13.5px;}\n'
+ 'th,td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top;}\n'
+ 'th{background:var(--th);color:#fff;font-weight:600;}\n'
+ 'tr:nth-child(even) td{background:rgba(255,255,255,.02);}\n'
+ 'blockquote{margin:1em 0;padding:2px 16px;border-left:3px solid var(--accent);background:rgba(88,166,255,.06);border-radius:0 6px 6px 0;color:var(--text);}\n'
+ 'blockquote p{margin:.5em 0;}\n'
+ 'ul,ol{padding-left:24px;margin:.5em 0;}\nli{margin:.25em 0;}\n'
+ 'hr{border:none;border-top:1px solid var(--border);margin:1.6em 0;}\n'
+ 'del{color:var(--muted);}\n.hidden{display:none!important;}\n'
+ '@media(max-width:900px){#sidebar{display:none;}#content{padding:20px;}}\n'
+ '</style>\n</head>\n<body>\n<div id="layout">\n'
+ '  <nav id="sidebar">\n    <h1>MTC Documentation</h1>\n'
+ '    <div class="sub">EngineerSystem &middot; generated ' + generated + '</div>\n'
+ '    <input id="search" type="search" placeholder="Filter sections..." autocomplete="off">\n'
+ '    <div id="toc">\n' + tocHtml + '\n    </div>\n  </nav>\n'
+ '  <main id="content">\n' + sections.join('\n') + '\n  </main>\n</div>\n'
+ '<script>\n'
+ 'var q=document.getElementById("search");\n'
+ 'if(q){q.addEventListener("input",function(){\n'
+ '  var v=this.value.toLowerCase();\n'
+ '  document.querySelectorAll(".toc-group").forEach(function(g){\n'
+ '    g.classList.toggle("hidden",g.textContent.toLowerCase().indexOf(v)<0);\n'
+ '  });\n});}\n'
+ '</script>\n</body>\n</html>\n';

const outPath = path.join(ROOT, 'mtc-docs.html');
fs.writeFileSync(outPath, HTML, 'utf8');
console.log('Wrote ' + outPath + ' (' + (HTML.length / 1024).toFixed(0) + ' KB, ' + sections.length + ' docs)');
