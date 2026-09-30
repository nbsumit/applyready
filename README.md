# ApplyReady.in ⚡

> **100% Client-Side Document Utility for Indian Job Seekers & Exam Aspirants**

ApplyReady is a lightning-fast, mobile-first, privacy-focused web application built to solve the two biggest document headaches for Indian job seekers:
1. **Sarkari Exam Photo & Signature Resizer** (UPSC, SSC, IBPS, State PSCs)
2. **Single-Column ATS-Friendly Resume Builder**

🔒 **Zero Server Uploads**: 100% of processing happens in your browser on your device using client-side JavaScript, Canvas API, and WebAssembly. No resumes, photos, or signatures are ever sent to an external server.

---

## 🚀 Features

### 1. Sarkari Exam Photo & Signature Resizer
- **Official Exam Presets**:
  - `UPSC Photo`: 350x350 px, strictly under 50 KB, automated candidate name & date strip.
  - `SSC Signature`: 140x60 px, strictly under 20 KB.
  - `SSC Photo`: 350x450 px, strictly under 50 KB, date strip.
  - `IBPS / Banking Photo`: 200x230 px, under 50 KB.
  - `IBPS / Banking Signature`: 140x60 px, under 20 KB.
  - `Custom`: Enter any custom dimensions (px) and strict KB target.
- **Cropper.js Integration**: Interactive zooming, rotation (±90°), and aspect ratio locking.
- **Automated Date on Photo**: Adds official date strip at the bottom of the photo via HTML5 Canvas `fillText`.
- **Strict Client-Side KB Compression**: Uses Compressor.js with adaptive quality iteration to ensure files strictly meet portal upload size ceilings.

### 2. Single-Column ATS-Friendly Resume Builder
- **100% ATS Parser Compatible**: Single-column layout, zero graphics or multi-column grids that confuse Applicant Tracking Systems.
- **Live Real-Time Preview**: As you type, your A4 document updates instantly.
- **Preloaded Sample Data**: One-click "Load Sample" button for fast editing.
- **Typography Switching**: Toggle between *Classic Serif (Times New Roman)* and *Clean Sans-Serif (Modern)*.
- **Instant A4 PDF Export**: Uses `html2pdf.js` with high-resolution canvas rendering and exact A4 pagination.

### 3. Student-First Monetization
- Built for students by a student.
- Integrated voluntary support button: **☕ Buy me a Chai (₹30)** powered by Razorpay (`https://razorpay.com/@nbsumit`).

---

## 🛠️ Tech Stack

- **HTML5**: Semantic and accessible markup.
- **Vanilla CSS3**: Mobile-first design system with utility blue (`#2563EB`) and trust green (`#10B981`).
- **Vanilla JavaScript (ES6+)**: Zero frameworks or Node.js runtime required.
- **CDN Libraries**:
  - [Cropper.js](https://github.com/fengyuanchen/cropperjs) (Image cropping)
  - [Compressor.js](https://github.com/fengyuanchen/compressorjs) (Client-side image compression)
  - [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) (Client-side PDF generation)
  - [FontAwesome](https://fontawesome.com/) (Icons)

---

## 📂 File Structure

```
/
├── index.html          # Photo & Signature Resizer
├── resume.html         # ATS-Friendly Resume Builder
├── CNAME               # Custom domain: applyready.in
├── css/
│   └── style.css       # Global styles & design system
├── js/
│   ├── resizer.js      # Canvas & Cropper logic
│   └── resume.js       # html2pdf logic & live preview
└── README.md           # Documentation
```

---

## 🌐 Custom Domain & Deployment

Hosted as a static site on GitHub Pages with custom domain `applyready.in`.

---

## ☕ Support
If ApplyReady saved you a trip to the cyber cafe, consider buying me a chai:
👉 [https://razorpay.me/@nbsumit](https://razorpay.me/@nbsumit)

