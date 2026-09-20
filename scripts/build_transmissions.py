"""Build public transmission pages from approved excerpts. No third-party packages.

Add a reviewed entry to content/transmissions.json, then run this script from
any directory. It rebuilds the archive and three featured homepage cards.
The original three reading-room passages keep their stable anchor IDs.
"""
from pathlib import Path
from html import escape
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://departmentofsurrender.com'
POSTS = json.loads((ROOT / 'content/transmissions.json').read_text())
SEED_IDS = ['warning-about-words', 'productive-leisure', 'the-word-enough']

def route(post):
    return '/transmissions/' + post['id'] + '.html'

def sharing(post):
    url = route(post) + '#passage-' + post['id']
    return f'''<div class="passage-actions" data-share-url="{url}" data-share-title="{escape(post['title'], quote=True)} — The Orion Protocol" data-share-text="{escape(post['quote'], quote=True)}">
<div class="share-controls"><button type="button" data-share hidden>Share this passage ↗</button><button type="button" data-copy hidden>Copy link</button><a href="{url}">Passage permalink</a></div>
<p class="share-status" data-share-status role="status" aria-live="polite"></p>
<label class="share-manual" data-share-manual hidden>Passage link<input type="url" readonly aria-label="Passage link to copy"></label>
</div>'''

def card(post):
    return f'''<article class="dispatch-card"><p class="dispatch-number">TRANSMISSION {escape(post['number'])} <span aria-hidden="true">↗</span></p><h3><a href="{route(post)}">{escape(post['title'])}</a></h3><blockquote>“{escape(post['quote'])}”</blockquote><p class="dispatch-source">THE ORION PROTOCOL / ORION SAINT</p><a class="text-link" href="{route(post)}">Open transmission →</a></article>'''

def header(title, description, path, article=False):
    title = escape(title, quote=True)
    description = escape(description, quote=True)
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Department of Surrender</title><meta name="description" content="{description}"><meta name="theme-color" content="#12100f"><link rel="canonical" href="{SITE}{path}">
<meta property="og:site_name" content="Department of Surrender"><meta property="og:type" content="{'article' if article else 'website'}"><meta property="og:locale" content="en_US">
<meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}/og-flamingo.png"><meta property="og:image:secure_url" content="{SITE}/og-flamingo.png"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1254"><meta property="og:image:height" content="1254"><meta property="og:image:alt" content="The Department of Surrender flamingo: white line art on black, spiral eyes and a raised middle finger.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}"><meta name="twitter:description" content="{description}"><meta name="twitter:image" content="{SITE}/og-flamingo.png"><meta name="twitter:image:alt" content="The Department of Surrender flamingo in white line art on black.">
<link rel="stylesheet" href="/site.css"><script defer src="/analytics.js"></script><script defer src="/_vercel/insights/script.js"></script><script defer src="/reader.js"></script>
</head><body id="top"><a class="skip-link" href="#main">Skip to the file</a><div class="transmission"><span>DEPARTMENT OF SURRENDER / PUBLIC ARCHIVE</span><span>CLEARED FOR CIRCULATION</span></div>
<header class="top"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">D/S</span><span>DEPARTMENT<br>OF SURRENDER</span></a><nav aria-label="Main navigation"><a class="nav-link" href="/transmissions.html">Transmissions</a><a class="read-cta" href="/#read">Read a passage ↓</a><a class="buy" href="/requisition.html">Get the book ↗</a></nav></header>'''

FOOTER = '''<footer class="foot"><div class="footer-title">THE FILE IS OPEN.<br><span>PASS IT ON.</span></div><div class="footer-bottom"><p>THE ORION PROTOCOL<br><span>Orion Saint · Department of Surrender</span></p><nav aria-label="Footer navigation"><a href="/transmissions.html">All transmissions</a><a href="/#author">The author</a><a href="/#faq">Book FAQ</a><a href="/#join">Join the Department</a><a href="/privacy.html">Privacy</a></nav></div><p class="fiction-note">The Department of Surrender is the fictional institution of The Orion Protocol.</p></footer></body></html>'''

