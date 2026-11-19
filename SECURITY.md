# Security policy

ApplyReady processes files in the visitor's browser and has no server-side application, database or
accounts. That removes whole classes of risk, but not all of them: files are untrusted input, and saved
resumes live in browser storage. We take reports seriously.

## Supported versions

Only the live site (https://applyready.in, the `main` branch) is supported. There are no older releases
to patch.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for a security problem. Email **hello@nbsumit.com** with:

- what you found and why it matters (for example: a file that runs script in the page, a way to read
  another site's data, data sent off the device, a bypass of the Content Security Policy),
- steps to reproduce, with a sample file if one is needed (make sure it contains no personal data),
- the browser and version you used.

You will get an acknowledgement within 5 business days. We will confirm the issue, work on a fix, and
credit you in the changelog if you wish. Please give us reasonable time to fix the problem before
disclosing it publicly.

## Scope

In scope: cross-site scripting through file names, file contents, imported backups or URL parameters;
anything that sends data off the device; parsing bugs that hang or crash the page with a small file;
weaknesses in the service worker or browser storage handling.

Out of scope: denial of service by giving the page a file larger than the stated limits; missing HTTP
security headers that GitHub Pages cannot set (HSTS, `frame-ancestors`), which are documented; issues in
the visitor's own browser or extensions.

## How the site is protected

- A Content Security Policy on every page allows scripts, styles, fonts, images and connections from the
  site's own origin only, with no `eval` and no inline scripts. Only WebAssembly compilation is allowed
  (`'wasm-unsafe-eval'`), for the PDF reader's image decoders. Workers are started from `blob:` URLs so
  that the same policy applies inside them.
- Files are identified by their content, size-limited per tool, and decoded by the browser or by
  maintained libraries (pdf.js, pdf-lib) running in workers where possible.
- User text and file names are escaped before being shown; imported resumes are rebuilt from an
  allow-list of fields.
- There are no third-party scripts, analytics or advertising.
