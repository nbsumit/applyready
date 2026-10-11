/**
 * ApplyReady.in - Shared Presets Database
 * 100% Client-Side In-Browser Configuration
 * Accurate government exam specifications & dimensions.
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

    // Exam Presets - verified against official guidelines
    'ssc-photo': {
      name: 'SSC Photo (350 × 450 px, 20–50 KB)',
      width: 350,
      height: 450,
      minKB: 20,
      maxKB: 50,
      defaultPrefix: 'SSC_Photo'
    },
    'ssc-signature': {
      name: 'SSC Signature (400 × 200 px, 10–20 KB)',
      width: 400,
      height: 200,
      minKB: 10,
      maxKB: 20,
      defaultPrefix: 'SSC_Signature'
    },
    'upsc-photo': {
      name: 'UPSC Photo (350 × 350 px, 20–200 KB)',
      width: 350,
      height: 350,
      minKB: 20,
      maxKB: 200,
      defaultPrefix: 'UPSC_Photo'
    },
    'upsc-signature': {
      name: 'UPSC Triple Signature (400 × 400 px, 20–100 KB)',
      width: 400,
      height: 400,
      minKB: 20,
      maxKB: 100,
      defaultPrefix: 'UPSC_Signature'
    },
    'ibps-photo': {
      name: 'IBPS Photo (200 × 230 px, 20–50 KB)',
      width: 200,
      height: 230,
      minKB: 20,
      maxKB: 50,
      defaultPrefix: 'IBPS_Photo'
    },
    'ibps-signature': {
      name: 'IBPS Signature (140 × 60 px, 10–20 KB)',
      width: 140,
      height: 60,
      minKB: 10,
      maxKB: 20,
      defaultPrefix: 'IBPS_Signature'
    },
    'neet-photo': {
      name: 'NEET Photo (400 × 500 px, 10–200 KB)',
      width: 400,
      height: 500,
      minKB: 10,
      maxKB: 200,
      defaultPrefix: 'NEET_Photo'
    },
    'neet-signature': {
      name: 'NEET Signature (300 × 100 px, typically 10–50 KB; check official bulletin)',
      width: 300,
      height: 100,
      minKB: 10,
      maxKB: 50,
      defaultPrefix: 'NEET_Signature'
    },
    'rrb-photo': {
      name: 'RRB Photo (240 × 320 px, 30–70 KB)',
      width: 240,
      height: 320,
      minKB: 30,
      maxKB: 70,
      defaultPrefix: 'RRB_Photo'
    },
    'rrb-signature': {
      name: 'RRB Signature (300 × 120 px, 30–49 KB)',
      width: 300,
      height: 120,
      minKB: 30,
      maxKB: 49,
      defaultPrefix: 'RRB_Signature'
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
