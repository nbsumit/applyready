/**
 * ApplyReady.in - Single-Column ATS-Friendly Resume Builder
 * 100% Client-Side Real-Time Preview & html2pdf.js Export
 */

(function () {
  'use strict';

  // Resume State
  let resumeData = {
    personal: {
      fullName: 'RAHUL SHARMA',
      targetTitle: 'Full Stack Developer | B.Tech Computer Science',
      email: 'rahul.sharma@gmail.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, Karnataka, India',
      linkedin: 'linkedin.com/in/rahulsharma',
      github: 'github.com/rahulsharma'
    },
    summary: 'Motivated software engineer with practical experience in full-stack web development, RESTful APIs, and database architecture. Proven track record of architecting scalable applications and collaborating in agile teams. Passionate about solving complex algorithmic challenges and optimizing application performance.',
    education: [
      {
        id: 'edu-1',
        degree: 'B.Tech in Computer Science & Engineering',
        institution: 'National Institute of Technology (NIT)',
        location: 'Surathkal, India',
        duration: '2020 – 2024',
        score: 'CGPA: 8.8 / 10'
      },
      {
        id: 'edu-2',
        degree: 'Senior Secondary (Class XII) - CBSE Science',
        institution: 'Delhi Public School',
        location: 'Delhi, India',
        duration: '2018 – 2020',
        score: 'Percentage: 94.4%'
      }
    ],
    experience: [
      {
        id: 'exp-1',
        role: 'Software Developer Intern',
        company: 'TechCorp Solutions',
        location: 'Bengaluru, India',
        duration: 'Jan 2024 – Jun 2024',
        bulletsText: 'Developed and deployed RESTful microservices in Node.js, reducing server response latency by 22% across 50,000+ active users.\nIntegrated Redis caching for hot database queries, decreasing PostgreSQL load by 35%.\nCollaborated with senior engineers in sprint reviews, CI/CD pipeline automation via GitHub Actions, and unit testing with Jest.'
      }
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'E-Commerce Platform with Microservices',
        tech: 'React.js, Node.js, Express, MongoDB, Docker',
        link: 'github.com/rahulsharma/ecommerce-platform',
        bulletsText: 'Engineered an end-to-end shopping platform with JWT authentication, role-based access control, and Razorpay payment gateway integration.\nDesigned responsive product catalog with debounced live search, faceted filtering, and optimized MongoDB index queries.'
      },
      {
        id: 'proj-2',
        name: 'Job Application & ATS Keyword Analyzer',
        tech: 'Python, Flask, SpaCy NLP, SQLite',
        link: 'github.com/rahulsharma/ats-analyzer',
        bulletsText: 'Built a natural language processing tool parsing PDF resumes to extract skill keywords and compute ATS relevancy score against job descriptions.\nAchieved 91% parsing accuracy on 500+ benchmark resumes with automated keyword highlighting.'
      }
    ],
    skills: {
      languages: 'JavaScript (ES6+), TypeScript, Python, C++, SQL',
      frameworks: 'React.js, Next.js, Node.js, Express.js, Redux Toolkit, Tailwind CSS',
      tools: 'MongoDB, PostgreSQL, Git, Docker, Postman, Linux',
      other: 'Data Structures & Algorithms, Object-Oriented Design, System Design, REST APIs'
    }
  };

  // DOM Elements
  const btnLoadSample = document.getElementById('btnLoadSample');
  const btnClearForm = document.getElementById('btnClearForm');
  const btnDownloadPDF = document.getElementById('btnDownloadPDF');
  const fontSelect = document.getElementById('fontSelect');
  const resumeSheet = document.getElementById('resumeSheet');

  // Input Fields
  const fullNameInp = document.getElementById('fullName');
  const targetTitleInp = document.getElementById('targetTitle');
  const emailInp = document.getElementById('email');
  const phoneInp = document.getElementById('phone');
  const locationInp = document.getElementById('location');
  const linkedinInp = document.getElementById('linkedin');
  const githubInp = document.getElementById('github');
  const summaryInp = document.getElementById('summaryText');

  const skillLanguagesInp = document.getElementById('skillLanguages');
  const skillFrameworksInp = document.getElementById('skillFrameworks');
  const skillToolsInp = document.getElementById('skillTools');
  const skillOtherInp = document.getElementById('skillOther');

  // Dynamic Lists Containers
  const educationList = document.getElementById('educationList');
  const btnAddEducation = document.getElementById('btnAddEducation');

  const experienceList = document.getElementById('experienceList');
  const btnAddExperience = document.getElementById('btnAddExperience');

  const projectsList = document.getElementById('projectsList');
  const btnAddProject = document.getElementById('btnAddProject');

  // Preview Elements
  const prevFullName = document.getElementById('prevFullName');
  const prevTargetTitle = document.getElementById('prevTargetTitle');
  const prevPhone = document.getElementById('prevPhone');
  const prevEmail = document.getElementById('prevEmail');
  const prevLocation = document.getElementById('prevLocation');
  const prevLinkedIn = document.getElementById('prevLinkedIn');
  const prevGitHub = document.getElementById('prevGitHub');
  const prevSepLinkedIn = document.getElementById('prevSepLinkedIn');
  const prevSepGitHub = document.getElementById('prevSepGitHub');

  const prevSectionSummary = document.getElementById('prevSectionSummary');
  const prevSummary = document.getElementById('prevSummary');

  const prevSectionEducation = document.getElementById('prevSectionEducation');
  const prevEducationList = document.getElementById('prevEducationList');

  const prevSectionExperience = document.getElementById('prevSectionExperience');
  const prevExperienceList = document.getElementById('prevExperienceList');

  const prevSectionProjects = document.getElementById('prevSectionProjects');
  const prevProjectsList = document.getElementById('prevProjectsList');

  const prevSectionSkills = document.getElementById('prevSectionSkills');
  const prevSkillsLanguages = document.getElementById('prevSkillsLanguages');
  const prevSkillsFrameworks = document.getElementById('prevSkillsFrameworks');
  const prevSkillsTools = document.getElementById('prevSkillsTools');
  const prevSkillsOther = document.getElementById('prevSkillsOther');
  const prevRowLanguages = document.getElementById('prevRowLanguages');
  const prevRowFrameworks = document.getElementById('prevRowFrameworks');
  const prevRowTools = document.getElementById('prevRowTools');
  const prevRowOther = document.getElementById('prevRowOther');

  // Monetization Modal
  const monetizeModal = document.getElementById('monetizeModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const linkDismissModal = document.getElementById('linkDismissModal');

  // Initialization
  function init() {
    populateFormWithData();
    renderDynamicFormSections();
    renderResumePreview();
    attachEventListeners();
    setupAccordions();
  }

  // Populate inputs from state
  function populateFormWithData() {
    fullNameInp.value = resumeData.personal.fullName || '';
    targetTitleInp.value = resumeData.personal.targetTitle || '';
    emailInp.value = resumeData.personal.email || '';
    phoneInp.value = resumeData.personal.phone || '';
    locationInp.value = resumeData.personal.location || '';
    linkedinInp.value = resumeData.personal.linkedin || '';
    githubInp.value = resumeData.personal.github || '';

    summaryInp.value = resumeData.summary || '';

    skillLanguagesInp.value = resumeData.skills.languages || '';
    skillFrameworksInp.value = resumeData.skills.frameworks || '';
    skillToolsInp.value = resumeData.skills.tools || '';
    skillOtherInp.value = resumeData.skills.other || '';
  }

  // Render Dynamic Education, Experience, Projects in Form
  function renderDynamicFormSections() {
    // 1. Education
    educationList.innerHTML = '';
    resumeData.education.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="dynamic-item-header">
          <span class="dynamic-item-title">Education #${index + 1}</span>
          <button type="button" class="btn-remove-item" data-action="remove-edu" data-id="${item.id}">
            <i class="fa-solid fa-trash-can"></i> Remove
          </button>
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Degree / Qualification *</label>
          <input type="text" class="form-control item-degree" value="${escapeHtml(item.degree)}" placeholder="e.g. B.Tech in CSE">
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Institution / College / School *</label>
          <input type="text" class="form-control item-institution" value="${escapeHtml(item.institution)}" placeholder="e.g. National Institute of Technology">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div class="form-group">
            <label class="form-label text-sm">Graduation Year / Dates</label>
            <input type="text" class="form-control item-duration" value="${escapeHtml(item.duration)}" placeholder="e.g. 2020 – 2024">
          </div>
          <div class="form-group">
            <label class="form-label text-sm">CGPA / Percentage</label>
            <input type="text" class="form-control item-score" value="${escapeHtml(item.score)}" placeholder="e.g. CGPA: 8.5/10">
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label text-sm">Location (Optional)</label>
          <input type="text" class="form-control item-location" value="${escapeHtml(item.location)}" placeholder="e.g. New Delhi, India">
        </div>
      `;
      educationList.appendChild(el);
    });

    // 2. Experience
    experienceList.innerHTML = '';
    resumeData.experience.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="dynamic-item-header">
          <span class="dynamic-item-title">Experience #${index + 1}</span>
          <button type="button" class="btn-remove-item" data-action="remove-exp" data-id="${item.id}">
            <i class="fa-solid fa-trash-can"></i> Remove
          </button>
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Job Title / Role *</label>
          <input type="text" class="form-control item-role" value="${escapeHtml(item.role)}" placeholder="e.g. Software Developer Intern">
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Company / Organization *</label>
          <input type="text" class="form-control item-company" value="${escapeHtml(item.company)}" placeholder="e.g. TechCorp Solutions">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div class="form-group">
            <label class="form-label text-sm">Duration / Dates</label>
            <input type="text" class="form-control item-duration" value="${escapeHtml(item.duration)}" placeholder="e.g. Jan 2024 – Jun 2024">
          </div>
          <div class="form-group">
            <label class="form-label text-sm">Location</label>
            <input type="text" class="form-control item-location" value="${escapeHtml(item.location)}" placeholder="e.g. Bengaluru, India">
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label text-sm">Responsibilities & Achievements (One per line)</label>
          <textarea class="form-control item-bullets" rows="3" placeholder="Engineered REST APIs using Node.js...\nImproved throughput by 20%...">${escapeHtml(item.bulletsText)}</textarea>
          <p class="form-hint">Each new line automatically turns into an ATS bullet point.</p>
        </div>
      `;
      experienceList.appendChild(el);
    });

    // 3. Projects
    projectsList.innerHTML = '';
    resumeData.projects.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'dynamic-item';
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="dynamic-item-header">
          <span class="dynamic-item-title">Project #${index + 1}</span>
          <button type="button" class="btn-remove-item" data-action="remove-proj" data-id="${item.id}">
            <i class="fa-solid fa-trash-can"></i> Remove
          </button>
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Project Name *</label>
          <input type="text" class="form-control item-name" value="${escapeHtml(item.name)}" placeholder="e.g. E-Commerce Microservices">
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Technologies Used</label>
          <input type="text" class="form-control item-tech" value="${escapeHtml(item.tech)}" placeholder="e.g. React.js, Node.js, MongoDB, Docker">
        </div>
        <div class="form-group">
          <label class="form-label text-sm">Project Link / Repo</label>
          <input type="text" class="form-control item-link" value="${escapeHtml(item.link)}" placeholder="e.g. github.com/username/project">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label text-sm">Key Contributions (One per line)</label>
          <textarea class="form-control item-bullets" rows="2" placeholder="Designed scalable architecture...\nIntegrated authentication with JWT...">${escapeHtml(item.bulletsText)}</textarea>
        </div>
      `;
      projectsList.appendChild(el);
    });
  }

  // Render Resume Preview DOM
  function renderResumePreview() {
    // 1. Personal Details
    const name = resumeData.personal.fullName.trim() || 'YOUR NAME';
    prevFullName.textContent = name.toUpperCase();

    if (resumeData.personal.targetTitle.trim()) {
      prevTargetTitle.textContent = resumeData.personal.targetTitle.trim();
      prevTargetTitle.style.display = 'block';
    } else {
      prevTargetTitle.style.display = 'none';
    }

    // Contact line items
    prevPhone.textContent = resumeData.personal.phone.trim();
    prevPhone.style.display = resumeData.personal.phone.trim() ? 'inline' : 'none';

    prevEmail.textContent = resumeData.personal.email.trim();
    prevEmail.style.display = resumeData.personal.email.trim() ? 'inline' : 'none';

    prevLocation.textContent = resumeData.personal.location.trim();
    prevLocation.style.display = resumeData.personal.location.trim() ? 'inline' : 'none';

    if (resumeData.personal.linkedin.trim()) {
      prevLinkedIn.textContent = resumeData.personal.linkedin.trim();
      prevLinkedIn.style.display = 'inline';
      prevSepLinkedIn.style.display = 'inline';
    } else {
      prevLinkedIn.style.display = 'none';
      prevSepLinkedIn.style.display = 'none';
    }

    if (resumeData.personal.github.trim()) {
      prevGitHub.textContent = resumeData.personal.github.trim();
      prevGitHub.style.display = 'inline';
      prevSepGitHub.style.display = 'inline';
    } else {
      prevGitHub.style.display = 'none';
      prevSepGitHub.style.display = 'none';
    }

    // 2. Summary
    if (resumeData.summary.trim()) {
      prevSectionSummary.style.display = 'block';
      prevSummary.textContent = resumeData.summary.trim();
    } else {
      prevSectionSummary.style.display = 'none';
    }

    // 3. Education
    if (resumeData.education.length > 0) {
      prevSectionEducation.style.display = 'block';
      prevEducationList.innerHTML = '';
      resumeData.education.forEach(edu => {
        const itemEl = document.createElement('div');
        itemEl.className = 'resume-entry';
        
        let detailsPart = '';
        if (edu.score && edu.location) {
          detailsPart = `${escapeHtml(edu.score)} | ${escapeHtml(edu.location)}`;
        } else if (edu.score) {
          detailsPart = escapeHtml(edu.score);
        } else if (edu.location) {
          detailsPart = escapeHtml(edu.location);
        }

        itemEl.innerHTML = `
          <div class="resume-entry-header">
            <div>
              <span class="resume-entry-title">${escapeHtml(edu.degree)}</span> — 
              <span class="resume-entry-subtitle">${escapeHtml(edu.institution)}</span>
            </div>
            <div class="resume-entry-date">${escapeHtml(edu.duration)}</div>
          </div>
          ${detailsPart ? `<div style="font-size: 9.5pt; font-style: italic; color: #374151;">${detailsPart}</div>` : ''}
        `;
        prevEducationList.appendChild(itemEl);
      });
    } else {
      prevSectionEducation.style.display = 'none';
    }

    // 4. Experience
    if (resumeData.experience.length > 0) {
      prevSectionExperience.style.display = 'block';
      prevExperienceList.innerHTML = '';
      resumeData.experience.forEach(exp => {
        const itemEl = document.createElement('div');
        itemEl.className = 'resume-entry';

        const bullets = parseBullets(exp.bulletsText);
        const bulletsHtml = bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('');

        itemEl.innerHTML = `
          <div class="resume-entry-header">
            <div>
              <span class="resume-entry-title">${escapeHtml(exp.role)}</span> | 
              <span class="resume-entry-subtitle">${escapeHtml(exp.company)}</span>
            </div>
            <div class="resume-entry-date">${escapeHtml(exp.duration)}${exp.location ? ` | ${escapeHtml(exp.location)}` : ''}</div>
          </div>
          ${bulletsHtml ? `<ul class="resume-bullets">${bulletsHtml}</ul>` : ''}
        `;
        prevExperienceList.appendChild(itemEl);
      });
    } else {
      prevSectionExperience.style.display = 'none';
    }

    // 5. Projects
    if (resumeData.projects.length > 0) {
      prevSectionProjects.style.display = 'block';
      prevProjectsList.innerHTML = '';
      resumeData.projects.forEach(proj => {
        const itemEl = document.createElement('div');
        itemEl.className = 'resume-entry';

        const bullets = parseBullets(proj.bulletsText);
        const bulletsHtml = bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('');

        itemEl.innerHTML = `
          <div class="resume-entry-header">
            <div>
              <span class="resume-entry-title">${escapeHtml(proj.name)}</span>
              ${proj.tech ? ` <span style="font-size: 9.5pt; font-weight: normal; font-style: italic;">(${escapeHtml(proj.tech)})</span>` : ''}
            </div>
            ${proj.link ? `<div class="resume-entry-date">${escapeHtml(proj.link)}</div>` : ''}
          </div>
          ${bulletsHtml ? `<ul class="resume-bullets">${bulletsHtml}</ul>` : ''}
        `;
        prevProjectsList.appendChild(itemEl);
      });
    } else {
      prevSectionProjects.style.display = 'none';
    }

    // 6. Skills
    const hasLang = resumeData.skills.languages.trim();
    const hasFrame = resumeData.skills.frameworks.trim();
    const hasTools = resumeData.skills.tools.trim();
    const hasOther = resumeData.skills.other.trim();

    if (hasLang || hasFrame || hasTools || hasOther) {
      prevSectionSkills.style.display = 'block';

      prevSkillsLanguages.textContent = hasLang;
      prevRowLanguages.style.display = hasLang ? 'flex' : 'none';

      prevSkillsFrameworks.textContent = hasFrame;
      prevRowFrameworks.style.display = hasFrame ? 'flex' : 'none';

      prevSkillsTools.textContent = hasTools;
      prevRowTools.style.display = hasTools ? 'flex' : 'none';

      prevSkillsOther.textContent = hasOther;
      prevRowOther.style.display = hasOther ? 'flex' : 'none';
    } else {
      prevSectionSkills.style.display = 'none';
    }
  }

  // Parse lines to bullet array
  function parseBullets(text) {
    if (!text) return [];
    return text
      .split('\n')
      .map(line => line.trim().replace(/^[-*•]\s*/, ''))
      .filter(line => line.length > 0);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Setup Event Listeners
  function attachEventListeners() {
    // Realtime input updates for personal info & summary
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

    // Dynamic Add / Remove buttons
    btnAddEducation.addEventListener('click', () => {
      const newId = 'edu-' + Date.now();
      resumeData.education.push({
        id: newId,
        degree: '',
        institution: '',
        location: '',
        duration: '',
        score: ''
      });
      renderDynamicFormSections();
      renderResumePreview();
    });

    educationList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-edu"]');
      if (btn) {
        const id = btn.dataset.id;
        resumeData.education = resumeData.education.filter(x => x.id !== id);
        renderDynamicFormSections();
        renderResumePreview();
      }
    });

    btnAddExperience.addEventListener('click', () => {
      const newId = 'exp-' + Date.now();
      resumeData.experience.push({
        id: newId,
        role: '',
        company: '',
        location: '',
        duration: '',
        bulletsText: ''
      });
      renderDynamicFormSections();
      renderResumePreview();
    });

    experienceList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-exp"]');
      if (btn) {
        const id = btn.dataset.id;
        resumeData.experience = resumeData.experience.filter(x => x.id !== id);
        renderDynamicFormSections();
        renderResumePreview();
      }
    });

    btnAddProject.addEventListener('click', () => {
      const newId = 'proj-' + Date.now();
      resumeData.projects.push({
        id: newId,
        name: '',
        tech: '',
        link: '',
        bulletsText: ''
      });
      renderDynamicFormSections();
      renderResumePreview();
    });

    projectsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-proj"]');
      if (btn) {
        const id = btn.dataset.id;
        resumeData.projects = resumeData.projects.filter(x => x.id !== id);
        renderDynamicFormSections();
        renderResumePreview();
      }
    });

    // Font selector toggle
    fontSelect.addEventListener('change', () => {
      if (fontSelect.value === 'sans') {
        resumeSheet.classList.add('font-sans');
      } else {
        resumeSheet.classList.remove('font-sans');
      }
    });

    // Load Sample Button
    btnLoadSample.addEventListener('click', () => {
      loadSampleData();
    });

    // Clear Form Button
    btnClearForm.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all resume fields?')) {
        clearAllData();
      }
    });

    // Download PDF Button
    btnDownloadPDF.addEventListener('click', exportToPDF);

    // Modal Events
    btnCloseModal.addEventListener('click', closeMonetizeModal);
    linkDismissModal.addEventListener('click', (e) => {
      e.preventDefault();
      closeMonetizeModal();
    });
    monetizeModal.addEventListener('click', (e) => {
      if (e.target === monetizeModal) {
        closeMonetizeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && monetizeModal.classList.contains('active')) {
        closeMonetizeModal();
      }
    });
  }

  // Handle Dynamic Inputs
  function handleEducationInput(e) {
    const parent = e.target.closest('.dynamic-item');
    if (!parent) return;
    const id = parent.dataset.id;
    const item = resumeData.education.find(x => x.id === id);
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
    const id = parent.dataset.id;
    const item = resumeData.experience.find(x => x.id === id);
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
    const id = parent.dataset.id;
    const item = resumeData.projects.find(x => x.id === id);
    if (!item) return;

    if (e.target.classList.contains('item-name')) item.name = e.target.value;
    if (e.target.classList.contains('item-tech')) item.tech = e.target.value;
    if (e.target.classList.contains('item-link')) item.link = e.target.value;
    if (e.target.classList.contains('item-bullets')) item.bulletsText = e.target.value;

    renderResumePreview();
  }

  // Accordion Toggles
  function setupAccordions() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('open');
      });
    });
  }

  // Load Sample Data
  function loadSampleData() {
    resumeData = {
      personal: {
        fullName: 'RAHUL SHARMA',
        targetTitle: 'Full Stack Developer | B.Tech Computer Science',
        email: 'rahul.sharma@gmail.com',
        phone: '+91 98765 43210',
        location: 'Bengaluru, Karnataka, India',
        linkedin: 'linkedin.com/in/rahulsharma',
        github: 'github.com/rahulsharma'
      },
      summary: 'Motivated software engineer with practical experience in full-stack web development, RESTful APIs, and database architecture. Proven track record of architecting scalable applications and collaborating in agile teams. Passionate about solving complex algorithmic challenges and optimizing application performance.',
      education: [
        {
          id: 'edu-1',
          degree: 'B.Tech in Computer Science & Engineering',
          institution: 'National Institute of Technology (NIT)',
          location: 'Surathkal, India',
          duration: '2020 – 2024',
          score: 'CGPA: 8.8 / 10'
        },
        {
          id: 'edu-2',
          degree: 'Senior Secondary (Class XII) - CBSE Science',
          institution: 'Delhi Public School',
          location: 'Delhi, India',
          duration: '2018 – 2020',
          score: 'Percentage: 94.4%'
        }
      ],
      experience: [
        {
          id: 'exp-1',
          role: 'Software Developer Intern',
          company: 'TechCorp Solutions',
          location: 'Bengaluru, India',
          duration: 'Jan 2024 – Jun 2024',
          bulletsText: 'Developed and deployed RESTful microservices in Node.js, reducing server response latency by 22% across 50,000+ active users.\nIntegrated Redis caching for hot database queries, decreasing PostgreSQL load by 35%.\nCollaborated with senior engineers in sprint reviews, CI/CD pipeline automation via GitHub Actions, and unit testing with Jest.'
        }
      ],
      projects: [
        {
          id: 'proj-1',
          name: 'E-Commerce Platform with Microservices',
          tech: 'React.js, Node.js, Express, MongoDB, Docker',
          link: 'github.com/rahulsharma/ecommerce-platform',
          bulletsText: 'Engineered an end-to-end shopping platform with JWT authentication, role-based access control, and Razorpay payment gateway integration.\nDesigned responsive product catalog with debounced live search, faceted filtering, and optimized MongoDB index queries.'
        },
        {
          id: 'proj-2',
          name: 'Job Application & ATS Keyword Analyzer',
          tech: 'Python, Flask, SpaCy NLP, SQLite',
          link: 'github.com/rahulsharma/ats-analyzer',
          bulletsText: 'Built a natural language processing tool parsing PDF resumes to extract skill keywords and compute ATS relevancy score against job descriptions.\nAchieved 91% parsing accuracy on 500+ benchmark resumes with automated keyword highlighting.'
        }
      ],
      skills: {
        languages: 'JavaScript (ES6+), TypeScript, Python, C++, SQL',
        frameworks: 'React.js, Next.js, Node.js, Express.js, Redux Toolkit, Tailwind CSS',
        tools: 'MongoDB, PostgreSQL, Git, Docker, Postman, Linux',
        other: 'Data Structures & Algorithms, Object-Oriented Design, System Design, REST APIs'
      }
    };

    populateFormWithData();
    renderDynamicFormSections();
    renderResumePreview();
  }

  // Clear All Form Fields
  function clearAllData() {
    resumeData = {
      personal: {
        fullName: '',
        targetTitle: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        github: ''
      },
      summary: '',
      education: [],
      experience: [],
      projects: [],
      skills: {
        languages: '',
        frameworks: '',
        tools: '',
        other: ''
      }
    };

    populateFormWithData();
    renderDynamicFormSections();
    renderResumePreview();
  }

  // Export to PDF with html2pdf.js
  function exportToPDF() {
    if (!window.html2pdf) {
      alert('PDF generation library is loading. Please try again in a moment.');
      return;
    }

    const originalBtnHtml = btnDownloadPDF.innerHTML;
    btnDownloadPDF.disabled = true;
    btnDownloadPDF.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';

    const safeName = (resumeData.personal.fullName || 'Candidate')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const opt = {
      margin: [10, 10, 10, 10], // 10mm margins for A4
      filename: `${safeName}_ATS_Resume.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollY: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf()
      .set(opt)
      .from(resumeSheet)
      .save()
      .then(() => {
        btnDownloadPDF.disabled = false;
        btnDownloadPDF.innerHTML = originalBtnHtml;

        // Trigger Monetization Modal after PDF is downloaded
        setTimeout(() => {
          openMonetizeModal();
        }, 1000);
      })
      .catch((err) => {
        console.error('PDF generation error:', err);
        btnDownloadPDF.disabled = false;
        btnDownloadPDF.innerHTML = originalBtnHtml;
        alert('Could not generate PDF. Please check your browser print settings or try again.');
      });
  }

  // Monetization Modal Management
  function openMonetizeModal() {
    monetizeModal.classList.add('active');
  }

  function closeMonetizeModal() {
    monetizeModal.classList.remove('active');
  }

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', init);

})();