ids = [p['id'] for p in POSTS]
assert len(set(ids)) == len(ids) and all(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', p) for p in ids)
analytics_path = ROOT / 'analytics.js'
analytics = analytics_path.read_text()
analytics = re.sub(r'const passages = new Set\(\[.*?\]\);', lambda _: 'const passages = new Set(' + json.dumps(ids) + ');', analytics)
analytics_path.write_text(analytics)
(ROOT / 'transmissions').mkdir(exist_ok=True)
for i, post in enumerate(POSTS):
    next_post = POSTS[(i + 1) % len(POSTS)]
    page = header(post['title'] + ' — The Orion Protocol', post['description'] + ' Read and share this short passage by Orion Saint.', route(post), True)
    page += f'''<main id="main" class="dispatch-page"><a class="text-link" href="/transmissions.html">← All transmissions</a><div class="dispatch-layout"><article class="dispatch-document" aria-labelledby="dispatch-title"><p class="eyebrow">CLASSIFIED TRANSMISSION {escape(post['number'])} / RELEASED</p><h1 id="dispatch-title">{escape(post['title'])}</h1><p class="dispatch-lede">{escape(post['description'])}</p><p class="dispatch-label">{escape(post['label'])} · ORION SAINT</p><div class="dispatch-passage" id="passage-{post['id']}" data-passage-id="{post['id']}">{post['passage_html']}<p class="source-note">{escape(post['source'])} · <cite>The Orion Protocol</cite></p></div>{sharing(post)}<div class="dispatch-next"><a href="{route(next_post)}">Next file: {escape(next_post['title'])} →</a></div></article><aside class="dispatch-evidence"><figure><img src="/orion-flamingo.webp" width="1254" height="1254" alt="The Department’s flamingo, with spiral eyes and a raised middle finger."><figcaption>THE BIRD / WITNESS TO THE FILE</figcaption></figure><p class="eyebrow">CONTINUE READING</p><h2>This is only<br>the opening.</h2><p>More recovered files await in the free reading room. No email or purchase required.</p><a class="button button-primary" href="/#read">Read the free sample →</a><a class="text-link" href="/requisition.html">Explore the digital edition ↗</a><a class="text-link" href="/#join">Join the Department →</a></aside></div></main>'''
    (ROOT / route(post).lstrip('/')).write_text(page + FOOTER)

cards = ''.join(card(post) for post in POSTS)
archive = header('Classified Transmissions', 'Short passages from The Orion Protocol by Orion Saint. Open a recovered file, share a passage, and continue in the free reading room.', '/transmissions.html')
archive += f'''<main id="main" class="archive-page"><section class="archive-intro" aria-labelledby="archive-title"><div><p class="eyebrow">OFFICE OF PUBLIC CIRCULATION / THE ORION PROTOCOL</p><h1 id="archive-title">CLASSIFIED<br><span>TRANSMISSIONS.</span></h1><p>Short files. Unreasonable questions. A Bird with no intention of filling in the form.</p><p>Read these selections from <cite>The Orion Protocol</cite>, then pass a file to someone who needs a little less <em>more</em>.</p><a class="text-link" href="/#read">Enter the free reading room →</a></div><figure><img src="/orion-flamingo.webp" width="1254" height="1254" alt="The Department’s spiral-eyed flamingo in white line art on black."><figcaption>UNCLASSIFIED / THE BIRD</figcaption></figure></section><section aria-label="Transmission files"><div class="archive-count"><span>RELEASED FILES</span><span>{len(POSTS):03} TRANSMISSIONS</span></div><div class="dispatch-grid">{cards}</div></section><section class="archive-follow"><p class="eyebrow">THE CORRESPONDENCE CONTINUES</p><h2>Keep a file open.</h2><p>Find Pemberton’s bulletin, read more passages, or join the Department for future correspondence.</p><div class="reading-links"><a class="text-link" href="/bulletin.html">Read Pemberton’s bulletin →</a><a class="text-link" href="/#join">Join the Department →</a></div></section></main>'''
(ROOT / 'transmissions.html').write_text(archive + FOOTER)

home = (ROOT / 'index.html').read_text()
for post in POSTS:
    if post['id'] not in SEED_IDS:
        continue
    opened = ' open' if post['id'] == SEED_IDS[0] else ''
    sample = f'''<details id="passage-{post['id']}" data-passage-id="{post['id']}"{opened}><summary><span>{escape(post['label'])}</span>{escape(post['title'])}</summary><div class="passage">{post['passage_html']}<p class="source-note">{escape(post['source'])}</p>{sharing(post)}</div></details>'''
    pattern = r'(<!-- SAMPLE ' + post['id'] + r' START -->).*?(<!-- SAMPLE ' + post['id'] + r' END -->)'
    home = re.sub(pattern, lambda m: m[1] + '\n' + sample + '\n' + m[2], home, flags=re.S)
featured = f'''<section class="transmissions-home" id="transmissions" aria-labelledby="transmissions-title"><div class="section-heading"><div><p class="eyebrow">CLEARED FOR CIRCULATION / OPEN FILES</p><h2 id="transmissions-title">Classified<br>Transmissions.</h2></div><a class="text-link" href="/transmissions.html">View the archive ↗</a></div><div class="dispatch-grid">{''.join(card(post) for post in POSTS[-3:])}</div></section>'''
home = re.sub(r'(<!-- TRANSMISSIONS START -->).*?(<!-- TRANSMISSIONS END -->)', lambda m: m[1] + '\n' + featured + '\n' + m[2], home, flags=re.S)
(ROOT / 'index.html').write_text(home)

pages = ['/', '/transmissions.html', '/requisition.html', '/bulletin.html', '/privacy.html', '/withdraw.html'] + [route(post) for post in POSTS]
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE}{path}</loc></url>\n' for path in pages) + '</urlset>\n')
print(f'Built {len(POSTS)} transmission pages, archive, homepage excerpts and sitemap.')
