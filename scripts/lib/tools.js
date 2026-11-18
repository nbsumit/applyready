/* The ApplyReady tool registry: the single source of truth for navigation and search.

   Everything that lists tools reads from here: the header Tools menu, the footer, the tool
   directory (tools.html), the home page entry points, the search index (js/tool-index.js),
   related-tool links and the sitemap. Add a tool here, run `node scripts/sync-shell.js`, and it
   appears everywhere at once.

   Fields
     id        stable identifier (also stored in "recently used", so never rename one)
     name      what the tool is called everywhere
     path      page path from the site root ('' is the home page)
     category  primary category id (see CATEGORIES)
     also      other categories it should be listed under
     icon      Font Awesome solid icon name, without the "fa-" prefix
     summary   one short line: what you get (menus, cards, search results)
     keywords  words people type when they need this tool, including synonyms and misspellings
     live      false hides a tool everywhere until its page exists (never link to a missing page)
     popular   order on the home page "most used" row (lower first); also breaks ties in search
     presetOf  the tool this page is a ready-set version of (the KB limit pages open the image
               resizer with a limit chosen). Such a page is not a separate tool: the directory shows
               it as a link on its parent's card, search lists it on its own, and the header menu
               and footer leave it out.
     preset    the short label for that link, e.g. "20 KB"
*/
'use strict';

const CATEGORIES = [
  { id: 'resume', name: 'Resume', icon: 'file-lines', summary: 'Write, save and download a resume.' },
  { id: 'image', name: 'Image tools', icon: 'image', summary: 'Resize, compress and convert photos and signatures.' },
  { id: 'pdf', name: 'PDF tools', icon: 'file-pdf', summary: 'Merge, split, organise and compress PDFs.' },
  { id: 'document', name: 'Document tools', icon: 'file-circle-check', summary: 'Check files and turn text into PDF.' },
  { id: 'batch', name: 'Batch processing', icon: 'layer-group', summary: 'Process many files at once and download a ZIP.' },
  { id: 'cafe', name: 'Cyber cafe tools', icon: 'users', summary: 'Separate, temporary workspaces for each applicant.' }
];

