/**
 * ApplyReady.in - Rebuilt ATS-Friendly Resume Builder
 * 8 Distinct Templates, 3-Tab Workspace (Content, Design, Review & Export),
 * True Vector PDF, Editable OOXML DOCX, and Plain Text Exports.
 * 100% Client-Side Processing, Privacy-Preserving Draft Storage, and Zero Support Popups.
 */

(function () {
  'use strict';

  const SCHEMA = typeof ApplyReadySchema !== 'undefined' ? ApplyReadySchema
    : (typeof require === 'function' ? require('./resume-schema.js') : null);
  const notify = (message, error = false) => { if (window.ApplyReadyUI) window.ApplyReadyUI.notify(message, error); };

  // Template catalogue, visual rules and labels shared with the export engines.
  const TPL = typeof ApplyReadyTemplates !== 'undefined' ? ApplyReadyTemplates
    : (typeof require === 'function' ? require('./templates.js') : null);
  const TEMPLATES = TPL.TEMPLATES;

  // Demonstration Sample Data
  const SAMPLE_DATA = {
    version: 2,
    app: 'ApplyReady',
    template: 'classic-professional',
    design: {
      fontFamily: 'serif',
      fontSize: 'standard',
      density: 'standard',
      pageSize: 'a4',
      accentColor: 'navy',
      sectionOrder: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic']
    },
    sectionVisibility: {
      summary: true,
      experience: true,
      education: true,
      projects: true,
      skills: true,
      certifications: true,
      achievements: true,
      volunteering: false,
      languages: false,
      academic: false
    },
    personal: {
      fullName: 'ALEX R. MORGAN',
      targetTitle: 'Operations & Project Manager | PMP Candidate',
      email: 'alex.morgan@email.com',
      phone: '+1 (555) 234-5678',
      location: 'Chicago, IL',
      linkedin: 'linkedin.com/in/alexmorgan',
      github: '',
      website: 'alexmorgan-portfolio.com'
    },
    summaryTitle: 'Professional Summary',
    summary: 'Results-driven operations professional with over 5 years of experience optimizing cross-functional workflows, managing enterprise project lifecycles, and driving operational efficiency. Demonstrated expertise in budget allocation, stakeholder coordination, and lean process improvements resulting in 18% cost reductions and enhanced team delivery timelines.',
    experienceTitle: 'Work Experience',
    experience: [
      {
        id: 'exp-1',
        role: 'Senior Operations Coordinator',
        company: 'Apex Logistics Solutions',
        location: 'Chicago, IL',
        duration: 'Jan 2022 - Present',
        bulletsText: 'Directed daily distribution workflows for 4 regional facilities, improving on-time delivery rate from 91% to 98.4%.\nSpearheaded adoption of automated inventory tracking software, eliminating manual dispatch errors and saving 14 hours weekly.\nManaged vendor contracts and procurement negotiations, reducing recurring supply chain costs by $120,000 annually.\nSupervised a team of 12 dispatchers and project coordinators, conducting quarterly performance evaluations and safety audits.'
      },
      {
        id: 'exp-2',
        role: 'Project Analyst',
        company: 'Beacon Strategic Advisory',
        location: 'Evanston, IL',
        duration: 'Jun 2019 - Dec 2021',
        bulletsText: 'Facilitated sprint planning and risk assessment reviews for 8 concurrent digital transformation client engagements.\nSynthesized operational KPI datasets into executive dashboards, providing actionable visibility to senior leadership.\nStandardized internal project documentation and handover templates adopted across all client-facing consulting divisions.'
      }
    ],
    educationTitle: 'Education',
    education: [
      {
        id: 'edu-1',
        degree: 'Bachelor of Science in Business Administration',
        institution: 'University of Illinois Urbana-Champaign',
        location: 'Champaign, IL',
        duration: '2015 - 2019',
        score: 'GPA: 3.8 / 4.0'
      }
    ],
    projectsTitle: 'Key Projects & Initiatives',
    projects: [
      {
        id: 'proj-1',
        name: 'Enterprise Supply Chain Automation',
        tech: 'Jira, Smartsheet, Tableau, SAP ERP',
        link: 'beaconadvisory.com/case-studies/logistics',
        bulletsText: 'Led end-to-end migration of legacy dispatch sheets to centralized cloud ERP for a fleet of 80 transport vehicles.\nOrganized user acceptance testing workshops and authored training manuals for 65 operations staff members.'
      }
    ],
    skillsTitle: 'Skills & Competencies',
    skills: {
      languages: 'Project Lifecycle Management, Agile / Scrum Framework, Risk Assessment, Budget Oversight, Lean Six Sigma',
      frameworks: 'Jira, Asana, Microsoft Project, Smartsheet, Salesforce CRM, SAP ERP, Trello',
      tools: 'Advanced Excel / Google Sheets, Tableau, Power BI, SQL Data Queries, Google Workspace',
      other: 'Stakeholder Communication, Vendor Management, Team Leadership, Process Documentation, Bilingual (English/Spanish)'
    },
    certifications: [
      { id: 'cert-1', name: 'Project Management Professional (PMP Candidate)', issuer: 'Project Management Institute', year: '2023' }
    ],
    achievements: [
      'Recipient of Apex Logistics Operational Excellence Award (2023) for supply chain automation leadership'
    ],
    volunteering: [
      { id: 'vol-1', role: 'Volunteer Logistics Coordinator', organization: 'Greater Chicago Food Network', duration: '2020 - Present' }
    ],
    languages: [
      { id: 'lang-1', name: 'English', proficiency: 'Native' },
      { id: 'lang-2', name: 'Spanish', proficiency: 'Professional working' }
    ],
    academic: {
      publications: [],
      teaching: [],
      presentations: [],
      grants: []
    }
  };

  // Blank initial state
  const EMPTY_DATA = {
    version: 2,
    app: 'ApplyReady',
    template: 'classic-professional',
    design: {
      fontFamily: 'serif',
      fontSize: 'standard',
      density: 'standard',
      pageSize: 'a4',
      accentColor: 'navy',
      sectionOrder: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic']
    },
    sectionVisibility: {
      summary: true,
      experience: true,
      education: true,
      projects: true,
      skills: true,
      certifications: false,
      achievements: false,
      volunteering: false,
      languages: false,
      academic: false
    },
    personal: {
      fullName: '',
      targetTitle: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: ''
    },
    summaryTitle: 'Professional Summary',
    summary: '',
    experienceTitle: 'Work Experience',
    experience: [],
    educationTitle: 'Education',
    education: [],
    projectsTitle: 'Key Projects & Initiatives',
    projects: [],
    skillsTitle: 'Skills & Competencies',
    skills: {
      languages: '',
      frameworks: '',
      tools: '',
      other: ''
    },
    certifications: [],
    achievements: [],
    volunteering: [],
    languages: [],
    academic: {
      publications: [],
      teaching: [],
      presentations: []
    }
  };

  // Active Resume State
  let resumeData = JSON.parse(JSON.stringify(EMPTY_DATA));
  let isDirty = false;
  let autoSaveDraft = false;
  let currentZoom = 'fit';

  // Bounded Undo / Redo History Stack (up to 30 snapshots)
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 30;

  function pushHistoryState() {
    undoStack.push(JSON.stringify(resumeData));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0; // Clear redo on new action
    isDirty = true;
    updateUndoRedoButtons();
  }

  function performUndo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(resumeData));
    const previous = undoStack.pop();
    resumeData = JSON.parse(previous);
    populateAllFormFields();
    renderAllDynamicLists();
    renderResumePreview();
    updateDesignControlsFromState();
    setupTemplateGallery();
    runResumeReview();
    updateUndoRedoButtons();
  }

  function performRedo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(resumeData));
    const next = redoStack.pop();
    resumeData = JSON.parse(next);
    populateAllFormFields();
    renderAllDynamicLists();
    renderResumePreview();
    updateDesignControlsFromState();
    setupTemplateGallery();
    runResumeReview();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const btnUndo = getEl('btnUndo');
    const btnRedo = getEl('btnRedo');
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
  }

  // DOM Helpers
  const doc = typeof document !== 'undefined' ? document : null;
  const getEl = (id) => doc ? doc.getElementById(id) : null;

  /**
   * Escape HTML safely to prevent XSS
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitize URL for safe href
   */
  function sanitizeHref(url) {
    if (!url || typeof url !== 'string') return '#';
    const clean = url.trim();
    if (/[\u0000-\u001f]/.test(clean)) return '#';
    try {
      const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(clean);
      const parsed = new URL(hasProtocol ? clean : 'https://' + clean);
      return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.href : '#';
    } catch (e) { return '#'; }
  }

  /**
   * Validate URL format
   */
  function isValidUrlFormat(str) {
    if (!str) return true;
    const s = String(str).trim();
    if (/\s/.test(s)) return false;
    if (/^(javascript|data|vbscript|file):/i.test(s)) return false;
    try {
      const testUrl = s.startsWith('http://') || s.startsWith('https://') ? s : 'https://' + s;
      const u = new URL(testUrl);
      return Boolean(u.hostname && u.hostname.includes('.'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate Backup Schema (v1 or v2)
   */
  function validateResumeSchema(payload) { return SCHEMA.validate(payload); }

  /**
   * Migrate any v1 or partial data safely into v2
   */
  function migrateResumeSchema(raw) {
    if (SCHEMA && typeof SCHEMA.migrate === 'function') {
      return SCHEMA.migrate(raw);
    }
    if (typeof ApplyReadyTemplates !== 'undefined' && ApplyReadyTemplates.migrateResumeSchema) {
      return ApplyReadyTemplates.migrateResumeSchema(raw);
    }
    const src = (raw && raw.data) ? raw.data : (raw || {});
    return Object.assign(JSON.parse(JSON.stringify(EMPTY_DATA)), src, {
      personal: Object.assign({}, EMPTY_DATA.personal, src.personal || {}),
      skills: Object.assign({}, EMPTY_DATA.skills, src.skills || {}),
      design: Object.assign({}, EMPTY_DATA.design, src.design || {}),
      sectionVisibility: Object.assign({}, EMPTY_DATA.sectionVisibility, src.sectionVisibility || {})
    });
  }

  /**
   * Initialize Builder on DOM Ready
   */
  function init() {
    loadDraftFromStorage();
    setupEditorTabs();
    setupTemplateGallery();
    setupTemplatePreviewModal();
    populateAllFormFields();
    renderAllDynamicLists();
    setupDesignControls();
    updateDesignControlsFromState();
    renderResumePreview();
    attachEventListeners();
    setupAccordions();
    updatePreviewScale();
    updateUndoRedoButtons();
    runResumeReview();

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const sheet = getEl('resumeSheet'); if (sheet) visualPageCount = renderPaginatedPreview(sheet, pdfPageCount); updatePreviewScale(); });
    window.addEventListener('resize', () => { updatePreviewScale(); scaleTemplateModal(); });
    // Without device saving, a reload or closed tab would silently discard
    // the resume. Warn only when there is unsaved, non-sample work.
    window.addEventListener('beforeunload', e => {
      if (autoSaveDraft || !isDirty || isDocumentEmpty()) return;
      e.preventDefault();
      e.returnValue = '';
    });
    window.addEventListener('orientationchange', () => setTimeout(updatePreviewScale, 150));
  }

  /**
   * Load Draft from Local Storage (consented draft takes precedence)
   */
  function loadDraftFromStorage() {
    try {
      const enabled = localStorage.getItem('applyready_draft_enabled');
      const chkSaveDraft = getEl('chkSaveDraft');
      const draftStatusText = getEl('draftStatusText');

      if (enabled === 'true') {
        autoSaveDraft = true;
        if (chkSaveDraft) chkSaveDraft.checked = true;
        const saved = localStorage.getItem('applyready_resume_draft');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (validateResumeSchema(parsed)) {
            resumeData = migrateResumeSchema(parsed);
            if (draftStatusText && parsed.savedAt) {
              const d = new Date(parsed.savedAt);
              draftStatusText.textContent = `Draft restored: ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            return;
          }
          throw new Error('Saved draft is invalid');
        }
      } else {
        autoSaveDraft = false;
        if (chkSaveDraft) chkSaveDraft.checked = false;
        if (draftStatusText) draftStatusText.textContent = 'Local saving disabled';
      }
    } catch (e) {
      autoSaveDraft = false;
      const saveCheckbox = getEl('chkSaveDraft');
      if (saveCheckbox) saveCheckbox.checked = false;
      const draftStatusText = getEl('draftStatusText');
      if (draftStatusText) draftStatusText.textContent = 'Draft could not be restored. Import a backup or start a new resume.';
    }

    // Default start with clean EMPTY_DATA (placeholders will guide the user)
    resumeData = JSON.parse(JSON.stringify(EMPTY_DATA));
  }

  function saveDraftToStorage() {
    if (!autoSaveDraft) return;
    try {
      const payload = {
        version: 2,
        app: 'ApplyReady',
        savedAt: new Date().toISOString(),
        data: resumeData
      };
      localStorage.setItem('applyready_resume_draft', JSON.stringify(payload));
      const draftStatusText = getEl('draftStatusText');
      if (draftStatusText) {
        const now = new Date();
        draftStatusText.textContent = `Draft saved: Just now (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      }
    } catch (e) {
      // Storage can be blocked or full; keep the current in-memory draft.
      const draftStatusText = getEl('draftStatusText');
      if (draftStatusText) draftStatusText.textContent = 'Error saving to local storage (quota exceeded)';
    }
  }

  function deleteDraftFromStorage() {
    try {
      localStorage.removeItem('applyready_resume_draft');
      const draftStatusText = getEl('draftStatusText');
      if (draftStatusText) {
        draftStatusText.textContent = autoSaveDraft ? 'No draft saved yet' : 'Local saving disabled';
      }
    } catch (e) {}
  }

  /**
   * Setup Editor Tabs (Content, Design, Review)
   */
  function setupEditorTabs() {
    const tabs = [
      { btn: getEl('tabContent'), pane: getEl('viewContent') },
      { btn: getEl('tabDesign'), pane: getEl('viewDesign') },
      { btn: getEl('tabReview'), pane: getEl('viewReview') }
    ];

    tabs.forEach(({ btn, pane }) => {
      if (!btn || !pane) return;
      btn.addEventListener('click', () => {
        tabs.forEach(t => {
          if (t.btn) {
            t.btn.classList.remove('active');
            t.btn.setAttribute('aria-selected', 'false');
          }
          if (t.pane) t.pane.classList.remove('active');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        pane.classList.add('active');

        if (btn.id === 'tabReview') {
          runResumeReview();
        }
      });
    });
  }

  let modalTriggerElement = null;
  let activeModalTemplateId = null;

  function isDocumentEmpty() {
    const hasText = value => typeof value === 'string' ? !!value.trim()
      : Array.isArray(value) ? value.some(hasText)
      : value && typeof value === 'object' ? Object.keys(value).some(key => key !== 'id' && hasText(value[key])) : false;
    return !hasText({ personal: resumeData.personal, summary: resumeData.summary, experience: resumeData.experience, education: resumeData.education, projects: resumeData.projects, skills: resumeData.skills, certifications: resumeData.certifications, achievements: resumeData.achievements, volunteering: resumeData.volunteering, languages: resumeData.languages, academic: resumeData.academic });
  }

  function newEntryId(prefix) {
    return prefix + '-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  }

  function renderResumeDataToHTML(data, templateId) {
    const p = data.personal || {};
    const style = TPL.getTemplateStyle(templateId);
    const pdfApi = (typeof window !== 'undefined' && window.ApplyReadyPDF) || (typeof require === 'function' ? require('./pdf-engine.js') : null);
    const bulletLines = pdfApi ? pdfApi.bulletLines : text => String(text || '').split(/\r?\n|\r/).map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
    const optionalEntries = pdfApi ? pdfApi.optionalEntries : () => [];
    const vis = data.sectionVisibility || {};
    const visible = key => vis[key] !== false;
    const t = value => (typeof value === 'string' ? value.trim() : '');
    const heading = text => `<h3 class="resume-section-title">${escapeHTML(text)}</h3>`;
    const bulletList = items => items.length ? `<ul class="resume-bullets">${items.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>` : '';
    const entryHeader = (left, right) => {
      if (!left && !right) return '';
      return `<div class="resume-entry-header">${left ? `<span>${left}</span>` : ''}${right ? `<span class="resume-entry-meta">${right}</span>` : ''}</div>`;
    };

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
      sections.summary = `<section class="resume-section">${heading(TPL.getSectionTitle(data, templateId, 'summary'))}<p class="resume-summary">${escapeHTML(summaryText)}</p></section>`;
    }

    const exp = (data.experience || []).filter(x => x && (t(x.role) || t(x.company) || t(x.duration) || t(x.location) || bulletLines(x.bulletsText).length));
    if (exp.length && visible('experience')) {
      const items = exp.map(item => `<div class="resume-entry">${entryHeader(escapeHTML([t(item.role), t(item.company)].filter(Boolean).join(' | ')), escapeHTML([t(item.duration), t(item.location)].filter(Boolean).join(' • ')))}${bulletList(bulletLines(item.bulletsText))}</div>`).join('');
      sections.experience = `<section class="resume-section">${heading(TPL.getSectionTitle(data, templateId, 'experience'))}<div>${items}</div></section>`;
    }

    const edu = (data.education || []).filter(x => x && (t(x.degree) || t(x.institution) || t(x.duration) || t(x.location) || t(x.score)));
    if (edu.length && visible('education')) {
      const items = edu.map(item => `<div class="resume-entry">${entryHeader(escapeHTML([t(item.degree), t(item.institution)].filter(Boolean).join(' — ')), escapeHTML([t(item.duration), t(item.location), t(item.score)].filter(Boolean).join(' • ')))}</div>`).join('');
      sections.education = `<section class="resume-section">${heading(TPL.getSectionTitle(data, templateId, 'education'))}<div>${items}</div></section>`;
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
      sections.projects = `<section class="resume-section">${heading(TPL.getSectionTitle(data, templateId, 'projects'))}<div>${items}</div></section>`;
    }

    const s = data.skills || {};
    const skillLabels = TPL.getSkillLabels(templateId, data);
    const skillRows = Array.isArray(s.categories)
      ? s.categories.filter(c => c && t(c.name) && t(c.items)).map(c => ({ label: t(c.name).replace(/:\s*$/, ''), val: t(c.items) }))
      : ['languages', 'frameworks', 'tools', 'other'].filter(key => t(s[key])).map(key => ({ label: String(skillLabels[key] || '').replace(/:\s*$/, ''), val: t(s[key]) }));
    if (skillRows.length && visible('skills')) {
      sections.skills = `<section class="resume-section">${heading(TPL.getSectionTitle(data, templateId, 'skills'))}<div>${skillRows.map(r => `<div class="resume-skills-row"><span class="skills-category">${escapeHTML(r.label)}: </span><span>${escapeHTML(r.val)}</span></div>`).join('')}</div></section>`;
    }

    for (const key of ['certifications', 'achievements', 'volunteering']) {
      const lines = optionalEntries(data, key);
      if (lines.length && visible(key)) sections[key] = `<section class="resume-section">${heading(TPL.getSectionLabel(templateId, key))}<div>${lines.map(line => `<div class="resume-entry resume-list-entry">${escapeHTML(line)}</div>`).join('')}</div></section>`;
    }
    const langs = optionalEntries(data, 'languages');
    if (langs.length && visible('languages')) sections.languages = `<section class="resume-section">${heading(TPL.getSectionLabel(templateId, 'languages'))}<p class="resume-summary">${escapeHTML(langs.join(' • '))}</p></section>`;
    if (visible('academic')) {
      sections.academic = ['publications', 'teaching', 'presentations', 'grants'].map(key => {
        const lines = optionalEntries(data, key);
        return lines.length ? `<section class="resume-section">${heading(TPL.getSectionLabel(templateId, key))}<div>${lines.map(line => `<div class="resume-entry resume-list-entry">${escapeHTML(line)}</div>`).join('')}</div></section>` : '';
      }).join('');
    }

    const order = SCHEMA.normalizeSectionOrder(data.design && data.design.sectionOrder);
    const orderedHtml = order.map(k => sections[k] || '').join('');
    const name = t(p.fullName) || 'YOUR NAME';

    return `
      <header class="resume-header">
        <h1 class="resume-name">${escapeHTML(style.nameCase === 'upper' ? name.toUpperCase() : name)}</h1>
        ${t(p.targetTitle) ? `<div class="resume-target-title">${escapeHTML(t(p.targetTitle))}</div>` : ''}
        ${contactHtml ? `<div class="resume-contact-line">${contactHtml}</div>` : ''}
      </header>
      <div>${orderedHtml}</div>
    `;
  }

  function renderTemplateIntoContainer(sheet, templateId, data) {
    const tmpl = TEMPLATES[templateId] || TEMPLATES['classic-professional'];
    const style = TPL.getTemplateStyle(templateId);
    const fontClass = ((data.design && data.design.fontFamily) || tmpl.fontFamily) === 'sans' ? 'font-sans' : 'font-serif';
    const density = (data.design && data.design.density) || tmpl.density || 'standard';
    const fontSize = (data.design && data.design.fontSize) || 'standard';
    const pageSize = (data.design && data.design.pageSize) || 'a4';
    const sourceClass = sheet.id === 'resumeSheet' ? ' resume-source-sheet' : '';
    const styleClasses = [`header-${style.headerAlign}`, `header-rule-${style.headerRule}`, `heading-rule-${style.headingRule}`, `dates-${style.datePlacement}`].join(' ');

    sheet.className = `ats-resume-sheet template-${templateId} page-${pageSize} density-${density} font-size-${fontSize} ${fontClass} ${styleClasses}${sourceClass}`;
    sheet.style.setProperty('--resume-heading-color', '#' + style.headingHex);
    sheet.style.setProperty('--resume-rule-color', '#' + style.ruleHex);
    sheet.style.setProperty('--resume-header-rule-color', '#' + style.headerRuleHex);
    sheet.style.setProperty('--resume-link-color', '#' + style.linkHex);
    sheet.style.setProperty('--resume-meta-color', '#' + style.metaHex);
    sheet.innerHTML = renderResumeDataToHTML(data, templateId);
  }

  // Share PDF line positions and page breaks with the live preview. SVG text
  // stays selectable and prints sharply, with no browser-dependent reflow.
  function buildVectorPage(layout, fontFamily) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.fontFamily = fontFamily === 'sans' ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif';
    layout.elements.forEach(item => {
      const node = document.createElementNS(ns, item.type === 'text' ? 'text' : 'line');
      const color = `rgb(${item.color.map(value => Math.round(value * 255)).join(',')})`;
      if (item.type === 'text') {
        node.textContent = item.text;
        for (const attr of ['x', 'y']) node.setAttribute(attr, item[attr]);
        node.setAttribute('font-size', item.fontSize);
        node.setAttribute('font-weight', item.fontStyle === 'bold' ? '700' : '400');
        node.setAttribute('font-style', item.fontStyle === 'italic' ? 'italic' : 'normal');
        node.setAttribute('fill', color);
        node.setAttribute('xml:space', 'preserve');
        if (item.width > 0) {
          node.setAttribute('textLength', item.width);
          node.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        }
      } else {
        for (const attr of ['x1', 'y1', 'x2', 'y2']) node.setAttribute(attr, item[attr]);
        node.setAttribute('stroke', color);
        node.setAttribute('stroke-width', item.lineWidth);
      }
      svg.appendChild(node);
    });
    return svg;
  }

  function renderVectorPreview(doc, source) {
    const target = getEl('resumeVisualPages');
    target.replaceChildren();
    const pageClass = Array.from(source.classList).filter(name => name !== 'resume-source-sheet').join(' ');
    doc.pages.forEach((layout, index) => {
      const page = document.createElement('article');
      page.className = `${pageClass} resume-visual-page resume-vector-page`;
      page.dataset.previewPage = String(index + 1);
      page.setAttribute('aria-label', `Resume page ${index + 1} of ${doc.pages.length}`);
      page.appendChild(buildVectorPage(layout, doc.fontFamily));
      target.appendChild(page);
    });
    target.dataset.pageCount = String(doc.pages.length);
    return doc.pages.length;
  }

  function renderPaginatedPreview(source) {
    const target = getEl('resumeVisualPages');
    if (!source || !target) return 1;
    target.innerHTML = '';

    const pageClass = Array.from(source.classList).filter(name => name !== 'resume-source-sheet').join(' ');
    const sourceHeader = source.querySelector(':scope > .resume-header');
    const sectionsRoot = source.querySelector(':scope > div');
    const sourceSections = sectionsRoot
      ? Array.from(sectionsRoot.children).filter(node => node.classList && node.classList.contains('resume-section'))
      : [];
    const pages = [];

    function createPage(includeHeader) {
      const page = document.createElement('article');
      page.className = `${pageClass} resume-visual-page`;
      page.dataset.previewPage = String(pages.length + 1);
      if (includeHeader && sourceHeader) page.appendChild(sourceHeader.cloneNode(true));

      const sections = document.createElement('div');
      sections.className = 'resume-page-sections';
      page.appendChild(sections);
      target.appendChild(page);

      const record = { page, sections };
      pages.push(record);
      return record;
    }

    function isOverflowing(page) {
      return page.scrollHeight > page.clientHeight + 2;
    }

    function sectionParts(original) {
      const children = Array.from(original.children);
      const title = children.find(node => node.classList && node.classList.contains('resume-section-title')) || null;
      const bodyNodes = children.filter(node => node !== title);

      if (bodyNodes.length === 1 && bodyNodes[0].tagName === 'DIV' && bodyNodes[0].children.length) {
        return { title, wrapper: bodyNodes[0], units: Array.from(bodyNodes[0].children) };
      }
      return { title, wrapper: null, units: bodyNodes };
    }

    function makeChunk(original, includeTitle) {
      const parts = sectionParts(original);
      const shell = original.cloneNode(false);
      if (includeTitle && parts.title) shell.appendChild(parts.title.cloneNode(true));

      let holder = shell;
      if (parts.wrapper) {
        const wrapper = parts.wrapper.cloneNode(false);
        shell.appendChild(wrapper);
        holder = wrapper;
      }
      return { shell, holder, units: parts.units };
    }

    let current = createPage(true);

    function appendSplitSection(original) {
      const parts = sectionParts(original);
      if (!parts.units.length) {
        const clone = original.cloneNode(true);
        current.sections.appendChild(clone);
        if (isOverflowing(current.page) && current.sections.children.length > 1) {
          current.sections.removeChild(clone);
          current = createPage(false);
          current.sections.appendChild(clone);
        }
        return;
      }

      let chunk = makeChunk(original, true);
      current.sections.appendChild(chunk.shell);

      const first = parts.units[0].cloneNode(true);
      chunk.holder.appendChild(first);

      // Keep a section title with its first content item. Only move to a new
      // sheet when that pair cannot fit in the remaining space.
      if (isOverflowing(current.page) && (current.sections.children.length > 1 || current.page.querySelector('.resume-header'))) {
        current.sections.removeChild(chunk.shell);
        current = createPage(false);
        chunk = makeChunk(original, true);
        current.sections.appendChild(chunk.shell);
        chunk.holder.appendChild(first);
      }

      for (let i = 1; i < parts.units.length; i++) {
        const unit = parts.units[i].cloneNode(true);
        chunk.holder.appendChild(unit);

        if (!isOverflowing(current.page)) continue;

        chunk.holder.removeChild(unit);
        current = createPage(false);
        chunk = makeChunk(original, false);
        current.sections.appendChild(chunk.shell);
        chunk.holder.appendChild(unit);
      }
    }

    sourceSections.forEach(section => {
      const whole = section.cloneNode(true);
      current.sections.appendChild(whole);
      if (!isOverflowing(current.page)) return;

      current.sections.removeChild(whole);
      appendSplitSection(section);
    });

    pages.forEach((record, index) => {
      record.page.setAttribute('aria-label', `Resume page ${index + 1} of ${pages.length}`);
    });
    target.dataset.pageCount = String(pages.length);
    return pages.length;
  }

  function openTemplatePreviewModal(templateId, triggerBtn) {
    const modal = getEl('templatePreviewModal');
    const sheet = getEl('tmplModalPreviewSheet');
    const title = getEl('tmplModalTitle');
    const tmpl = TEMPLATES[templateId];
    if (!modal || !sheet || !tmpl) return;

    modalTriggerElement = triggerBtn || document.activeElement;
    activeModalTemplateId = templateId;

    if (title) {
      title.textContent = `${tmpl.name} — Full Template Preview`;
    }

    const sample = SCHEMA.migrate(SAMPLE_DATA);
    sample.template = templateId;
    sample.design.templateId = templateId;
    sample.design.fontFamily = tmpl.fontFamily;
    sample.design.density = tmpl.density || 'standard';
    sample.design.pageSize = resumeData.design.pageSize || 'a4';
    sample.design.sectionOrder = SCHEMA.normalizeSectionOrder(tmpl.recommendedOrder);
    Object.assign(sample.sectionVisibility, tmpl.defaultVisibility || {});
    // Draw the first page with the export engine so the preview is the download.
    try {
      const doc = window.ApplyReadyPDF.generateResumePDF(sample);
      sheet.className = `ats-resume-sheet page-${sample.design.pageSize} resume-vector-page template-modal-page`;
      sheet.style.height = sample.design.pageSize === 'letter' ? '11in' : '297mm';
      sheet.replaceChildren(buildVectorPage(doc.pages[0], doc.fontFamily));
    } catch (e) {
      sheet.style.height = '';
      renderTemplateIntoContainer(sheet, templateId, sample);
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    getEl('mainContent').inert = true;
    document.querySelector('.navbar').inert = true;
    document.querySelector('.site-footer').inert = true;
    scaleTemplateModal();

    const closeBtn = getEl('btnCloseTmplModal');
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function scaleTemplateModal() {
    const modal = getEl('templatePreviewModal');
    const sheet = getEl('tmplModalPreviewSheet');
    if (!modal || modal.classList.contains('hidden')) return;
    let wrapper = getEl('tmplModalPreviewWrapper');
    if (!wrapper) {
      wrapper = document.createElement('div'); wrapper.id = 'tmplModalPreviewWrapper';
      sheet.parentElement.insertBefore(wrapper, sheet); wrapper.appendChild(sheet);
    }
    const available = modal.querySelector('.template-preview-modal-body').clientWidth - 40;
    const scale = Math.min(1, Math.max(.05, available / sheet.offsetWidth));
    wrapper.style.width = `${sheet.offsetWidth * scale}px`;
    wrapper.style.height = `${sheet.offsetHeight * scale}px`;
    wrapper.style.flexShrink = '0';
    sheet.style.transform = `scale(${scale})`;
    sheet.style.margin = '0';
  }

  function closeTemplatePreviewModal() {
    const modal = getEl('templatePreviewModal');
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    document.body.style.overflow = '';
    getEl('mainContent').inert = false;
    document.querySelector('.navbar').inert = false;
    document.querySelector('.site-footer').inert = false;

    if (modalTriggerElement && typeof modalTriggerElement.focus === 'function') {
      modalTriggerElement.focus();
    }
    modalTriggerElement = null;
    activeModalTemplateId = null;
  }

  function setupTemplatePreviewModal() {
    const modal = getEl('templatePreviewModal');
    const btnClose = getEl('btnCloseTmplModal');
    const btnCloseFooter = getEl('btnCloseTmplModalFooter');
    const btnUse = getEl('btnUseTmplModal');

    if (btnClose) btnClose.addEventListener('click', closeTemplatePreviewModal);
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeTemplatePreviewModal);
    if (btnUse) {
      btnUse.addEventListener('click', () => {
        if (activeModalTemplateId) {
          selectTemplate(activeModalTemplateId);
        }
        closeTemplatePreviewModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeTemplatePreviewModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && modal && !modal.classList.contains('hidden')) {
        const buttons = Array.from(modal.querySelectorAll('button:not(:disabled)'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape') {
        const modal = getEl('templatePreviewModal');
        if (modal && !modal.classList.contains('hidden')) {
          closeTemplatePreviewModal();
        }
      }
    });
  }

  function restoreListFocus(listId, targetId, preferredAction, fallbackAddBtnId) {
    setTimeout(() => {
      const list = getEl(listId);
      if (!list) return;
      if (targetId) {
        const item = list.querySelector(`.dynamic-item[data-id="${targetId}"]`);
        if (item) {
          const btn = item.querySelector(`button[data-action="${preferredAction}"]`) || item.querySelector('button');
          if (btn && !btn.disabled) {
            btn.focus();
            return;
          }
        }
      }
      const addBtn = getEl(fallbackAddBtnId);
      if (addBtn) addBtn.focus();
    }, 20);
  }

  function restoreRemoveFocus(listId, prevIdx, fallbackAddBtnId) {
    setTimeout(() => {
      const list = getEl(listId);
      if (!list) return;
      const items = list.querySelectorAll('.dynamic-item');
      if (items.length > 0) {
        const targetItem = items[Math.min(prevIdx, items.length - 1)];
        const btn = targetItem ? targetItem.querySelector('button[data-action*="remove"]') || targetItem.querySelector('button') : null;
        if (btn) {
          btn.focus();
          return;
        }
      }
      const addBtn = getEl(fallbackAddBtnId);
      if (addBtn) addBtn.focus();
    }, 20);
  }

  /**
   * Setup Template Gallery in Design Tab
   */
  let activeTemplateGroup = 'all';
  function renderTemplateFilters() {
    const bar = getEl('templateFilterBar');
    if (!bar || !TPL.TEMPLATE_GROUPS) return;
    bar.replaceChildren();
    TPL.TEMPLATE_GROUPS.forEach(group => {
      const count = group.id === 'all' ? Object.keys(TEMPLATES).length : Object.values(TEMPLATES).filter(t => t.group === group.id).length;
      if (!count) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = `${group.name} (${count})`;
      btn.setAttribute('aria-pressed', String(group.id === activeTemplateGroup));
      btn.addEventListener('click', () => {
        activeTemplateGroup = group.id;
        renderTemplateFilters();
        applyTemplateFilter();
      });
      bar.appendChild(btn);
    });
  }
  function applyTemplateFilter() {
    document.querySelectorAll('#templateGalleryGrid .template-card').forEach(card => {
      const tmpl = TEMPLATES[card.dataset.templateId];
      card.hidden = activeTemplateGroup !== 'all' && tmpl && tmpl.group !== activeTemplateGroup && card.dataset.templateId !== resumeData.template;
    });
  }

  function setupTemplateGallery() {
    const galleryGrid = getEl('templateGalleryGrid');
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';
    renderTemplateFilters();

    const templateKeys = Object.keys(TEMPLATES);
    templateKeys.forEach(key => {
      const tmpl = TEMPLATES[key];
      const card = document.createElement('div');
      card.className = `template-card ${resumeData.template === key ? 'active' : ''}`;
      card.dataset.templateId = key;

      const svgThumb = tmpl.svgThumbnail || `<div style="padding: 1rem; color: #94A3B8;">${tmpl.name}</div>`;

      card.innerHTML = `
        <div class="template-thumb-wrap">
          ${svgThumb}
        </div>
        <div class="template-meta-row">
          <strong class="template-card-title">${escapeHTML(tmpl.name)}</strong>
          <span class="template-badge">${escapeHTML(tmpl.badge || 'ATS')}</span>
        </div>
        <p class="template-card-desc">${escapeHTML(tmpl.description)}</p>
        <div class="template-card-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-preview-template" data-template="${key}" title="Full preview of ${escapeHTML(tmpl.name)}" aria-label="Full preview of ${escapeHTML(tmpl.name)}">
            <i aria-hidden="true" class="fa-regular fa-eye"></i> Preview
          </button>
          <button type="button" class="btn ${resumeData.template === key ? 'btn-primary' : 'btn-outline-primary'} btn-sm btn-select-template" data-template="${key}" aria-label="Use ${escapeHTML(tmpl.name)} template" aria-pressed="${resumeData.template === key}">
            ${resumeData.template === key ? '<i aria-hidden="true" class="fa-solid fa-check"></i> Active' : 'Use'}
          </button>
        </div>
      `;

      const btnPreview = card.querySelector('.btn-preview-template');
      if (btnPreview) {
        btnPreview.addEventListener('click', () => {
          openTemplatePreviewModal(key, btnPreview);
        });
      }

      const btnSelect = card.querySelector('.btn-select-template');
      if (btnSelect) {
        btnSelect.addEventListener('click', () => {
          selectTemplate(key);
        });
      }

      galleryGrid.appendChild(card);
    });
    applyTemplateFilter();
  }

  /**
   * Select Template without losing ANY content or drafts
   */
  function selectTemplate(templateId) {
    if (!TEMPLATES[templateId]) return;
    pushHistoryState();

    resumeData.template = templateId;
    resumeData.design.templateId = templateId;
    const tmpl = TEMPLATES[templateId];

    // Automatically set default typography & density associated with template
    if (tmpl.fontFamily) resumeData.design.fontFamily = tmpl.fontFamily;
    if (tmpl.density) resumeData.design.density = tmpl.density;

    const btnApplyRecommended = getEl('btnApplyRecommendedOrder');

    if (tmpl.recommendedOrder && Array.isArray(tmpl.recommendedOrder)) {
      if (isDocumentEmpty()) {
        // Automatically apply recommended order for new empty documents
        resumeData.design.sectionOrder = SCHEMA.normalizeSectionOrder(tmpl.recommendedOrder);
        if (btnApplyRecommended) btnApplyRecommended.classList.add('hidden');
      } else {
        // Document has content: do not overwrite user's section order silently.
        const currentOrder = resumeData.design.sectionOrder || [];
        const isDifferent = JSON.stringify(currentOrder) !== JSON.stringify(tmpl.recommendedOrder);
        if (btnApplyRecommended) {
          if (isDifferent) {
            btnApplyRecommended.classList.remove('hidden');
            btnApplyRecommended.innerHTML = `<i aria-hidden="true" class="fa-solid fa-arrows-rotate"></i> Apply ${escapeHTML(tmpl.name)}'s Recommended Section Order`;
            btnApplyRecommended.onclick = () => {
              pushHistoryState();
              resumeData.design.sectionOrder = SCHEMA.normalizeSectionOrder(tmpl.recommendedOrder);
              renderSectionOrderControls();
              renderResumePreview();
              btnApplyRecommended.classList.add('hidden');
            };
          } else {
            btnApplyRecommended.classList.add('hidden');
          }
        }
      }
    } else if (btnApplyRecommended) {
      btnApplyRecommended.classList.add('hidden');
    }

    // Update gallery UI active states
    document.querySelectorAll('.template-card').forEach(c => {
      const isCurrent = c.dataset.templateId === templateId;
      c.classList.toggle('active', isCurrent);
      const btn = c.querySelector('.btn-select-template');
      if (btn) {
        btn.className = `btn ${isCurrent ? 'btn-primary' : 'btn-outline-primary'} btn-sm btn-select-template`;
        btn.setAttribute('aria-pressed', String(isCurrent));
        btn.innerHTML = isCurrent ? '<i aria-hidden="true" class="fa-solid fa-check"></i> Active' : 'Use';
      }
    });

    updateDesignControlsFromState();
    updateTemplateFieldLabels();
    renderResumePreview();
    runResumeReview();
  }

  /**
   * Populate All Form Input Fields from State
   */
  function populateAllFormFields() {
    const p = resumeData.personal || {};
    if (getEl('fullName')) getEl('fullName').value = p.fullName || '';
    if (getEl('targetTitle')) getEl('targetTitle').value = p.targetTitle || '';
    if (getEl('email')) getEl('email').value = p.email || '';
    if (getEl('phone')) getEl('phone').value = p.phone || '';
    if (getEl('location')) getEl('location').value = p.location || '';
    if (getEl('linkedin')) getEl('linkedin').value = p.linkedin || '';
    if (getEl('github')) getEl('github').value = p.github || '';
    if (getEl('website')) getEl('website').value = p.website || '';
    if (getEl('summaryText')) getEl('summaryText').value = resumeData.summary || '';

    const s = resumeData.skills || {};
    if (getEl('skillLanguages')) getEl('skillLanguages').value = s.languages || '';
    if (getEl('skillFrameworks')) getEl('skillFrameworks').value = s.frameworks || '';
    if (getEl('skillTools')) getEl('skillTools').value = s.tools || '';
    if (getEl('skillOther')) getEl('skillOther').value = s.other || '';
    updateTemplateFieldLabels();
  }

  // Section headings and skill row labels follow the active template unless
  // the person has typed their own heading.
  function updateTemplateFieldLabels() {
    ['summary', 'experience', 'education', 'projects', 'skills'].forEach(key => {
      const input = getEl(key + 'TitleInput');
      if (!input || document.activeElement === input) return;
      input.value = TPL.getSectionTitle(resumeData, resumeData.template, key);
      input.placeholder = TPL.getSectionLabel(resumeData.template, key);
    });
    ['certifications', 'achievements', 'volunteering', 'languages'].forEach(key => {
      const text = TPL.getSectionLabel(resumeData.template, key);
      const header = document.querySelector(`#sec-${key} .accordion-header > span`);
      if (header && header.lastChild && header.lastChild.nodeType === 3) header.lastChild.textContent = ' ' + text;
      const option = document.querySelector(`#optionalSectionSelect option[value="${key}"]`);
      if (option) option.textContent = text;
    });
    const labels = TPL.getSkillLabels(resumeData.template, resumeData);
    const defaults = TPL.getSkillLabels(resumeData.template);
    const custom = resumeData.skillLabels || {};
    Object.keys(labels).forEach(key => {
      const label = getEl('skill-label-' + key);
      if (label) label.textContent = labels[key];
      const input = document.querySelector(`.skill-label-input[data-skill="${key}"]`);
      if (input) {
        if (document.activeElement !== input) input.value = custom[key] || '';
        input.placeholder = 'Rename label (optional)';
        input.title = `Leave empty to use “${defaults[key]}”`;
        input.setAttribute('aria-label', `Row label, currently ${labels[key]}`);
      }
    });
  }

  /**
   * Render All Dynamic List Sections (Experience, Education, Projects, Optional)
   */
  function renderAllDynamicLists() {
    renderExperienceList();
    renderEducationList();
    renderProjectsList();
    renderOptionalSections();
  }

  function renderExperienceList() {
    const list = getEl('experienceList');
    if (!list) return;
    list.innerHTML = '';

    (resumeData.experience || []).forEach((exp, index) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.dataset.id = exp.id;
      el.innerHTML = `
        <div class="dynamic-item-header">
          <strong style="font-size: 0.85rem;">#${index + 1} Role / Company</strong>
          <div class="dynamic-item-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-up-exp" data-id="${exp.id}" title="Move Up" aria-label="Move entry ${index + 1} up" ${index === 0 ? 'disabled' : ''}>
              <i aria-hidden="true" class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-down-exp" data-id="${exp.id}" title="Move Down" aria-label="Move entry ${index + 1} down" ${index === resumeData.experience.length - 1 ? 'disabled' : ''}>
              <i aria-hidden="true" class="fa-solid fa-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate-exp" data-id="${exp.id}" title="Duplicate Entry" aria-label="Duplicate entry ${index + 1}">
              <i aria-hidden="true" class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-exp" data-id="${exp.id}" title="Delete Entry" aria-label="Delete Entry">
              <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="form-row-2" style="margin-bottom: 0.5rem;">
          <div>
            <label class="form-label text-sm" for="exp-role-${exp.id}">Job Title / Role</label>
            <input type="text" id="exp-role-${exp.id}" class="form-control item-role" placeholder="e.g. Operations Coordinator" value="${escapeHTML(exp.role)}">
          </div>
          <div>
            <label class="form-label text-sm" for="exp-comp-${exp.id}">Company / Organization</label>
            <input type="text" id="exp-comp-${exp.id}" class="form-control item-company" placeholder="e.g. Acme Corp" value="${escapeHTML(exp.company)}">
          </div>
        </div>
        <div class="form-row-2" style="margin-bottom: 0.5rem;">
          <div>
            <label class="form-label text-sm" for="exp-dur-${exp.id}">Duration / Dates</label>
            <input type="text" id="exp-dur-${exp.id}" class="form-control item-duration" placeholder="e.g. Jan 2022 - Present" value="${escapeHTML(exp.duration)}">
          </div>
          <div>
            <label class="form-label text-sm" for="exp-loc-${exp.id}">Location</label>
            <input type="text" id="exp-loc-${exp.id}" class="form-control item-location" placeholder="e.g. Chicago, IL" value="${escapeHTML(exp.location)}">
          </div>
        </div>
        <div>
          <label class="form-label text-sm" for="exp-bul-${exp.id}">Key Responsibilities & Measurable Impact (One bullet per line)</label>
          <textarea id="exp-bul-${exp.id}" class="form-control item-bullets" rows="3" placeholder="Enter achievements (one bullet per line)...">${escapeHTML(exp.bulletsText)}</textarea>
        </div>
      `;
      list.appendChild(el);
    });
  }

  function renderEducationList() {
    const list = getEl('educationList');
    if (!list) return;
    list.innerHTML = '';

    (resumeData.education || []).forEach((edu, index) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.dataset.id = edu.id;
      el.innerHTML = `
        <div class="dynamic-item-header">
          <strong style="font-size: 0.85rem;">#${index + 1} Degree / School</strong>
          <div class="dynamic-item-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-up-edu" data-id="${edu.id}" title="Move Up" aria-label="Move entry ${index + 1} up" ${index === 0 ? 'disabled' : ''}>
              <i aria-hidden="true" class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-down-edu" data-id="${edu.id}" title="Move Down" aria-label="Move entry ${index + 1} down" ${index === resumeData.education.length - 1 ? 'disabled' : ''}>
              <i aria-hidden="true" class="fa-solid fa-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate-edu" data-id="${edu.id}" title="Duplicate Entry" aria-label="Duplicate entry ${index + 1}">
              <i aria-hidden="true" class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-edu" data-id="${edu.id}" title="Delete Entry" aria-label="Delete Entry">
              <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="form-row-2" style="margin-bottom: 0.5rem;">
          <div>
            <label class="form-label text-sm" for="edu-deg-${edu.id}">Degree / Field of Study</label>
            <input type="text" id="edu-deg-${edu.id}" class="form-control item-degree" placeholder="e.g. B.S. in Management" value="${escapeHTML(edu.degree)}">
          </div>
          <div>
            <label class="form-label text-sm" for="edu-inst-${edu.id}">Institution / School</label>
            <input type="text" id="edu-inst-${edu.id}" class="form-control item-institution" placeholder="e.g. University Name" value="${escapeHTML(edu.institution)}">
          </div>
        </div>
        <div class="form-row-3">
          <div>
            <label class="form-label text-sm" for="edu-dur-${edu.id}">Dates / Years</label>
            <input type="text" id="edu-dur-${edu.id}" class="form-control item-duration" placeholder="e.g. 2018 - 2022" value="${escapeHTML(edu.duration)}">
          </div>
          <div>
            <label class="form-label text-sm" for="edu-loc-${edu.id}">Location</label>
            <input type="text" id="edu-loc-${edu.id}" class="form-control item-location" placeholder="e.g. Chicago, IL" value="${escapeHTML(edu.location)}">
          </div>
          <div>
            <label class="form-label text-sm" for="edu-score-${edu.id}">GPA / Honors (Optional)</label>
            <input type="text" id="edu-score-${edu.id}" class="form-control item-score" placeholder="e.g. GPA: 3.8 / 4.0" value="${escapeHTML(edu.score)}">
          </div>
        </div>
      `;
      list.appendChild(el);
    });
  }

  function renderProjectsList() {
    const list = getEl('projectsList');
    if (!list) return;
    list.innerHTML = '';

    (resumeData.projects || []).forEach((proj, index) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.dataset.id = proj.id;
      el.innerHTML = `
        <div class="dynamic-item-header">
          <strong style="font-size: 0.85rem;">#${index + 1} Project</strong>
          <div class="dynamic-item-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-up-proj" data-id="${proj.id}" title="Move Up" aria-label="Move entry ${index + 1} up" ${index === 0 ? 'disabled' : ''}>
              <i aria-hidden="true" class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-down-proj" data-id="${proj.id}" title="Move Down" aria-label="Move entry ${index + 1} down" ${index === resumeData.projects.length - 1 ? 'disabled' : ''}>
              <i aria-hidden="true" class="fa-solid fa-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate-proj" data-id="${proj.id}" title="Duplicate Entry" aria-label="Duplicate entry ${index + 1}">
              <i aria-hidden="true" class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-proj" data-id="${proj.id}" title="Delete Entry" aria-label="Delete Entry">
              <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="form-row-2" style="margin-bottom: 0.5rem;">
          <div>
            <label class="form-label text-sm" for="proj-name-${proj.id}">Project Name</label>
            <input type="text" id="proj-name-${proj.id}" class="form-control item-name" placeholder="e.g. Enterprise Automation" value="${escapeHTML(proj.name)}">
          </div>
          <div>
            <label class="form-label text-sm" for="proj-tech-${proj.id}">Tools & Methodologies</label>
            <input type="text" id="proj-tech-${proj.id}" class="form-control item-tech" placeholder="e.g. Jira, Tableau, SAP" value="${escapeHTML(proj.tech)}">
          </div>
        </div>
        <div style="margin-bottom: 0.5rem;">
          <label class="form-label text-sm" for="proj-link-${proj.id}">Link / Case Study URL (Optional)</label>
          <input type="text" id="proj-link-${proj.id}" class="form-control item-link" placeholder="e.g. portfolio.com/case-study" value="${escapeHTML(proj.link)}">
        </div>
        <div>
          <label class="form-label text-sm" for="proj-bul-${proj.id}">Key Contributions & Outcomes (One bullet per line)</label>
          <textarea id="proj-bul-${proj.id}" class="form-control item-bullets" rows="2" placeholder="Key outcomes or impact metrics...">${escapeHTML(proj.bulletsText)}</textarea>
        </div>
      `;
      list.appendChild(el);
    });
  }

  function labelOptionalFields() {
    const labels = { 'item-cert-name': 'Certification name', 'item-cert-issuer': 'Issuing body', 'item-cert-year': 'Certification year', 'item-ach-text': 'Achievement', 'item-vol-role': 'Volunteer role', 'item-vol-org': 'Volunteer organization', 'item-vol-dur': 'Volunteer dates', 'item-lang-name': 'Language', 'item-lang-prof': 'Language proficiency', 'item-pub-text': 'Publication citation', 'item-teach-role': 'Teaching role or course', 'item-teach-inst': 'Teaching institution', 'item-teach-term': 'Teaching term', 'item-pres-title': 'Presentation title', 'item-pres-event': 'Presentation event', 'item-grant-title': 'Grant title', 'item-grant-funder': 'Grant funding body', 'item-grant-year': 'Grant year' };
    document.querySelectorAll('#optionalSectionsArea .form-control').forEach(input => {
      const key = Object.keys(labels).find(key => input.classList.contains(key));
      if (key) {
        input.id = `${key}-${input.dataset.index}`;
        input.setAttribute('aria-label', labels[key]);
        const label = input.parentElement.querySelector('label');
        if (label) label.htmlFor = input.id;
      }
    });
    document.querySelectorAll('#optionalSectionsArea button[data-action]').forEach(button => {
      button.setAttribute('aria-label', `Remove ${button.dataset.action.replace('remove-', '')} entry ${Number(button.dataset.index) + 1}`);
    });
  }

  function renderOptionalSections() {
    const vis = resumeData.sectionVisibility || {};

    // Certifications
    const secCert = getEl('sec-certifications');
    if (secCert) {
      secCert.style.display = vis.certifications ? 'block' : 'none';
      const list = getEl('certificationsList');
      if (list) {
        list.innerHTML = '';
        (resumeData.certifications || []).forEach((c, idx) => {
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div class="dynamic-item-header">
              <strong style="font-size: 0.85rem;">Certification #${idx + 1}</strong>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-cert" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <div class="form-row-3">
              <div style="flex: 2;">
                <label class="form-label text-sm">Certification Name</label>
                <input type="text" class="form-control item-cert-name" value="${escapeHTML(c.name || c.title)}" data-index="${idx}">
              </div>
              <div style="flex: 2;">
                <label class="form-label text-sm">Issuing Body</label>
                <input type="text" class="form-control item-cert-issuer" value="${escapeHTML(c.issuer)}" data-index="${idx}">
              </div>
              <div style="flex: 1;">
                <label class="form-label text-sm">Year</label>
                <input type="text" class="form-control item-cert-year" value="${escapeHTML(c.year || c.date)}" data-index="${idx}">
              </div>
            </div>
          `;
          list.appendChild(item);
        });
      }
    }

    // Achievements
    const secAch = getEl('sec-achievements');
    if (secAch) {
      secAch.style.display = vis.achievements ? 'block' : 'none';
      const list = getEl('achievementsList');
      if (list) {
        list.innerHTML = '';
        (resumeData.achievements || []).forEach((ach, idx) => {
          const text = typeof ach === 'string' ? ach : (ach.title || ach.text || '');
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" class="form-control item-ach-text" value="${escapeHTML(text)}" data-index="${idx}" placeholder="e.g. Recipient of 2023 Leadership Award" style="flex: 1;">
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-ach" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          `;
          list.appendChild(item);
        });
      }
    }

    // Volunteering
    const secVol = getEl('sec-volunteering');
    if (secVol) {
      secVol.style.display = vis.volunteering ? 'block' : 'none';
      const list = getEl('volunteeringList');
      if (list) {
        list.innerHTML = '';
        (resumeData.volunteering || []).forEach((v, idx) => {
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div class="dynamic-item-header">
              <strong style="font-size: 0.85rem;">Role / Organization</strong>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-vol" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <div class="form-row-3">
              <input type="text" class="form-control item-vol-role" placeholder="Role (e.g. Volunteer Mentor)" value="${escapeHTML(v.role)}" data-index="${idx}">
              <input type="text" class="form-control item-vol-org" placeholder="Organization" value="${escapeHTML(v.organization || v.org)}" data-index="${idx}">
              <input type="text" class="form-control item-vol-dur" placeholder="Duration (e.g. 2021 - 2023)" value="${escapeHTML(v.duration)}" data-index="${idx}">
            </div>
          `;
          list.appendChild(item);
        });
      }
    }

    // Languages
    const secLang = getEl('sec-languages');
    if (secLang) {
      secLang.style.display = vis.languages ? 'block' : 'none';
      const list = getEl('languagesList');
      if (list) {
        list.innerHTML = '';
        (resumeData.languages || []).forEach((l, idx) => {
          const name = typeof l === 'string' ? l : (l.name || '');
          const prof = typeof l === 'string' ? '' : (l.proficiency || '');
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" class="form-control item-lang-name" placeholder="Language (e.g. Spanish)" value="${escapeHTML(name)}" data-index="${idx}" style="flex: 2;">
              <input type="text" class="form-control item-lang-prof" placeholder="Proficiency (e.g. Professional Working)" value="${escapeHTML(prof)}" data-index="${idx}" style="flex: 2;">
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-lang" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          `;
          list.appendChild(item);
        });
      }
    }

    // Academic CV
    const secAcad = getEl('sec-academic');
    if (secAcad) {
      secAcad.style.display = vis.academic ? 'block' : 'none';
      const pubsList = getEl('academicPubsList');
      if (pubsList) {
        pubsList.innerHTML = '';
        const pubs = (resumeData.academic && resumeData.academic.publications) || [];
        pubs.forEach((p, idx) => {
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <textarea class="form-control item-pub-text" data-index="${idx}" rows="2" placeholder="Full publication citation...">${escapeHTML(p.title || p.citation)}</textarea>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-pub" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          `;
          pubsList.appendChild(item);
        });
      }

      const teachList = getEl('academicTeachingList');
      if (teachList) {
        teachList.innerHTML = '';
        const teach = (resumeData.academic && resumeData.academic.teaching) || [];
        teach.forEach((t, idx) => {
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div class="dynamic-item-header">
              <strong style="font-size: 0.85rem;">Teaching Entry</strong>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-teach" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <div class="form-row-3">
              <input type="text" class="form-control item-teach-role" placeholder="Role / Course" value="${escapeHTML(t.role || t.course)}" data-index="${idx}">
              <input type="text" class="form-control item-teach-inst" placeholder="Institution" value="${escapeHTML(t.institution)}" data-index="${idx}">
              <input type="text" class="form-control item-teach-term" placeholder="Term / Year" value="${escapeHTML(t.term)}" data-index="${idx}">
            </div>
          `;
          teachList.appendChild(item);
        });
      }

      const presList = getEl('academicPresentationsList');
      if (presList) {
        presList.innerHTML = '';
        ((resumeData.academic && resumeData.academic.presentations) || []).forEach((pr, idx) => {
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div class="dynamic-item-header">
              <strong style="font-size: 0.85rem;">Presentation</strong>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-pres" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <div class="form-row-2">
              <input type="text" class="form-control item-pres-title" placeholder="Talk or poster title" value="${escapeHTML(typeof pr === 'string' ? pr : pr.title)}" data-index="${idx}">
              <input type="text" class="form-control item-pres-event" placeholder="Conference, place, year" value="${escapeHTML(typeof pr === 'string' ? '' : pr.event)}" data-index="${idx}">
            </div>
          `;
          presList.appendChild(item);
        });
      }

      const grantList = getEl('academicGrantsList');
      if (grantList) {
        grantList.innerHTML = '';
        ((resumeData.academic && resumeData.academic.grants) || []).forEach((g, idx) => {
          const item = document.createElement('div');
          item.className = 'dynamic-item';
          item.innerHTML = `
            <div class="dynamic-item-header">
              <strong style="font-size: 0.85rem;">Grant</strong>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-grant" data-index="${idx}">
                <i aria-hidden="true" class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            <div class="form-row-3">
              <input type="text" class="form-control item-grant-title" placeholder="Grant or award title" value="${escapeHTML(typeof g === 'string' ? g : (g.title || g.name))}" data-index="${idx}">
              <input type="text" class="form-control item-grant-funder" placeholder="Funding body" value="${escapeHTML(typeof g === 'string' ? '' : g.funder)}" data-index="${idx}">
              <input type="text" class="form-control item-grant-year" placeholder="Year" value="${escapeHTML(typeof g === 'string' ? '' : g.year)}" data-index="${idx}">
            </div>
          `;
          grantList.appendChild(item);
        });
      }
    }
    labelOptionalFields();
  }

  /**
   * Setup Design Controls in Tab 2
   */
  function setupDesignControls() {
    const fontSelect = getEl('fontSelect');
    const pageSizeSelect = getEl('pageSizeSelect');
    const densitySelect = getEl('densitySelect');
    const fontSizeSelect = getEl('fontSizeSelect');

    if (fontSelect) {
      fontSelect.addEventListener('change', () => {
        pushHistoryState();
        resumeData.design.fontFamily = fontSelect.value;
        renderResumePreview();
      });
    }

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', () => {
        pushHistoryState();
        resumeData.design.pageSize = pageSizeSelect.value;
        document.querySelectorAll('.export-page-size-label').forEach(el => {
          el.textContent = pageSizeSelect.value === 'letter' ? 'Letter' : 'A4';
        });
        renderResumePreview();
      });
    }

    if (densitySelect) {
      densitySelect.addEventListener('change', () => {
        pushHistoryState();
        resumeData.design.density = densitySelect.value;
        renderResumePreview();
      });
    }

    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', () => {
        pushHistoryState();
        resumeData.design.fontSize = fontSizeSelect.value;
        renderResumePreview();
      });
    }

    renderSectionOrderControls();
  }

  function updateDesignControlsFromState() {
    const fontSelect = getEl('fontSelect');
    const pageSizeSelect = getEl('pageSizeSelect');
    const densitySelect = getEl('densitySelect');
    const fontSizeSelect = getEl('fontSizeSelect');

    if (fontSelect && resumeData.design.fontFamily) fontSelect.value = resumeData.design.fontFamily;
    if (pageSizeSelect && resumeData.design.pageSize) pageSizeSelect.value = resumeData.design.pageSize;
    if (densitySelect && resumeData.design.density) densitySelect.value = resumeData.design.density;
    if (fontSizeSelect && resumeData.design.fontSize) fontSizeSelect.value = resumeData.design.fontSize;

    document.querySelectorAll('.export-page-size-label').forEach(el => {
      el.textContent = (resumeData.design.pageSize === 'letter') ? 'Letter' : 'A4';
    });

    renderSectionOrderControls();
  }

  /**
   * Render Section Reorder and Visibility Controls
   */
  function renderSectionOrderControls() {
    const container = getEl('sectionOrderContainer');
    if (!container) return;
    container.innerHTML = '';

    const order = (resumeData.design && Array.isArray(resumeData.design.sectionOrder))
      ? resumeData.design.sectionOrder
      : ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'];

    const labels = { academic: 'Academic & Research (CV)' };
    ['summary', 'experience', 'education', 'projects', 'skills'].forEach(key => { labels[key] = TPL.getSectionTitle(resumeData, resumeData.template, key); });
    ['certifications', 'achievements', 'volunteering', 'languages'].forEach(key => { labels[key] = TPL.getSectionLabel(resumeData.template, key); });

    order.forEach((key, index) => {
      if (!labels[key]) return;
      const isVis = resumeData.sectionVisibility[key] !== false;

      const row = document.createElement('div');
      row.className = 'dynamic-item';
      row.style.marginBottom = '0.35rem';
      row.style.padding = '0.5rem 0.75rem';
      row.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
          <label class="checkbox-label" style="font-size: 0.85rem; font-weight: 600; color: var(--text-heading);">
            <input type="checkbox" class="chk-section-vis" data-key="${key}" ${isVis ? 'checked' : ''}>
            <span>${escapeHTML(labels[key])}</span>
          </label>
          <div style="display: flex; gap: 0.3rem;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="order-up" data-index="${index}" title="Move Up" aria-label="Move ${escapeHTML(labels[key])} up" ${index === 0 ? 'disabled' : ''} style="min-height: 28px; padding: 0.15rem 0.45rem;">
              <i aria-hidden="true" class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="order-down" data-index="${index}" title="Move Down" aria-label="Move ${escapeHTML(labels[key])} down" ${index === order.length - 1 ? 'disabled' : ''} style="min-height: 28px; padding: 0.15rem 0.45rem;">
              <i aria-hidden="true" class="fa-solid fa-arrow-down"></i>
            </button>
          </div>
        </div>
      `;

      row.querySelector('.chk-section-vis').addEventListener('change', (e) => {
        pushHistoryState();
        resumeData.sectionVisibility[key] = e.target.checked;
        renderOptionalSections();
        renderResumePreview();
        runResumeReview();
      });

      row.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const idx = parseInt(btn.dataset.index, 10);
          pushHistoryState();

          if (action === 'order-up' && idx > 0) {
            const temp = order[idx];
            order[idx] = order[idx - 1];
            order[idx - 1] = temp;
          } else if (action === 'order-down' && idx < order.length - 1) {
            const temp = order[idx];
            order[idx] = order[idx + 1];
            order[idx + 1] = temp;
          }
          resumeData.design.sectionOrder = order;
          renderSectionOrderControls();
          renderResumePreview();
          setTimeout(() => {
            const newIdx = (action === 'order-up') ? idx - 1 : idx + 1;
            const c = getEl('sectionOrderContainer');
            if (c) {
              const rows = c.querySelectorAll('.dynamic-item');
              if (rows[newIdx]) {
                const b = rows[newIdx].querySelector(`button[data-action="${action}"]`);
                if (b && !b.disabled) b.focus();
              }
            }
          }, 20);
        });
      });

      container.appendChild(row);
    });
  }

  /**
   * Render Resume Live Preview (DOM Updates)
   */
  let pdfPageCount = 1;
  let visualPageCount = 1;
  function renderResumePreview() {
    const sheet = getEl('resumeSheet');
    if (!sheet) return;
    renderTemplateIntoContainer(sheet, resumeData.template, resumeData);
    const badge = getEl('prevTemplateBadge');
    if (badge) badge.textContent = (TEMPLATES[resumeData.template] || TEMPLATES['classic-professional']).name;
    const note = getEl('previewEmptyNote');
    if (note) note.classList.toggle('hidden', !isDocumentEmpty());
    try {
      const doc = window.ApplyReadyPDF.generateResumePDF(resumeData);
      pdfPageCount = doc.getPageCount();
      visualPageCount = renderVectorPreview(doc, sheet);
    } catch (e) {
      pdfPageCount = null;
      visualPageCount = renderPaginatedPreview(sheet);
    }
    saveDraftToStorage();
    updatePreviewScale();
  }

  /**
   * Fit-to-Width Preview Scaling & Page Count Indicator
   */
  function updatePreviewScale() {
    const resumePreviewOuter = getEl('resumePreviewOuter');
    const previewWrapper = getEl('previewWrapper');
    const resumeSheet = getEl('resumeSheet');
    const visualPages = getEl('resumeVisualPages');
    const pageCountPill = getEl('pageCountPill');

    if (!resumePreviewOuter || !previewWrapper || !resumeSheet || !visualPages) return;
    const firstPage = visualPages.querySelector('.resume-visual-page');
    const paperWidth = (firstPage && firstPage.offsetWidth) || resumeSheet.offsetWidth || 794;

    let scale = 1;
    if (currentZoom === 'fit') {
      const previewStyle = getComputedStyle(resumePreviewOuter);
      const availableWidth = resumePreviewOuter.clientWidth - parseFloat(previewStyle.paddingLeft) - parseFloat(previewStyle.paddingRight);
      scale = Math.min(1, Math.max(0.05, availableWidth / paperWidth));
    } else if (currentZoom === '75') scale = 0.75;
    else if (currentZoom === '100') scale = 1.0;
    else if (currentZoom === '125') scale = 1.25;

    visualPages.style.transform = `scale(${scale})`;
    resumeSheet.style.transform = `scale(${scale})`;
    previewWrapper.style.width = `${paperWidth * scale}px`;
    previewWrapper.style.height = `${visualPages.offsetHeight * scale}px`;
    if (pageCountPill) {
      const count = pdfPageCount || visualPageCount || 1;
      pageCountPill.textContent = `${count} PDF page${count > 1 ? 's' : ''}`;
    }
  }

  /**
   * Actionable Resume Review Checklist Generator
   */
  function generateReviewReport(data, pageCount) {
    const issues = [];
    const p = data.personal || {};
    const t = value => (typeof value === 'string' ? value.trim() : '');
    const vis = data.sectionVisibility || {};
    const shown = key => vis[key] !== false;
    const tmpl = TEMPLATES[data.template] || {};
    const add = (type, message, section, targetField) => issues.push({ type, message, section, targetField });
    const splitBullets = text => String(text || '').split(/\r?\n|\r/).map(line => line.trim().replace(/^[-*•▪◦·]\s*/, '').trim()).filter(Boolean);

    // Contact details
    if (!t(p.fullName)) add('error', 'Full name is missing. Recruiters and applicant tracking systems use it to identify your file.', 'personal', 'fullName');
    if (!t(p.email)) add('warning', 'Email address not provided. Add one so recruiters can contact you.', 'personal', 'email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t(p.email))) add('error', `Email "${t(p.email)}" looks incomplete or malformed.`, 'personal', 'email');
    if (!t(p.phone)) add('warning', 'Phone number not provided. Most application portals expect one.', 'personal', 'phone');
    else if (t(p.phone).replace(/\D/g, '').length < 7) add('error', `Phone "${t(p.phone)}" has too few digits.`, 'personal', 'phone');
    if (!t(p.location)) add('info', 'Add a city and country or state. Many recruiters filter candidates by location.', 'personal', 'location');
    for (const [key, name] of [['linkedin', 'LinkedIn URL'], ['website', 'Website URL'], ['github', 'GitHub URL']]) {
      if (t(p[key]) && !isValidUrlFormat(p[key])) add('error', `${name} "${t(p[key])}" appears malformed.`, 'personal', key);
    }

    // Summary
    const summary = t(data.summary);
    if (shown('summary') && !summary && tmpl.defaultVisibility && tmpl.defaultVisibility.summary) add('info', 'Professional summary is empty. Two or three lines about your focus and strongest results help a recruiter scan quickly.', 'summary', 'summaryText');
    if (summary && summary.split(/\s+/).length > 90) add('info', `Summary is ${summary.split(/\s+/).length} words. Around 40 to 80 words is easier to scan.`, 'summary', 'summaryText');

    // Experience
    const experience = (data.experience || []).filter(x => x && (t(x.role) || t(x.company) || splitBullets(x.bulletsText).length));
    const studentTemplate = ['graduate-early-career', 'campus-fresher', 'ivy-classic', 'academic-cv'].includes(data.template);
    if (!experience.length && shown('experience') && !studentTemplate) add('info', 'No work experience added yet. Internships, freelance and volunteer roles count.', 'experience');
    experience.forEach((exp, index) => {
      const label = t(exp.role) || t(exp.company) || `Entry ${index + 1}`;
      if (!t(exp.role)) add('warning', `Experience "${label}" has no job title.`, 'experience');
      if (!t(exp.company)) add('info', `Experience "${label}" has no company or organisation.`, 'experience');
      if (!t(exp.duration)) add('warning', `Experience "${label}" has no dates. Applicant tracking systems use dates to calculate experience.`, 'experience');
      if (!splitBullets(exp.bulletsText).length) add('info', `Experience "${label}" has no bullet points describing your work.`, 'experience');
      if (splitBullets(exp.bulletsText).length > 8) add('info', `Experience "${label}" has ${splitBullets(exp.bulletsText).length} bullets. Keep the strongest 3 to 6.`, 'experience');
    });

    // Bullet quality across experience and projects
    const bullets = [...experience, ...(data.projects || [])].flatMap(item => splitBullets(item && item.bulletsText));
    if (bullets.length >= 3) {
      const measured = bullets.filter(b => /\d/.test(b)).length;
      if (measured / bullets.length < 0.3) add('info', `Only ${measured} of ${bullets.length} bullets include a number. Add measurable results such as %, time saved, revenue, or team size where you can.`, 'experience');
    }
    const weak = bullets.filter(b => /^(responsible for|worked on|helped|assisted( with)?|duties included|tasked with|involved in|in charge of)\b/i.test(b));
    if (weak.length) add('info', `${weak.length} bullet${weak.length > 1 ? 's start' : ' starts'} with a passive phrase such as "${weak[0].split(/\s+/).slice(0, 2).join(' ')}". Start with an action verb such as Led, Built, Reduced, or Delivered.`, 'experience');
    const firstPerson = bullets.filter(b => /\b(I|me|my|mine|we|our)\b/.test(b));
    if (firstPerson.length) add('info', `${firstPerson.length} bullet${firstPerson.length > 1 ? 's use' : ' uses'} first-person words (I, my, we). Resumes conventionally omit them.`, 'experience');
    const long = bullets.filter(b => b.split(/\s+/).length > 40);
    if (long.length) add('info', `${long.length} bullet${long.length > 1 ? 's are' : ' is'} longer than 40 words. Split long points so each fits in about two lines.`, 'experience');

    // Education and skills
    const education = (data.education || []).filter(x => x && (t(x.degree) || t(x.institution)));
    if (!education.length && shown('education')) add('warning', 'Education history is empty.', 'education');
    education.forEach(edu => { if (!t(edu.duration)) add('info', `Education "${t(edu.degree) || t(edu.institution)}" has no dates or graduation year.`, 'education'); });
    const skills = data.skills || {};
    if (shown('skills') && !['languages', 'frameworks', 'tools', 'other'].some(key => t(skills[key]))) add('warning', 'Skills section is empty. Applicant tracking systems match job keywords against it.', 'skills', 'skillLanguages');

    // Placeholders and document length
    const strPayload = JSON.stringify(data).toLowerCase();
    if (/lorem ipsum|\[company name\]|\[your name\]|xxx|todo:/.test(strPayload)) add('warning', 'Placeholder text detected (for example "[Company Name]" or "Lorem ipsum"). Replace it before you send the file.', 'summary');
    if (pageCount && pageCount > 2 && data.template !== 'academic-cv') add('warning', `Your PDF is ${pageCount} pages. Most employers expect one or two pages; consider trimming older roles.`, 'experience');
    else if (pageCount === 2 && experience.length <= 1 && education.length <= 2) add('info', 'Your PDF runs to two pages with little experience. Try the Compact density or 10 pt text to fit one page.', 'experience');
    if (!pageCount) add('info', 'Some characters need a Unicode font, so PDF download uses your browser\'s Save as PDF. Word and text downloads keep every character.', 'personal');

    if (data.template === 'academic-cv') add('info', 'Academic / Research CV is designed for comprehensive multi-page dossiers with publications and teaching.', 'academic');

    return issues;
  }

  function runResumeReview() {
    const checklist = getEl('reviewChecklist');
    const statusBar = getEl('reviewStatusBar');
    const statusText = getEl('reviewStatusText');
    const statusIcon = getEl('reviewStatusIcon');
    const pageEstPill = getEl('reviewPageEstimatePill');

    if (!checklist) return;
    const issues = generateReviewReport(resumeData, pdfPageCount);

    const hasErrors = issues.some(x => x.type === 'error');
    const hasWarnings = issues.some(x => x.type === 'warning');

    if (statusBar && statusText && statusIcon) {
      if (hasErrors) {
        statusBar.className = 'readiness-status-bar readiness-warning';
        statusText.textContent = `Action Needed: ${issues.filter(x => x.type === 'error').length} Required Fix(es)`;
        statusIcon.className = 'fa-solid fa-triangle-exclamation';
      } else if (hasWarnings) {
        statusBar.className = 'readiness-status-bar readiness-ready';
        statusText.textContent = 'Ready to Export (With Suggestions)';
        statusIcon.className = 'fa-solid fa-circle-check';
      } else {
        statusBar.className = 'readiness-status-bar readiness-ready';
        statusText.textContent = 'All Checks Satisfied - Ready to Export';
        statusIcon.className = 'fa-solid fa-circle-check';
      }
    }

    // Page count estimate
    const sheet = getEl('resumeSheet');
    if (sheet && pageEstPill) {
      pageEstPill.textContent = pdfPageCount ? `${pdfPageCount} PDF page${pdfPageCount > 1 ? 's' : ''}` : 'Browser PDF';
    }

    renderKeywordMatch();
    checklist.innerHTML = '';
    if (issues.length === 0) {
      checklist.innerHTML = `
        <div class="review-item" style="border-left: 3px solid var(--accent-green);">
          <div class="review-item-content">
            <i aria-hidden="true" class="fa-solid fa-circle-check" style="color: var(--accent-green); margin-top: 0.15rem;"></i>
            <span>All contact information, links, and sections conform to clean ATS formatting standards.</span>
          </div>
        </div>
      `;
      return;
    }

    issues.forEach(iss => {
      const item = document.createElement('div');
      item.className = 'review-item';
      let icon = 'fa-circle-info text-muted';
      let borderColor = 'var(--border-color)';
      if (iss.type === 'error') {
        icon = 'fa-triangle-exclamation text-danger';
        borderColor = 'var(--accent-danger)';
      } else if (iss.type === 'warning') {
        icon = 'fa-circle-exclamation text-warning';
        borderColor = 'var(--accent-warning)';
      }
      item.style.borderLeft = `3px solid ${borderColor}`;

      item.innerHTML = `
        <div class="review-item-content">
          <i aria-hidden="true" class="fa-solid ${icon}" style="margin-top: 0.15rem;"></i>
          <span>${escapeHTML(iss.message)}</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm review-jump-btn" data-target="${iss.targetField || iss.section}">
          Go to Section
        </button>
      `;

      item.querySelector('.review-jump-btn').addEventListener('click', () => {
        // Switch to Content Tab
        const tabContent = getEl('tabContent');
        if (tabContent) tabContent.click();

        // Focus and scroll
        setTimeout(() => {
          const target = getEl(iss.targetField) || getEl('sec-' + iss.section);
          if (target) {
            const section = target.closest('.accordion-section') || target;
            if (section.classList.contains('accordion-section')) {
              section.classList.add('open');
              section.querySelector('.accordion-header').setAttribute('aria-expanded', 'true');
            }
            if (!iss.targetField) section.querySelector('.accordion-header').focus();
            else target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      });

      checklist.appendChild(item);
    });
  }

  // New content keeps the chosen template, paper and typography; replacing
  // them silently left the gallery showing a template that was not in use.
  function withCurrentDesign(next, sectionVisibility) {
    next.template = resumeData.template;
    next.design = Object.assign({}, JSON.parse(JSON.stringify(resumeData.design)), { templateId: resumeData.template });
    next.design.sectionOrder = SCHEMA.normalizeSectionOrder((TEMPLATES[resumeData.template] || {}).recommendedOrder || next.design.sectionOrder);
    next.sectionVisibility = Object.assign({}, sectionVisibility);
    return next;
  }

  function refreshWholeEditor() {
    populateAllFormFields();
    renderAllDynamicLists();
    updateDesignControlsFromState();
    setupTemplateGallery();
    renderResumePreview();
    runResumeReview();
  }

  function downloadName(suffix) {
    const name = ((resumeData.personal && resumeData.personal.fullName) || '').trim().normalize('NFC')
      .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
    return `${name || 'Candidate'}_${suffix}`;
  }

  // Job-description comparison: lists the advert's key terms found in, and
  // missing from, the resume text. Nothing is stored or sent anywhere.
  function renderKeywordMatch() {
    const input = getEl('jobDescriptionInput');
    const out = getEl('keywordMatchResult');
    if (!input || !out || !window.ApplyReadyKeywords || !window.ApplyReadyPDF) return;
    const job = input.value.trim();
    if (job.split(/\s+/).length < 8) {
      out.replaceChildren();
      if (job) out.textContent = 'Paste a little more of the job description to compare.';
      return;
    }
    const result = window.ApplyReadyKeywords.matchKeywords(job, window.ApplyReadyPDF.generateResumeText(resumeData), 30);
    if (!result.keywords.length) { out.textContent = 'No distinctive terms found in this text.'; return; }
    const list = (terms, cls) => `<ul class="keyword-chips ${cls}">${terms.map(term => `<li>${escapeHTML(term)}</li>`).join('')}</ul>`;
    out.innerHTML = `
      <p class="keyword-summary"><strong>${result.found.length} of ${result.keywords.length}</strong> key terms from this advert appear in your resume.</p>
      ${result.missing.length ? `<h4 class="keyword-heading">Not in your resume yet</h4>${list(result.missing, 'is-missing')}
      <p class="form-hint">Add the ones that genuinely describe your experience, in your skills or bullet points, using the advert's wording. Never add skills you do not have.</p>` : ''}
      ${result.found.length ? `<h4 class="keyword-heading">Already covered</h4>${list(result.found, 'is-found')}` : ''}`;
  }

  /**
   * Attach All Event Listeners
   */
  function attachEventListeners() {
    // Dirty flag on typing
    let lastTypingField, lastTypingAt = 0;
    document.addEventListener('input', e => {
      if (!e.target.closest('#formPanel') || e.target.id === 'jobDescriptionInput') return;
      const now = Date.now();
      if (e.target !== lastTypingField || now - lastTypingAt > 1000) pushHistoryState();
      lastTypingField = e.target; lastTypingAt = now;
      isDirty = true;
    }, true);

    // Keyboard shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
    document.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return; // respect native text undo inside inputs

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        performRedo();
      }
    });

    const jobInput = getEl('jobDescriptionInput');
    if (jobInput) {
      let keywordTimer;
      jobInput.addEventListener('input', () => { clearTimeout(keywordTimer); keywordTimer = setTimeout(renderKeywordMatch, 200); });
    }

    // Undo / Redo buttons
    const btnUndo = getEl('btnUndo');
    const btnRedo = getEl('btnRedo');
    if (btnUndo) btnUndo.addEventListener('click', performUndo);
    if (btnRedo) btnRedo.addEventListener('click', performRedo);

    // Zoom Toolbar
    const btnZoomFit = getEl('btnZoomFit');
    const btnZoom100 = getEl('btnZoom100');
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        currentZoom = 'fit';
        updatePreviewScale();
      });
    }
    if (btnZoom100) {
      btnZoom100.addEventListener('click', () => {
        currentZoom = '100';
        updatePreviewScale();
      });
    }

    const openExport = getEl('btnOpenExport');
    if (openExport) openExport.addEventListener('click', () => { getEl('tabEdit').click(); getEl('tabReview').click(); getEl('formPanel').scrollIntoView({ block: 'start', behavior: 'smooth' }); });

    // Quick PDF button
    const btnQuickPDF = getEl('btnQuickPDF');
    if (btnQuickPDF) btnQuickPDF.addEventListener('click', exportToVectorPDF);

    // Input change listeners
    const bindInput = (id, setter) => {
      const el = getEl(id);
      if (el) {
        el.addEventListener('input', (e) => {
          setter(e.target.value);
          renderResumePreview();
        });
      }
    };

    bindInput('fullName', v => { resumeData.personal.fullName = v; });
    bindInput('targetTitle', v => { resumeData.personal.targetTitle = v; });
    bindInput('email', v => { resumeData.personal.email = v; });
    bindInput('phone', v => { resumeData.personal.phone = v; });
    bindInput('location', v => { resumeData.personal.location = v; });
    bindInput('linkedin', v => { resumeData.personal.linkedin = v; });
    bindInput('github', v => { resumeData.personal.github = v; });
    bindInput('website', v => { resumeData.personal.website = v; });
    bindInput('summaryText', v => { resumeData.summary = v; });

    ['summary', 'experience', 'education', 'projects', 'skills'].forEach(key => {
      bindInput(key + 'TitleInput', v => { resumeData[key + 'Title'] = v.trim() ? v : TPL.getSectionLabel(resumeData.template, key); });
      const input = getEl(key + 'TitleInput');
      if (input) input.addEventListener('blur', () => { updateTemplateFieldLabels(); renderSectionOrderControls(); });
    });

    document.querySelectorAll('.skill-label-input').forEach(input => {
      input.addEventListener('input', () => {
        if (!resumeData.skillLabels || typeof resumeData.skillLabels !== 'object') resumeData.skillLabels = {};
        resumeData.skillLabels[input.dataset.skill] = input.value;
        renderResumePreview();
      });
      input.addEventListener('blur', updateTemplateFieldLabels);
    });

    bindInput('skillLanguages', v => { resumeData.skills.languages = v; });
    bindInput('skillFrameworks', v => { resumeData.skills.frameworks = v; });
    bindInput('skillTools', v => { resumeData.skills.tools = v; });
    bindInput('skillOther', v => { resumeData.skills.other = v; });

    // Dynamic Lists delegation
    const expList = getEl('experienceList');
    if (expList) {
      expList.addEventListener('input', handleExperienceInput);
      expList.addEventListener('click', handleExperienceAction);
    }

    const eduList = getEl('educationList');
    if (eduList) {
      eduList.addEventListener('input', handleEducationInput);
      eduList.addEventListener('click', handleEducationAction);
    }

    const projList = getEl('projectsList');
    if (projList) {
      projList.addEventListener('input', handleProjectInput);
      projList.addEventListener('click', handleProjectAction);
    }

    // Optional sections list delegation
    const certList = getEl('certificationsList');
    if (certList) {
      certList.addEventListener('input', handleCertInput);
      certList.addEventListener('click', handleCertAction);
    }
    const achList = getEl('achievementsList');
    if (achList) {
      achList.addEventListener('input', handleAchInput);
      achList.addEventListener('click', handleAchAction);
    }
    const volList = getEl('volunteeringList');
    if (volList) {
      volList.addEventListener('input', handleVolInput);
      volList.addEventListener('click', handleVolAction);
    }
    const langList = getEl('languagesList');
    if (langList) {
      langList.addEventListener('input', handleLangInput);
      langList.addEventListener('click', handleLangAction);
    }
    const pubsList = getEl('academicPubsList');
    if (pubsList) {
      pubsList.addEventListener('input', handlePubInput);
      pubsList.addEventListener('click', handlePubAction);
    }
    const teachList = getEl('academicTeachingList');
    if (teachList) {
      teachList.addEventListener('input', handleTeachInput);
      teachList.addEventListener('click', handleTeachAction);
    }
    const presList = getEl('academicPresentationsList');
    if (presList) {
      presList.addEventListener('input', e => handleAcademicInput(e, 'presentations', { 'item-pres-title': 'title', 'item-pres-event': 'event' }));
      presList.addEventListener('click', e => handleAcademicRemove(e, 'presentations', 'remove-pres', 'academicPresentationsList', 'btnAddPresentation'));
    }
    const grantList = getEl('academicGrantsList');
    if (grantList) {
      grantList.addEventListener('input', e => handleAcademicInput(e, 'grants', { 'item-grant-title': 'title', 'item-grant-funder': 'funder', 'item-grant-year': 'year' }));
      grantList.addEventListener('click', e => handleAcademicRemove(e, 'grants', 'remove-grant', 'academicGrantsList', 'btnAddGrant'));
    }
    [['btnAddPresentation', 'presentations', { title: '', event: '' }], ['btnAddGrant', 'grants', { title: '', funder: '', year: '' }]].forEach(([id, key, blank]) => {
      const btn = getEl(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.academic) resumeData.academic = {};
        if (!Array.isArray(resumeData.academic[key])) resumeData.academic[key] = [];
        resumeData.academic[key].push(Object.assign({ id: newEntryId(key) }, blank));
        renderOptionalSections();
        renderResumePreview();
      });
    });

    // Add Entry buttons
    const btnAddExp = getEl('btnAddExperience');
    if (btnAddExp) {
      btnAddExp.addEventListener('click', () => {
        pushHistoryState();
        resumeData.experience.push({
          id: newEntryId('exp'),
          role: '',
          company: '',
          location: '',
          duration: '',
          bulletsText: ''
        });
        renderExperienceList();
        renderResumePreview();
      });
    }

    const btnAddEdu = getEl('btnAddEducation');
    if (btnAddEdu) {
      btnAddEdu.addEventListener('click', () => {
        pushHistoryState();
        resumeData.education.push({
          id: newEntryId('edu'),
          degree: '',
          institution: '',
          location: '',
          duration: '',
          score: ''
        });
        renderEducationList();
        renderResumePreview();
      });
    }

    const btnAddProj = getEl('btnAddProject');
    if (btnAddProj) {
      btnAddProj.addEventListener('click', () => {
        pushHistoryState();
        resumeData.projects.push({
          id: newEntryId('proj'),
          name: '',
          tech: '',
          link: '',
          bulletsText: ''
        });
        renderProjectsList();
        renderResumePreview();
      });
    }

    // Add Optional Section Handler
    const btnAddOptional = getEl('btnAddOptionalSection');
    const selectOptional = getEl('optionalSectionSelect');
    if (btnAddOptional && selectOptional) {
      btnAddOptional.addEventListener('click', () => {
        const val = selectOptional.value;
        if (!val) return;
        pushHistoryState();
        resumeData.sectionVisibility[val] = true;

        // Ensure array exists
        if (val === 'certifications' && (!resumeData.certifications || resumeData.certifications.length === 0)) {
          resumeData.certifications = [{ id: newEntryId('cert'), name: '', issuer: '', year: '' }];
        } else if (val === 'achievements' && (!resumeData.achievements || resumeData.achievements.length === 0)) {
          resumeData.achievements = [''];
        } else if (val === 'volunteering' && (!resumeData.volunteering || resumeData.volunteering.length === 0)) {
          resumeData.volunteering = [{ role: '', organization: '', duration: '' }];
        } else if (val === 'languages' && (!resumeData.languages || resumeData.languages.length === 0)) {
          resumeData.languages = [{ name: '', proficiency: '' }];
        } else if (val === 'academic') {
          if (!resumeData.academic) resumeData.academic = {};
          if (!resumeData.academic.publications) resumeData.academic.publications = [{ title: '' }];
        }

        renderOptionalSections();
        renderSectionOrderControls();
        renderResumePreview();

        // Expand the newly enabled section
        const secEl = getEl('sec-' + val);
        if (secEl) {
          secEl.classList.add('open');
          secEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // Add buttons for individual optional items
    const btnAddCert = getEl('btnAddCertification');
    if (btnAddCert) {
      btnAddCert.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.certifications) resumeData.certifications = [];
        resumeData.certifications.push({ id: newEntryId('cert'), name: '', issuer: '', year: '' });
        renderOptionalSections();
        renderResumePreview();
      });
    }
    const btnAddAch = getEl('btnAddAchievement');
    if (btnAddAch) {
      btnAddAch.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.achievements) resumeData.achievements = [];
        resumeData.achievements.push('');
        renderOptionalSections();
        renderResumePreview();
      });
    }
    const btnAddVol = getEl('btnAddVolunteering');
    if (btnAddVol) {
      btnAddVol.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.volunteering) resumeData.volunteering = [];
        resumeData.volunteering.push({ role: '', organization: '', duration: '' });
        renderOptionalSections();
        renderResumePreview();
      });
    }
    const btnAddLang = getEl('btnAddLanguage');
    if (btnAddLang) {
      btnAddLang.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.languages) resumeData.languages = [];
        resumeData.languages.push({ name: '', proficiency: '' });
        renderOptionalSections();
        renderResumePreview();
      });
    }
    const btnAddPub = getEl('btnAddPublication');
    if (btnAddPub) {
      btnAddPub.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.academic) resumeData.academic = {};
        if (!resumeData.academic.publications) resumeData.academic.publications = [];
        resumeData.academic.publications.push({ title: '' });
        renderOptionalSections();
        renderResumePreview();
      });
    }
    const btnAddTeach = getEl('btnAddTeaching');
    if (btnAddTeach) {
      btnAddTeach.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.academic) resumeData.academic = {};
        if (!resumeData.academic.teaching) resumeData.academic.teaching = [];
        resumeData.academic.teaching.push({ role: '', institution: '', term: '' });
        renderOptionalSections();
        renderResumePreview();
      });
    }

    // Load Sample Button
    const btnLoadSample = getEl('btnLoadSample');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        if (!isDocumentEmpty()) {
          if (!confirm('Populate the editor with demonstration sample data? This will overwrite your current fields.')) return;
        }
        pushHistoryState();
        resumeData = withCurrentDesign(SCHEMA.migrate(SAMPLE_DATA), SAMPLE_DATA.sectionVisibility);
        isDirty = false;
        refreshWholeEditor();
      });
    }

    // Clear Form Button
    const btnClearForm = getEl('btnClearForm');
    if (btnClearForm) {
      btnClearForm.addEventListener('click', () => {
        if (!confirm('Are you sure you want to clear all resume fields?')) return;
        pushHistoryState();
        resumeData = withCurrentDesign(SCHEMA.migrate(EMPTY_DATA), EMPTY_DATA.sectionVisibility);
        isDirty = false;
        refreshWholeEditor();
      });
    }

    // Draft Persistence
    const chkSaveDraft = getEl('chkSaveDraft');
    if (chkSaveDraft) {
      chkSaveDraft.addEventListener('change', () => {
        autoSaveDraft = chkSaveDraft.checked;
        try {
          localStorage.setItem('applyready_draft_enabled', String(autoSaveDraft));
        } catch (e) {}
        if (autoSaveDraft) saveDraftToStorage();
        else deleteDraftFromStorage();
      });
    }

    const btnDeleteDraft = getEl('btnDeleteDraft');
    if (btnDeleteDraft) {
      btnDeleteDraft.addEventListener('click', () => {
        if (!confirm('Delete your saved local draft from this device?')) return;
        autoSaveDraft = false;
        deleteDraftFromStorage();
        if (chkSaveDraft) chkSaveDraft.checked = false;
        autoSaveDraft = false;
        try {
          localStorage.setItem('applyready_draft_enabled', 'false');
        } catch (e) {}
      });
    }

    // Export JSON Backup
    const btnExportJSON = getEl('btnExportJSON');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => {
        const payload = {
          version: 2,
          app: 'ApplyReady',
          exportedAt: new Date().toISOString(),
          data: resumeData
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName('Resume_Backup.json');
        isDirty = false;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      });
    }

    // Import JSON Backup
    const btnImportJSON = getEl('btnImportJSON');
    const fileImportInput = getEl('fileImportInput');
    if (btnImportJSON && fileImportInput) {
      btnImportJSON.addEventListener('click', () => fileImportInput.click());
      fileImportInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          notify('This backup exceeds 2 MB. Your resume is preserved.', true);
          fileImportInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
          notify('Could not read the backup file from disk.', true);
          fileImportInput.value = '';
        };
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            if (!validateResumeSchema(parsed)) {
              throw new Error('Invalid resume schema');
            }
            if (!isDocumentEmpty()) {
              if (!confirm('Importing this file will replace your current edits. Do you wish to continue?')) {
                fileImportInput.value = '';
                return;
              }
            }
            pushHistoryState();
            resumeData = migrateResumeSchema(parsed);
            isDirty = false;
            populateAllFormFields();
            renderAllDynamicLists();
            updateDesignControlsFromState();
            renderResumePreview();
            runResumeReview();
            notify('Resume backup restored.');
            // Restored sections can change the page height substantially. Show the
            // restored identity instead of leaving a field beneath the sticky header.
            const contactSection = getEl('sec-personal');
            contactSection.classList.add('open');
            contactSection.querySelector('.accordion-header').setAttribute('aria-expanded', 'true');
            contactSection.scrollIntoView({ block: 'start', behavior: 'auto' });
            getEl('fullName').focus({ preventScroll: true });
          } catch (err) {
            notify('Could not import this backup. Your current resume is preserved.', true);
          }
          fileImportInput.value = '';
        };
        reader.onerror = () => { notify('Could not read this backup. Please choose it again.', true); fileImportInput.value = ''; };
        reader.readAsText(file);
      });
    }

    // Export Controls
    const btnDownloadPDF = getEl('btnDownloadPDF');
    if (btnDownloadPDF) btnDownloadPDF.addEventListener('click', exportToVectorPDF);

    const btnDownloadDOCX = getEl('btnDownloadDOCX');
    if (btnDownloadDOCX) btnDownloadDOCX.addEventListener('click', exportToDOCX);

    const btnDownloadText = getEl('btnDownloadText');
    if (btnDownloadText) btnDownloadText.addEventListener('click', exportToPlainText);

    const btnPrintPDF = getEl('btnPrintPDF');
    if (btnPrintPDF) btnPrintPDF.addEventListener('click', printResume);

    // Mobile View Toggle
    const tabEdit = getEl('tabEdit');
    const tabPreview = getEl('tabPreview');
    const layout = getEl('resumeAppLayout');
    if (tabEdit && tabPreview && layout) {
      tabEdit.addEventListener('click', () => {
        tabEdit.classList.add('active');
        tabPreview.classList.remove('active');
        tabEdit.setAttribute('aria-selected', 'true');
        tabPreview.setAttribute('aria-selected', 'false');
        layout.className = 'resume-app-layout view-edit';
      });
      tabPreview.addEventListener('click', () => {
        tabPreview.classList.add('active');
        tabEdit.classList.remove('active');
        tabPreview.setAttribute('aria-selected', 'true');
        tabEdit.setAttribute('aria-selected', 'false');
        layout.className = 'resume-app-layout view-preview';
        setTimeout(updatePreviewScale, 50);
      });
    }
  }

  // Dynamic Input Listeners
  function handleExperienceInput(e) {
    const parent = e.target.closest('.dynamic-item');
    if (!parent) return;
    const item = resumeData.experience.find(x => x.id === parent.dataset.id);
    if (!item) return;

    if (e.target.classList.contains('item-role')) item.role = e.target.value;
    if (e.target.classList.contains('item-company')) item.company = e.target.value;
    if (e.target.classList.contains('item-duration')) item.duration = e.target.value;
    if (e.target.classList.contains('item-location')) item.location = e.target.value;
    if (e.target.classList.contains('item-bullets')) item.bulletsText = e.target.value;
    renderResumePreview();
  }

  function handleExperienceAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = resumeData.experience.findIndex(x => x.id === id);
    if (idx === -1) return;

    pushHistoryState();
    if (action === 'remove-exp') {
      resumeData.experience.splice(idx, 1);
      renderExperienceList();
      renderResumePreview();
      restoreRemoveFocus('experienceList', idx, 'btnAddExperience');
      return;
    } else if (action === 'duplicate-exp') {
      const copy = JSON.parse(JSON.stringify(resumeData.experience[idx]));
      copy.id = newEntryId('exp');
      resumeData.experience.splice(idx + 1, 0, copy);
      renderExperienceList();
      renderResumePreview();
      restoreListFocus('experienceList', copy.id, 'duplicate-exp', 'btnAddExperience');
      return;
    } else if (action === 'move-up-exp' && idx > 0) {
      const temp = resumeData.experience[idx];
      resumeData.experience[idx] = resumeData.experience[idx - 1];
      resumeData.experience[idx - 1] = temp;
      renderExperienceList();
      renderResumePreview();
      restoreListFocus('experienceList', id, 'move-up-exp', 'btnAddExperience');
      return;
    } else if (action === 'move-down-exp' && idx < resumeData.experience.length - 1) {
      const temp = resumeData.experience[idx];
      resumeData.experience[idx] = resumeData.experience[idx + 1];
      resumeData.experience[idx + 1] = temp;
      renderExperienceList();
      renderResumePreview();
      restoreListFocus('experienceList', id, 'move-down-exp', 'btnAddExperience');
      return;
    }

    renderExperienceList();
    renderResumePreview();
  }

  function handleEducationInput(e) {
    const parent = e.target.closest('.dynamic-item');
    if (!parent) return;
    const item = resumeData.education.find(x => x.id === parent.dataset.id);
    if (!item) return;

    if (e.target.classList.contains('item-degree')) item.degree = e.target.value;
    if (e.target.classList.contains('item-institution')) item.institution = e.target.value;
    if (e.target.classList.contains('item-duration')) item.duration = e.target.value;
    if (e.target.classList.contains('item-location')) item.location = e.target.value;
    if (e.target.classList.contains('item-score')) item.score = e.target.value;
    renderResumePreview();
  }

  function handleEducationAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = resumeData.education.findIndex(x => x.id === id);
    if (idx === -1) return;

    pushHistoryState();
    if (action === 'remove-edu') {
      resumeData.education.splice(idx, 1);
      renderEducationList();
      renderResumePreview();
      restoreRemoveFocus('educationList', idx, 'btnAddEducation');
      return;
    } else if (action === 'duplicate-edu') {
      const copy = JSON.parse(JSON.stringify(resumeData.education[idx]));
      copy.id = newEntryId('edu');
      resumeData.education.splice(idx + 1, 0, copy);
      renderEducationList();
      renderResumePreview();
      restoreListFocus('educationList', copy.id, 'duplicate-edu', 'btnAddEducation');
      return;
    } else if (action === 'move-up-edu' && idx > 0) {
      const temp = resumeData.education[idx];
      resumeData.education[idx] = resumeData.education[idx - 1];
      resumeData.education[idx - 1] = temp;
      renderEducationList();
      renderResumePreview();
      restoreListFocus('educationList', id, 'move-up-edu', 'btnAddEducation');
      return;
    } else if (action === 'move-down-edu' && idx < resumeData.education.length - 1) {
      const temp = resumeData.education[idx];
      resumeData.education[idx] = resumeData.education[idx + 1];
      resumeData.education[idx + 1] = temp;
      renderEducationList();
      renderResumePreview();
      restoreListFocus('educationList', id, 'move-down-edu', 'btnAddEducation');
      return;
    }

    renderEducationList();
    renderResumePreview();
  }

  function handleProjectInput(e) {
    const parent = e.target.closest('.dynamic-item');
    if (!parent) return;
    const item = resumeData.projects.find(x => x.id === parent.dataset.id);
    if (!item) return;

    if (e.target.classList.contains('item-name')) item.name = e.target.value;
    if (e.target.classList.contains('item-tech')) item.tech = e.target.value;
    if (e.target.classList.contains('item-link')) item.link = e.target.value;
    if (e.target.classList.contains('item-bullets')) item.bulletsText = e.target.value;
    renderResumePreview();
  }

  function handleProjectAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = resumeData.projects.findIndex(x => x.id === id);
    if (idx === -1) return;

    pushHistoryState();
    if (action === 'remove-proj') {
      resumeData.projects.splice(idx, 1);
      renderProjectsList();
      renderResumePreview();
      restoreRemoveFocus('projectsList', idx, 'btnAddProject');
      return;
    } else if (action === 'duplicate-proj') {
      const copy = JSON.parse(JSON.stringify(resumeData.projects[idx]));
      copy.id = newEntryId('proj');
      resumeData.projects.splice(idx + 1, 0, copy);
      renderProjectsList();
      renderResumePreview();
      restoreListFocus('projectsList', copy.id, 'duplicate-proj', 'btnAddProject');
      return;
    } else if (action === 'move-up-proj' && idx > 0) {
      const temp = resumeData.projects[idx];
      resumeData.projects[idx] = resumeData.projects[idx - 1];
      resumeData.projects[idx - 1] = temp;
      renderProjectsList();
      renderResumePreview();
      restoreListFocus('projectsList', id, 'move-up-proj', 'btnAddProject');
      return;
    } else if (action === 'move-down-proj' && idx < resumeData.projects.length - 1) {
      const temp = resumeData.projects[idx];
      resumeData.projects[idx] = resumeData.projects[idx + 1];
      resumeData.projects[idx + 1] = temp;
      renderProjectsList();
      renderResumePreview();
      restoreListFocus('projectsList', id, 'move-down-proj', 'btnAddProject');
      return;
    }

    renderProjectsList();
    renderResumePreview();
  }

  // Handlers for optional items
  function handleCertInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.certifications || !resumeData.certifications[idx]) return;
    if (e.target.classList.contains('item-cert-name')) resumeData.certifications[idx].name = e.target.value;
    if (e.target.classList.contains('item-cert-issuer')) resumeData.certifications[idx].issuer = e.target.value;
    if (e.target.classList.contains('item-cert-year')) resumeData.certifications[idx].year = e.target.value;
    renderResumePreview();
  }
  function handleCertAction(e) {
    const btn = e.target.closest('button[data-action="remove-cert"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.certifications.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('certificationsList', idx, 'btnAddCertification');
  }

  function handleAchInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.achievements) return;
    resumeData.achievements[idx] = e.target.value;
    renderResumePreview();
  }
  function handleAchAction(e) {
    const btn = e.target.closest('button[data-action="remove-ach"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.achievements.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('achievementsList', idx, 'btnAddAchievement');
  }

  function handleVolInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.volunteering || !resumeData.volunteering[idx]) return;
    if (e.target.classList.contains('item-vol-role')) resumeData.volunteering[idx].role = e.target.value;
    if (e.target.classList.contains('item-vol-org')) resumeData.volunteering[idx].organization = e.target.value;
    if (e.target.classList.contains('item-vol-dur')) resumeData.volunteering[idx].duration = e.target.value;
    renderResumePreview();
  }
  function handleVolAction(e) {
    const btn = e.target.closest('button[data-action="remove-vol"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.volunteering.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('volunteeringList', idx, 'btnAddVolunteering');
  }

  function handleLangInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.languages || !resumeData.languages[idx]) return;
    if (e.target.classList.contains('item-lang-name')) resumeData.languages[idx].name = e.target.value;
    if (e.target.classList.contains('item-lang-prof')) resumeData.languages[idx].proficiency = e.target.value;
    renderResumePreview();
  }
  function handleLangAction(e) {
    const btn = e.target.closest('button[data-action="remove-lang"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.languages.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('languagesList', idx, 'btnAddLanguage');
  }

  function handlePubInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.academic || !resumeData.academic.publications || !resumeData.academic.publications[idx]) return;
    resumeData.academic.publications[idx].title = e.target.value;
    renderResumePreview();
  }
  function handlePubAction(e) {
    const btn = e.target.closest('button[data-action="remove-pub"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.academic.publications.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('academicPubsList', idx, 'btnAddPublication');
  }

  function handleTeachInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.academic || !resumeData.academic.teaching || !resumeData.academic.teaching[idx]) return;
    if (e.target.classList.contains('item-teach-role')) resumeData.academic.teaching[idx].role = e.target.value;
    if (e.target.classList.contains('item-teach-inst')) resumeData.academic.teaching[idx].institution = e.target.value;
    if (e.target.classList.contains('item-teach-term')) resumeData.academic.teaching[idx].term = e.target.value;
    renderResumePreview();
  }
  function handleTeachAction(e) {
    const btn = e.target.closest('button[data-action="remove-teach"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.academic.teaching.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('academicTeachingList', idx, 'btnAddTeaching');
  }

  function handleAcademicInput(e, key, fields) {
    const idx = parseInt(e.target.dataset.index, 10);
    const list = resumeData.academic && resumeData.academic[key];
    if (!list || list[idx] === undefined) return;
    if (typeof list[idx] === 'string') list[idx] = { title: list[idx] };
    const cls = Object.keys(fields).find(name => e.target.classList.contains(name));
    if (!cls) return;
    list[idx][fields[cls]] = e.target.value;
    renderResumePreview();
  }
  function handleAcademicRemove(e, key, action, listId, addBtnId) {
    const btn = e.target.closest(`button[data-action="${action}"]`);
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.academic[key].splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus(listId, idx, addBtnId);
  }

  function setupAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const sec = header.parentElement;
        const isOpen = sec.classList.contains('open');
        sec.classList.toggle('open');
        header.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  /**
   * Export to True Vector PDF (Searchable text, A4 / Letter)
   */
  function printResume() {
    // Browser print must use the exact same paginated DOM shown in the preview.
    // The resume pages already contain their own document padding, so @page
    // margins stay at zero to avoid shrinking/reflowing the printed version.
    renderResumePreview();
    let style = getEl('printPageSize');
    if (!style) { style = document.createElement('style'); style.id = 'printPageSize'; document.head.appendChild(style); }
    style.textContent = `@media print { @page { size: ${resumeData.design.pageSize === 'letter' ? 'Letter' : 'A4'} portrait; margin: 0; } }`;
    document.fonts.ready.then(() => window.print());
  }

  function exportToVectorPDF() {
    if (!window.ApplyReadyPDF) {
      notify('PDF export is unavailable. Reload or use Browser Print.', true);
      return;
    }

    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : '').trim();
    if (!fullName) {
      notify('Add your name in Contact details before downloading.', true);
      getEl('tabEdit').click();
      getEl('sec-personal').classList.add('open');
      getEl('sec-personal').querySelector('.accordion-header').setAttribute('aria-expanded', 'true');
      const fnInp = getEl('fullName');
      if (fnInp) {
        const tabContent = getEl('tabContent');
        if (tabContent) tabContent.click();
        setTimeout(() => fnInp.focus(), 100);
      }
      return;
    }

    const btn = getEl('btnDownloadPDF') || getEl('btnQuickPDF');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
    }

    try {
      const doc = window.ApplyReadyPDF.generateResumePDF(resumeData, {
        pageSize: resumeData.design.pageSize || 'a4',
        fontFamily: resumeData.design.fontFamily || 'serif',
        fontSize: resumeData.design.fontSize || 'standard',
        template: resumeData.template || 'classic-professional',
        density: resumeData.design.density || 'standard',
        sectionOrder: resumeData.design.sectionOrder,
        sectionVisibility: resumeData.sectionVisibility
      });

      const blob = doc.toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName('Resume.pdf');
      isDirty = false;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      if (err.code === 'UNSUPPORTED_PDF_TEXT') {
        notify('Use Save as PDF in the print dialog to preserve all your characters.');
        printResume();
      } else notify('PDF could not be generated. Try Browser Print or Word.', true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  }

  /**
   * Export to Editable OOXML DOCX
   */
  function exportToDOCX() {
    if (!window.ApplyReadyDOCX) {
      notify('Word export is unavailable. Reload or use PDF.', true);
      return;
    }

    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : '').trim();
    if (!fullName) {
      notify('Add your name in Contact details before downloading.', true);
      getEl('tabEdit').click(); getEl('tabContent').click();
      getEl('sec-personal').classList.add('open');
      getEl('sec-personal').querySelector('.accordion-header').setAttribute('aria-expanded', 'true');
      getEl('fullName').focus();
      return;
    }

    const btn = getEl('btnDownloadDOCX');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Building DOCX...';
    }

    try {
      const zip = window.ApplyReadyDOCX.generateResumeDOCX(resumeData, {
        pageSize: resumeData.design.pageSize || 'a4',
        fontFamily: resumeData.design.fontFamily || 'serif',
        template: resumeData.template || 'classic-professional',
        density: resumeData.design.density || 'standard',
        fontSize: resumeData.design.fontSize || 'standard'
      });

      const blob = zip.toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName('Resume.docx');
      isDirty = false;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      notify('Word export could not be generated. Please try again.', true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  }

  /**
   * Export to Formatted Plain Text (.txt)
   */
  function exportToPlainText() {
    if (!window.ApplyReadyPDF || !window.ApplyReadyPDF.generateResumeText) {
      notify('Text export is unavailable. Please reload.', true);
      return;
    }

    const textContent = window.ApplyReadyPDF.generateResumeText(resumeData);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName('Resume.txt');
    isDirty = false;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Initialize on DOM Ready in browser
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      validateResumeSchema,
      migrateResumeSchema,
      SAMPLE_DATA,
      EMPTY_DATA,
      escapeHTML,
      sanitizeHref,
      isValidUrlFormat,
      generateReviewReport,
      renderResumeDataToHTML,
      TEMPLATES
    };
  }
})();
