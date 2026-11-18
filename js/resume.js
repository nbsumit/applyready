/**
 * ApplyReady resume builder: the editor (Write, Style, Review, Download) for the open resume.
 * Saving, the library of saved resumes and backups live in js/resume-library-ui.js; references
 * and custom sections in js/resume-sections.js; the HTML document in js/resume-render.js.
 * They talk to this file through window.ApplyReadyResumeEditor (see exposeEditor below).
 * Everything runs in the browser; nothing is uploaded.
 */

(function () {
  'use strict';

  const SCHEMA = typeof ApplyReadySchema !== 'undefined' ? ApplyReadySchema
    : (typeof require === 'function' ? require('./resume-schema.js') : null);
  const notify = (message, error = false) => { if (window.ApplyReadyUI) window.ApplyReadyUI.notify(message, error); };
  // Confirmation uses the interface dialog; window.confirm remains only as a fallback.
  const askConfirm = options => (window.ApplyReadyUI && window.ApplyReadyUI.confirm
    ? window.ApplyReadyUI.confirm(options) : Promise.resolve(window.confirm(options.message)));

  // Template catalogue, visual rules and labels shared with the export engines.
  const TPL = typeof ApplyReadyTemplates !== 'undefined' ? ApplyReadyTemplates
    : (typeof require === 'function' ? require('./templates.js') : null);
  const TEMPLATES = TPL.TEMPLATES;
  const RENDER = typeof ApplyReadyResumeRender !== 'undefined' ? ApplyReadyResumeRender
    : (typeof require === 'function' ? require('./resume-render.js') : null);
  const { escapeHTML, sanitizeHref, renderResumeDataToHTML, renderTemplateIntoContainer } = RENDER;
  // References and custom sections (js/resume-sections.js), when the page loads them.
  const EXTRA = () => (typeof window !== 'undefined' && window.ApplyReadyResumeSections) || null;

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
    publications: [],
    academic: {
      teaching: [],
      presentations: [],
      grants: []
    },
    references: [],
    referencesOnRequest: false,
    customSections: []
  };

  // A fictional final-year student, used to preview the student and fresher templates: education
  // with CGPA and percentage first, an internship, projects, a certificate and a position of
  // responsibility.
  const STUDENT_SAMPLE = {
    version: 2,
    app: 'ApplyReady',
    template: 'campus-fresher',
    design: { fontFamily: 'serif', fontSize: 'standard', density: 'standard', pageSize: 'a4', accentColor: 'navy', sectionOrder: [] },
    sectionVisibility: { summary: true, experience: true, education: true, projects: true, skills: true, certifications: true, achievements: true, volunteering: true, languages: false, academic: false },
    personal: {
      fullName: 'Ananya Rao',
      targetTitle: 'B.Tech Computer Science, 2026 | Data Analyst Intern',
      email: 'ananya.rao@email.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, Karnataka',
      linkedin: 'linkedin.com/in/ananyarao',
      github: 'github.com/ananyarao',
      website: ''
    },
    summary: 'Final-year computer science student who builds data dashboards and small web tools. Looking for an analyst or software role that works with real data.',
    experience: [
      { id: 'exp-s1', role: 'Data Analyst Intern', company: 'Northwind Retail', location: 'Bengaluru', duration: 'May 2025 - Jul 2025', bulletsText: 'Built a weekly sales dashboard in Power BI used by 6 store managers.\nCleaned two years of billing data in Python, cutting report preparation from 3 hours to 40 minutes.' }
    ],
    education: [
      { id: 'edu-s1', degree: 'B.Tech in Computer Science and Engineering', institution: 'State Institute of Technology', location: 'Bengaluru', duration: '2022 - 2026', score: 'CGPA 8.6 / 10' },
      { id: 'edu-s2', degree: 'Class XII (PCM), CBSE', institution: 'Central Public School', location: 'Mysuru', duration: '2022', score: '92.4%' }
    ],
    projects: [
      { id: 'proj-s1', name: 'Campus Placement Analytics Dashboard', tech: 'Python, Pandas, Power BI', link: 'github.com/ananyarao/placement-dashboard', bulletsText: 'Analysed four years of placement records to show offers by branch and CGPA band.\nPresented the findings to the placement cell, which now updates the dashboard each term.' },
      { id: 'proj-s2', name: 'Library Seat Booking App', tech: 'Flask, SQLite', link: '', bulletsText: 'Built a seat booking web app for the college library with a team of three.\nHandled 3,000 bookings in the first semester with no double bookings.' }
    ],
    skills: { languages: 'Python, SQL, Java, C', frameworks: 'Pandas, NumPy, Flask, scikit-learn', tools: 'Power BI, Excel, Git, Jupyter', other: 'Data structures, DBMS, Operating systems, Statistics' },
    skillLabels: { languages: 'Programming', frameworks: 'Libraries', tools: 'Tools', other: 'Coursework' },
    certifications: [{ id: 'cert-s1', name: 'Python for Data Science (online course)', issuer: '', year: '2024' }],
    achievements: ['Second place in an inter-college hackathon on smart campus ideas (2024)'],
    volunteering: [{ id: 'vol-s1', role: 'Student Placement Coordinator', organization: 'Training and Placement Cell', duration: '2025 - 2026' }],
    languages: [],
    academic: { teaching: [], presentations: [], grants: [] }
  };

  // Active Resume State
  let resumeData = SCHEMA.migrate(EMPTY_DATA);
  let isDirty = false;
  let currentZoom = 'fit';
  const changeListeners = [];

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

  // Undo and redo swap whole snapshots of this resume. setResume() empties both stacks, so history
  // never crosses from one saved resume into another.
  function stepHistory(from, to) {
    if (from.length === 0) return;
    to.push(JSON.stringify(resumeData));
    resumeData = JSON.parse(from.pop());
    refreshWholeEditor();
    updateUndoRedoButtons();
  }
  const performUndo = () => stepHistory(undoStack, redoStack);
  const performRedo = () => stepHistory(redoStack, undoStack);

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

  // Backups and saved records of versions 1 to 3 (js/resume-schema.js).
  const validateResumeSchema = payload => SCHEMA.validate(payload);
  const migrateResumeSchema = raw => SCHEMA.migrate(raw);

  /**
   * Initialize Builder on DOM Ready. The resume itself arrives from the library through setResume().
   */
  function init() {
    if (EXTRA()) EXTRA().mount(editorApi);
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

    // The vector preview does not depend on web fonts; only the HTML fallback pages are re-measured.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const sheet = getEl('resumeSheet'); if (sheet && pdfPageCount === null) visualPageCount = renderPaginatedPreview(sheet); updatePreviewScale(); });
    window.addEventListener('resize', () => { updatePreviewScale(); scaleTemplateModal(); });
    window.addEventListener('orientationchange', () => setTimeout(updatePreviewScale, 150));
  }

  /* ------------------------------------------------ Editor interface for the library and sections */
  // Load another resume: migrate it, clear undo history, folded entries and the dirty flag, redraw.
  function setResume(data) {
    clearTimeout(renderTimer);
    resumeData = SCHEMA.migrate(data);
    undoStack.length = 0;
    redoStack.length = 0;
    isDirty = false;
    collapsedEntries.clear();
    refreshWholeEditor();
    updateUndoRedoButtons();
  }
  const emitChange = () => changeListeners.forEach(fn => { try { fn(resumeData); } catch (e) { /* a listener must not break editing */ } });
  const editorApi = {
    getData: () => resumeData,
    setResume,
    isEmpty: () => isDocumentEmpty(),
    hasUserChanges: () => isDirty || undoStack.length > 0,
    onChange: fn => { changeListeners.push(fn); },
    pushHistory: () => pushHistoryState(),
    render: () => renderResumePreview(),
    scheduleRender: () => scheduleRender(),
    refreshOrder: () => renderSectionOrderControls(),
    refresh: () => refreshWholeEditor(),
    sample: () => withCurrentDesign(SCHEMA.migrate(SAMPLE_DATA), SAMPLE_DATA.sectionVisibility),
    blank: () => withCurrentDesign(SCHEMA.migrate(EMPTY_DATA), EMPTY_DATA.sectionVisibility),
    templateName: id => (TEMPLATES[id] || TEMPLATES['classic-professional']).name,
    newEntryId: prefix => newEntryId(prefix),
    focusNewEntry: id => focusNewEntry(id),
    restoreRemoveFocus: (listId, idx, addId) => restoreRemoveFocus(listId, idx, addId),
    escapeHTML,
    confirm: askConfirm,
    downloadName: suffix => downloadName(suffix),
    openSection: id => openAccordion(getEl(id)),
    announce: message => announce(message)
  };
  if (typeof window !== 'undefined') window.ApplyReadyResumeEditor = editorApi;

  function openAccordion(section) {
    if (!section || !section.classList.contains('accordion-section')) return;
    section.classList.add('open');
    const header = section.querySelector('.accordion-header');
    if (header) header.setAttribute('aria-expanded', 'true');
  }

  /**
   * Setup Editor Tabs (Content, Design, Review)
   */
  function setupEditorTabs() {
    const tabs = [
      { btn: getEl('tabContent'), pane: getEl('viewContent') },
      { btn: getEl('tabDesign'), pane: getEl('viewDesign') },
      { btn: getEl('tabReview'), pane: getEl('viewReview') },
      { btn: getEl('tabDownload'), pane: getEl('viewDownload') }
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
        if (btn.id === 'tabDownload') loadDocxEngine().catch(() => { /* retried on the Word download itself */ });
        // A new step starts at its top, below the sticky header.
        const panel = getEl('formPanel');
        if (panel && panel.getBoundingClientRect().top < 0) {
          panel.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
      });
    });
    // "Next" and "Back" buttons inside each step move along the same path.
    document.querySelectorAll('[data-goto-tab]').forEach(button => {
      button.addEventListener('click', () => {
        const target = getEl(button.dataset.gotoTab);
        if (target) { target.click(); target.focus({ preventScroll: true }); }
      });
    });
  }

  let modalTriggerElement = null;
  let activeModalTemplateId = null;

  function isDocumentEmpty() {
    const hasText = value => typeof value === 'string' ? !!value.trim()
      : Array.isArray(value) ? value.some(hasText)
      : value && typeof value === 'object' ? Object.keys(value).some(key => key !== 'id' && hasText(value[key])) : false;
    const custom = (resumeData.customSections || []).map(s => ({ text: s.text, entries: s.entries }));
    return !hasText({ personal: resumeData.personal, summary: resumeData.summary, experience: resumeData.experience, education: resumeData.education, projects: resumeData.projects, skills: resumeData.skills, certifications: resumeData.certifications, achievements: resumeData.achievements, volunteering: resumeData.volunteering, languages: resumeData.languages, publications: resumeData.publications, academic: resumeData.academic, references: resumeData.references, custom });
  }

  function newEntryId(prefix) {
    return prefix + '-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
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
      title.textContent = `${tmpl.name} | Full template preview`;
    }

    // Student templates are shown with a student's resume; the others with the general sample.
    const student = tmpl.group === 'students';
    const sample = SCHEMA.migrate(student ? STUDENT_SAMPLE : SAMPLE_DATA);
    sample.template = templateId;
    sample.design.templateId = templateId;
    sample.design.fontFamily = tmpl.fontFamily;
    sample.design.density = tmpl.density || 'standard';
    sample.design.pageSize = resumeData.design.pageSize || 'a4';
    Object.assign(sample.sectionVisibility, tmpl.defaultVisibility || {}, student ? STUDENT_SAMPLE.sectionVisibility : {});
    // The sample shows the section order this resume will have with the template: the template's
    // own order, or the person's order when they have arranged the sections themselves.
    const keepsOwnOrder = orderIsOwn(resumeData);
    sample.design.sectionOrder = keepsOwnOrder
      ? SCHEMA.normalizeSectionOrder(SCHEMA.sectionKeys(resumeData).filter(key => !SCHEMA.isCustomKey(key)), sample)
      : recommendedOrderFor(templateId, sample);
    const note = getEl('tmplModalNote');
    if (note) {
      note.textContent = `${student ? 'A sample student resume' : 'Sample content'}, for illustration. Choosing this template keeps everything you wrote${keepsOwnOrder
        ? ' and the section order you set yourself, as shown here.'
        : ', and your sections follow the order shown here.'}`;
    }
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
    document.querySelector('.site-header').inert = true;
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
    const available = modal.querySelector('.template-preview-modal-body').clientWidth - 48;
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
    document.querySelector('.site-header').inert = false;
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
        const buttons = Array.from(modal.querySelectorAll('button:not(:disabled), [tabindex="0"]'));
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

  // After a move or duplicate, focus stays in the same entry: the pressed button, or once the entry
  // reaches the top or the bottom (and that button is disabled) the opposite move button. A move is
  // announced with the entry's new position.
  function restoreListFocus(listId, targetId, preferredAction, fallbackAddBtnId, noun) {
    setTimeout(() => {
      const list = getEl(listId);
      if (!list) return;
      if (targetId) {
        const item = list.querySelector(`.dynamic-item[data-id="${targetId}"]`);
        if (item) {
          const opposite = preferredAction.startsWith('move-up-') ? preferredAction.replace('move-up-', 'move-down-')
            : preferredAction.startsWith('move-down-') ? preferredAction.replace('move-down-', 'move-up-') : '';
          const btn = [`button[data-action="${preferredAction}"]`, opposite && `button[data-action="${opposite}"]`, '.entry__toggle', 'button']
            .filter(Boolean).map(sel => item.querySelector(sel)).find(b => b && !b.disabled);
          if (btn) {
            btn.focus();
            if (noun) {
              const items = Array.from(list.querySelectorAll(':scope > .dynamic-item'));
              announce(`${noun[0].toUpperCase()}${noun.slice(1)} moved to position ${items.indexOf(item) + 1} of ${items.length}.`);
            }
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
      btn.className = 'chip';
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
      const selected = resumeData.template === key;
      card.className = `template-card ${selected ? 'active' : ''}`;
      card.dataset.templateId = key;

      const svgThumb = tmpl.svgThumbnail || `<div class="template-thumb-fallback">${escapeHTML(tmpl.name)}</div>`;

      // The whole face is the select button; Preview is a small separate control.
      card.innerHTML = `
        <button type="button" class="template-select btn-select-template" data-template="${key}" aria-pressed="${selected}" aria-label="Use ${escapeHTML(tmpl.name)} template">
          <span class="template-thumb-wrap">${svgThumb}</span>
          <span class="template-meta-row">
            <strong class="template-card-title">${escapeHTML(tmpl.name)}</strong>
            <span class="template-badge">${escapeHTML(tmpl.badge || '')}</span>
            <span class="template-check" aria-hidden="true"><i class="fa-solid fa-check"></i> In use</span>
          </span>
          <span class="template-card-desc">${escapeHTML(tmpl.description)}</span>
        </button>
        <button type="button" class="btn btn-sm btn-icon btn-preview-template" data-template="${key}" title="Preview ${escapeHTML(tmpl.name)}" aria-label="Full preview of ${escapeHTML(tmpl.name)}">
          <i aria-hidden="true" class="fa-regular fa-eye"></i>
        </button>
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

    const previousTemplate = resumeData.template;
    const previousOrder = SCHEMA.sectionKeys(resumeData);
    const previousLabels = TPL.getSkillLabels(previousTemplate, resumeData);
    resumeData.template = templateId;
    resumeData.design.templateId = templateId;
    const tmpl = TEMPLATES[templateId];

    // Automatically set default typography & density associated with template
    if (tmpl.fontFamily) resumeData.design.fontFamily = tmpl.fontFamily;
    if (tmpl.density) resumeData.design.density = tmpl.density;

    // The template's section order is part of what it promises, so it applies unless the person
    // has arranged the sections by hand. The note under the card says what changed and undoes it.
    if (Array.isArray(tmpl.recommendedOrder) && !orderIsOwn(resumeData)) {
      resumeData.design.sectionOrder = recommendedOrderFor(templateId, resumeData);
      resumeData.design.orderCustom = false;
    }

    // Skill rows the person has filled in keep the label they were written under. Otherwise a
    // template would silently turn "Core Competencies: Python, SQL" into "Leadership: Python, SQL".
    const keptLabels = [];
    if (previousTemplate !== templateId) {
      const next = TPL.getSkillLabels(templateId, resumeData);
      const custom = resumeData.skillLabels && typeof resumeData.skillLabels === 'object' ? resumeData.skillLabels : (resumeData.skillLabels = {});
      SKILL_KEYS.forEach(key => {
        const filled = typeof resumeData.skills[key] === 'string' && resumeData.skills[key].trim();
        const named = typeof custom[key] === 'string' && custom[key].trim();
        if (filled && !named && next[key] !== previousLabels[key]) { custom[key] = previousLabels[key]; keptLabels.push(key); }
      });
    }

    // Update gallery UI active states
    document.querySelectorAll('.template-card').forEach(c => {
      const isCurrent = c.dataset.templateId === templateId;
      c.classList.toggle('active', isCurrent);
      const btn = c.querySelector('.btn-select-template');
      if (btn) btn.setAttribute('aria-pressed', String(isCurrent));
    });

    updateDesignControlsFromState();
    updateTemplateFieldLabels();
    renderResumePreview();
    runResumeReview();
    showTemplateNote(previousOrder, keptLabels);
  }

  const SKILL_KEYS = ['languages', 'frameworks', 'tools', 'other'];
  // Names of the editor's sections, as review findings refer to them.
  const SECTION_NAMES = {
    personal: 'Contact details', summary: 'Professional summary', experience: 'Work experience', education: 'Education', skills: 'Skills', projects: 'Projects',
    certifications: 'Certifications', achievements: 'Achievements', volunteering: 'Leadership and volunteering', languages: 'Languages', publications: 'Publications',
    academic: 'Academic and research', references: 'References', custom: 'Custom sections'
  };
  // A template's order for a resume. A template that hides the summary by default (or does not
  // place it) still keeps a written summary at the top rather than after every other section:
  // choosing a template does not hide the summary, so its place must stay where a reader expects it.
  function recommendedOrderFor(templateId, data) {
    const tmpl = TEMPLATES[templateId] || {};
    const order = tmpl.recommendedOrder || [];
    const hidesSummary = !order.includes('summary') || (tmpl.defaultVisibility && tmpl.defaultVisibility.summary === false);
    return SCHEMA.normalizeSectionOrder(hidesSummary ? ['summary', ...order.filter(key => key !== 'summary')] : order, data);
  }

  // Whether the person arranged the sections themselves. Resumes saved before this was recorded
  // count as arranged by hand only when their order is not the recommended order of any template.
  function orderIsOwn(data) {
    if (typeof data.design.orderCustom === 'boolean') return data.design.orderCustom;
    const current = JSON.stringify(SCHEMA.sectionKeys(data));
    return !Object.keys(TEMPLATES).some(id => Array.isArray(TEMPLATES[id].recommendedOrder)
      && [recommendedOrderFor(id, data), SCHEMA.normalizeSectionOrder(TEMPLATES[id].recommendedOrder, data)].some(order => JSON.stringify(order) === current));
  }

  // The headings of the sections that print, in order, for messages ("Education, Key Projects, ...").
  function shownSectionNames(order) {
    const names = sectionLabels();
    const shown = order.filter(key => {
      if (!names[key]) return false;
      if (SCHEMA.isCustomKey(key)) { const s = (resumeData.customSections || []).find(c => SCHEMA.customKey(c.id) === key); return !!s && s.visible !== false; }
      return resumeData.sectionVisibility[key] !== false;
    }).map(key => names[key]);
    return shown.length > 6 ? shown.slice(0, 6).join(', ') + ' and more' : shown.join(', ');
  }

  // A short note under the chosen template card: what choosing it did to the section order and
  // the skill labels, with a way back. An empty resume has nothing to rearrange, so it gets none.
  function showTemplateNote(previousOrder, keptLabels) {
    document.querySelectorAll('.template-note').forEach(el => el.remove());
    if (isDocumentEmpty()) return;
    const tmpl = TEMPLATES[resumeData.template];
    const card = document.querySelector(`#templateGalleryGrid .template-card[data-template-id="${resumeData.template}"]`);
    if (!tmpl || !card) return;
    const order = SCHEMA.sectionKeys(resumeData);
    const changed = JSON.stringify(order) !== JSON.stringify(previousOrder);
    const recommended = recommendedOrderFor(resumeData.template, resumeData);
    const parts = [], spoken = [];
    const say = (text, button) => { spoken.push(text); parts.push(`<p>${escapeHTML(text)}</p>${button || ''}`); };
    if (changed) {
      say(`Your sections now follow this template's order: ${shownSectionNames(order)}.`, '<button type="button" class="btn btn-sm" data-note="keep-order">Keep my previous order</button>');
    } else if (JSON.stringify(order) !== JSON.stringify(recommended)) {
      say(`Your own section order is kept. This template suggests: ${shownSectionNames(recommended)}.`, '<button type="button" class="btn btn-sm" data-note="use-order">Use this template\'s order</button>');
    }
    if (keptLabels.length) {
      const labels = TPL.getSkillLabels(resumeData.template, resumeData);
      say(`Your skill rows keep their labels (${keptLabels.map(key => labels[key]).join(', ')}). To use this template's wording instead, clear the label boxes in Skills.`);
    }
    if (!parts.length) return;
    const note = document.createElement('div');
    note.className = 'template-note';
    note.innerHTML = parts.join('');
    card.appendChild(note);
    announce(spoken.join(' '));
    const restore = note.querySelector('[data-note="keep-order"]');
    if (restore) restore.addEventListener('click', () => {
      pushHistoryState();
      resumeData.design.sectionOrder = SCHEMA.normalizeSectionOrder(previousOrder, resumeData);
      resumeData.design.orderCustom = true;
      renderSectionOrderControls();
      renderResumePreview();
      note.innerHTML = `<p>Your previous section order is back: ${escapeHTML(shownSectionNames(SCHEMA.sectionKeys(resumeData)))}.</p>`;
      note.tabIndex = -1;
      note.focus();
      announce(note.textContent.trim());
    });
    const use = note.querySelector('[data-note="use-order"]');
    if (use) use.addEventListener('click', () => {
      applyRecommendedOrder();
      note.innerHTML = `<p>Your sections now follow this template's order: ${escapeHTML(shownSectionNames(SCHEMA.sectionKeys(resumeData)))}.</p>`;
      note.tabIndex = -1;
      note.focus();
      announce(note.textContent.trim());
    });
  }

  // Polite screen-reader updates for changes that move things around (reordering, template notes).
  function announce(message) {
    const region = getEl('rbAnnounce');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
  }

  /**
   * Populate All Form Input Fields from State
   */
  function populateAllFormFields() {
    const p = resumeData.personal || {};
    if (getEl('fullName')) { getEl('fullName').value = p.fullName || ''; clearFullNameError(); }
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
    ['certifications', 'achievements', 'volunteering', 'languages', 'publications', 'references'].forEach(key => {
      const text = TPL.getSectionLabel(resumeData.template, key);
      const header = document.querySelector(`#sec-${key} .accordion-header > span`);
      if (header && header.lastChild && header.lastChild.nodeType === 3) header.lastChild.textContent = text;
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

  // ---- Entry objects: one bordered, titled unit per job, school, project and so on ----
  function entryTitle(kind, item, index) {
    const join = (a, b) => (a && b ? `${a}, ${b}` : a || b);
    const t = value => (typeof value === 'string' ? value.trim() : '');
    switch (kind) {
      case 'exp': return join(t(item.role), t(item.company)) || `Role ${index + 1}`;
      case 'edu': return join(t(item.degree), t(item.institution)) || `Education ${index + 1}`;
      case 'proj': return t(item.name) || `Project ${index + 1}`;
      default: return '';
    }
  }

  const iconButton = (action, attr, label, icon, extraClass = '', disabled = false) =>
    `<button type="button" class="btn btn-sm btn-icon btn-ghost ${extraClass}" data-action="${action}" ${attr} title="${label}" aria-label="${label}"${disabled ? ' disabled' : ''}><i aria-hidden="true" class="${icon}"></i></button>`;

  // Reorder, duplicate and delete share one quiet style; delete sits apart and only turns red when aimed at.
  function entryActions(kind, id, index, count, noun) {
    const attr = `data-id="${id}"`;
    return `<div class="dynamic-item-actions entry__actions">
            ${iconButton('move-up-' + kind, attr, `Move ${noun} ${index + 1} up`, 'fa-solid fa-arrow-up', '', index === 0)}
            ${iconButton('move-down-' + kind, attr, `Move ${noun} ${index + 1} down`, 'fa-solid fa-arrow-down', '', index === count - 1)}
            ${iconButton('duplicate-' + kind, attr, `Duplicate ${noun} ${index + 1}`, 'fa-regular fa-copy')}
            <span class="entry__sep" aria-hidden="true"></span>
            ${iconButton('remove-' + kind, attr, `Delete ${noun} ${index + 1}`, 'fa-regular fa-trash-can', 'btn-danger-ghost')}
          </div>`;
  }

  const fieldHTML = (id, label, cls, value, placeholder, optional) => `<div class="field">
            <label class="field-label" for="${id}">${label}${optional ? ' <span class="optional">(optional)</span>' : ''}</label>
            <input type="text" id="${id}" class="input ${cls}" placeholder="${placeholder}" value="${escapeHTML(value)}">
          </div>`;

  // Entries can be folded to their title so a long history stays scannable. The folded set
  // lives only in this page view; it survives re-rendering but is never saved.
  const collapsedEntries = new Set();
  function entryFrame(kind, item, index, count, noun, body) {
    const open = !collapsedEntries.has(item.id);
    const bodyId = `entry-body-${item.id}`;
    return `<div class="entry__head dynamic-item-header">
          <button type="button" class="entry__toggle" aria-expanded="${open}" aria-controls="${bodyId}" data-entry-toggle="${item.id}">
            <span class="entry__num" aria-hidden="true">${index + 1}</span>
            <strong class="entry__title">${escapeHTML(entryTitle(kind, item, index))}</strong>
          </button>
          ${entryActions(kind, item.id, index, count, noun)}
        </div>
        <div class="entry__body" id="${bodyId}">${body}</div>`;
  }

  function setEntryOpen(entry, open) {
    if (!entry) return;
    const toggle = entry.querySelector('.entry__toggle');
    entry.classList.toggle('is-collapsed', !open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (open) collapsedEntries.delete(entry.dataset.id); else collapsedEntries.add(entry.dataset.id);
  }

  function mountEntries(list, kind, items, noun, bodyFor) {
    list.innerHTML = '';
    items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `dynamic-item entry${collapsedEntries.has(item.id) ? ' is-collapsed' : ''}`;
      el.dataset.id = item.id;
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', `${noun[0].toUpperCase()}${noun.slice(1)} ${index + 1}`);
      el.innerHTML = entryFrame(kind, item, index, items.length, noun, bodyFor(item));
      list.appendChild(el);
    });
  }

  // Keep the heading of an entry in step with what is typed in it.
  function refreshEntryTitle(parent, kind, item) {
    const title = parent && parent.querySelector('.entry__title');
    if (!title) return;
    const index = Array.from(parent.parentElement.children).indexOf(parent);
    title.textContent = entryTitle(kind, item, index);
  }

  // A freshly added entry takes focus so typing can start at once.
  function focusNewEntry(listId) {
    setTimeout(() => {
      const list = getEl(listId);
      const last = list && list.lastElementChild;
      const field = last && last.querySelector('input, textarea');
      if (!field) return;
      field.focus({ preventScroll: true });
      const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      field.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    }, 0);
  }

  function renderExperienceList() {
    const list = getEl('experienceList');
    if (!list) return;
    mountEntries(list, 'exp', resumeData.experience || [], 'role', exp => `
          <div class="field-row">
            ${fieldHTML('exp-role-' + exp.id, 'Job title', 'item-role', exp.role, 'e.g. Operations Coordinator')}
            ${fieldHTML('exp-comp-' + exp.id, 'Company or organization', 'item-company', exp.company, 'e.g. Acme Corp')}
          </div>
          <div class="field-row">
            ${fieldHTML('exp-dur-' + exp.id, 'Dates', 'item-duration', exp.duration, 'e.g. Jan 2022 - Present')}
            ${fieldHTML('exp-loc-' + exp.id, 'Location', 'item-location', exp.location, 'e.g. Chicago, IL', true)}
          </div>
          <div class="field">
            <label class="field-label" for="exp-bul-${exp.id}">Responsibilities and results</label>
            <textarea id="exp-bul-${exp.id}" class="textarea item-bullets" rows="4" placeholder="One bullet per line, for example: Cut report turnaround by 25% by automating weekly data pulls">${escapeHTML(exp.bulletsText)}</textarea>
            <p class="field-hint">One bullet per line. Start with an action verb and add a number where you can.</p>
          </div>`);
  }

  function renderEducationList() {
    const list = getEl('educationList');
    if (!list) return;
    mountEntries(list, 'edu', resumeData.education || [], 'education entry', edu => `
          <div class="field-row">
            ${fieldHTML('edu-deg-' + edu.id, 'Degree or field of study', 'item-degree', edu.degree, 'e.g. B.S. in Management')}
            ${fieldHTML('edu-inst-' + edu.id, 'School or university', 'item-institution', edu.institution, 'e.g. University Name')}
          </div>
          <div class="field-row field-row--3">
            ${fieldHTML('edu-dur-' + edu.id, 'Years', 'item-duration', edu.duration, 'e.g. 2018 - 2022')}
            ${fieldHTML('edu-loc-' + edu.id, 'Location', 'item-location', edu.location, 'e.g. Chicago, IL', true)}
            ${fieldHTML('edu-score-' + edu.id, 'GPA or honors', 'item-score', edu.score, 'e.g. GPA 3.8 / 4.0', true)}
          </div>`);
  }

  function renderProjectsList() {
    const list = getEl('projectsList');
    if (!list) return;
    mountEntries(list, 'proj', resumeData.projects || [], 'project', proj => `
          <div class="field-row">
            ${fieldHTML('proj-name-' + proj.id, 'Project name', 'item-name', proj.name, 'e.g. Enterprise Automation')}
            ${fieldHTML('proj-tech-' + proj.id, 'Tools and methods', 'item-tech', proj.tech, 'e.g. Jira, Tableau, SAP', true)}
          </div>
          ${fieldHTML('proj-link-' + proj.id, 'Link or case study', 'item-link', proj.link, 'e.g. portfolio.com/case-study', true)}
          <div class="field">
            <label class="field-label" for="proj-bul-${proj.id}">What you did and what changed</label>
            <textarea id="proj-bul-${proj.id}" class="textarea item-bullets" rows="3" placeholder="One bullet per line">${escapeHTML(proj.bulletsText)}</textarea>
            <p class="field-hint">One bullet per line.</p>
          </div>`);
  }

  // Optional sections keep their index based data; each item is still one titled, deletable unit.
  function labelOptionalFields() {
    document.querySelectorAll('#optionalSectionsArea button[data-action]').forEach(button => {
      button.setAttribute('aria-label', `Delete ${button.dataset.action.replace('remove-', '')} entry ${Number(button.dataset.index) + 1}`);
    });
  }

  function optionalItem(title, action, idx, body, extraClass) {
    const el = document.createElement('div');
    el.className = `dynamic-item entry entry--compact${extraClass ? ' ' + extraClass : ''}`;
    const nouns = { 'remove-cert': 'Certification', 'remove-ach': 'Achievement', 'remove-vol': 'Leadership entry', 'remove-lang': 'Language', 'remove-pub': 'Publication', 'remove-teach': 'Teaching entry', 'remove-pres': 'Presentation', 'remove-grant': 'Grant' };
    el.innerHTML = `<div class="entry__head dynamic-item-header">
          <span class="entry__num" aria-hidden="true">${idx + 1}</span>
          <strong class="entry__title" data-fallback="${nouns[action] || 'Entry'} ${idx + 1}">${escapeHTML(title)}</strong>
          <div class="dynamic-item-actions entry__actions">
            <button type="button" class="btn btn-sm btn-icon btn-danger-ghost" data-action="${action}" data-index="${idx}" title="Delete entry ${idx + 1}" aria-label="Delete entry ${idx + 1}"><i aria-hidden="true" class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
        <div class="entry__body">${body}</div>`;
    return el;
  }
  const optField = (prefix, idx, label, cls, value, placeholder) => `<div class="field">
            <label class="field-label" for="${prefix}-${idx}">${label}</label>
            <input type="text" id="${prefix}-${idx}" class="input ${cls}" placeholder="${placeholder}" value="${escapeHTML(value)}" data-index="${idx}">
          </div>`;

  function renderOptionalSections() {
    const vis = resumeData.sectionVisibility || {};
    const fill = (listId, items, build) => {
      const list = getEl(listId);
      if (!list) return;
      list.innerHTML = '';
      items.forEach((item, idx) => list.appendChild(build(item, idx)));
    };
    const show = (id, on) => { const sec = getEl(id); if (sec) sec.style.display = on ? 'block' : 'none'; return !!sec; };

    if (show('sec-certifications', vis.certifications)) {
      fill('certificationsList', resumeData.certifications || [], (c, idx) => optionalItem(c.name || c.title || `Certification ${idx + 1}`, 'remove-cert', idx, `
          <div class="field-row">
            ${optField('cert-name', idx, 'Certification name', 'item-cert-name', c.name || c.title, 'e.g. PMP')}
            ${optField('cert-year', idx, 'Year', 'item-cert-year', c.year || c.date, 'e.g. 2024')}
          </div>
          ${optField('cert-issuer', idx, 'Issuing body', 'item-cert-issuer', c.issuer, 'e.g. Project Management Institute')}`));
    }
    if (show('sec-achievements', vis.achievements)) {
      fill('achievementsList', resumeData.achievements || [], (ach, idx) => {
        const text = typeof ach === 'string' ? ach : (ach.title || ach.text || '');
        return optionalItem(text || `Achievement ${idx + 1}`, 'remove-ach', idx, optField('ach-text', idx, 'Achievement', 'item-ach-text', text, 'e.g. Recipient of the 2023 Leadership Award'));
      });
    }
    if (show('sec-volunteering', vis.volunteering)) {
      fill('volunteeringList', resumeData.volunteering || [], (v, idx) => optionalItem(v.role || `Leadership entry ${idx + 1}`, 'remove-vol', idx, `
          <div class="field-row">
            ${optField('vol-role', idx, 'Role', 'item-vol-role', v.role, 'e.g. Volunteer mentor')}
            ${optField('vol-org', idx, 'Organization', 'item-vol-org', v.organization || v.org, 'e.g. Community Group')}
          </div>
          ${optField('vol-dur', idx, 'Dates', 'item-vol-dur', v.duration, 'e.g. 2021 - 2023')}`));
    }
    if (show('sec-languages', vis.languages)) {
      fill('languagesList', resumeData.languages || [], (l, idx) => {
        const name = typeof l === 'string' ? l : (l.name || '');
        const prof = typeof l === 'string' ? '' : (l.proficiency || '');
        return optionalItem(name || `Language ${idx + 1}`, 'remove-lang', idx, `
          <div class="field-row">
            ${optField('lang-name', idx, 'Language', 'item-lang-name', name, 'e.g. Spanish')}
            ${optField('lang-prof', idx, 'Proficiency', 'item-lang-prof', prof, 'e.g. Professional working')}
          </div>`);
      });
    }
    if (show('sec-publications', vis.publications)) {
      fill('publicationsList', resumeData.publications || [], (p, idx) => optionalItem(`Publication ${idx + 1}`, 'remove-pub', idx, `<div class="field">
            <label class="field-label" for="pub-text-${idx}">Full citation</label>
            <textarea id="pub-text-${idx}" class="textarea item-pub-text" data-index="${idx}" rows="3" placeholder="Authors, title, journal or publisher, year">${escapeHTML(p.title || p.citation)}</textarea>
          </div>`));
    }
    if (show('sec-academic', vis.academic)) {
      const academic = resumeData.academic || {};
      fill('academicTeachingList', academic.teaching || [], (t, idx) => optionalItem(t.role || t.course || `Teaching entry ${idx + 1}`, 'remove-teach', idx, `
          <div class="field-row">
            ${optField('teach-role', idx, 'Role or course', 'item-teach-role', t.role || t.course, 'e.g. Teaching assistant, Statistics')}
            ${optField('teach-inst', idx, 'Institution', 'item-teach-inst', t.institution, 'e.g. University Name')}
          </div>
          ${optField('teach-term', idx, 'Term or year', 'item-teach-term', t.term, 'e.g. Fall 2024')}`));
      fill('academicPresentationsList', academic.presentations || [], (pr, idx) => {
        const title = typeof pr === 'string' ? pr : pr.title;
        return optionalItem(title || `Presentation ${idx + 1}`, 'remove-pres', idx, `
          <div class="field-row">
            ${optField('pres-title', idx, 'Talk or poster title', 'item-pres-title', title, 'Title')}
            ${optField('pres-event', idx, 'Conference, place and year', 'item-pres-event', typeof pr === 'string' ? '' : pr.event, 'e.g. ACM CHI, Hamburg, 2024')}
          </div>`);
      });
      fill('academicGrantsList', academic.grants || [], (g, idx) => {
        const title = typeof g === 'string' ? g : (g.title || g.name);
        const rest = typeof g === 'string' ? {} : g;
        return optionalItem(title || `Grant ${idx + 1}`, 'remove-grant', idx, `
          <div class="field-row">
            ${optField('grant-title', idx, 'Grant or award title', 'item-grant-title', title, 'Title')}
            ${optField('grant-funder', idx, 'Funding body', 'item-grant-funder', rest.funder, 'e.g. Research Council')}
          </div>
          ${optField('grant-year', idx, 'Year', 'item-grant-year', rest.year, 'e.g. 2024')}`);
      });
    }
    if (EXTRA()) EXTRA().render();
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
    const apply = getEl('btnApplyRecommendedOrder');
    if (apply) apply.addEventListener('click', () => {
      if (!applyRecommendedOrder()) return;
      document.querySelectorAll('.template-note').forEach(el => el.remove());
      const first = document.querySelector('#sectionOrderContainer button:not(:disabled), #sectionOrderContainer input');
      if (first) first.focus();
      announce(`Sections now follow the ${TEMPLATES[resumeData.template].name} order.`);
    });
  }

  // Put the sections in the open template's recommended order; choosing templates then follows
  // their orders again until the person rearranges sections by hand.
  function applyRecommendedOrder() {
    const tmpl = TEMPLATES[resumeData.template];
    if (!tmpl || !Array.isArray(tmpl.recommendedOrder)) return false;
    pushHistoryState();
    resumeData.design.sectionOrder = recommendedOrderFor(resumeData.template, resumeData);
    resumeData.design.orderCustom = false;
    renderSectionOrderControls();
    renderResumePreview();
    return true;
  }

  // Heading of every section as the resume prints it, by section key.
  function sectionLabels() {
    const labels = { academic: 'Academic & Research (CV)' };
    ['summary', 'experience', 'education', 'projects', 'skills'].forEach(key => { labels[key] = TPL.getSectionTitle(resumeData, resumeData.template, key); });
    ['certifications', 'achievements', 'volunteering', 'languages', 'publications', 'references'].forEach(key => { labels[key] = TPL.getSectionLabel(resumeData.template, key); });
    (resumeData.customSections || []).forEach(s => { labels[SCHEMA.customKey(s.id)] = s.title.trim() || 'Custom section'; });
    return labels;
  }

  // Offer the template's own section order whenever the resume uses a different one.
  function updateRecommendedOrderButton() {
    const apply = getEl('btnApplyRecommendedOrder');
    if (!apply) return;
    const tmpl = TEMPLATES[resumeData.template] || {};
    const differs = Array.isArray(tmpl.recommendedOrder) && JSON.stringify(SCHEMA.sectionKeys(resumeData)) !== JSON.stringify(recommendedOrderFor(resumeData.template, resumeData));
    apply.classList.toggle('hidden', !differs);
    if (differs) apply.innerHTML = `<i aria-hidden="true" class="fa-solid fa-arrows-rotate"></i> Use the ${escapeHTML(tmpl.name)} section order`;
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

    const order = SCHEMA.sectionKeys(resumeData);
    updateRecommendedOrderButton();
    const labels = sectionLabels();

    order.forEach((key, index) => {
      if (!labels[key]) return;
      const custom = SCHEMA.isCustomKey(key) ? (resumeData.customSections || []).find(s => SCHEMA.customKey(s.id) === key) : null;
      const isVis = custom ? custom.visible !== false : resumeData.sectionVisibility[key] !== false;

      const row = document.createElement('div');
      row.className = 'dynamic-item section-order-row';
      row.innerHTML = `
        <span class="section-order-row__name">${escapeHTML(labels[key])}</span>
        <label class="switch switch--inline" title="${isVis ? 'Shown' : 'Hidden'} on the resume">
          <input type="checkbox" class="chk-section-vis" data-key="${key}" role="switch" aria-label="Show ${escapeHTML(labels[key])} on the resume" ${isVis ? 'checked' : ''}>
        </label>
        <div class="section-order-row__actions">
          <button type="button" class="btn btn-sm btn-icon btn-ghost" data-action="order-up" data-index="${index}" title="Move up" aria-label="Move ${escapeHTML(labels[key])} up" ${index === 0 ? 'disabled' : ''}>
            <i aria-hidden="true" class="fa-solid fa-arrow-up"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-ghost" data-action="order-down" data-index="${index}" title="Move down" aria-label="Move ${escapeHTML(labels[key])} down" ${index === order.length - 1 ? 'disabled' : ''}>
            <i aria-hidden="true" class="fa-solid fa-arrow-down"></i>
          </button>
        </div>
      `;

      row.querySelector('.chk-section-vis').addEventListener('change', (e) => {
        pushHistoryState();
        if (custom) custom.visible = e.target.checked;
        else resumeData.sectionVisibility[key] = e.target.checked;
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
          resumeData.design.orderCustom = true;
          renderSectionOrderControls();
          renderResumePreview();
          // Focus stays on the moved row: the same button, or the other one once the row reaches the
          // top or the bottom and the pressed button is disabled.
          const newIdx = (action === 'order-up') ? idx - 1 : idx + 1;
          const rows = container.querySelectorAll('.section-order-row');
          const moved = rows[newIdx];
          if (moved) {
            const other = action === 'order-up' ? 'order-down' : 'order-up';
            const target = [`button[data-action="${action}"]`, `button[data-action="${other}"]`, '.chk-section-vis'].map(sel => moved.querySelector(sel)).find(b => b && !b.disabled);
            if (target) target.focus();
            announce(`${labels[order[newIdx]]} moved to position ${newIdx + 1} of ${rows.length}.`);
          }
        });
      });

      container.appendChild(row);
    });
  }

  // One quiet line per section header says what is in it, so the outline doubles as a status view.
  function updateSectionMeta() {
    const t = value => (typeof value === 'string' ? value.trim() : '');
    const count = (items, one, many) => {
      const n = (items || []).filter(x => x && (typeof x === 'string' ? t(x) : Object.keys(x).some(k => k !== 'id' && t(x[k])))).length;
      return n ? `${n} ${n === 1 ? one : many}` : '';
    };
    const p = resumeData.personal || {};
    const words = t(resumeData.summary) ? t(resumeData.summary).split(/\s+/).length : 0;
    const skills = resumeData.skills || {};
    const skillCount = ['languages', 'frameworks', 'tools', 'other'].reduce((n, k) => n + t(skills[k]).split(',').filter(x => x.trim()).length, 0);
    const academic = resumeData.academic || {};
    const academicCount = ['teaching', 'presentations', 'grants'].reduce((n, k) => n + (academic[k] || []).length, 0);
    const meta = {
      personal: t(p.fullName) || '',
      summary: words ? `${words} words` : '',
      experience: count(resumeData.experience, 'role', 'roles'),
      education: count(resumeData.education, 'entry', 'entries'),
      projects: count(resumeData.projects, 'project', 'projects'),
      skills: skillCount ? `${skillCount} skills` : '',
      certifications: count(resumeData.certifications, 'item', 'items'),
      achievements: count(resumeData.achievements, 'item', 'items'),
      volunteering: count(resumeData.volunteering, 'entry', 'entries'),
      languages: count(resumeData.languages, 'language', 'languages'),
      publications: count(resumeData.publications, 'publication', 'publications'),
      academic: academicCount ? `${academicCount} items` : ''
    };
    if (EXTRA()) Object.assign(meta, EXTRA().meta());
    document.querySelectorAll('.accordion-meta[data-meta]').forEach(el => {
      const text = meta[el.dataset.meta] || '';
      el.textContent = text || 'Empty';
      el.classList.toggle('is-empty', !text);
    });
  }

  /**
   * Render Resume Live Preview (DOM Updates)
   */
  let pdfPageCount = 1;
  let visualPageCount = 1;
  // Typing redraws once the person pauses (layout of every page costs tens of milliseconds on a slow
  // computer). The data itself is updated on every keystroke, so exports never lag behind.
  const RENDER_DELAY = 180;
  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderResumePreview, RENDER_DELAY);
    // The counts in the section headers are cheap, so they follow every keystroke.
    updateSectionMeta();
  }
  function renderResumePreview() {
    clearTimeout(renderTimer);
    renderTimer = null;
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
    emitChange();
    updatePreviewScale();
    updateSectionMeta();
    refreshReview();
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
    [['btnZoomFit', 'fit'], ['btnZoom100', '100']].forEach(([id, zoom]) => {
      const button = getEl(id);
      if (button) button.setAttribute('aria-pressed', String(currentZoom === zoom));
    });

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
      const field = name => (exp.id ? `exp-${name}-${exp.id}` : undefined);
      if (!t(exp.role)) add('warning', `Experience "${label}" has no job title.`, 'experience', field('role'));
      if (!t(exp.company)) add('info', `Experience "${label}" has no company or organisation.`, 'experience', field('comp'));
      if (!t(exp.duration)) add('warning', `Experience "${label}" has no dates. Recruiters and many applicant tracking systems use dates to work out your experience.`, 'experience', field('dur'));
      if (!splitBullets(exp.bulletsText).length) add('info', `Experience "${label}" has no bullet points describing your work.`, 'experience', field('bul'));
      if (splitBullets(exp.bulletsText).length > 8) add('info', `Experience "${label}" has ${splitBullets(exp.bulletsText).length} bullets. Keep the strongest 3 to 6.`, 'experience', field('bul'));
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
    education.forEach(edu => { if (!t(edu.duration)) add('info', `Education "${t(edu.degree) || t(edu.institution)}" has no dates or graduation year.`, 'education', edu.id ? `edu-dur-${edu.id}` : undefined); });
    const skills = data.skills || {};
    if (shown('skills') && !['languages', 'frameworks', 'tools', 'other'].some(key => t(skills[key]))) add('warning', 'Skills section is empty. Applicant tracking systems match job keywords against it.', 'skills', 'skillLanguages');

    // Placeholders and document length
    const strPayload = JSON.stringify(data).toLowerCase();
    if (/lorem ipsum|\[company name\]|\[your name\]|xxx|todo:/.test(strPayload)) add('warning', 'Placeholder text detected (for example "[Company Name]" or "Lorem ipsum"). Replace it before you send the file.', 'summary');
    if (pageCount && pageCount > 2 && data.template !== 'academic-cv') add('warning', `Your PDF is ${pageCount} pages. Most employers expect one or two pages; consider trimming older roles.`, 'experience');
    else if (pageCount === 2 && experience.length <= 1 && education.length <= 2) add('info', 'Your PDF runs to two pages with little experience. Try the Compact density or 10 pt text to fit one page.', 'experience');
    // Characters outside the PDF's built-in fonts (₹, arrows, emoji, Indian scripts): name them and
    // the first field that has them, and offer a plain replacement where one exists.
    const odd = findUnsupportedText(data);
    if (odd.length) {
      const chars = [...new Set(odd.flatMap(x => x.chars))];
      const more = odd.length > 1 ? ` (and ${odd.length - 1} more ${odd.length === 2 ? 'place' : 'places'})` : '';
      issues.push({
        type: 'warning',
        message: `${capital(quoteList(chars))} cannot be written with the PDF's built-in fonts, so Download PDF opens your browser's print dialog instead, where Save as PDF keeps every character. Word and text downloads keep them as well.`,
        section: odd[0].section,
        where: odd[0].where + more,
        targetField: odd[0].field,
        replace: chars.some(c => REPLACEMENTS[c]) ? chars.filter(c => REPLACEMENTS[c]) : null
      });
    } else if (!pageCount) add('info', 'Some characters need a Unicode font, so PDF download uses your browser\'s Save as PDF. Word and text downloads keep every character.', 'personal');

    if (data.template === 'academic-cv') add('info', 'Academic / Research CV is designed for comprehensive multi-page dossiers with publications and teaching.', 'academic');

    return issues;
  }

  // Plain stand-ins for common symbols the PDF fonts lack. Each is offered, never applied silently.
  const REPLACEMENTS = {
    '₹': { pattern: /₹\s*/g, with: 'Rs. ', label: 'Rs.' },
    '→': { pattern: /\s*→\s*/g, with: ' - ', label: '-' },
    '➔': { pattern: /\s*➔\s*/g, with: ' - ', label: '-' },
    '⇒': { pattern: /\s*⇒\s*/g, with: ' - ', label: '-' },
    '✓': { pattern: /✓\s*/g, with: '', label: 'nothing' },
    '✔': { pattern: /✔\s*/g, with: '', label: 'nothing' },
    '≥': { pattern: /≥/g, with: '>=', label: '>=' },
    '≤': { pattern: /≤/g, with: '<=', label: '<=' }
  };
  // Writing systems named as a whole ("Devanagari text") rather than letter by letter: their vowel
  // signs and viramas mean nothing on their own. Keys are Unicode script names.
  const SCRIPT_NAMES = {
    Devanagari: 'Devanagari', Bengali: 'Bengali', Gurmukhi: 'Gurmukhi', Gujarati: 'Gujarati', Oriya: 'Odia', Tamil: 'Tamil',
    Telugu: 'Telugu', Kannada: 'Kannada', Malayalam: 'Malayalam', Sinhala: 'Sinhala', Ol_Chiki: 'Ol Chiki', Meetei_Mayek: 'Meetei Mayek',
    Arabic: 'Arabic', Hebrew: 'Hebrew', Thai: 'Thai', Lao: 'Lao', Khmer: 'Khmer', Myanmar: 'Myanmar', Tibetan: 'Tibetan',
    Han: 'Chinese or Japanese', Hiragana: 'Japanese', Katakana: 'Japanese', Hangul: 'Korean',
    Cyrillic: 'Cyrillic', Greek: 'Greek', Armenian: 'Armenian', Georgian: 'Georgian', Ethiopic: 'Ethiopic'
  };
  const SCRIPT_TESTS = Object.keys(SCRIPT_NAMES).map(key => [new RegExp(`\\p{Script_Extensions=${key}}`, 'u'), `${SCRIPT_NAMES[key]} text`]);
  const EMOJI_PART = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE00}-\u{FE0F}\u{20E3}\u{E0020}-\u{E007F}]/u;
  // What a reader should look for: "Devanagari text", "emoji", "accent marks", or the character itself.
  function charGroup(c) {
    for (const [test, name] of SCRIPT_TESTS) if (test.test(c)) return name;
    if (EMOJI_PART.test(c)) return 'emoji';
    if (/\p{M}/u.test(c)) return 'accent marks';
    return `“${c}”`;
  }
  // "Devanagari text and “₹”": scripts and emoji once each, other characters quoted one by one.
  const quoteList = chars => {
    const items = [...new Set(chars.map(charGroup))];
    const shown = items.slice(0, 5);
    const rest = items.length - shown.length;
    if (rest) return `${shown.join(', ')} and ${rest} more${items.slice(5).every(item => item.startsWith('“')) ? (rest === 1 ? ' character' : ' characters') : ''}`;
    return andList(shown);
  };
  const andList = items => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
  const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
  // "replace ₹ with Rs.", "remove ✓": what the Review step's Replace button will do.
  const replacementPhrase = c => (REPLACEMENTS[c].with === '' ? `remove ${c}` : `replace ${c} with ${REPLACEMENTS[c].label}`);

  /* The message when Download PDF has to fall back to the print dialog. It names what is in the
     first place found, and offers the Review step's replacement only for characters that have one. */
  function unsupportedDownloadMessage(odd) {
    if (!odd.length) return 'Use Save as PDF in the print dialog to preserve all your characters.';
    const all = [...new Set(odd.flatMap(x => x.chars))];
    const replaceable = all.filter(c => REPLACEMENTS[c]);
    const others = odd.length - 1;
    const more = others ? ` (and ${others} more ${others === 1 ? 'place' : 'places'})` : '';
    const next = replaceable.length
      ? `The Review step ${replaceable.length < all.length ? 'shows where the rest is and ' : ''}can ${andList(replaceable.map(replacementPhrase))}`.replace(/\.?$/, '.')
      : 'The Review step shows where.';
    return `${capital(quoteList(odd[0].chars))} in ${odd[0].where}${more} cannot go into this PDF, so the print dialog opens: choose Save as PDF there. ${next}`;
  }
  const PDF_ENGINE = () => (typeof window !== 'undefined' && window.ApplyReadyPDF) || (typeof require === 'function' ? require('./pdf-engine.js') : null);

  /* Every printed field holding characters the vector PDF cannot write, in reading order:
     [{ chars, section, where ("Work experience, role 2"), field (the input's id) }]. */
  function findUnsupportedText(data) {
    const engine = PDF_ENGINE();
    if (!engine || !engine.unsupportedCharacters) return [];
    const vis = data.sectionVisibility || {};
    const shown = key => vis[key] !== false;
    const found = [];
    const check = (value, section, where, field) => {
      const chars = typeof value === 'string' ? engine.unsupportedCharacters(value) : [];
      if (chars.length) found.push({ chars, section, where, field });
    };
    const each = (items, section, noun, fields) => (Array.isArray(items) ? items : []).forEach((item, i) => {
      const where = `${noun} ${i + 1}`;
      if (typeof item === 'string') { check(item, section, where, fields[0][1](item, i)); return; }
      if (item && typeof item === 'object') fields.forEach(([key, field]) => check(item[key], section, where, field(item, i)));
    });
    const p = data.personal || {};
    [['fullName', 'name'], ['targetTitle', 'headline'], ['email', 'email'], ['phone', 'phone'], ['location', 'location'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['website', 'website']]
      .forEach(([key, label]) => check(p[key], 'personal', `Contact details, ${label}`, key));
    for (const key of ['summary', 'experience', 'education', 'projects', 'skills']) if (shown(key)) check(data[key + 'Title'], key, `${SECTION_NAMES[key]}, heading`, key + 'TitleInput');
    if (shown('summary')) check(data.summary, 'summary', SECTION_NAMES.summary, 'summaryText');
    if (shown('experience')) each(data.experience, 'experience', 'Work experience, role', [['role', 'role'], ['company', 'comp'], ['duration', 'dur'], ['location', 'loc'], ['bulletsText', 'bul']].map(([key, f]) => [key, item => `exp-${f}-${item.id}`]));
    if (shown('education')) each(data.education, 'education', 'Education, entry', [['degree', 'deg'], ['institution', 'inst'], ['duration', 'dur'], ['location', 'loc'], ['score', 'score']].map(([key, f]) => [key, item => `edu-${f}-${item.id}`]));
    if (shown('projects')) each(data.projects, 'projects', 'Projects, project', [['name', 'name'], ['tech', 'tech'], ['link', 'link'], ['bulletsText', 'bul']].map(([key, f]) => [key, item => `proj-${f}-${item.id}`]));
    if (shown('skills')) {
      const skills = data.skills || {}, labels = data.skillLabels || {};
      SKILL_KEYS.forEach((key, i) => {
        if (!(typeof skills[key] === 'string' && skills[key].trim())) return;
        const id = key[0].toUpperCase() + key.slice(1);
        check(labels[key], 'skills', `Skills, row ${i + 1} label`, 'skillLabel' + id);
        check(skills[key], 'skills', `Skills, row ${i + 1}`, 'skill' + id);
      });
    }
    const at = prefix => (item, i) => `${prefix}-${i}`;
    if (shown('certifications')) each(data.certifications, 'certifications', 'Certifications, item', [['name', at('cert-name')], ['title', at('cert-name')], ['issuer', at('cert-issuer')], ['year', at('cert-year')]]);
    if (shown('achievements')) each(data.achievements, 'achievements', 'Achievements, item', [['title', at('ach-text')], ['text', at('ach-text')]]);
    if (shown('volunteering')) each(data.volunteering, 'volunteering', 'Leadership and volunteering, entry', [['role', at('vol-role')], ['organization', at('vol-org')], ['duration', at('vol-dur')]]);
    if (shown('languages')) each(data.languages, 'languages', 'Languages, item', [['name', at('lang-name')], ['proficiency', at('lang-prof')]]);
    if (shown('publications')) each(data.publications, 'publications', 'Publications, item', [['title', at('pub-text')], ['citation', at('pub-text')]]);
    if (shown('academic')) {
      const academic = data.academic || {};
      each(academic.teaching, 'academic', 'Teaching, entry', [['role', at('teach-role')], ['course', at('teach-role')], ['institution', at('teach-inst')], ['term', at('teach-term')]]);
      each(academic.presentations, 'academic', 'Presentations, entry', [['title', at('pres-title')], ['event', at('pres-event')]]);
      each(academic.grants, 'academic', 'Grants, entry', [['title', at('grant-title')], ['name', at('grant-title')], ['funder', at('grant-funder')], ['year', at('grant-year')]]);
    }
    if (shown('references') && data.referencesOnRequest !== true) each(data.references, 'references', 'References, referee', ['name', 'title', 'organization', 'contact'].map(key => [key, item => `ref-${key === 'organization' ? 'org' : key}-${item.id}`]));
    (data.customSections || []).filter(s => s && s.visible !== false).forEach(s => {
      const name = (typeof s.title === 'string' && s.title.trim()) || 'Custom section';
      check(s.title, 'custom', name + ', heading', `cs-title-${s.id}`);
      if (s.mode === 'text') check(s.text, 'custom', name, `cs-text-${s.id}`);
      else each(s.entries, 'custom', name + ', entry', [['title', item => `ce-title-${item.id}`], ['subtitle', item => `ce-sub-${item.id}`], ['date', item => `ce-date-${item.id}`], ['bulletsText', item => `ce-bul-${item.id}`]]);
    });
    return found;
  }

  // Swap the offered stand-ins into every text of the resume (one undo step), then redraw.
  function replaceUnsupported(chars) {
    const rules = chars.map(c => REPLACEMENTS[c]).filter(Boolean);
    if (!rules.length) return;
    pushHistoryState();
    let count = 0;
    const walk = value => {
      if (typeof value === 'string') return rules.reduce((text, rule) => text.replace(rule.pattern, () => { count++; return rule.with; }), value);
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === 'object') { Object.keys(value).forEach(key => { if (key !== 'id') value[key] = walk(value[key]); }); return value; }
      return value;
    };
    walk(resumeData);
    refreshWholeEditor();
    notify(`Replaced ${count} ${count === 1 ? 'character' : 'characters'}. You can undo this in the Write step.`);
  }

  // The count on the Review tab follows every change, not only a visit to the Review step.
  function updateReviewCount(issues) {
    const tabCount = getEl('reviewTabCount');
    if (!tabCount) return;
    const errors = issues.filter(x => x.type === 'error').length;
    const open = errors + issues.filter(x => x.type === 'warning').length;
    tabCount.hidden = !open;
    tabCount.textContent = open ? String(open) : '';
    tabCount.className = `tab-count${errors ? ' tab-count--error' : ''}`;
    tabCount.setAttribute('aria-label', open ? `${open} to check` : '');
  }
  function refreshReview() {
    const pane = getEl('viewReview');
    if (pane && pane.classList.contains('active')) runResumeReview();
    else updateReviewCount(generateReviewReport(resumeData, pdfPageCount));
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
        const fixCount = issues.filter(x => x.type === 'error').length;
        statusText.textContent = `${fixCount} ${fixCount === 1 ? 'thing' : 'things'} to fix before you download`;
        statusIcon.className = 'fa-solid fa-triangle-exclamation';
      } else if (hasWarnings) {
        statusBar.className = 'readiness-status-bar readiness-ready';
        statusText.textContent = 'Ready to download. A few suggestions below.';
        statusIcon.className = 'fa-solid fa-circle-check';
      } else {
        statusBar.className = 'readiness-status-bar readiness-ready';
        statusText.textContent = 'Ready to download';
        statusIcon.className = 'fa-solid fa-circle-check';
      }
    }

    // Page count estimate
    const sheet = getEl('resumeSheet');
    if (sheet && pageEstPill) {
      pageEstPill.textContent = pdfPageCount ? `${pdfPageCount} PDF page${pdfPageCount > 1 ? 's' : ''}` : 'Browser PDF';
    }

    updateReviewCount(issues);

    renderKeywordMatch();
    checklist.innerHTML = '';
    if (issues.length === 0) {
      checklist.innerHTML = `
        <div class="review-item review-item--ok">
          <i aria-hidden="true" class="fa-solid fa-circle-check"></i>
          <div class="review-item__body"><p class="review-item__msg">Contact details, links and sections all passed the checks.</p></div>
        </div>
      `;
      return;
    }

    // Four kinds of feedback, each named so severity is never carried by colour alone:
    // fix first (blocks a good download), worth checking, suggestions. Success is the line above.
    const groups = [
      { type: 'error', title: 'Fix before sending', icon: 'fa-triangle-exclamation', label: 'Required fix' },
      { type: 'warning', title: 'Worth checking', icon: 'fa-circle-exclamation', label: 'Warning' },
      { type: 'info', title: 'Suggestions', icon: 'fa-circle-info', label: 'Suggestion' }
    ];
    const WHERE = SECTION_NAMES;
    groups.forEach(group => {
      const groupIssues = issues.filter(x => (x.type === 'error' || x.type === 'warning') ? x.type === group.type : group.type === 'info');
      if (!groupIssues.length) return;
      const heading = document.createElement('h4');
      heading.className = `review-group-title review-group-title--${group.type}`;
      heading.innerHTML = `${group.title} <span class="review-group-count">${groupIssues.length}</span>`;
      checklist.appendChild(heading);

      groupIssues.forEach(iss => {
        const item = document.createElement('div');
        item.className = `review-item review-item--${group.type}`;
        item.innerHTML = `
          <i aria-hidden="true" class="fa-solid ${group.icon}"></i>
          <div class="review-item__body">
            <p class="review-item__msg"><span class="sr-only">${group.label}: </span>${escapeHTML(iss.message)}</p>
            <p class="review-item__where">In ${escapeHTML(iss.where || WHERE[iss.section] || 'your resume')}</p>
            ${iss.replace ? `<button type="button" class="btn btn-sm review-replace-btn">${escapeHTML(iss.replace.map(c => `Replace ${c} with ${REPLACEMENTS[c].label}`).join(', '))}</button>` : ''}
          </div>
          <button type="button" class="btn btn-sm review-jump-btn" data-target="${iss.targetField || iss.section}" aria-label="Go to ${escapeHTML(iss.where || WHERE[iss.section] || 'the section')} to fix this">Fix</button>
        `;
        const replaceBtn = item.querySelector('.review-replace-btn');
        if (replaceBtn) replaceBtn.addEventListener('click', () => {
          replaceUnsupported(iss.replace);
          const heading = getEl('reviewHeading');
          if (heading) { heading.tabIndex = -1; heading.focus(); }
        });

        item.querySelector('.review-jump-btn').addEventListener('click', () => {
          // Switch to Content Tab (on a phone, to the editor as well)
          const tabEdit = getEl('tabEdit');
          const bar = tabEdit && tabEdit.closest('.rb-bar');
          if (bar && getComputedStyle(bar).display !== 'none') tabEdit.click();
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
              setEntryOpen(target.closest('.entry'), true);
              // A field inside a closed disclosure (a section heading, a skill label) cannot take focus.
              for (let box = target.closest('details'); box; box = box.parentElement && box.parentElement.closest('details')) box.open = true;
              if (!iss.targetField) section.querySelector('.accordion-header').focus();
              else target.focus();
              target.scrollIntoView({ behavior: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'), block: 'center' });
            }
          }, 100);
        });

        checklist.appendChild(item);
      });
    });
  }

  // New content keeps the chosen template, paper and typography; replacing
  // them silently left the gallery showing a template that was not in use.
  function withCurrentDesign(next, sectionVisibility) {
    next.template = resumeData.template;
    next.design = Object.assign({}, JSON.parse(JSON.stringify(resumeData.design)), { templateId: resumeData.template });
    next.design.sectionOrder = recommendedOrderFor(resumeData.template, next);
    next.design.orderCustom = false;
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

  // "Priya_Raghavan_Business_Analyst_Resume.pdf": the name, then the headline up to its first
  // separator, so versions tailored to different roles do not overwrite each other.
  function downloadName(suffix) {
    const part = (value, max) => String(value || '').trim().normalize('NFC')
      .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, max).replace(/_$/, '');
    const personal = resumeData.personal || {};
    const name = part(personal.fullName, 60);
    const headline = part(String(personal.targetTitle || '').split(/\s[-–—]\s|[|•·,;:()/]/)[0], 40);
    return [name || 'Candidate', headline, suffix].filter(Boolean).join('_');
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

    // Fold or unfold an entry from its title row.
    const formPanel = getEl('formPanel');
    // A text box focused from below scrolls only as far as its caret, which can leave its label and
    // top under the sticky step bar; bring the whole field into view when it fits.
    if (formPanel) formPanel.addEventListener('focusin', e => {
      requestAnimationFrame(() => {
        const steps = formPanel.querySelector('.rb-steps');
        if (!steps || document.activeElement !== e.target || e.target === steps || steps.contains(e.target)) return;
        const box = e.target.getBoundingClientRect();
        const limit = steps.getBoundingClientRect().bottom + 8;
        if (box.top < limit && box.bottom > 0 && box.height < window.innerHeight - limit) window.scrollBy(0, box.top - limit);
      });
    });
    if (formPanel) formPanel.addEventListener('click', e => {
      const toggle = e.target.closest('[data-entry-toggle]');
      if (toggle) setEntryOpen(toggle.closest('.entry'), toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Phone: Download is always one tap away in the bottom bar.
    const mobileDownload = getEl('btnMobileDownload');
    if (mobileDownload) mobileDownload.addEventListener('click', () => {
      getEl('tabEdit').click();
      getEl('tabDownload').click();
      const panel = getEl('formPanel');
      if (panel) panel.scrollIntoView({ block: 'start', behavior: 'auto' });
      getEl('tabDownload').focus({ preventScroll: true });
    });
    const openExport = getEl('btnOpenExport');
    if (openExport) openExport.addEventListener('click', () => { getEl('tabEdit').click(); getEl('tabReview').click(); getEl('formPanel').scrollIntoView({ block: 'start', behavior: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth') }); });

    // Quick PDF button
    const btnQuickPDF = getEl('btnQuickPDF');
    if (btnQuickPDF) btnQuickPDF.addEventListener('click', exportToVectorPDF);

    // Input change listeners
    const bindInput = (id, setter) => {
      const el = getEl(id);
      if (el) {
        el.addEventListener('input', (e) => {
          setter(e.target.value);
          scheduleRender();
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
        scheduleRender();
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
    const pubsList = getEl('publicationsList');
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
        focusNewEntry(id === 'btnAddPresentation' ? 'academicPresentationsList' : 'academicGrantsList');
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
        focusNewEntry('experienceList');
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
        focusNewEntry('educationList');
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
        focusNewEntry('projectsList');
      });
    }

    // Add Optional Section Handler
    const btnAddOptional = getEl('btnAddOptionalSection');
    const selectOptional = getEl('optionalSectionSelect');
    if (btnAddOptional && selectOptional) {
      btnAddOptional.addEventListener('click', () => {
        const val = selectOptional.value;
        if (!val) return;
        if ((val === 'references' || val === 'custom') && EXTRA()) { EXTRA().add(val); return; }
        pushHistoryState();
        resumeData.sectionVisibility[val] = true;

        // Ensure array exists
        if (val === 'certifications' && (!resumeData.certifications || resumeData.certifications.length === 0)) {
          resumeData.certifications = [{ id: newEntryId('cert'), name: '', issuer: '', year: '' }];
        } else if (val === 'achievements' && (!resumeData.achievements || resumeData.achievements.length === 0)) {
          resumeData.achievements = [''];
        } else if (val === 'volunteering' && (!resumeData.volunteering || resumeData.volunteering.length === 0)) {
          resumeData.volunteering = [{ id: newEntryId('vol'), role: '', organization: '', duration: '' }];
        } else if (val === 'languages' && (!resumeData.languages || resumeData.languages.length === 0)) {
          resumeData.languages = [{ id: newEntryId('lang'), name: '', proficiency: '' }];
        } else if (val === 'publications' && (!resumeData.publications || resumeData.publications.length === 0)) {
          resumeData.publications = [{ id: newEntryId('pub'), title: '' }];
        } else if (val === 'academic') {
          if (!resumeData.academic) resumeData.academic = {};
          if (!resumeData.academic.teaching || !resumeData.academic.teaching.length) resumeData.academic.teaching = [{ id: newEntryId('teach'), role: '', institution: '', term: '' }];
        }

        renderOptionalSections();
        renderSectionOrderControls();
        renderResumePreview();

        // Expand the newly enabled section
        const secEl = getEl('sec-' + val);
        if (secEl) {
          secEl.classList.add('open');
          secEl.scrollIntoView({ behavior: (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'), block: 'center' });
        }
      });
    }

    const optionalArea = getEl('optionalSectionsArea');
    if (optionalArea) optionalArea.addEventListener('input', e => {
      const entry = e.target.closest('.entry');
      if (!entry || e.target.classList.contains('item-pub-text')) return;
      const first = entry.querySelector('input');
      const title = entry.querySelector('.entry__title');
      if (first && title) title.textContent = first.value.trim() || title.dataset.fallback || title.textContent;
    });

    // Add buttons for individual optional items
    const btnAddCert = getEl('btnAddCertification');
    if (btnAddCert) {
      btnAddCert.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.certifications) resumeData.certifications = [];
        resumeData.certifications.push({ id: newEntryId('cert'), name: '', issuer: '', year: '' });
        renderOptionalSections();
        renderResumePreview();
        focusNewEntry('certificationsList');
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
        focusNewEntry('achievementsList');
      });
    }
    const btnAddVol = getEl('btnAddVolunteering');
    if (btnAddVol) {
      btnAddVol.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.volunteering) resumeData.volunteering = [];
        resumeData.volunteering.push({ id: newEntryId('vol'), role: '', organization: '', duration: '' });
        renderOptionalSections();
        renderResumePreview();
        focusNewEntry('volunteeringList');
      });
    }
    const btnAddLang = getEl('btnAddLanguage');
    if (btnAddLang) {
      btnAddLang.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.languages) resumeData.languages = [];
        resumeData.languages.push({ id: newEntryId('lang'), name: '', proficiency: '' });
        renderOptionalSections();
        renderResumePreview();
        focusNewEntry('languagesList');
      });
    }
    const btnAddPub = getEl('btnAddPublication');
    if (btnAddPub) {
      btnAddPub.addEventListener('click', () => {
        pushHistoryState();
        if (!Array.isArray(resumeData.publications)) resumeData.publications = [];
        resumeData.publications.push({ id: newEntryId('pub'), title: '' });
        renderOptionalSections();
        renderResumePreview();
        focusNewEntry('publicationsList');
      });
    }
    const btnAddTeach = getEl('btnAddTeaching');
    if (btnAddTeach) {
      btnAddTeach.addEventListener('click', () => {
        pushHistoryState();
        if (!resumeData.academic) resumeData.academic = {};
        if (!resumeData.academic.teaching) resumeData.academic.teaching = [];
        resumeData.academic.teaching.push({ id: newEntryId('teach'), role: '', institution: '', term: '' });
        renderOptionalSections();
        renderResumePreview();
        focusNewEntry('academicTeachingList');
      });
    }

    // Load Sample Button
    const btnLoadSample = getEl('btnLoadSample');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', async () => {
        if (!isDocumentEmpty()) {
          // With the library, the sample opens as a new resume and nothing written is replaced.
          if (typeof editorApi.openSampleAsNew === 'function') { editorApi.openSampleAsNew(); return; }
          const ok = await askConfirm({ title: 'Replace your content with the sample?', message: 'The sample overwrites what you have written so far. You can undo this straight afterwards.', confirmLabel: 'Use the sample' });
          if (!ok) return;
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
      btnClearForm.addEventListener('click', async () => {
        const ok = await askConfirm({ title: 'Clear the whole resume?', message: 'Every field of this resume will be emptied, and the empty version is saved. You can undo this straight afterwards. To keep a copy, duplicate it in My resumes first.', confirmLabel: 'Clear resume', danger: true });
        if (!ok) return;
        pushHistoryState();
        resumeData = withCurrentDesign(SCHEMA.migrate(EMPTY_DATA), EMPTY_DATA.sectionVisibility);
        isDirty = false;
        refreshWholeEditor();
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
        layout.className = 'resume-app-layout rb view-edit';
        layout.dataset.view = 'edit';
      });
      tabPreview.addEventListener('click', () => {
        tabPreview.classList.add('active');
        tabEdit.classList.remove('active');
        tabPreview.setAttribute('aria-selected', 'true');
        tabEdit.setAttribute('aria-selected', 'false');
        layout.className = 'resume-app-layout rb view-preview';
        layout.dataset.view = 'preview';
        window.scrollTo({ top: 0, behavior: 'auto' });
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
    refreshEntryTitle(parent, 'exp', item);
    scheduleRender();
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
      restoreListFocus('experienceList', id, 'move-up-exp', 'btnAddExperience', 'role');
      return;
    } else if (action === 'move-down-exp' && idx < resumeData.experience.length - 1) {
      const temp = resumeData.experience[idx];
      resumeData.experience[idx] = resumeData.experience[idx + 1];
      resumeData.experience[idx + 1] = temp;
      renderExperienceList();
      renderResumePreview();
      restoreListFocus('experienceList', id, 'move-down-exp', 'btnAddExperience', 'role');
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
    refreshEntryTitle(parent, 'edu', item);
    scheduleRender();
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
      restoreListFocus('educationList', id, 'move-up-edu', 'btnAddEducation', 'education entry');
      return;
    } else if (action === 'move-down-edu' && idx < resumeData.education.length - 1) {
      const temp = resumeData.education[idx];
      resumeData.education[idx] = resumeData.education[idx + 1];
      resumeData.education[idx + 1] = temp;
      renderEducationList();
      renderResumePreview();
      restoreListFocus('educationList', id, 'move-down-edu', 'btnAddEducation', 'education entry');
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
    refreshEntryTitle(parent, 'proj', item);
    scheduleRender();
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
      restoreListFocus('projectsList', id, 'move-up-proj', 'btnAddProject', 'project');
      return;
    } else if (action === 'move-down-proj' && idx < resumeData.projects.length - 1) {
      const temp = resumeData.projects[idx];
      resumeData.projects[idx] = resumeData.projects[idx + 1];
      resumeData.projects[idx + 1] = temp;
      renderProjectsList();
      renderResumePreview();
      restoreListFocus('projectsList', id, 'move-down-proj', 'btnAddProject', 'project');
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
    scheduleRender();
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
    scheduleRender();
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
    scheduleRender();
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
    scheduleRender();
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
    if (!resumeData.publications || !resumeData.publications[idx]) return;
    resumeData.publications[idx].title = e.target.value;
    scheduleRender();
  }
  function handlePubAction(e) {
    const btn = e.target.closest('button[data-action="remove-pub"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    pushHistoryState();
    resumeData.publications.splice(idx, 1);
    renderOptionalSections();
    renderResumePreview();
    restoreRemoveFocus('publicationsList', idx, 'btnAddPublication');
  }

  function handleTeachInput(e) {
    const idx = parseInt(e.target.dataset.index, 10);
    if (!resumeData.academic || !resumeData.academic.teaching || !resumeData.academic.teaching[idx]) return;
    if (e.target.classList.contains('item-teach-role')) resumeData.academic.teaching[idx].role = e.target.value;
    if (e.target.classList.contains('item-teach-inst')) resumeData.academic.teaching[idx].institution = e.target.value;
    if (e.target.classList.contains('item-teach-term')) resumeData.academic.teaching[idx].term = e.target.value;
    scheduleRender();
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
    scheduleRender();
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

  // One delegated listener, so sections drawn later (custom sections) fold the same way.
  function setupAccordions() {
    const panel = getEl('formPanel');
    if (panel) panel.addEventListener('click', e => {
      const header = e.target.closest('.accordion-header');
      if (!header) return;
      const sec = header.parentElement;
      const isOpen = sec.classList.contains('open');
      sec.classList.toggle('open');
      header.setAttribute('aria-expanded', String(!isOpen));
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

  /* The error under Full name lasts only while the field is empty. Typing clears it, and so does
     any change that fills the form from data (a sample, another saved resume, an import, undo). */
  function clearFullNameError() {
    const input = getEl('fullName');
    const shown = getEl('fullNameError');
    if (!input || !shown || !input.value.trim()) return;
    shown.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }

  /* Every download needs the name. Without it, go to the field, mark it invalid and put the reason
     under it (linked with aria-describedby), so it stays after the toast has gone. Typing clears it. */
  function requireFullName() {
    const input = getEl('fullName');
    if (((resumeData.personal && resumeData.personal.fullName) || '').trim()) return true;
    notify('Add your name in Contact details before downloading.', true);
    const tabEdit = getEl('tabEdit');
    if (tabEdit) tabEdit.click();
    const tabContent = getEl('tabContent');
    if (tabContent) tabContent.click();
    openAccordion(getEl('sec-personal'));
    if (!input) return false;
    let error = getEl('fullNameError');
    if (!error) {
      error = document.createElement('p');
      error.id = 'fullNameError';
      error.className = 'field-error';
      input.insertAdjacentElement('afterend', error);
    }
    if (!input.dataset.nameCheck) {
      input.dataset.nameCheck = 'on';
      input.addEventListener('input', clearFullNameError);
    }
    error.textContent = 'Enter your full name before downloading. It goes at the top of the resume and in the file name.';
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'fullNameError');
    setTimeout(() => { input.focus({ preventScroll: true }); input.scrollIntoView({ block: 'center', behavior: 'auto' }); }, 100);
    return false;
  }

  function exportToVectorPDF(event) {
    if (!window.ApplyReadyPDF) {
      notify('PDF export is unavailable. Reload or use Browser Print.', true);
      return;
    }

    if (!requireFullName()) return;

    // Show progress on the button that was pressed (Download step or the Quick PDF button).
    const btn = (event && event.currentTarget && event.currentTarget.tagName === 'BUTTON') ? event.currentTarget : getEl('btnDownloadPDF');
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
        notify(unsupportedDownloadMessage(findUnsupportedText(resumeData)));
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
  // The Word engine loads on the way to the first Word download (the Download step), not with the
  // page. It is part of the offline cache like every other script.
  let docxLoading = null;
  function loadDocxEngine() {
    if (window.ApplyReadyDOCX) return Promise.resolve(window.ApplyReadyDOCX);
    if (!docxLoading) docxLoading = new Promise((resolve, reject) => {
      const own = document.querySelector('script[src*="js/resume.js"]');
      const query = own ? (own.getAttribute('src').split('?')[1] || '') : '';
      const script = document.createElement('script');
      script.src = 'js/docx-engine.js' + (query ? '?' + query : '');
      script.onload = () => (window.ApplyReadyDOCX ? resolve(window.ApplyReadyDOCX) : reject(new Error('Word engine missing')));
      script.onerror = () => { docxLoading = null; script.remove(); reject(new Error('Word engine did not load')); };
      document.head.appendChild(script);
    });
    return docxLoading;
  }

  async function exportToDOCX() {
    if (!requireFullName()) return;

    const btn = getEl('btnDownloadDOCX');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Building DOCX...';
    }

    try {
      let engine;
      try { engine = await loadDocxEngine(); } catch (e) {
        notify('Word export could not start. Check your connection and reload, or download the PDF.', true);
        return;
      }
      const zip = engine.generateResumeDOCX(resumeData, {
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

    if (!requireFullName()) return;

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
      unsupportedDownloadMessage,
      renderResumeDataToHTML,
      TEMPLATES
    };
  }
})();
