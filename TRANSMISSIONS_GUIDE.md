# Classified Transmissions

The first three files reuse the exact passages already published in the reading
room. Each has a stable URL, its own metadata, the original flamingo, a free-sample
link, native sharing, and copy-link controls with a manual fallback.

## Weekly publishing

Add reviewed excerpts to `content/transmissions.json`, with a unique lowercase
hyphenated ID, file number, title, description, short quote, trusted HTML passage,
and accurate source note. Then run:

    python scripts/build_transmissions.py

This rebuilds the archive, individual pages, three homepage feature cards and
sitemap. Keep published IDs unchanged so shared links continue to work. The three
original reading-room excerpts retain their original positions and deep links.
The JSON is an editorial source file, not user-submitted content: never place
unreviewed HTML or private manuscript text in it.

The initial three share destinations are:

- https://departmentofsurrender.com/transmissions/warning-about-words.html
- https://departmentofsurrender.com/transmissions/productive-leisure.html
- https://departmentofsurrender.com/transmissions/the-word-enough.html

This release publishes the archive and its first three files. It does not create
a recurring job, send broadcasts, or post to social accounts. Later weekly sets
need approved content and publication through the normal repository workflow.

## Author portrait

The author biography uses the supplied background. No identifiable author photo
was available. The section uses a typographic personnel card; replace it with the
user's chosen portrait once supplied. Do not use a stock or generated face as the
author's photograph.
