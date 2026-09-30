# ApplyReady.in - SEO & Search Console Setup Guide

This document outlines the step-by-step instructions for the website owner to verify domain ownership, submit sitemaps, configure IndexNow, and monitor search indexing across Google and Bing.

---

## 1. Google Search Console (GSC) Setup

### Step 1: Add Property
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Choose **Domain** verification (covers `https://applyready.in`, `http://`, and all subdomains) or **URL prefix** (`https://applyready.in`).

### Step 2: Verification Methods
- **Method A: DNS TXT Record (Recommended for Domain Property)**
  1. Copy the TXT record token provided by Google (e.g., `google-site-verification=XXXXXXXXXXXXXXXXXXXXX`).
  2. Log into your domain registrar / DNS provider for `applyready.in`.
  3. Add a `TXT` record at the root domain (`@`) with TTL 300 or Automatic.
  4. Wait 5-10 minutes and click **Verify** in Search Console.
- **Method B: HTML Meta Tag (URL Prefix)**
  1. If using URL prefix, Google provides a meta tag:
     ```html
     <meta name="google-site-verification" content="YOUR_TOKEN_HERE" />
     ```
  2. Paste this tag into the `<head>` of `index.html` and commit/deploy.

### Step 3: Submit Sitemap
1. In the GSC left sidebar, click **Sitemaps**.
2. Under "Add a new sitemap", enter:
   ```
   sitemap.xml
   ```
   (Full URL: `https://applyready.in/sitemap.xml`)
3. Click **Submit**. Verify that the status shows **Success**.

### Step 4: URL Inspection & Request Indexing
1. Use the search bar at the top to inspect key public URLs:
   - `https://applyready.in/`
   - `https://applyready.in/resume.html`
   - `https://applyready.in/how-to-use.html`
2. Click **Test Live URL** to ensure Googlebot renders the client-side HTML without blockages.
3. Click **Request Indexing**.

---

## 2. Bing Webmaster Tools Setup

### Step 1: Add Site & Verification
1. Navigate to [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. You can authenticate instantly by importing your verified properties from **Google Search Console**, or add `https://applyready.in` manually via DNS CNAME/TXT or meta tag:
   ```html
   <meta name="msvalidate.01" content="YOUR_BING_TOKEN" />
   ```

### Step 2: Submit Sitemap
1. Go to **Sitemaps** in the Bing Webmaster dashboard.
2. Submit `https://applyready.in/sitemap.xml`.

---

## 3. IndexNow Setup & Owner-Controlled Submission

### What is IndexNow?
IndexNow is an open protocol that instantly alerts participating search engines (Bing, Yandex, Seznam, Naver) whenever URLs are added, updated, or deleted. Note: **IndexNow does not submit to Google**; Google relies on standard sitemaps and Search Console indexing.

### Security & Privacy Rules:
- **Do NOT trigger IndexNow from visitor browsers.** Firing API requests on every page view causes unnecessary network overhead, risks rate-limiting, and leaks internal IP addresses.
- **Trigger submissions only when content changes**, executed by the repository owner via CI/CD (GitHub Actions) or a local script.

### Setup Instructions:
1. **Generate an IndexNow API Key:**
   A key is an arbitrary 32-character hexadecimal string, e.g., `8f4b23c91d0e4a77b812f6c5e3d09a12`.
2. **Create Key File at Root:**
   Place a text file named `{your-key}.txt` at the website root containing only your key:
   `https://applyready.in/{your-key}.txt`
3. **Submit Changed URLs (Owner Command):**
   When publishing updates, run an HTTP POST request to the IndexNow endpoint:
   ```bash
   curl -X POST "https://api.indexnow.org/indexnow" \
        -H "Content-Type: application/json; charset=utf-8" \
        -d '{
          "host": "applyready.in",
          "key": "YOUR_KEY_HERE",
          "keyLocation": "https://applyready.in/YOUR_KEY_HERE.txt",
          "urlList": [
            "https://applyready.in/",
            "https://applyready.in/resume.html",
            "https://applyready.in/how-to-use.html",
            "https://applyready.in/guides/image-dimensions-vs-file-size.html",
            "https://applyready.in/guides/compression-targets-guide.html",
            "https://applyready.in/guides/image-formats-guide.html",
            "https://applyready.in/guides/ats-friendly-resume-guide.html"
          ]
        }'
   ```

---

## 4. Ongoing SEO Maintenance Checklist

- [ ] **Monitor Indexing Coverage:** Review the "Pages" report in GSC monthly to resolve any 404s, redirect errors, or soft 404s.
- [ ] **Audit Core Web Vitals:** Verify that Largest Contentful Paint (LCP) is under 2.5s and Cumulative Layout Shift (CLS) is near 0. Measure the deployed site; privacy and the absence of tracking do not guarantee good Core Web Vitals.
- [ ] **Sitemap Updates:** When adding new guides or features, append the canonical URL and current `lastmod` date to `sitemap.xml`.
- [ ] **Check Robots.txt:** Ensure `robots.txt` consistently permits crawling of public HTML, styles, and favicon assets while referencing the sitemap.