const TOOLS = [
  // Resume
  { id: 'resume', name: 'Resume builder', path: 'resume.html', category: 'resume', icon: 'file-lines', popular: 1,
    summary: 'Write a resume, save it on this device, download PDF or Word',
    keywords: ['resume', 'cv', 'biodata', 'create resume', 'make cv', 'resume maker', 'resume template', 'ats', 'job application', 'curriculum vitae', 'resume pdf', 'resume word', 'docx', 'edit resume', 'saved resume'] },

  // Image tools
  { id: 'image-resizer', name: 'Image resizer', path: 'image-resizer.html', category: 'image', icon: 'crop-simple', popular: 2,
    summary: 'Exact pixel size and KB limit, with crop and rotate',
    keywords: ['resize image', 'resize photo', 'photo size', 'image size', 'change size', 'pixels', 'dimensions', 'crop', 'rotate', 'kb', 'reduce size', 'photo resizer', 'picture', 'jpg', 'jpeg', 'cm', 'inches', 'dpi'] },
  { id: 'passport-photo', name: 'Passport photo resizer', path: 'passport-photo-resizer.html', category: 'image', icon: 'id-badge',
    summary: 'Passport-size photo at the pixel size and KB a form asks for',
    keywords: ['passport photo', 'passport size photo', 'photo for form', 'id photo', '35x45', '3.5 x 4.5', 'profile photo', 'face photo', 'photograph'] },
  { id: 'signature-resizer', name: 'Signature resizer', path: 'signature-resizer.html', category: 'image', icon: 'signature',
    summary: 'Signature image at the exact size and KB limit',
    keywords: ['signature', 'signature size', 'resize signature', 'sign', 'signature kb', 'signature 20kb', 'sign image', 'autograph'] },
  { id: 'compress-image', name: 'Image compressor', path: 'compress-image.html', category: 'image', also: ['batch'], icon: 'compress',
    summary: 'Make photos smaller in KB, one or many at once',
    keywords: ['compress image', 'compress photo', 'reduce kb', 'reduce file size', 'shrink image', 'smaller photo', 'image under 100kb', 'optimise', 'optimize', 'compressor'] },
  { id: 'convert-image', name: 'Image converter', path: 'convert-image.html', category: 'image', also: ['batch'], icon: 'arrows-rotate',
    summary: 'Convert between JPG, PNG and WebP',
    keywords: ['convert image', 'png to jpg', 'jpg to png', 'webp to jpg', 'jpg to webp', 'png to webp', 'heic', 'heic to jpg', 'image format', 'change format', 'jpeg', 'converter'] },
  { id: 'signature-cleaner', name: 'Signature cleaner', path: 'signature-cleaner.html', category: 'image', icon: 'wand-magic-sparkles',
    summary: 'White paper and dark ink from a phone photo of a signature',
    keywords: ['signature', 'clean signature', 'signature background', 'white background', 'scan signature', 'signature photo', 'remove background', 'transparent signature'] },
  { id: 'passport-print', name: 'Passport photo print sheet', path: 'passport-photo-print.html', category: 'image', icon: 'print',
    summary: 'A printable A4 or 4x6 sheet of passport photos',
    keywords: ['passport photo print', 'print photos', 'photo sheet', 'a4 passport photos', '4x6', 'print passport size', 'multiple copies'] },
  { id: 'resize-20kb', name: 'Resize image to 20 KB', path: 'resize-image-to-20kb.html', category: 'image', icon: 'crop-simple', presetOf: 'image-resizer', preset: '20 KB',
    summary: 'Photo or signature under 20 KB',
    keywords: ['20kb', '20 kb', 'under 20kb', 'photo 20kb', 'signature 20kb'] },
  { id: 'resize-50kb', name: 'Resize image to 50 KB', path: 'resize-image-to-50kb.html', category: 'image', icon: 'crop-simple', presetOf: 'image-resizer', preset: '50 KB',
    summary: 'Photo under 50 KB',
    keywords: ['50kb', '50 kb', 'under 50kb', 'photo 50kb'] },
  { id: 'resize-kb', name: 'Resize image to any KB', path: 'resize-image-to-kb-limit.html', category: 'image', icon: 'crop-simple', presetOf: 'image-resizer', preset: 'Any KB',
    summary: '10, 100, 200 KB or your own limit',
    keywords: ['10kb', '100kb', '200kb', 'kb limit', 'file size limit', 'under 100kb'] },

  // PDF tools
  { id: 'merge-pdf', name: 'Merge PDF', path: 'merge-pdf.html', category: 'pdf', icon: 'object-group', popular: 4,
    summary: 'Join several PDFs into one, in the order you choose',
    keywords: ['merge pdf', 'combine pdf', 'join pdf', 'pdf merger', 'add pdf together', 'one pdf', 'attach pdfs', 'certificates', 'combine certificates', 'merge certificates'] },
  { id: 'split-pdf', name: 'Split PDF', path: 'split-pdf.html', category: 'pdf', icon: 'scissors',
    summary: 'Take out pages or split a PDF into parts',
    keywords: ['split pdf', 'extract pages', 'separate pdf', 'cut pdf', 'pdf pages', 'remove pages', 'divide pdf'] },
  { id: 'organize-pdf', name: 'Organise PDF pages', path: 'organize-pdf.html', category: 'pdf', icon: 'table-cells-large',
    summary: 'Reorder, rotate and delete pages',
    keywords: ['organize pdf', 'organise pdf', 'reorder pages', 'rotate pdf', 'delete pdf pages', 'arrange pdf', 'sort pages', 'move pages', 'turn page'] },
  { id: 'image-to-pdf', name: 'Image to PDF', path: 'image-to-pdf.html', category: 'pdf', icon: 'file-pdf', popular: 5,
    summary: 'Combine photos and scans into one PDF',
    keywords: ['image to pdf', 'jpg to pdf', 'photo to pdf', 'scan to pdf', 'png to pdf', 'pictures to pdf', 'convert to pdf', 'certificates', 'certificate photos', 'combine photos', 'scanned documents'] },
  { id: 'compress-pdf', name: 'Compress PDF', path: 'compress-pdf.html', category: 'pdf', icon: 'file-zipper', popular: 6,
    summary: 'Make a PDF small enough for an upload limit',
    keywords: ['compress pdf', 'reduce pdf size', 'pdf kb', 'pdf mb', 'shrink pdf', 'pdf under 1mb', 'smaller pdf', 'pdf size'] },
  { id: 'pdf-to-image', name: 'PDF to images', path: 'pdf-to-image.html', category: 'pdf', icon: 'images',
    summary: 'Save PDF pages as JPG or PNG images',
    keywords: ['pdf to image', 'pdf to jpg', 'pdf to png', 'convert pdf', 'pdf page image', 'pdf photo'] },
  { id: 'pdf-to-text', name: 'Extract text from PDF', path: 'pdf-to-text.html', category: 'pdf', also: ['document'], icon: 'font',
    summary: 'Copy the text out of a PDF',
    keywords: ['pdf to text', 'extract text', 'copy text from pdf', 'pdf text', 'txt', 'read pdf', 'pdf to word', 'pdf to doc', 'pdf to docx'] },
  { id: 'page-numbers', name: 'Add page numbers', path: 'add-page-numbers.html', category: 'pdf', icon: 'list-ol',
    summary: 'Number the pages of a PDF',
    keywords: ['page numbers', 'number pages', 'pdf page number', 'paginate', 'footer number'] },
  { id: 'watermark-pdf', name: 'Watermark PDF', path: 'watermark-pdf.html', category: 'pdf', icon: 'stamp',
    summary: 'Stamp text such as "Copy" across every page',
    keywords: ['watermark', 'stamp pdf', 'pdf watermark', 'self attested', 'copy stamp', 'confidential'] },

  // Document tools
  { id: 'text-to-pdf', name: 'Text to PDF', path: 'text-to-pdf.html', category: 'document', also: ['pdf'], icon: 'file-export',
    summary: 'Turn typed or pasted text into a clean PDF',
    keywords: ['text to pdf', 'txt to pdf', 'notepad to pdf', 'write pdf', 'make pdf', 'cover letter pdf', 'letter to pdf'] },
  { id: 'file-checker', name: 'File checker', path: 'file-checker.html', category: 'document', icon: 'file-circle-check',
    summary: 'See a file’s real type, size, pixels and metadata; remove photo metadata',
    keywords: ['file checker', 'check file', 'file size', 'file type', 'metadata', 'exif', 'remove metadata', 'dpi', 'image dimensions', 'pdf pages', 'validate file', 'gps location'] },

  // Batch
  { id: 'batch-image', name: 'Batch image processor', path: 'batch-image.html', category: 'batch', also: ['image'], icon: 'layer-group', popular: 3,
    summary: 'Resize, compress or convert many photos at once, download a ZIP',
    keywords: ['batch', 'bulk', 'multiple images', 'many photos', 'batch resize', 'bulk resize', 'resize all', 'zip', 'mass resize', 'batch processing', 'multiple signatures'] },

  // Cyber cafe
  { id: 'workspace', name: 'Applicant workspaces', path: 'workspace.html', category: 'cafe', icon: 'users',
    summary: 'A separate, temporary space for each applicant’s files',
    keywords: ['cyber cafe', 'operator', 'applicant', 'workspace', 'customer', 'shared computer', 'computer centre', 'placement office', 'session', 'multiple applicants'] }
];

