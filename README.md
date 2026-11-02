# belliavesha.github.io

The personal website of Vladislav Loktev, astrophysicist: https://belliavesha.github.io

## Structure

- `index.html` – the home page: a lake in Turku drawn live in the browser (the scene's knobs are in the `SCENE` object near the top of its script).
- `research.html`, `about.html`, `merits.html` – the other pages.
- `data.js` – all the content (papers, talks, career, contacts, notes, fortunes). Edit it there; every page renders from it.
- `site.js`, `site.css` – what every page shares: the menu, the command line, the simulated clock and weather.
- `book.css` – the paper and type of Research and About. `fifty.js` – the "$50" joke on the About page.
- `CygX2/`, `collatztree/`, `mandelburger/` – small side projects. `old/` – the previous site, kept but not indexed.

## Preview locally

    python3 -m http.server

then open http://localhost:8000. Add `?debug` to the address for the test hooks (`window.__rv` and friends).

Before pushing, refresh the file list the command line shows (`ls`, `cat`, `open`):
run `update_manifest.py` (kept outside this repository) with the path of this folder.

## Notes

- The "$50" form is a joke: nothing typed into it leaves the browser or is stored.
- Spectra in `CygX2/data/` are NuSTAR observations from HEASARC. Fonts are from Google Fonts (SIL Open Font License).
