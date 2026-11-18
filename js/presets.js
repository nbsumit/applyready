/**
 * ApplyReady.in - Shared Presets Database
 * 100% Client-Side In-Browser Configuration
 * Common photo, signature and document sizes used by job and application portals.
 */

(function () {
  'use strict';

  const PRESETS = {
    custom: {
      name: 'Custom Dimensions',
      width: 350,
      height: 350,
      maxKB: 50,
      minKB: 0,
      defaultPrefix: 'Custom'
    },
    passport: {
      name: 'Passport Photo (350 × 450 px, max 50 KB)',
      width: 350,
      height: 450,
      maxKB: 50,
      minKB: 0,
      defaultPrefix: 'Passport_Photo'
    },
    avatar: {
      name: 'Square Avatar (400 × 400 px, max 100 KB)',
      width: 400,
      height: 400,
      maxKB: 100,
      minKB: 0,
      defaultPrefix: 'Avatar'
    },
    signature: {
      name: 'Signature (300 × 100 px, max 30 KB)',
      width: 300,
      height: 100,
      maxKB: 30,
      minKB: 0,
      defaultPrefix: 'Signature'
    },
    'web-banner': {
      name: 'Wide Banner (1200 × 630 px, max 300 KB)',
      width: 1200,
      height: 630,
      maxKB: 300,
      minKB: 0,
      defaultPrefix: 'Banner'
    },
    document: {
      name: 'A4 Document Scan (1240 × 1754 px, max 500 KB)',
      width: 1240,
      height: 1754,
      maxKB: 500,
      minKB: 0,
      defaultPrefix: 'Document'
    },
    thumb: {
      name: 'Thumb Impression (240 × 240 px, 20–50 KB)',
      width: 240,
      height: 240,
      minKB: 20,
      maxKB: 50,
      defaultPrefix: 'Thumb_Impression'
    },
    declaration: {
      name: 'Handwritten Declaration (800 × 400 px, 50–100 KB)',
      width: 800,
      height: 400,
      minKB: 50,
      maxKB: 100,
      defaultPrefix: 'Declaration'
    },

    // Target KB Presets
    'kb-10': {
      name: 'Target: Under 10 KB',
      width: 300,
      height: 300,
      maxKB: 10,
      minKB: 0,
      defaultPrefix: 'Image_10KB'
    },
    'kb-20': {
      name: 'Target: Under 20 KB',
      width: 350,
      height: 350,
      maxKB: 20,
      minKB: 0,
      defaultPrefix: 'Image_20KB'
    },
    'kb-50': {
      name: 'Target: Under 50 KB',
      width: 400,
      height: 500,
      maxKB: 50,
      minKB: 0,
      defaultPrefix: 'Image_50KB'
    },
    'kb-100': {
      name: 'Target: Under 100 KB',
      width: 600,
      height: 600,
      maxKB: 100,
      minKB: 0,
      defaultPrefix: 'Image_100KB'
    },
    'kb-200': {
      name: 'Target: Under 200 KB',
      width: 800,
      height: 800,
      maxKB: 200,
      minKB: 0,
      defaultPrefix: 'Image_200KB'
    }
  };

  if (typeof window !== 'undefined') {
    window.APPLYREADY_PRESETS = PRESETS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PRESETS };
  }
})();
