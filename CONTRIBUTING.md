# Contributing to ApplyReady

Thank you for helping. ApplyReady is a free, open-source, privacy-first toolkit for job applications.
Contributions of every kind are welcome: bug reports, testing on real devices, accessibility feedback,
guide improvements and code.

## Principles every change must respect

Read [`philosophy.html`](philosophy.html) (or the live page) first. In short:

1. **Files never leave the device.** No uploads, analytics, trackers, third-party scripts, fonts or CDNs.
   The Content Security Policy enforces `'self'` only; do not loosen it.
2. **Free for everyone.** No paid features, usage limits, advertising or donation pop-ups. The single
   voluntary donation link lives in the footer, About, Philosophy and Contribute pages only.
3. **Accessible.** Keyboard operable, labelled, readable at 320 px wide, WCAG 2.2 AA contrast, no
   motion that ignores `prefers-reduced-motion`.
4. **Honest.** No claims the code does not back. When a browser cannot do something reliably, say so.
5. **Simple to maintain.** Plain HTML, CSS and JavaScript. Discuss a new dependency in an issue first.

## Getting started

```bash
git clone https://github.com/nbsumit/applyready.git
cd applyready
npm ci                      # dev dependencies: Playwright and axe-core, for tests only
python3 -m http.server 8000 # then open http://localhost:8000/
```

Optional, to rebuild the icon subset: `pip install fonttools brotli`.

## How the code is organised

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The important rules:

- **Generated markup.** The header, footer, CSP, tool listings, search index, sitemap and service worker
  precache are generated. Edit the generator in `scripts/` and run `node scripts/sync-shell.js`. Never hand
  edit text between `<!-- shell:... -->`, `<!-- tool:... -->` or `<!-- directory:... -->` markers.
- **Adding a tool.** Add it to `scripts/lib/tools.js` (with `live: false` until it works), create the page
  with `node scripts/new-page.js`, write the script in `js/` using the shared modules in `js/lib/`, then
  remove `live: false` and run the generators. It then appears in the menu, directory, search and sitemap.
- **Processing code** goes in `js/lib/` (testable, no DOM where possible); page scripts only handle the
  interface. Storage goes through `js/lib/store.js`.
- **Styles** use the tokens in `css/app.css` (see `docs/DESIGN_SYSTEM.md`): no raw colours, icon sizes
  12/16/20/28 px, control heights from tokens, no inline `style` attributes.

## Before you open a pull request

```bash
npm test               # unit, regression and content checks (fast)
npm run test:browser   # Playwright suites in Chromium (set BROWSER_EXECUTABLE_PATH to use a local Chrome)
```

- Add or update tests for what you changed. Tests verify real output (for example with `pdfinfo` or by
  decoding images); please keep that standard.
- Do not skip, weaken or delete a test to make it pass. If a test is wrong, explain why in the PR.
- Check your change on a phone-sized screen and with the keyboard alone.
- Keep commits focused, with messages that say why.

## Reporting bugs and suggesting features

Use the issue templates on GitHub, or email hello@nbsumit.com. Never attach personal documents: describe
the file (type and approximate size) instead. Security problems: see [`SECURITY.md`](SECURITY.md).

## Code of conduct

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).
