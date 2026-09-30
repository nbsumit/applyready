/**
 * ApplyReady.in - Single-Column ATS-Friendly Resume Builder
 * 100% Client-Side Real-Time Preview, Vector Text PDF Export, and Local Drafts
 */

(function () {
  'use strict';

  // State
  let isDirty = false;
  let autoSaveDraft = false;
  let currentFont = 'serif';

  // General-purpose professional sample data
  const SAMPLE_DATA = {
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
    }
  };

  // Blank template
  const EMPTY_DATA = {
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
    projectsTitle: 'Key Projects',
    projects: [],
    skillsTitle: 'Skills & Competencies',
    skills: {
      languages: '',
      frameworks: '',
      tools: '',
      other: ''
    }
  };

  // Current Resume State
  let resumeData = JSON.parse(JSON.stringify(SAMPLE_DATA));

  // DOM Elements (safe for Node test environments)
  const doc = typeof document !== 'undefined' ? document : null;
  const getEl = (id) => doc ? doc.getElementById(id) : null;

  const btnLoadSample = getEl('btnLoadSample');
  const btnClearForm = getEl('btnClearForm');
  const btnDownloadPDF = getEl('btnDownloadPDF');
  const btnPrintPDF = getEl('btnPrintPDF');
  const btnExportJSON = getEl('btnExportJSON');
  const btnImportJSON = getEl('btnImportJSON');
  const fileImportInput = getEl('fileImportInput');

  // Draft Elements
  const chkSaveDraft = getEl('chkSaveDraft');
  const draftStatusText = getEl('draftStatusText');
  const btnDeleteDraft = getEl('btnDeleteDraft');

  // Mobile Tabs
  const tabEdit = getEl('tabEdit');
  const tabPreview = getEl('tabPreview');
  const resumeAppLayout = getEl('resumeAppLayout');

  // Font Selection
  const fontSelect = getEl('fontSelect');
  const resumeSheet = getEl('resumeSheet');
  const previewWrapper = getEl('previewWrapper');
  const resumePreviewOuter = getEl('resumePreviewOuter');

  // Inputs
  const fullNameInp = getEl('fullName');
  const targetTitleInp = getEl('targetTitle');
  const emailInp = getEl('email');
  const phoneInp = getEl('phone');
  const locationInp = getEl('location');
  const linkedinInp = getEl('linkedin');
  const githubInp = getEl('github');
  const websiteInp = getEl('website');
  const summaryInp = getEl('summaryText');

  const skillLanguagesInp = getEl('skillLanguages');
  const skillFrameworksInp = getEl('skillFrameworks');
  const skillToolsInp = getEl('skillTools');
  const skillOtherInp = getEl('skillOther');

  // Dynamic Lists
  const educationList = getEl('educationList');
  const btnAddEducation = getEl('btnAddEducation');
  const experienceList = getEl('experienceList');
  const btnAddExperience = getEl('btnAddExperience');
  const projectsList = getEl('projectsList');
  const btnAddProject = getEl('btnAddProject');

  // Preview Elements
  const prevFullName = getEl('prevFullName');
  const prevTargetTitle = getEl('prevTargetTitle');
  const prevContactLine = getEl('prevContactLine');
  const prevSectionSummary = getEl('prevSectionSummary');
  const prevSummaryTitle = getEl('prevSummaryTitle');
  const prevSummary = getEl('prevSummary');

  const prevSectionEducation = getEl('prevSectionEducation');
  const prevEducationTitle = getEl('prevEducationTitle');
  const prevEducationList = getEl('prevEducationList');

  const prevSectionExperience = getEl('prevSectionExperience');
  const prevExperienceTitle = getEl('prevExperienceTitle');
  const prevExperienceList = getEl('prevExperienceList');

  const prevSectionProjects = getEl('prevSectionProjects');
  const prevProjectsTitle = getEl('prevProjectsTitle');
  const prevProjectsList = getEl('prevProjectsList');

  const prevSectionSkills = getEl('prevSectionSkills');
  const prevSkillsTitle = getEl('prevSkillsTitle');
  const prevSkillsList = getEl('prevSkillsList');

  /**
   * Initialize Builder
   */
  function init() {
    loadDraftSettings();
    populateFormWithData();
    renderDynamicFormSections();
    renderResumePreview();
    attachEventListeners();
    setupAccordions();
    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
  }

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
   * Check Local Draft Storage
   */
  function loadDraftSettings() {
    try {
      const enabled = localStorage.getItem('applyready_draft_enabled');
      if (enabled === 'true') {
        autoSaveDraft = true;
        if (chkSaveDraft) chkSaveDraft.checked = true;
        const saved = localStorage.getItem('applyready_resume_draft');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.data) {
            resumeData = parsed.data;
            if (draftStatusText && parsed.savedAt) {
              const d = new Date(parsed.savedAt);
              draftStatusText.textContent = `Draft saved locally: ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
          }
        }
      } else {
        autoSaveDraft = false;
        if (chkSaveDraft) chkSaveDraft.checked = false;
        if (draftStatusText) draftStatusText.textContent = 'Local saving disabled';
      }
    } catch (e) {
      console.warn('Storage unavailable:', e);
      if (draftStatusText) draftStatusText.textContent = 'Storage unavailable in private mode';
    }
  }

  function saveDraftToStorage() {
    if (!autoSaveDraft) return;
    try {
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        data: resumeData
      };
      localStorage.setItem('applyready_resume_draft', JSON.stringify(payload));
      if (draftStatusText) {
        const now = new Date();
        draftStatusText.textContent = `Draft saved: Just now (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      }
    } catch (e) {
      console.error('Failed to save draft:', e);
      if (draftStatusText) draftStatusText.textContent = 'Error saving to local storage (quota exceeded)';
    }
  }

  function deleteDraftFromStorage() {
    try {
      localStorage.removeItem('applyready_resume_draft');
      if (draftStatusText) {
        draftStatusText.textContent = autoSaveDraft ? 'No draft saved yet' : 'Local saving disabled';
      }
    } catch (e) {}
  }

  /**
   * Populate Inputs from State
   */
  function populateFormWithData() {
    fullNameInp.value = resumeData.personal.fullName || '';
    targetTitleInp.value = resumeData.personal.targetTitle || '';
    emailInp.value = resumeData.personal.email || '';
    phoneInp.value = resumeData.personal.phone || '';
    locationInp.value = resumeData.personal.location || '';
    linkedinInp.value = resumeData.personal.linkedin || '';
    githubInp.value = resumeData.personal.github || '';
    if (websiteInp) websiteInp.value = resumeData.personal.website || '';
    summaryInp.value = resumeData.summary || '';

    const s = resumeData.skills || {};
    skillLanguagesInp.value = s.languages || '';
    skillFrameworksInp.value = s.frameworks || '';
    skillToolsInp.value = s.tools || '';
    skillOtherInp.value = s.other || '';
  }

  /**
   * Render Dynamic Form Lists (Education, Experience, Projects)
   */
  function renderDynamicFormSections() {
    // Education
    educationList.innerHTML = '';
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
            <input type="text" id="edu-score-${edu.id}" class="form-control item-score" placeholder="e.g. GPA: 3.9" value="${escapeHTML(edu.score)}">
          </div>
        </div>
      `;
      educationList.appendChild(el);
    });

    // Experience
    experienceList.innerHTML = '';
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
            <label class="form-label text-sm" for="exp-dur-${exp.id}">Duration</label>
            <input type="text" id="exp-dur-${exp.id}" class="form-control item-duration" placeholder="e.g. Jan 2022 - Present" value="${escapeHTML(exp.duration)}">
          </div>
          <div>
            <label class="form-label text-sm" for="exp-loc-${exp.id}">Location</label>
            <input type="text" id="exp-loc-${exp.id}" class="form-control item-location" placeholder="e.g. New York, NY" value="${escapeHTML(exp.location)}">
          </div>
        </div>
        <div>
          <label class="form-label text-sm" for="exp-bul-${exp.id}">Key Responsibilities & Achievements (One per line)</label>
          <textarea id="exp-bul-${exp.id}" class="form-control item-bullets" rows="3" placeholder="Enter bullet points (start each achievement on a new line)...">${escapeHTML(exp.bulletsText)}</textarea>
        </div>
      `;
      experienceList.appendChild(el);
    });

    // Projects
    projectsList.innerHTML = '';
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
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-proj" data-id="${proj.id}" title="Delete Entry">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="form-row-2" style="margin-bottom: 0.5rem;">
          <div>
            <label class="form-label text-sm" for="proj-name-${proj.id}">Project Name</label>
            <input type="text" id="proj-name-${proj.id}" class="form-control item-name" placeholder="e.g. Process Optimization Project" value="${escapeHTML(proj.name)}">
          </div>
          <div>
            <label class="form-label text-sm" for="proj-tech-${proj.id}">Tools / Methodologies Used</label>
            <input type="text" id="proj-tech-${proj.id}" class="form-control item-tech" placeholder="e.g. Asana, Tableau, Excel" value="${escapeHTML(proj.tech)}">
          </div>
        </div>
        <div style="margin-bottom: 0.5rem;">
          <label class="form-label text-sm" for="proj-link-${proj.id}">Link / Case Study URL (Optional)</label>
          <input type="text" id="proj-link-${proj.id}" class="form-control item-link" placeholder="e.g. portfolio.com/case-study" value="${escapeHTML(proj.link)}">
        </div>
        <div>
          <label class="form-label text-sm" for="proj-bul-${proj.id}">Project Highlights & Impact (One per line)</label>
          <textarea id="proj-bul-${proj.id}" class="form-control item-bullets" rows="2" placeholder="Key outcomes or impact metrics...">${escapeHTML(proj.bulletsText)}</textarea>
        </div>
      `;
      projectsList.appendChild(el);
    });
  }

  /**
   * Render Resume Live Preview
   */
  function renderResumePreview() {
    const p = resumeData.personal || {};

    // Name & Target Title
    prevFullName.textContent = (p.fullName || 'YOUR FULL NAME').toUpperCase();
    if (p.targetTitle && p.targetTitle.trim()) {
      prevTargetTitle.textContent = p.targetTitle;
      prevTargetTitle.style.display = 'block';
    } else {
      prevTargetTitle.textContent = '';
      prevTargetTitle.style.display = 'none';
    }

    // Contact Information: only insert bullet separators between non-empty items!
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
        sep.style.color = '#9CA3AF';
        prevContactLine.appendChild(sep);
      }
    });

    // Professional Summary
    if (resumeData.summary && resumeData.summary.trim()) {
      prevSummaryTitle.textContent = resumeData.summaryTitle || 'PROFESSIONAL SUMMARY';
      prevSummary.textContent = resumeData.summary;
      prevSectionSummary.style.display = 'block';
    } else {
      prevSectionSummary.style.display = 'none';
    }

    // Work Experience
    const exp = resumeData.experience || [];
    const validExp = exp.filter(x => x.role || x.company || x.bulletsText);
    if (validExp.length > 0) {
      prevExperienceTitle.textContent = resumeData.experienceTitle || 'WORK EXPERIENCE';
      prevExperienceList.innerHTML = '';
      validExp.forEach(item => {
        const div = document.createElement('div');
        div.className = 'resume-entry';

        const roleComp = [item.role, item.company].filter(Boolean).join(' | ');
        const durLoc = [item.duration, item.location].filter(Boolean).join(' • ');

        let bulletsHtml = '';
        if (item.bulletsText && item.bulletsText.trim()) {
          const lines = item.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const cleanLines = lines.map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
          if (cleanLines.length > 0) {
            bulletsHtml = `<ul class="resume-bullets">${cleanLines.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>`;
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

    // Education
    const edu = resumeData.education || [];
    const validEdu = edu.filter(x => x.degree || x.institution);
    if (validEdu.length > 0) {
      prevEducationTitle.textContent = resumeData.educationTitle || 'EDUCATION';
      prevEducationList.innerHTML = '';
      validEdu.forEach(item => {
        const div = document.createElement('div');
        div.className = 'resume-entry';

        const degInst = [item.degree, item.institution].filter(Boolean).join(' — ');
        const meta = [item.duration, item.location, item.score].filter(Boolean).join(' • ');

        div.innerHTML = `
          <div class="resume-entry-header">
            <span>${escapeHTML(degInst)}</span>
            <span style="font-weight: normal; font-style: italic; font-size: 9pt;">${escapeHTML(meta)}</span>
          </div>
        `;
        prevEducationList.appendChild(div);
      });
      prevSectionEducation.style.display = 'block';
    } else {
      prevSectionEducation.style.display = 'none';
    }

    // Projects
    const proj = resumeData.projects || [];
    const validProj = proj.filter(x => x.name || x.tech || x.bulletsText);
    if (validProj.length > 0) {
      prevProjectsTitle.textContent = resumeData.projectsTitle || 'KEY PROJECTS';
      prevProjectsList.innerHTML = '';
      validProj.forEach(item => {
        const div = document.createElement('div');
        div.className = 'resume-entry';

        const nameTech = item.tech ? `${item.name} | <span style="font-weight: normal; font-style: italic;">${escapeHTML(item.tech)}</span>` : escapeHTML(item.name);
        const linkHtml = item.link ? `<a href="${sanitizeHref(item.link)}" target="_blank" rel="noopener noreferrer" style="font-size: 8.5pt; color: #1D4ED8;">${escapeHTML(item.link)}</a>` : '';

        let bulletsHtml = '';
        if (item.bulletsText && item.bulletsText.trim()) {
          const lines = item.bulletsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const cleanLines = lines.map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
          if (cleanLines.length > 0) {
            bulletsHtml = `<ul class="resume-bullets">${cleanLines.map(l => `<li>${escapeHTML(l)}</li>`).join('')}</ul>`;
          }
        }

        div.innerHTML = `
          <div class="resume-entry-header">
            <span>${nameTech}</span>
            <span>${linkHtml}</span>
          </div>
          ${bulletsHtml}
        `;
        prevProjectsList.appendChild(div);
      });
      prevSectionProjects.style.display = 'block';
    } else {
      prevSectionProjects.style.display = 'none';
    }

    // Skills
    const skills = resumeData.skills || {};
    const skillRows = [];
    if (skills.languages && skills.languages.trim()) skillRows.push({ label: 'Core Competencies', val: skills.languages.trim() });
    if (skills.frameworks && skills.frameworks.trim()) skillRows.push({ label: 'Tools & Platforms', val: skills.frameworks.trim() });
    if (skills.tools && skills.tools.trim()) skillRows.push({ label: 'Technical & Data Skills', val: skills.tools.trim() });
    if (skills.other && skills.other.trim()) skillRows.push({ label: 'Professional Skills', val: skills.other.trim() });

    if (skillRows.length > 0) {
      prevSkillsTitle.textContent = resumeData.skillsTitle || 'SKILLS & COMPETENCIES';
      prevSkillsList.innerHTML = '';
      skillRows.forEach(row => {
        const div = document.createElement('div');
        div.className = 'resume-skills-row';
        div.innerHTML = `<span class="skills-category">${escapeHTML(row.label)}: </span><span>${escapeHTML(row.val)}</span>`;
        prevSkillsList.appendChild(div);
      });
      prevSectionSkills.style.display = 'block';
    } else {
      prevSectionSkills.style.display = 'none';
    }

    // Autosave Draft if enabled
    saveDraftToStorage();

    // Trigger responsive fit-to-width recalculation
    updatePreviewScale();
  }

  /**
   * Fit-to-Width Preview Scaling
   * Replaces hard-coded 0.65 scale and negative margins with exact geometry.
   */
  function updatePreviewScale() {
    if (!resumePreviewOuter || !previewWrapper || !resumeSheet) return;
    const availableWidth = resumePreviewOuter.clientWidth - 20;
    // Standard A4 width in px at 96 DPI is 794px (210mm)
    const sheetWidth = 794;
    const scale = Math.min(1, Math.max(0.35, availableWidth / sheetWidth));

    resumeSheet.style.transform = `scale(${scale})`;
    previewWrapper.style.height = `${resumeSheet.offsetHeight * scale}px`;
  }

  /**
   * Validate ApplyReady Resume Backup Schema
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
   * Attach Event Listeners
   */
  function attachEventListeners() {
    // Dirty flag on any user typing
    document.addEventListener('input', () => {
      isDirty = true;
    });

    // Inputs
    fullNameInp.addEventListener('input', (e) => {
      resumeData.personal.fullName = e.target.value;
      renderResumePreview();
    });
    targetTitleInp.addEventListener('input', (e) => {
      resumeData.personal.targetTitle = e.target.value;
      renderResumePreview();
    });
    emailInp.addEventListener('input', (e) => {
      resumeData.personal.email = e.target.value;
      renderResumePreview();
    });
    phoneInp.addEventListener('input', (e) => {
      resumeData.personal.phone = e.target.value;
      renderResumePreview();
    });
    locationInp.addEventListener('input', (e) => {
      resumeData.personal.location = e.target.value;
      renderResumePreview();
    });
    linkedinInp.addEventListener('input', (e) => {
      resumeData.personal.linkedin = e.target.value;
      renderResumePreview();
    });
    githubInp.addEventListener('input', (e) => {
      resumeData.personal.github = e.target.value;
      renderResumePreview();
    });
    if (websiteInp) {
      websiteInp.addEventListener('input', (e) => {
        resumeData.personal.website = e.target.value;
        renderResumePreview();
      });
    }

    summaryInp.addEventListener('input', (e) => {
      resumeData.summary = e.target.value;
      renderResumePreview();
    });

    // Skills
    skillLanguagesInp.addEventListener('input', (e) => {
      resumeData.skills.languages = e.target.value;
      renderResumePreview();
    });
    skillFrameworksInp.addEventListener('input', (e) => {
      resumeData.skills.frameworks = e.target.value;
      renderResumePreview();
    });
    skillToolsInp.addEventListener('input', (e) => {
      resumeData.skills.tools = e.target.value;
      renderResumePreview();
    });
    skillOtherInp.addEventListener('input', (e) => {
      resumeData.skills.other = e.target.value;
      renderResumePreview();
    });

    // Dynamic Lists input delegation
    educationList.addEventListener('input', handleEducationInput);
    experienceList.addEventListener('input', handleExperienceInput);
    projectsList.addEventListener('input', handleProjectInput);

    // Dynamic Add Buttons
    btnAddEducation.addEventListener('click', () => {
      resumeData.education.push({
        id: 'edu-' + Date.now(),
        degree: '',
        institution: '',
        location: '',
        duration: '',
        score: ''
      });
      renderDynamicFormSections();
      renderResumePreview();
    });

    btnAddExperience.addEventListener('click', () => {
      resumeData.experience.push({
        id: 'exp-' + Date.now(),
        role: '',
        company: '',
        location: '',
        duration: '',
        bulletsText: ''
      });
      renderDynamicFormSections();
      renderResumePreview();
    });

    btnAddProject.addEventListener('click', () => {
      resumeData.projects.push({
        id: 'proj-' + Date.now(),
        name: '',
        tech: '',
        link: '',
        bulletsText: ''
      });
      renderDynamicFormSections();
      renderResumePreview();
    });

    // Dynamic List Action delegation (Remove, Move Up, Move Down)
    educationList.addEventListener('click', handleEducationAction);
    experienceList.addEventListener('click', handleExperienceAction);
    projectsList.addEventListener('click', handleProjectAction);

    // Font selector
    fontSelect.addEventListener('change', () => {
      currentFont = fontSelect.value;
      if (currentFont === 'sans') {
        resumeSheet.classList.add('font-sans');
      } else {
        resumeSheet.classList.remove('font-sans');
      }
      updatePreviewScale();
    });

    // Load Sample Button with Overwrite Protection
    btnLoadSample.addEventListener('click', () => {
      if (isDirty) {
        if (!confirm('Loading sample data will replace your current edits. Do you wish to continue?')) {
          return;
        }
      }
      resumeData = JSON.parse(JSON.stringify(SAMPLE_DATA));
      isDirty = false;
      populateFormWithData();
      renderDynamicFormSections();
      renderResumePreview();
    });

    // Clear Form Button with Overwrite Protection
    btnClearForm.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all resume fields?')) {
        resumeData = JSON.parse(JSON.stringify(EMPTY_DATA));
        isDirty = false;
        populateFormWithData();
        renderDynamicFormSections();
        renderResumePreview();
      }
    });

    // Draft Checkbox
    if (chkSaveDraft) {
      chkSaveDraft.addEventListener('change', () => {
        autoSaveDraft = chkSaveDraft.checked;
        try {
          localStorage.setItem('applyready_draft_enabled', String(autoSaveDraft));
        } catch (e) {}
        if (autoSaveDraft) {
          saveDraftToStorage();
        } else {
          deleteDraftFromStorage();
        }
      });
    }

    if (btnDeleteDraft) {
      btnDeleteDraft.addEventListener('click', () => {
        if (confirm('Delete your saved draft from this device?')) {
          deleteDraftFromStorage();
          if (chkSaveDraft) chkSaveDraft.checked = false;
          autoSaveDraft = false;
          try {
            localStorage.setItem('applyready_draft_enabled', 'false');
          } catch (e) {}
        }
      });
    }

    // JSON Export
    btnExportJSON.addEventListener('click', () => {
      const payload = {
        version: 1,
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

  // JSON Import
  btnImportJSON.addEventListener('click', () => fileImportInput.click());
  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('File size exceeds 1 MB. Please provide a valid ApplyReady backup file.');
      fileImportInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!validateResumeSchema(parsed)) {
          throw new Error('Invalid resume data schema');
        }

        if (isDirty) {
          if (!confirm('Importing this file will replace your current edits. Do you wish to continue?')) {
            fileImportInput.value = '';
            return;
          }
        }

        resumeData = Object.assign(JSON.parse(JSON.stringify(EMPTY_DATA)), parsed.data);
        isDirty = false;
        populateFormWithData();
        renderDynamicFormSections();
        renderResumePreview();
        alert('Resume data imported successfully.');
      } catch (err) {
        alert('Failed to import resume. The file is corrupt or does not match ApplyReady JSON backup schema.');
      }
      fileImportInput.value = '';
    };
    reader.readAsText(file);
  });

    // Download PDF (Vector Engine)
    btnDownloadPDF.addEventListener('click', exportToVectorPDF);

    // Browser Print Fallback
    if (btnPrintPDF) {
      btnPrintPDF.addEventListener('click', () => {
        window.print();
      });
    }

    // Mobile View Tabs
    if (tabEdit && tabPreview && resumeAppLayout) {
      tabEdit.addEventListener('click', () => {
        tabEdit.classList.add('active');
        tabPreview.classList.remove('active');
        resumeAppLayout.className = 'resume-app-layout view-edit';
      });

      tabPreview.addEventListener('click', () => {
        tabPreview.classList.add('active');
        tabEdit.classList.remove('active');
        resumeAppLayout.className = 'resume-app-layout view-preview';
        setTimeout(updatePreviewScale, 50);
      });
    }
  }

  // Dynamic Item Input Handlers
  function handleEducationInput(e) {
    const parent = e.target.closest('.dynamic-item');
    if (!parent) return;
    const item = resumeData.education.find(x => x.id === parent.dataset.id);
    if (!item) return;

    if (e.target.classList.contains('item-degree')) item.degree = e.target.value;
    if (e.target.classList.contains('item-institution')) item.institution = e.target.value;
    if (e.target.classList.contains('item-duration')) item.duration = e.target.value;
    if (e.target.classList.contains('item-score')) item.score = e.target.value;
    if (e.target.classList.contains('item-location')) item.location = e.target.value;
    renderResumePreview();
  }

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

  // Dynamic Item Action Handlers (Move / Delete)
  function handleEducationAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = resumeData.education.findIndex(x => x.id === id);
    if (idx === -1) return;

    if (action === 'remove-edu') {
      resumeData.education.splice(idx, 1);
    } else if (action === 'move-up-edu' && idx > 0) {
      const temp = resumeData.education[idx];
      resumeData.education[idx] = resumeData.education[idx - 1];
      resumeData.education[idx - 1] = temp;
    } else if (action === 'move-down-edu' && idx < resumeData.education.length - 1) {
      const temp = resumeData.education[idx];
      resumeData.education[idx] = resumeData.education[idx + 1];
      resumeData.education[idx + 1] = temp;
    }

    renderDynamicFormSections();
    renderResumePreview();
  }

  function handleExperienceAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = resumeData.experience.findIndex(x => x.id === id);
    if (idx === -1) return;

    if (action === 'remove-exp') {
      resumeData.experience.splice(idx, 1);
    } else if (action === 'move-up-exp' && idx > 0) {
      const temp = resumeData.experience[idx];
      resumeData.experience[idx] = resumeData.experience[idx - 1];
      resumeData.experience[idx - 1] = temp;
    } else if (action === 'move-down-exp' && idx < resumeData.experience.length - 1) {
      const temp = resumeData.experience[idx];
      resumeData.experience[idx] = resumeData.experience[idx + 1];
      resumeData.experience[idx + 1] = temp;
    }

    renderDynamicFormSections();
    renderResumePreview();
  }

  function handleProjectAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = resumeData.projects.findIndex(x => x.id === id);
    if (idx === -1) return;

    if (action === 'remove-proj') {
      resumeData.projects.splice(idx, 1);
    } else if (action === 'move-up-proj' && idx > 0) {
      const temp = resumeData.projects[idx];
      resumeData.projects[idx] = resumeData.projects[idx - 1];
      resumeData.projects[idx - 1] = temp;
    } else if (action === 'move-down-proj' && idx < resumeData.projects.length - 1) {
      const temp = resumeData.projects[idx];
      resumeData.projects[idx] = resumeData.projects[idx + 1];
      resumeData.projects[idx + 1] = temp;
    }

    renderDynamicFormSections();
    renderResumePreview();
  }

  // Setup Accordions
  function setupAccordions() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        const isOpen = section.classList.contains('open');
        section.classList.toggle('open');
        header.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  /**
   * Export to Vector Text PDF
   */
  function exportToVectorPDF() {
    if (!window.ApplyReadyPDF) {
      alert('PDF generation engine is not ready. Please try again.');
      return;
    }

    // Validate genuinely required information
    const fullName = (resumeData.personal && resumeData.personal.fullName ? resumeData.personal.fullName : '').trim();
    if (!fullName) {
      alert('Please enter your Full Name in Section 1 before downloading your resume.');
      if (fullNameInp) {
        fullNameInp.focus();
        fullNameInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const email = (resumeData.personal && resumeData.personal.email ? resumeData.personal.email : '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert(`The email address "${email}" appears invalid. Please check and correct the format.`);
      if (emailInp) {
        emailInp.focus();
        emailInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const originalBtnHtml = btnDownloadPDF.innerHTML;
    btnDownloadPDF.disabled = true;
    btnDownloadPDF.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Vector PDF...';

    try {
      const doc = window.ApplyReadyPDF.generateResumePDF(resumeData, {
        fontFamily: currentFont
      });

      const blob = doc.toBlob();
      const safeName = (resumeData.personal.fullName || 'Candidate')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_');

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
      alert('An error occurred while generating the PDF. Please try browser print fallback or contact support.');
    } finally {
      btnDownloadPDF.disabled = false;
      btnDownloadPDF.innerHTML = originalBtnHtml;
    }
  }

  // Initialize on DOM Ready (browser only)
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      validateResumeSchema,
      SAMPLE_DATA,
      EMPTY_DATA,
      escapeHTML,
      sanitizeHref
    };
  }

})();
