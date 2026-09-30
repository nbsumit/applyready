/**
 * ApplyReady.in - Rebuilt ATS-Friendly Resume Builder
 * 8 Distinct Templates, 3-Tab Workspace (Content, Design, Review & Export),
 * True Vector PDF, Editable OOXML DOCX, and Plain Text Exports.
 * 100% Client-Side Processing, Privacy-Preserving Draft Storage, and Zero Support Popups.
 */

(function () {
  'use strict';

  // Templates catalogue fallback (if templates.js is loaded, it provides ApplyReadyTemplates)
  const TEMPLATES = (typeof ApplyReadyTemplates !== 'undefined' && ApplyReadyTemplates.TEMPLATES)
    ? ApplyReadyTemplates.TEMPLATES
    : {
      'classic-professional': { id: 'classic-professional', name: 'Classic Professional', fontFamily: 'serif', category: 'Broad Professional', badge: 'Default', description: 'Restrained serif typography with clear section rules and reverse-chronological emphasis.', recommendedOrder: ['summary', 'experience', 'education', 'projects', 'skills'] },
      'modern-minimal': { id: 'modern-minimal', name: 'Modern Minimal', fontFamily: 'sans', category: 'Broad Professional', badge: 'Clean Sans', description: 'Clean sans-serif typography, open spacing, and minimal decorative rules with high-contrast hierarchy.', recommendedOrder: ['summary', 'experience', 'education', 'projects', 'skills'] },
      'graduate-early-career': { id: 'graduate-early-career', name: 'Graduate / Early Career', fontFamily: 'sans', category: 'Students & Entry Level', badge: 'Entry Level', description: 'Education, academic projects, and campus leadership prominent; no mandatory work-experience requirement.', recommendedOrder: ['education', 'projects', 'experience', 'skills', 'achievements'] },
      'experienced-professional': { id: 'experienced-professional', name: 'Experienced Professional', fontFamily: 'serif', category: 'Senior & Executive', badge: 'Executive', description: 'Experience and leadership achievements prominent with concise education; tailored for multi-page documents.', recommendedOrder: ['summary', 'experience', 'skills', 'education', 'projects'] },
      'project-focused': { id: 'project-focused', name: 'Project Focused', fontFamily: 'sans', category: 'Technical & Portfolio', badge: 'Portfolio', description: 'Projects and case studies prominent with readable links and clear contribution descriptions for technical disciplines.', recommendedOrder: ['summary', 'projects', 'experience', 'skills', 'education'] },
      'career-transition': { id: 'career-transition', name: 'Career Transition', fontFamily: 'sans', category: 'Career Change', badge: 'Pivot', description: 'Short summary and transferable skills prominent at the top, supported by a complete dated work-history section.', recommendedOrder: ['summary', 'skills', 'experience', 'projects', 'education'] },
      'compact-professional': { id: 'compact-professional', name: 'Compact Professional', fontFamily: 'sans', category: 'Condensed', badge: 'Dense', description: 'Efficient spacing and restrained hierarchy to fit rich qualifications into a dense, readable layout.', recommendedOrder: ['summary', 'experience', 'education', 'skills', 'projects'] },
      'academic-cv': { id: 'academic-cv', name: 'Academic / Research CV', fontFamily: 'serif', category: 'Academia & Research', badge: 'Multi-Page CV', description: 'Structured for scholarly curriculum vitae. Includes publications, teaching, research appointments, grants, and awards.', recommendedOrder: ['summary', 'education', 'academic', 'experience', 'projects', 'skills'] }
    };

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
    volunteering: [],
    languages: [],
    academic: {
      publications: [],
      teaching: [],
      presentations: []
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
    if (!url) return '';
    const clean = url.trim();
    if (clean.toLowerCase().startsWith('javascript:') || clean.toLowerCase().startsWith('data:')) {
      return '#';
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('mailto:') && !clean.startsWith('tel:')) {
      return 'https://' + clean;
    }
    return clean;
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
  function validateResumeSchema(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.data || typeof payload.data !== 'object') return false;
    const d = payload.data;
    if (!d.personal || typeof d.personal !== 'object') return false;
    if (!Array.isArray(d.experience) || !Array.isArray(d.education) || !Array.isArray(d.projects)) return false;
    if (d.skills && typeof d.skills !== 'object') return false;
    return true;
  }

  /**
   * Migrate any v1 or partial data safely into v2
   */
  function migrateResumeSchema(raw) {
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
    renderResumePreview();
    attachEventListeners();
    setupAccordions();
    updatePreviewScale();
    updateUndoRedoButtons();
    runResumeReview();

    window.addEventListener('resize', updatePreviewScale);
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
          if (parsed && (parsed.data || parsed.version)) {
            resumeData = migrateResumeSchema(parsed);
            if (draftStatusText && parsed.savedAt) {
              const d = new Date(parsed.savedAt);
              draftStatusText.textContent = `Draft restored: ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            return;
          }
        }
      } else {
        autoSaveDraft = false;
        if (chkSaveDraft) chkSaveDraft.checked = false;
        if (draftStatusText) draftStatusText.textContent = 'Local saving disabled';
      }
    } catch (e) {
      console.warn('Storage unavailable:', e);
      const draftStatusText = getEl('draftStatusText');
      if (draftStatusText) draftStatusText.textContent = 'Storage unavailable in private mode';
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
      console.error('Failed to save draft:', e);
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
    const p = resumeData.personal || {};
    const hasName = Boolean(p.fullName && p.fullName.trim());
    const hasSummary = Boolean(resumeData.summary && resumeData.summary.trim());
    const hasExp = Boolean(resumeData.experience && resumeData.experience.some(e => (e.role && e.role.trim()) || (e.company && e.company.trim())));
    const hasEdu = Boolean(resumeData.education && resumeData.education.some(e => (e.degree && e.degree.trim()) || (e.institution && e.institution.trim())));
    const hasProj = Boolean(resumeData.projects && resumeData.projects.some(pr => (pr.name && pr.name.trim())));
    return !hasName && !hasSummary && !hasExp && !hasEdu && !hasProj;
  }

  function renderResumeDataToHTML(data, templateId) {
    const tmpl = TEMPLATES[templateId] || TEMPLATES['classic-professional'];
    const p = data.personal || {};

    const contactItems = [];
    if (p.phone && p.phone.trim()) contactItems.push({ text: p.phone.trim(), href: 'tel:' + p.phone.trim().replace(/\s+/g, '') });
    if (p.email && p.email.trim()) contactItems.push({ text: p.email.trim(), href: 'mailto:' + p.email.trim() });
    if (p.location && p.location.trim()) contactItems.push({ text: p.location.trim() });
    if (p.linkedin && p.linkedin.trim()) contactItems.push({ text: p.linkedin.trim(), href: sanitizeHref(p.linkedin.trim()) });
    if (p.github && p.github.trim()) contactItems.push({ text: p.github.trim(), href: sanitizeHref(p.github.trim()) });
    if (p.website && p.website.trim()) contactItems.push({ text: p.website.trim(), href: sanitizeHref(p.website.trim()) });

    let contactHtml = contactItems.map((item, idx) => {
      const inner = item.href ? `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.text)}</a>` : escapeHTML(item.text);
      return `<span class="resume-contact-item">${inner}</span>` + (idx < contactItems.length - 1 ? '<span style="color: #94A3B8; margin: 0 0.35rem;">•</span>' : '');
    }).join('');

    const sections = {};

    const summaryText = (data.summary || '').trim();
    if (summaryText && (!data.sectionVisibility || data.sectionVisibility.summary !== false)) {
      sections['summary'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">${escapeHTML(data.summaryTitle || 'PROFESSIONAL SUMMARY')}</h3>
          <p style="font-size: 9.5pt; line-height: 1.4; text-align: justify; margin: 0;">${escapeHTML(summaryText)}</p>
        </section>`;
    }

    const exp = (data.experience || []).filter(x => x.role || x.company || x.bulletsText);
    if (exp.length > 0 && (!data.sectionVisibility || data.sectionVisibility.experience !== false)) {
      let expItems = exp.map(item => {
        const roleComp = [item.role, item.company].filter(Boolean).join(' | ');
        const durLoc = [item.duration, item.location].filter(Boolean).join(' • ');
        let bHtml = '';
        if (item.bulletsText && item.bulletsText.trim()) {
          const lines = item.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const clean = lines.map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
          if (clean.length > 0) {
            bHtml = `<ul class="resume-bullets">${clean.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>`;
          }
        }
        return `
          <div class="resume-entry">
            <div class="resume-entry-header">
              <span>${escapeHTML(roleComp)}</span>
              <span style="font-weight: normal; font-style: italic; font-size: 9pt;">${escapeHTML(durLoc)}</span>
            </div>
            ${bHtml}
          </div>`;
      }).join('');
      sections['experience'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">${escapeHTML(data.experienceTitle || 'WORK EXPERIENCE')}</h3>
          <div>${expItems}</div>
        </section>`;
    }

    const edu = (data.education || []).filter(x => x.degree || x.institution);
    if (edu.length > 0 && (!data.sectionVisibility || data.sectionVisibility.education !== false)) {
      let eduItems = edu.map(item => {
        const degInst = [item.degree, item.institution].filter(Boolean).join(' — ');
        const durLocScore = [item.duration, item.location, item.score].filter(Boolean).join(' • ');
        return `
          <div class="resume-entry">
            <div class="resume-entry-header">
              <span>${escapeHTML(degInst)}</span>
              <span style="font-weight: normal; font-style: italic; font-size: 9pt;">${escapeHTML(durLocScore)}</span>
            </div>
          </div>`;
      }).join('');
      sections['education'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">${escapeHTML(data.educationTitle || 'EDUCATION')}</h3>
          <div>${eduItems}</div>
        </section>`;
    }

    const proj = (data.projects || []).filter(x => x.name || x.tech || x.bulletsText);
    if (proj.length > 0 && (!data.sectionVisibility || data.sectionVisibility.projects !== false)) {
      let projItems = proj.map(item => {
        const tech = item.tech ? `| ${item.tech}` : '';
        const link = item.link ? `<a href="${sanitizeHref(item.link)}" target="_blank" rel="noopener noreferrer" style="color: #1D4ED8; font-weight: normal; font-size: 8.5pt;">${escapeHTML(item.link)}</a>` : '';
        let bHtml = '';
        if (item.bulletsText && item.bulletsText.trim()) {
          const lines = item.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const clean = lines.map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
          if (clean.length > 0) {
            bHtml = `<ul class="resume-bullets">${clean.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>`;
          }
        }
        return `
          <div class="resume-entry">
            <div class="resume-entry-header">
              <span>${escapeHTML(item.name)} <span style="font-style: italic; font-weight: normal; color: #4B5563;">${escapeHTML(tech)}</span></span>
              <span>${link}</span>
            </div>
            ${bHtml}
          </div>`;
      }).join('');
      sections['projects'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">${escapeHTML(data.projectsTitle || 'KEY PROJECTS & INITIATIVES')}</h3>
          <div>${projItems}</div>
        </section>`;
    }

    const s = data.skills || {};
    const skillRows = [];
    if (s.languages && s.languages.trim()) skillRows.push({ label: 'Core Competencies', val: s.languages.trim() });
    if (s.frameworks && s.frameworks.trim()) skillRows.push({ label: 'Tools & Platforms', val: s.frameworks.trim() });
    if (s.tools && s.tools.trim()) skillRows.push({ label: 'Technical & Data Skills', val: s.tools.trim() });
    if (s.other && s.other.trim()) skillRows.push({ label: 'Professional Skills', val: s.other.trim() });
    if (skillRows.length > 0 && (!data.sectionVisibility || data.sectionVisibility.skills !== false)) {
      let sHtml = skillRows.map(r => `
        <div class="resume-skills-row">
          <span class="skills-category">${escapeHTML(r.label)}: </span><span>${escapeHTML(r.val)}</span>
        </div>`).join('');
      sections['skills'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">${escapeHTML(data.skillsTitle || 'SKILLS & COMPETENCIES')}</h3>
          <div>${sHtml}</div>
        </section>`;
    }

    const certs = data.certifications || [];
    if (certs.length > 0 && data.sectionVisibility && data.sectionVisibility.certifications) {
      let cHtml = certs.map(c => `
        <div class="resume-entry">
          <strong>${escapeHTML(c.name || c.title)}</strong> ${c.issuer ? ' — ' + escapeHTML(c.issuer) : ''} ${c.year ? '(' + escapeHTML(c.year) + ')' : ''}
        </div>`).join('');
      sections['certifications'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">CERTIFICATIONS & CREDENTIALS</h3>
          <div>${cHtml}</div>
        </section>`;
    }

    const achs = data.achievements || [];
    if (achs.length > 0 && data.sectionVisibility && data.sectionVisibility.achievements) {
      let aHtml = achs.map(a => {
        const text = typeof a === 'string' ? a : (a.title || a.text || '');
        return `<div class="resume-entry">• ${escapeHTML(text)}</div>`;
      }).join('');
      sections['achievements'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">HONORS & ACHIEVEMENTS</h3>
          <div>${aHtml}</div>
        </section>`;
    }

    if (templateId === 'academic-cv' || (data.academic && data.sectionVisibility && data.sectionVisibility.academic)) {
      const pubs = (data.academic && data.academic.publications) || [
        'Morgan, A. et al. (2023). High-Throughput Supply Chain Optimization in In-Browser Environments. Operations Journal, 14(2), 78-95.',
        'Morgan, A. (2021). Predictive Bottleneck Analysis for Logistics Networks. Journal of Enterprise Engineering, 9(1), 112-128.'
      ];
      const teaching = (data.academic && data.academic.teaching) || [
        { role: 'Guest Lecturer, Supply Chain Analytics', institution: 'University of Illinois', term: 'Fall 2023' }
      ];
      let pubHtml = pubs.map(p => {
        const t = typeof p === 'string' ? p : (p.title || '');
        return `<div class="resume-entry">• ${escapeHTML(t)}</div>`;
      }).join('');
      let teachHtml = teaching.map(t => {
        const r = t.role || t.course || '';
        const inst = [t.institution, t.term].filter(Boolean).join(' — ');
        return `<div class="resume-entry"><strong>${escapeHTML(r)}</strong> ${inst ? ' (' + escapeHTML(inst) + ')' : ''}</div>`;
      }).join('');

      sections['academic'] = `
        <section class="resume-section">
          <h3 class="resume-section-title">PUBLICATIONS & RESEARCH</h3>
          <div>${pubHtml}</div>
          <h4 style="font-size: 8.5pt; font-weight: 700; margin-top: 0.5rem; margin-bottom: 0.25rem; color: #1E293B;">TEACHING EXPERIENCE</h4>
          <div>${teachHtml}</div>
        </section>`;
    }

    const order = (tmpl.recommendedOrder && tmpl.recommendedOrder.length > 0)
      ? tmpl.recommendedOrder
      : (data.design && data.design.sectionOrder) || ['summary', 'experience', 'education', 'projects', 'skills'];

    let orderedHtml = '';
    order.forEach(k => {
      if (sections[k]) orderedHtml += sections[k];
    });
    Object.keys(sections).forEach(k => {
      if (!order.includes(k) && sections[k]) orderedHtml += sections[k];
    });

    return `
      <header class="resume-header">
        <h1 class="resume-name">${escapeHTML((p.fullName || 'ALEX R. MORGAN').toUpperCase())}</h1>
        ${p.targetTitle ? `<div class="resume-target-title">${escapeHTML(p.targetTitle)}</div>` : ''}
        <div class="resume-contact-line">${contactHtml}</div>
      </header>
      <div>${orderedHtml}</div>
    `;
  }

  function renderTemplateIntoContainer(sheet, templateId, data) {
    const tmpl = TEMPLATES[templateId] || TEMPLATES['classic-professional'];
    const fontClass = (tmpl.fontFamily === 'sans' || (data.design && data.design.fontFamily === 'sans')) ? 'font-sans' : '';
    const density = tmpl.density || (data.design && data.design.density) || 'standard';
    const fontSize = (data.design && data.design.fontSize) || 'standard';
    const pageSize = (data.design && data.design.pageSize) || 'a4';

    sheet.className = `ats-resume-sheet template-${templateId} page-${pageSize} density-${density} font-size-${fontSize} ${fontClass}`;
    sheet.innerHTML = renderResumeDataToHTML(data, templateId);
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

    renderTemplateIntoContainer(sheet, templateId, SAMPLE_DATA);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const closeBtn = getEl('btnCloseTmplModal');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 50);
    }
  }

  function closeTemplatePreviewModal() {
    const modal = getEl('templatePreviewModal');
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    document.body.style.overflow = '';

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
  function setupTemplateGallery() {
    const galleryGrid = getEl('templateGalleryGrid');
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

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
          <button type="button" class="btn btn-secondary btn-sm btn-preview-template" data-template="${key}" title="Full preview of ${escapeHTML(tmpl.name)}">
            <i class="fa-regular fa-eye"></i> Preview
          </button>
          <button type="button" class="btn ${resumeData.template === key ? 'btn-primary' : 'btn-outline-primary'} btn-sm btn-select-template" data-template="${key}">
            ${resumeData.template === key ? '<i class="fa-solid fa-check"></i> Active' : 'Use'}
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
  }

  /**
   * Select Template without losing ANY content or drafts
   */
  function selectTemplate(templateId) {
    if (!TEMPLATES[templateId]) return;
    pushHistoryState();

    resumeData.template = templateId;
    const tmpl = TEMPLATES[templateId];

    // Automatically set default typography & density associated with template
    if (tmpl.fontFamily) resumeData.design.fontFamily = tmpl.fontFamily;
    if (tmpl.density) resumeData.design.density = tmpl.density;

    const btnApplyRecommended = getEl('btnApplyRecommendedOrder');

    if (tmpl.recommendedOrder && Array.isArray(tmpl.recommendedOrder)) {
      if (isDocumentEmpty()) {
        // Automatically apply recommended order for new empty documents
        resumeData.design.sectionOrder = [...tmpl.recommendedOrder];
        if (btnApplyRecommended) btnApplyRecommended.classList.add('hidden');
      } else {
        // Document has content: do not overwrite user's section order silently.
        const currentOrder = resumeData.design.sectionOrder || [];
        const isDifferent = JSON.stringify(currentOrder) !== JSON.stringify(tmpl.recommendedOrder);
        if (btnApplyRecommended) {
          if (isDifferent) {
            btnApplyRecommended.classList.remove('hidden');
            btnApplyRecommended.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Apply ${escapeHTML(tmpl.name)}'s Recommended Section Order`;
            btnApplyRecommended.onclick = () => {
              pushHistoryState();
              resumeData.design.sectionOrder = [...tmpl.recommendedOrder];
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
        btn.innerHTML = isCurrent ? '<i class="fa-solid fa-check"></i> Active' : 'Use';
      }
    });

    updateDesignControlsFromState();
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
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-up-exp" data-id="${exp.id}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-down-exp" data-id="${exp.id}" title="Move Down" ${index === resumeData.experience.length - 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate-exp" data-id="${exp.id}" title="Duplicate Entry">
              <i class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-exp" data-id="${exp.id}" title="Delete Entry">
              <i class="fa-regular fa-trash-can"></i>
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
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-up-edu" data-id="${edu.id}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-down-edu" data-id="${edu.id}" title="Move Down" ${index === resumeData.education.length - 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate-edu" data-id="${edu.id}" title="Duplicate Entry">
              <i class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-edu" data-id="${edu.id}" title="Delete Entry">
              <i class="fa-regular fa-trash-can"></i>
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
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-up-proj" data-id="${proj.id}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="move-down-proj" data-id="${proj.id}" title="Move Down" ${index === resumeData.projects.length - 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate-proj" data-id="${proj.id}" title="Duplicate Entry">
              <i class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-proj" data-id="${proj.id}" title="Delete Entry">
              <i class="fa-regular fa-trash-can"></i>
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
                <i class="fa-regular fa-trash-can"></i>
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
                <input type="text" class="form-control item-cert-year" value="${escapeHTML(c.year)}" data-index="${idx}">
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
                <i class="fa-regular fa-trash-can"></i>
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
                <i class="fa-regular fa-trash-can"></i>
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
                <i class="fa-regular fa-trash-can"></i>
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
                <i class="fa-regular fa-trash-can"></i>
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
                <i class="fa-regular fa-trash-can"></i>
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
    }
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

    const labels = {
      summary: 'Professional Summary',
      experience: 'Work Experience',
      education: 'Education',
      projects: 'Key Projects & Portfolio',
      skills: 'Skills & Competencies',
      certifications: 'Certifications & Credentials',
      achievements: 'Honors & Achievements',
      volunteering: 'Community & Leadership',
      languages: 'Languages',
      academic: 'Academic & Research (CV)'
    };

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
            <span>${labels[key]}</span>
          </label>
          <div style="display: flex; gap: 0.3rem;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="order-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled' : ''} style="min-height: 28px; padding: 0.15rem 0.45rem;">
              <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="order-down" data-index="${index}" title="Move Down" ${index === order.length - 1 ? 'disabled' : ''} style="min-height: 28px; padding: 0.15rem 0.45rem;">
              <i class="fa-solid fa-arrow-down"></i>
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
  function renderResumePreview() {
    const sheet = getEl('resumeSheet');
    if (!sheet) return;

    // Apply template class
    const tmplId = resumeData.template || 'classic-professional';
    sheet.className = `ats-resume-sheet template-${tmplId} page-${resumeData.design.pageSize || 'a4'} density-${resumeData.design.density || 'standard'} font-size-${resumeData.design.fontSize || 'standard'}`;

    if (resumeData.design.fontFamily === 'sans') {
      sheet.classList.add('font-sans');
    } else {
      sheet.classList.remove('font-sans');
    }

    // Update active badge in preview toolbar
    const prevBadge = getEl('prevTemplateBadge');
    if (prevBadge && TEMPLATES[tmplId]) {
      prevBadge.innerHTML = `<i class="fa-solid fa-shield-check"></i> ${escapeHTML(TEMPLATES[tmplId].name)}`;
    }

    const p = resumeData.personal || {};

    // Name & Title
    const prevFullName = getEl('prevFullName');
    if (prevFullName) {
      prevFullName.textContent = (p.fullName || 'YOUR FULL NAME').trim().toUpperCase();
    }

    const prevTargetTitle = getEl('prevTargetTitle');
    if (prevTargetTitle) {
      if (p.targetTitle && p.targetTitle.trim()) {
        prevTargetTitle.textContent = p.targetTitle.trim();
        prevTargetTitle.style.display = 'block';
      } else {
        prevTargetTitle.textContent = '';
        prevTargetTitle.style.display = 'none';
      }
    }

    // Contact Information
    const prevContactLine = getEl('prevContactLine');
    if (prevContactLine) {
      prevContactLine.innerHTML = '';
      const contactItems = [];
      if (p.phone && p.phone.trim()) contactItems.push({ text: p.phone.trim(), href: 'tel:' + p.phone.trim().replace(/\s+/g, '') });
      if (p.email && p.email.trim()) contactItems.push({ text: p.email.trim(), href: 'mailto:' + p.email.trim() });
      if (p.location && p.location.trim()) contactItems.push({ text: p.location.trim() });
      if (p.linkedin && p.linkedin.trim()) contactItems.push({ text: p.linkedin.trim(), href: sanitizeHref(p.linkedin.trim()) });
      if (p.github && p.github.trim()) contactItems.push({ text: p.github.trim(), href: sanitizeHref(p.github.trim()) });
      if (p.website && p.website.trim()) contactItems.push({ text: p.website.trim(), href: sanitizeHref(p.website.trim()) });

      contactItems.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'resume-contact-item';
        if (item.href) {
          const a = document.createElement('a');
          a.href = item.href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = item.text;
          span.appendChild(a);
        } else {
          span.textContent = item.text;
        }
        prevContactLine.appendChild(span);

        if (index < contactItems.length - 1) {
          const sep = document.createElement('span');
          sep.textContent = '•';
          sep.style.color = '#94A3B8';
          prevContactLine.appendChild(sep);
        }
      });
    }

    // Render individual sections content
    // Summary
    const prevSectionSummary = getEl('prevSectionSummary');
    const prevSummary = getEl('prevSummary');
    if (prevSectionSummary && prevSummary) {
      const summaryText = (resumeData.summary || '').trim();
      if (summaryText && resumeData.sectionVisibility.summary !== false) {
        prevSummary.textContent = summaryText;
        prevSectionSummary.style.display = 'block';
      } else {
        prevSectionSummary.style.display = 'none';
      }
    }

    // Experience
    const prevSectionExperience = getEl('prevSectionExperience');
    const prevExperienceList = getEl('prevExperienceList');
    if (prevSectionExperience && prevExperienceList) {
      const exp = (resumeData.experience || []).filter(x => x.role || x.company || x.bulletsText);
      if (exp.length > 0 && resumeData.sectionVisibility.experience !== false) {
        prevExperienceList.innerHTML = '';
        exp.forEach(item => {
          const div = document.createElement('div');
          div.className = 'resume-entry';
          const roleComp = [item.role, item.company].filter(Boolean).join(' | ');
          const durLoc = [item.duration, item.location].filter(Boolean).join(' • ');

          let bulletsHtml = '';
          if (item.bulletsText && item.bulletsText.trim()) {
            const lines = item.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            const clean = lines.map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
            if (clean.length > 0) {
              bulletsHtml = `<ul class="resume-bullets">${clean.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>`;
            }
          }

          div.innerHTML = `
            <div class="resume-entry-header">
              <span>${escapeHTML(roleComp)}</span>
              <span style="font-weight: normal; font-style: italic; font-size: 9pt;">${escapeHTML(durLoc)}</span>
            </div>
            ${bulletsHtml}
          `;
          prevExperienceList.appendChild(div);
        });
        prevSectionExperience.style.display = 'block';
      } else {
        prevSectionExperience.style.display = 'none';
      }
    }

    // Education
    const prevSectionEducation = getEl('prevSectionEducation');
    const prevEducationList = getEl('prevEducationList');
    if (prevSectionEducation && prevEducationList) {
      const edu = (resumeData.education || []).filter(x => x.degree || x.institution);
      if (edu.length > 0 && resumeData.sectionVisibility.education !== false) {
        prevEducationList.innerHTML = '';
        edu.forEach(item => {
          const div = document.createElement('div');
          div.className = 'resume-entry';
          const degInst = [item.degree, item.institution].filter(Boolean).join(' — ');
          const durLocScore = [item.duration, item.location, item.score].filter(Boolean).join(' • ');

          div.innerHTML = `
            <div class="resume-entry-header">
              <span>${escapeHTML(degInst)}</span>
              <span style="font-weight: normal; font-style: italic; font-size: 9pt;">${escapeHTML(durLocScore)}</span>
            </div>
          `;
          prevEducationList.appendChild(div);
        });
        prevSectionEducation.style.display = 'block';
      } else {
        prevSectionEducation.style.display = 'none';
      }
    }

    // Projects
    const prevSectionProjects = getEl('prevSectionProjects');
    const prevProjectsList = getEl('prevProjectsList');
    if (prevSectionProjects && prevProjectsList) {
      const proj = (resumeData.projects || []).filter(x => x.name || x.tech || x.bulletsText);
      if (proj.length > 0 && resumeData.sectionVisibility.projects !== false) {
        prevProjectsList.innerHTML = '';
        proj.forEach(item => {
          const div = document.createElement('div');
          div.className = 'resume-entry';
          const tech = item.tech ? `| ${item.tech}` : '';
          const link = item.link ? `<a href="${sanitizeHref(item.link)}" target="_blank" rel="noopener noreferrer" style="color: #1D4ED8; font-weight: normal; font-size: 8.5pt;">${escapeHTML(item.link)}</a>` : '';

          let bulletsHtml = '';
          if (item.bulletsText && item.bulletsText.trim()) {
            const lines = item.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            const clean = lines.map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
            if (clean.length > 0) {
              bulletsHtml = `<ul class="resume-bullets">${clean.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>`;
            }
          }

          div.innerHTML = `
            <div class="resume-entry-header">
              <span>${escapeHTML(item.name)} <span style="font-style: italic; font-weight: normal; color: #4B5563;">${escapeHTML(tech)}</span></span>
              <span>${link}</span>
            </div>
            ${bulletsHtml}
          `;
          prevProjectsList.appendChild(div);
        });
        prevSectionProjects.style.display = 'block';
      } else {
        prevSectionProjects.style.display = 'none';
      }
    }

    // Skills
    const prevSectionSkills = getEl('prevSectionSkills');
    const prevSkillsList = getEl('prevSkillsList');
    if (prevSectionSkills && prevSkillsList) {
      const s = resumeData.skills || {};
      const rows = [];
      if (s.languages && s.languages.trim()) rows.push({ label: 'Core Competencies', val: s.languages.trim() });
      if (s.frameworks && s.frameworks.trim()) rows.push({ label: 'Tools & Platforms', val: s.frameworks.trim() });
      if (s.tools && s.tools.trim()) rows.push({ label: 'Technical & Data Skills', val: s.tools.trim() });
      if (s.other && s.other.trim()) rows.push({ label: 'Professional Skills', val: s.other.trim() });

      if (rows.length > 0 && resumeData.sectionVisibility.skills !== false) {
        prevSkillsList.innerHTML = '';
        rows.forEach(r => {
          const div = document.createElement('div');
          div.className = 'resume-skills-row';
          div.innerHTML = `<span class="skills-category">${escapeHTML(r.label)}: </span><span>${escapeHTML(r.val)}</span>`;
          prevSkillsList.appendChild(div);
        });
        prevSectionSkills.style.display = 'block';
      } else {
        prevSectionSkills.style.display = 'none';
      }
    }

    // Certifications
    const prevSectionCert = getEl('prevSectionCertifications');
    const prevCertList = getEl('prevCertificationsList');
    if (prevSectionCert && prevCertList) {
      const certs = resumeData.certifications || [];
      if (certs.length > 0 && resumeData.sectionVisibility.certifications) {
        prevCertList.innerHTML = '';
        certs.forEach(c => {
          const div = document.createElement('div');
          div.className = 'resume-entry';
          div.innerHTML = `<strong>${escapeHTML(c.name || c.title)}</strong> ${c.issuer ? ' — ' + escapeHTML(c.issuer) : ''} ${c.year ? '(' + escapeHTML(c.year) + ')' : ''}`;
          prevCertList.appendChild(div);
        });
        prevSectionCert.style.display = 'block';
      } else {
        prevSectionCert.style.display = 'none';
      }
    }

    // Achievements
    const prevSectionAch = getEl('prevSectionAchievements');
    const prevAchList = getEl('prevAchievementsList');
    if (prevSectionAch && prevAchList) {
      const achs = resumeData.achievements || [];
      if (achs.length > 0 && resumeData.sectionVisibility.achievements) {
        prevAchList.innerHTML = '';
        achs.forEach(a => {
          const text = typeof a === 'string' ? a : (a.title || a.text || '');
          const div = document.createElement('div');
          div.className = 'resume-entry';
          div.innerHTML = `• ${escapeHTML(text)}`;
          prevAchList.appendChild(div);
        });
        prevSectionAch.style.display = 'block';
      } else {
        prevSectionAch.style.display = 'none';
      }
    }

    // Reorder sections in container based on active sectionOrder
    const container = getEl('resumeSectionsContainer');
    if (container && resumeData.design && Array.isArray(resumeData.design.sectionOrder)) {
      const sectionMap = {
        summary: prevSectionSummary,
        experience: prevSectionExperience,
        education: prevSectionEducation,
        projects: prevSectionProjects,
        skills: prevSectionSkills,
        certifications: prevSectionCert,
        achievements: prevSectionAch,
        volunteering: getEl('prevSectionVolunteering'),
        languages: getEl('prevSectionLanguages'),
        academic: getEl('prevSectionAcademic')
      };

      resumeData.design.sectionOrder.forEach(secKey => {
        const el = sectionMap[secKey];
        if (el) container.appendChild(el);
      });
    }

    // Autosave
    saveDraftToStorage();

    // Responsive scaling
    updatePreviewScale();
  }

  /**
   * Fit-to-Width Preview Scaling & Page Count Indicator
   */
  function updatePreviewScale() {
    const resumePreviewOuter = getEl('resumePreviewOuter');
    const previewWrapper = getEl('previewWrapper');
    const resumeSheet = getEl('resumeSheet');
    const pageCountPill = getEl('pageCountPill');

    if (!resumePreviewOuter || !previewWrapper || !resumeSheet) return;

    // Calculate scaling
    let scale = 1;
    if (currentZoom === 'fit') {
      const availableWidth = resumePreviewOuter.clientWidth - 24;
      const sheetWidth = resumeSheet.offsetWidth || 794;
      scale = Math.min(1, Math.max(0.35, availableWidth / sheetWidth));
    } else if (currentZoom === '75') {
      scale = 0.75;
    } else if (currentZoom === '100') {
      scale = 1.0;
    } else if (currentZoom === '125') {
      scale = 1.25;
    }

    resumeSheet.style.transform = `scale(${scale})`;
    previewWrapper.style.height = `${resumeSheet.offsetHeight * scale}px`;

    // Estimate pages based on sheet pixel height (standard A4 is 1123px at 96 DPI, Letter is 1056px)
    const pageHeightPx = (resumeData.design.pageSize === 'letter') ? 1056 : 1123;
    const totalHeight = resumeSheet.scrollHeight;
    const estPages = Math.max(1, Math.ceil(totalHeight / pageHeightPx));

    if (pageCountPill) {
      pageCountPill.textContent = `Est. ${estPages} Page${estPages > 1 ? 's' : ''}`;
    }
  }

  /**
   * Actionable Resume Review Checklist Generator
   */
  function generateReviewReport(data) {
    const issues = [];
    const p = data.personal || {};

    // 1. Critical: Full Name
    if (!p.fullName || !p.fullName.trim()) {
      issues.push({
        type: 'error',
        message: 'Full Name is missing. Required to identify your resume document.',
        section: 'personal',
        targetField: 'fullName'
      });
    }

    // 2. Email validation
    if (!p.email || !p.email.trim()) {
      issues.push({
        type: 'warning',
        message: 'Email address not provided. Recommended so recruiters can contact you.',
        section: 'personal',
        targetField: 'email'
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
      issues.push({
        type: 'error',
        message: `Email "${p.email}" format looks incomplete or malformed.`,
        section: 'personal',
        targetField: 'email'
      });
    }

    // 3. URLs
    if (p.linkedin && !isValidUrlFormat(p.linkedin)) {
      issues.push({
        type: 'error',
        message: `LinkedIn URL "${p.linkedin}" appears malformed.`,
        section: 'personal',
        targetField: 'linkedin'
      });
    }
    if (p.website && !isValidUrlFormat(p.website)) {
      issues.push({
        type: 'error',
        message: `Website URL "${p.website}" appears malformed.`,
        section: 'personal',
        targetField: 'website'
      });
    }
    if (p.github && !isValidUrlFormat(p.github)) {
      issues.push({
        type: 'error',
        message: `GitHub URL "${p.github}" appears malformed.`,
        section: 'personal',
        targetField: 'github'
      });
    }

    // 4. Content Completeness
    if (!data.summary || !data.summary.trim()) {
      issues.push({
        type: 'info',
        message: 'Professional Summary is currently empty.',
        section: 'summary',
        targetField: 'summaryText'
      });
    }

    const exp = data.experience || [];
    if (exp.length === 0) {
      if (data.template !== 'graduate-early-career') {
        issues.push({
          type: 'info',
          message: 'No Work Experience entries added yet.',
          section: 'experience'
        });
      }
    }

    const edu = data.education || [];
    if (edu.length === 0) {
      issues.push({
        type: 'warning',
        message: 'Education history is empty.',
        section: 'education'
      });
    }

    // 5. Placeholder detection
    const strPayload = JSON.stringify(data).toLowerCase();
    if (strPayload.includes('lorem ipsum') || strPayload.includes('[company name]')) {
      issues.push({
        type: 'warning',
        message: 'Placeholder text detected (e.g. "[Company Name]" or "Lorem ipsum"). Check your draft before final export.',
        section: 'summary'
      });
    }

    // 6. Template specific check
    if (data.template === 'academic-cv') {
      issues.push({
        type: 'info',
        message: 'Academic / Research CV is designed for comprehensive multi-page dossiers with publications and teaching.',
        section: 'academic'
      });
    }

    return issues;
  }

  function runResumeReview() {
    const checklist = getEl('reviewChecklist');
    const statusBar = getEl('reviewStatusBar');
    const statusText = getEl('reviewStatusText');
    const statusIcon = getEl('reviewStatusIcon');
    const pageEstPill = getEl('reviewPageEstimatePill');

    if (!checklist) return;
    const issues = generateReviewReport(resumeData);

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
      const pageHeightPx = (resumeData.design.pageSize === 'letter') ? 1056 : 1123;
      const estPages = Math.max(1, Math.ceil(sheet.scrollHeight / pageHeightPx));
      pageEstPill.textContent = `~${estPages} Page${estPages > 1 ? 's' : ''}`;
    }

    checklist.innerHTML = '';
    if (issues.length === 0) {
      checklist.innerHTML = `
        <div class="review-item" style="border-left: 3px solid var(--accent-green);">
          <div class="review-item-content">
            <i class="fa-solid fa-circle-check" style="color: var(--accent-green); margin-top: 0.15rem;"></i>
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
          <i class="fa-solid ${icon}" style="margin-top: 0.15rem;"></i>
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
            target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      });

      checklist.appendChild(item);
    });
  }

  /**
   * Attach All Event Listeners
   */
  function attachEventListeners() {
    // Dirty flag on typing
    document.addEventListener('input', () => {
      isDirty = true;
    });

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

    // Add Entry buttons
    const btnAddExp = getEl('btnAddExperience');
    if (btnAddExp) {
      btnAddExp.addEventListener('click', () => {
        pushHistoryState();
        resumeData.experience.push({
          id: 'exp-' + Date.now(),
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
          id: 'edu-' + Date.now(),
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
          id: 'proj-' + Date.now(),
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
          resumeData.certifications = [{ id: 'cert-' + Date.now(), name: '', issuer: '', year: '' }];
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
        resumeData.certifications.push({ id: 'cert-' + Date.now(), name: '', issuer: '', year: '' });
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
        if (isDirty) {
          if (!confirm('Populate the editor with demonstration sample data? This will overwrite your current fields.')) return;
        }
        pushHistoryState();
        resumeData = JSON.parse(JSON.stringify(SAMPLE_DATA));
        isDirty = false;
        populateAllFormFields();
        renderAllDynamicLists();
        updateDesignControlsFromState();
        renderResumePreview();
        runResumeReview();
      });
    }

    // Clear Form Button
    const btnClearForm = getEl('btnClearForm');
    if (btnClearForm) {
      btnClearForm.addEventListener('click', () => {
        if (!confirm('Are you sure you want to clear all resume fields?')) return;
        pushHistoryState();
        resumeData = JSON.parse(JSON.stringify(EMPTY_DATA));
        isDirty = false;
        populateAllFormFields();
        renderAllDynamicLists();
        updateDesignControlsFromState();
        renderResumePreview();
        runResumeReview();
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
        const safeName = (resumeData.personal.fullName || 'Candidate').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        a.href = url;
        a.download = `${safeName}_Resume_Backup.json`;
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
          alert('File size exceeds 2 MB. Please select a valid ApplyReady JSON backup file.');
          fileImportInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            if (!validateResumeSchema(parsed)) {
              throw new Error('Invalid resume schema');
            }
            if (isDirty) {
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
            alert('Resume data imported successfully.');
          } catch (err) {
            alert('Failed to import resume. The file is corrupt or does not match ApplyReady JSON backup schema.');
          }
          fileImportInput.value = '';
        };
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
    if (btnPrintPDF) btnPrintPDF.addEventListener('click', () => window.print());

    // Mobile View Toggle
    const tabEdit = getEl('tabEdit');
    const tabPreview = getEl('tabPreview');
    const layout = getEl('resumeAppLayout');
    if (tabEdit && tabPreview && layout) {
      tabEdit.addEventListener('click', () => {
        tabEdit.classList.add('active');
        tabPreview.classList.remove('active');
        layout.className = 'resume-app-layout view-edit';
      });
      tabPreview.addEventListener('click', () => {
        tabPreview.classList.add('active');
        tabEdit.classList.remove('active');
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
      copy.id = 'exp-' + Date.now();
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
      copy.id = 'edu-' + Date.now();
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
      copy.id = 'proj-' + Date.now();
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
  function exportToVectorPDF() {
    if (!window.ApplyReadyPDF) {
      alert('PDF generation engine is not ready. Please try again.');
      return;
    }

    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : '').trim();
    if (!fullName) {
      alert('Please enter your Full Name in Section 1 before downloading your resume.');
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
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
    }

    try {
      const doc = window.ApplyReadyPDF.generateResumePDF(resumeData, {
        pageSize: resumeData.design.pageSize || 'a4',
        fontFamily: resumeData.design.fontFamily || 'serif',
        template: resumeData.template || 'classic-professional',
        density: resumeData.design.density || 'standard',
        sectionOrder: resumeData.design.sectionOrder,
        sectionVisibility: resumeData.sectionVisibility
      });

      const blob = doc.toBlob();
      const safeName = fullName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}_ATS_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Vector PDF export error:', err);
      alert('An error occurred while generating the PDF. Please try browser print fallback.');
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
      alert('DOCX generator engine is not loaded. Please try again or download as PDF.');
      return;
    }

    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : '').trim();
    if (!fullName) {
      alert('Please enter your Full Name before downloading your Word document.');
      return;
    }

    const btn = getEl('btnDownloadDOCX');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Building DOCX...';
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
      const safeName = fullName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}_ATS_Resume.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('DOCX export error:', err);
      alert('An error occurred while building the Word document.');
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
      alert('Plain text generator is not ready. Please try again.');
      return;
    }

    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : '').trim();
    const textContent = window.ApplyReadyPDF.generateResumeText(resumeData);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const safeName = (fullName || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_ATS_Resume.txt`;
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
      TEMPLATES
    };
  }
})();