// Pages that are not tools but are worth finding by search. A path may end in #anchor when the
// answer is one section of a page.
const PAGES = [
  { id: 'tools', name: 'All tools', path: 'tools.html', icon: 'table-cells-large', summary: 'Every tool, by category', keywords: ['tools', 'all tools', 'directory', 'list'] },
  { id: 'guides', name: 'Guides', path: 'guides/', icon: 'book-open', summary: 'Step-by-step help for every tool', keywords: ['guide', 'help', 'how to', 'tutorial', 'instructions'] },
  { id: 'how-to-use', name: 'How to use ApplyReady', path: 'how-to-use.html', icon: 'circle-question', summary: 'A short walk through each tool', keywords: ['how to use', 'getting started', 'start', 'walkthrough', 'help', 'instructions'] },
  { id: 'word-to-pdf', name: 'Word to PDF', path: 'file-checker.html#word-to-pdf', icon: 'file-word', summary: 'ApplyReady does not convert Office files: how to save a PDF from Word, Excel, PowerPoint, Google Docs or LibreOffice', keywords: ['word to pdf', 'docx to pdf', 'doc to pdf', 'excel to pdf', 'xlsx to pdf', 'xls to pdf', 'powerpoint to pdf', 'ppt to pdf', 'pptx to pdf', 'convert word', 'word file', 'google docs', 'libreoffice', 'save as pdf', 'export pdf'] },
  { id: 'your-data', name: 'Your data', path: 'your-data.html', icon: 'database', summary: 'See and delete what ApplyReady keeps on this device', keywords: ['your data', 'my data', 'delete my data', 'delete data', 'clear data', 'saved resumes', 'storage', 'recently used', 'reset', 'remove everything'] },
  { id: 'privacy', name: 'Privacy', path: 'privacy.html', icon: 'shield-halved', summary: 'What is stored, where, and how to delete it', keywords: ['privacy', 'data', 'upload', 'safe', 'security', 'storage', 'privacy policy'] },
  { id: 'about', name: 'About ApplyReady', path: 'about.html', icon: 'circle-info', summary: 'What ApplyReady is and who it is for', keywords: ['about', 'who', 'free', 'open source'] },
  { id: 'philosophy', name: 'Our philosophy', path: 'philosophy.html', icon: 'heart', summary: 'Why ApplyReady is free, open source and private', keywords: ['philosophy', 'why free', 'values', 'principles', 'no ads'] },
  { id: 'contact', name: 'Contact and support', path: 'contact.html', icon: 'envelope', summary: 'Ask a question or report a problem', keywords: ['contact', 'support', 'help', 'email', 'bug', 'problem'] },
  { id: 'feedback', name: 'Feedback', path: 'feedback.html', icon: 'comment', summary: 'Report a problem or suggest a feature', keywords: ['feedback', 'suggest', 'suggestion', 'feature request', 'report a problem', 'bug'] },
  { id: 'changelog', name: 'Changelog', path: 'changelog.html', icon: 'clock-rotate-left', summary: 'What is new in ApplyReady', keywords: ['changelog', 'what is new', 'updates', 'release notes', 'version', 'history'] },
  { id: 'terms', name: 'Terms of use', path: 'terms.html', icon: 'scale-balanced', summary: 'The rules for using ApplyReady', keywords: ['terms', 'terms of use', 'terms and conditions', 'conditions', 'legal', 'licence', 'license'] },
  { id: 'contribute', name: 'Contribute', path: 'contribute.html', icon: 'code-branch', summary: 'Help with code, guides or testing', keywords: ['contribute', 'contributing', 'volunteer', 'github', 'source code', 'translate', 'developer'] }
];

const live = t => t.live !== false;
const liveTools = () => TOOLS.filter(live);
const isPreset = t => !!t.presetOf;
// The tools listed under a category: its own tools first, then those that also belong there, in
// registry order. Every listing (header menu, home, directory) uses this, so they always agree.
// Preset pages are left out; they appear as links on their parent's card (presetsOf).
const toolsIn = categoryId => {
  const tools = liveTools().filter(t => !isPreset(t));
  return [...tools.filter(t => t.category === categoryId), ...tools.filter(t => t.category !== categoryId && (t.also || []).includes(categoryId))];
};
const presetsOf = id => liveTools().filter(t => t.presetOf === id);
const byId = id => TOOLS.find(t => t.id === id);

module.exports = { CATEGORIES, TOOLS, PAGES, liveTools, toolsIn, presetsOf, isPreset, byId };
