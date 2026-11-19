/* Resume HTML document: the continuous HTML version of a resume.

   The live preview normally draws the pages with the PDF engine (vector SVG). This HTML version is
   the hidden source sheet, the fallback when the PDF fonts cannot show every character (browser
   print), and what the unit tests read. Every value is escaped; links pass through sanitizeHref.
   Works in the browser (window.ApplyReadyResumeRender) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyResumeRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const req = name => (typeof require === 'function' ? require(name) : null);
  const SCHEMA = () => (typeof ApplyReadySchema !== 'undefined' ? ApplyReadySchema : req('./resume-schema.js'));
  const TPL = () => (typeof ApplyReadyTemplates !== 'undefined' ? ApplyReadyTemplates : req('./templates.js'));
  const PDF = () => (typeof ApplyReadyPDF !== 'undefined' ? ApplyReadyPDF : req('./pdf-engine.js'));

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // A safe href, or '#' for anything that is not http(s), mailto or tel.
  function sanitizeHref(url) {
    if (!url || typeof url !== 'string') return '#';
    const clean = url.trim();
    if (/[\u0000-\u001f]/.test(clean)) return '#';
    try {
      // host:port (example.com:8080/x) is not a scheme, so it is given https:// like any bare host.
      // mailto: and tel: are always schemes, even before digits only (tel:9876543210).
      const hasProtocol = /^(mailto|tel):/i.test(clean) || (/^[a-z][a-z0-9+.-]*:/i.test(clean) && !/^[a-z][a-z0-9+.-]*:\d+(?:[/?#]|$)/i.test(clean));
      const parsed = new URL(hasProtocol ? clean : 'https://' + clean);
      return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.href : '#';
    } catch (e) { return '#'; }
  }

  function renderResumeDataToHTML(data, templateId) {
    const tpl = TPL();
    const pdfApi = PDF();
    const p = data.personal || {};
    const style = tpl.getTemplateStyle(templateId);
    const bulletLines = pdfApi ? pdfApi.bulletLines : text => String(text || '').split(/\r?\n|\r/).map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
    const optionalEntries = pdfApi ? pdfApi.optionalEntries : () => [];
    const vis = data.sectionVisibility || {};
    const visible = key => (pdfApi && pdfApi.sectionShown ? pdfApi.sectionShown(data, vis, key) : vis[key] !== false);
    const t = value => (typeof value === 'string' ? value.trim() : '');
    const heading = text => `<h3 class="resume-section-title">${escapeHTML(text)}</h3>`;
    const bulletList = items => items.length ? `<ul class="resume-bullets">${items.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>` : '';
    const entryHeader = (left, right) => {
      if (!left && !right) return '';
      return `<div class="resume-entry-header">${left ? `<span>${left}</span>` : ''}${right ? `<span class="resume-entry-meta">${right}</span>` : ''}</div>`;
    };
    const listSection = (title, lines) => `<section class="resume-section">${heading(title)}<div>${lines.map(line => `<div class="resume-entry resume-list-entry">${escapeHTML(line)}</div>`).join('')}</div></section>`;

    const contactItems = [];
    if (t(p.phone)) contactItems.push({ text: t(p.phone), href: 'tel:' + t(p.phone).replace(/[^\d+]/g, '') });
    if (t(p.email)) contactItems.push({ text: t(p.email), href: 'mailto:' + t(p.email) });
    if (t(p.location)) contactItems.push({ text: t(p.location) });
    for (const key of ['linkedin', 'github', 'website']) if (t(p[key])) contactItems.push({ text: t(p[key]), href: sanitizeHref(t(p[key])) });

    const contactHtml = contactItems.map((item, idx) => {
      const inner = item.href && item.href !== '#' ? `<a href="${escapeHTML(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.text)}</a>` : escapeHTML(item.text);
      return `<span class="resume-contact-item">${inner}</span>` + (idx < contactItems.length - 1 ? `<span class="resume-contact-sep" aria-hidden="true">${escapeHTML(style.contactSeparator)}</span>` : '');
    }).join('');

    const sections = {};
    const summaryText = t(data.summary);
    if (summaryText && visible('summary')) {
      sections.summary = `<section class="resume-section">${heading(tpl.getSectionTitle(data, templateId, 'summary'))}<p class="resume-summary">${escapeHTML(summaryText)}</p></section>`;
    }

    const exp = (data.experience || []).filter(x => x && (t(x.role) || t(x.company) || t(x.duration) || t(x.location) || bulletLines(x.bulletsText).length));
    if (exp.length && visible('experience')) {
      const items = exp.map(item => `<div class="resume-entry">${entryHeader(escapeHTML([t(item.role), t(item.company)].filter(Boolean).join(' | ')), escapeHTML([t(item.duration), t(item.location)].filter(Boolean).join(' • ')))}${bulletList(bulletLines(item.bulletsText))}</div>`).join('');
      sections.experience = `<section class="resume-section">${heading(tpl.getSectionTitle(data, templateId, 'experience'))}<div>${items}</div></section>`;
    }

    const edu = (data.education || []).filter(x => x && (t(x.degree) || t(x.institution) || t(x.duration) || t(x.location) || t(x.score)));
    if (edu.length && visible('education')) {
      const items = edu.map(item => `<div class="resume-entry">${entryHeader(escapeHTML([t(item.degree), t(item.institution)].filter(Boolean).join(' — ')), escapeHTML([t(item.duration), t(item.location), t(item.score)].filter(Boolean).join(' • ')))}</div>`).join('');
      sections.education = `<section class="resume-section">${heading(tpl.getSectionTitle(data, templateId, 'education'))}<div>${items}</div></section>`;
    }

    const proj = (data.projects || []).filter(x => x && (t(x.name) || t(x.tech) || t(x.link) || bulletLines(x.bulletsText).length));
    if (proj.length && visible('projects')) {
      const items = proj.map(item => {
        const href = sanitizeHref(t(item.link));
        const link = t(item.link) ? (href !== '#' ? `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(t(item.link))}</a>` : escapeHTML(t(item.link))) : '';
        const name = t(item.name);
        const tech = t(item.tech);
        const titleHtml = name
          ? escapeHTML(name) + (tech ? ` <span class="resume-entry-tech">| ${escapeHTML(tech)}</span>` : '')
          : (tech ? escapeHTML(tech) : '');
        return `<div class="resume-entry">${entryHeader(titleHtml, link)}${bulletList(bulletLines(item.bulletsText))}</div>`;
      }).join('');
      sections.projects = `<section class="resume-section">${heading(tpl.getSectionTitle(data, templateId, 'projects'))}<div>${items}</div></section>`;
    }

    const s = data.skills || {};
    const skillLabels = tpl.getSkillLabels(templateId, data);
    const skillRows = Array.isArray(s.categories)
      ? s.categories.filter(c => c && t(c.name) && t(c.items)).map(c => ({ label: t(c.name).replace(/:\s*$/, ''), val: t(c.items) }))
      : ['languages', 'frameworks', 'tools', 'other'].filter(key => t(s[key])).map(key => ({ label: String(skillLabels[key] || '').replace(/:\s*$/, ''), val: t(s[key]) }));
    if (skillRows.length && visible('skills')) {
      sections.skills = `<section class="resume-section">${heading(tpl.getSectionTitle(data, templateId, 'skills'))}<div>${skillRows.map(r => `<div class="resume-skills-row"><span class="skills-category">${escapeHTML(r.label)}: </span><span>${escapeHTML(r.val)}</span></div>`).join('')}</div></section>`;
    }

    for (const key of ['certifications', 'achievements', 'volunteering', 'publications']) {
      const lines = optionalEntries(data, key);
      if (lines.length && visible(key)) sections[key] = listSection(tpl.getSectionLabel(templateId, key), lines);
    }
    const langs = optionalEntries(data, 'languages');
    if (langs.length && visible('languages')) sections.languages = `<section class="resume-section">${heading(tpl.getSectionLabel(templateId, 'languages'))}<p class="resume-summary">${escapeHTML(langs.join(' • '))}</p></section>`;
    if (visible('academic')) {
      sections.academic = ['teaching', 'presentations', 'grants'].map(key => {
        const lines = optionalEntries(data, key);
        return lines.length ? listSection(tpl.getSectionLabel(templateId, key), lines) : '';
      }).join('');
    }
    const refs = pdfApi && pdfApi.referenceContent ? pdfApi.referenceContent(data, key => tpl.getSectionLabel(templateId, key)) : null;
    if (refs && visible('references')) {
      const body = refs.onRequest ? `<p class="resume-summary">${escapeHTML(refs.onRequest)}</p>`
        : `<div>${refs.items.map(ref => `<div class="resume-entry">${entryHeader(escapeHTML(ref.name), '')}${[ref.details, ref.contact].filter(Boolean).map(line => `<div>${escapeHTML(line)}</div>`).join('')}</div>`).join('')}</div>`;
      sections.references = `<section class="resume-section">${heading(tpl.getSectionLabel(templateId, 'references'))}${body}</section>`;
    }

    const order = SCHEMA().normalizeSectionOrder(data.design && data.design.sectionOrder, data);
    for (const key of order) {
      if (!SCHEMA().isCustomKey(key) || !visible(key) || !pdfApi || !pdfApi.customContent) continue;
      const content = pdfApi.customContent(pdfApi.customSectionFor(data, key));
      if (!content) continue;
      const body = content.mode === 'text'
        ? content.paragraphs.map(paragraph => `<p class="resume-summary">${escapeHTML(paragraph)}</p>`).join('')
        : `<div>${content.entries.map(entry => `<div class="resume-entry">${entryHeader(escapeHTML(entry.heading.replace(/\s+\|\s+/g, ' | ')), escapeHTML(entry.date))}${bulletList(entry.bullets)}</div>`).join('')}</div>`;
      sections[key] = `<section class="resume-section">${heading(content.title)}${body}</section>`;
    }
    const orderedHtml = order.map(k => sections[k] || '').join('');
    const name = t(p.fullName) || 'YOUR NAME';

    return `
      <header class="resume-header">
        <div class="resume-name">${escapeHTML(style.nameCase === 'upper' ? name.toUpperCase() : name)}</div>
        ${t(p.targetTitle) ? `<div class="resume-target-title">${escapeHTML(t(p.targetTitle))}</div>` : ''}
        ${contactHtml ? `<div class="resume-contact-line">${contactHtml}</div>` : ''}
      </header>
      <div>${orderedHtml}</div>
    `;
  }

  // Draw the HTML document into a sheet element with the template's classes and colours.
  function renderTemplateIntoContainer(sheet, templateId, data) {
    const tpl = TPL();
    const tmpl = tpl.TEMPLATES[templateId] || tpl.TEMPLATES['classic-professional'];
    const style = tpl.getTemplateStyle(templateId);
    const fontClass = ((data.design && data.design.fontFamily) || tmpl.fontFamily) === 'sans' ? 'font-sans' : 'font-serif';
    const density = (data.design && data.design.density) || tmpl.density || 'standard';
    const fontSize = (data.design && data.design.fontSize) || 'standard';
    const pageSize = (data.design && data.design.pageSize) || 'a4';
    const sourceClass = sheet.id === 'resumeSheet' ? ' resume-source-sheet' : '';
    const styleClasses = [`header-${style.headerAlign}`, `header-rule-${style.headerRule}`, `heading-rule-${style.headingRule}`, `heading-case-${style.headingCase === 'asis' ? 'asis' : 'upper'}`, `dates-${style.datePlacement}`].join(' ');

    sheet.className = `ats-resume-sheet template-${templateId} page-${pageSize} density-${density} font-size-${fontSize} ${fontClass} ${styleClasses}${sourceClass}`;
    sheet.style.setProperty('--resume-heading-color', '#' + style.headingHex);
    sheet.style.setProperty('--resume-rule-color', '#' + style.ruleHex);
    sheet.style.setProperty('--resume-header-rule-color', '#' + style.headerRuleHex);
    sheet.style.setProperty('--resume-link-color', '#' + style.linkHex);
    sheet.style.setProperty('--resume-meta-color', '#' + style.metaHex);
    sheet.innerHTML = renderResumeDataToHTML(data, templateId);
  }

  return { escapeHTML, sanitizeHref, renderResumeDataToHTML, renderTemplateIntoContainer };
});
