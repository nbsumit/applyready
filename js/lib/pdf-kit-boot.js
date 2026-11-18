/* Loads pdf.js for js/lib/pdf-kit.js. A module script, injected only when a PDF tool needs to draw
   or read pages: a browser that cannot run pdf.js fails here without breaking the rest of the page,
   and pdf-kit.js explains what to do. */
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';

window.__arPdfjs = pdfjs;
window.dispatchEvent(new Event('applyready:pdfjs'));
