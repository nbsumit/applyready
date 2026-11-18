/**
 * ApplyReady resume template catalogue: names, descriptions, section order and the visual rules
 * (alignment, case, rules, colours, date placement) shared by the preview, PDF, Word and text
 * exports. Every template is a single column of real text. Each one differs from every other in
 * at least one visible rule; tests/regression_tests.js checks that no two render the same.
 * Works in the browser and in Node.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ApplyReadyTemplates = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TEMPLATES = {
    'classic-professional': {
      id: 'classic-professional',
      group: 'general',
      name: 'Classic Professional',
      category: 'Broad Professional',
      badge: 'Default',
      description: 'Restrained serif typography, clear section rules, and reverse-chronological emphasis for broad industry applications.',
      fontFamily: 'serif',
      headerAlign: 'center',
      headingAccent: 'bottom-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'experience', 'education', 'projects', 'skills'],
      defaultVisibility: {
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
      style: { headerAlign: 'center', docxRule: { val: 'single', sz: 8, color: '0F172A' } },
      cssClass: 'template-classic-professional',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Classic Professional template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Centered Header -->
        <rect x="42" y="14" width="76" height="7" rx="1" fill="#0F172A"/>
        <rect x="52" y="24" width="56" height="4" rx="1" fill="#64748B"/>
        <rect x="30" y="31" width="100" height="3" rx="0.5" fill="#94A3B8"/>
        <line x1="16" y1="38" x2="144" y2="38" stroke="#0F172A" stroke-width="1"/>
        <!-- Summary Section -->
        <rect x="16" y="44" width="45" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="51" x2="144" y2="51" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="55" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="60" width="120" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Experience Section -->
        <rect x="16" y="70" width="40" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="77" x2="144" y2="77" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="82" width="70" height="3.5" fill="#1E293B"/>
        <rect x="110" y="82" width="34" height="3" fill="#64748B"/>
        <circle cx="20" cy="90" r="1.2" fill="#475569"/>
        <rect x="25" y="88.5" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="96" r="1.2" fill="#475569"/>
        <rect x="25" y="94.5" width="110" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="104" width="65" height="3.5" fill="#1E293B"/>
        <rect x="112" y="104" width="32" height="3" fill="#64748B"/>
        <circle cx="20" cy="112" r="1.2" fill="#475569"/>
        <rect x="25" y="110.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Education Section -->
        <rect x="16" y="123" width="32" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="130" x2="144" y2="130" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="135" width="80" height="3.5" fill="#1E293B"/>
        <rect x="115" y="135" width="29" height="3" fill="#64748B"/>
        <!-- Projects Section -->
        <rect x="16" y="146" width="35" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="153" x2="144" y2="153" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="157" width="60" height="3.5" fill="#1E293B"/>
        <circle cx="20" cy="165" r="1.2" fill="#475569"/>
        <rect x="25" y="163.5" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Skills Section -->
        <rect x="16" y="176" width="38" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="183" x2="144" y2="183" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="187" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="193" width="115" height="3" rx="0.5" fill="#94A3B8"/>
      </svg>`
    },

    'modern-minimal': {
      id: 'modern-minimal',
      group: 'general',
      name: 'Modern Minimal',
      category: 'Broad Professional',
      badge: 'Clean Sans',
      description: 'Clean sans-serif typography, open spacing, and minimal decorative rules with high-contrast hierarchy.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'subtle-weight',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'experience', 'education', 'projects', 'skills'],
      defaultVisibility: {
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
      style: { headingRule: 'none', docxRule: null },
      cssClass: 'template-modern-minimal',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Modern Minimal template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Left-aligned Header with generous whitespace -->
        <rect x="16" y="16" width="80" height="8" rx="1" fill="#0F172A"/>
        <rect x="16" y="27" width="55" height="4" rx="1" fill="#475569"/>
        <rect x="16" y="34" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Minimal subtle line -->
        <rect x="16" y="44" width="24" height="2" fill="#2563EB"/>
        <!-- Summary -->
        <rect x="16" y="52" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="57" width="124" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Experience -->
        <rect x="16" y="70" width="46" height="5" fill="#0F172A"/>
        <rect x="16" y="79" width="75" height="3.5" fill="#1E293B"/>
        <rect x="110" y="79" width="34" height="3" fill="#64748B"/>
        <circle cx="20" cy="87" r="1.2" fill="#2563EB"/>
        <rect x="25" y="85.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="93" r="1.2" fill="#2563EB"/>
        <rect x="25" y="91.5" width="112" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="103" width="70" height="3.5" fill="#1E293B"/>
        <rect x="112" y="103" width="32" height="3" fill="#64748B"/>
        <circle cx="20" cy="111" r="1.2" fill="#2563EB"/>
        <rect x="25" y="109.5" width="116" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Education -->
        <rect x="16" y="125" width="36" height="5" fill="#0F172A"/>
        <rect x="16" y="134" width="82" height="3.5" fill="#1E293B"/>
        <rect x="114" y="134" width="30" height="3" fill="#64748B"/>
        <!-- Projects -->
        <rect x="16" y="149" width="38" height="5" fill="#0F172A"/>
        <rect x="16" y="157" width="65" height="3.5" fill="#1E293B"/>
        <circle cx="20" cy="165" r="1.2" fill="#2563EB"/>
        <rect x="25" y="163.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Skills -->
        <rect x="16" y="179" width="32" height="5" fill="#0F172A"/>
        <rect x="16" y="188" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="194" width="110" height="3" rx="0.5" fill="#94A3B8"/>
      </svg>`
    },

    'graduate-early-career': {
      id: 'graduate-early-career',
      group: 'students',
      name: 'Graduate / Early Career',
      category: 'Students & Entry Level',
      badge: 'Entry Level',
      description: 'Education, projects and internships first. Name in normal case without a rule under it, and deep red headings over thin red lines.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'bottom-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['education', 'projects', 'experience', 'skills', 'achievements'],
      defaultVisibility: {
        summary: false,
        experience: true,
        education: true,
        projects: true,
        skills: true,
        certifications: false,
        achievements: true,
        volunteering: false,
        languages: false,
        academic: false
      },
      style: { nameCase: 'asis', headerRule: 'none', headingColor: [0.36, 0.12, 0.2], ruleColor: [0.36, 0.12, 0.2], ruleWidth: 0.8, docxRule: { val: 'single', sz: 6, color: '5C1F33' } },
      cssClass: 'template-graduate-early-career'
    },

    'experienced-professional': {
      id: 'experienced-professional',
      group: 'senior',
      name: 'Experienced Professional',
      category: 'Senior & Executive',
      badge: 'Executive',
      description: 'Experience and leadership achievements prominent with concise education; tailored for comfortable multi-page documents.',
      fontFamily: 'serif',
      headerAlign: 'center',
      headingAccent: 'double-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'experience', 'skills', 'education', 'projects'],
      defaultVisibility: {
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
      style: { headerAlign: 'center', headerRule: 'double', docxRule: { val: 'double', sz: 12, color: '0F172A' } },
      cssClass: 'template-experienced-professional',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Experienced Professional template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Authoritative Centered Header -->
        <rect x="36" y="14" width="88" height="8" rx="1" fill="#0F172A"/>
        <rect x="46" y="24" width="68" height="4" rx="1" fill="#475569"/>
        <rect x="24" y="31" width="112" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Double Rule Header Divider -->
        <line x1="16" y1="37" x2="144" y2="37" stroke="#0F172A" stroke-width="1.2"/>
        <line x1="16" y1="39.5" x2="144" y2="39.5" stroke="#0F172A" stroke-width="0.5"/>
        <!-- Executive Summary -->
        <rect x="16" y="45" width="48" height="4.5" fill="#0F172A"/>
        <rect x="16" y="52" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="57" width="124" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Extensive Work History -->
        <rect x="16" y="68" width="55" height="4.5" fill="#0F172A"/>
        <rect x="16" y="75" width="85" height="3.5" fill="#1E293B"/>
        <rect x="110" y="75" width="34" height="3" fill="#64748B"/>
        <circle cx="20" cy="83" r="1.2" fill="#475569"/>
        <rect x="25" y="81.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="89" r="1.2" fill="#475569"/>
        <rect x="25" y="87.5" width="114" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="97" width="80" height="3.5" fill="#1E293B"/>
        <rect x="112" y="97" width="32" height="3" fill="#64748B"/>
        <circle cx="20" cy="105" r="1.2" fill="#475569"/>
        <rect x="25" y="103.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="111" r="1.2" fill="#475569"/>
        <rect x="25" y="109.5" width="110" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="119" width="78" height="3.5" fill="#1E293B"/>
        <rect x="112" y="119" width="32" height="3" fill="#64748B"/>
        <circle cx="20" cy="127" r="1.2" fill="#475569"/>
        <rect x="25" y="125.5" width="116" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Core Competencies -->
        <rect x="16" y="137" width="44" height="4.5" fill="#0F172A"/>
        <rect x="16" y="144" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="150" width="120" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Concise Education -->
        <rect x="16" y="161" width="30" height="4.5" fill="#0F172A"/>
        <rect x="16" y="168" width="90" height="3.5" fill="#1E293B"/>
        <rect x="115" y="168" width="29" height="3" fill="#64748B"/>
        <!-- Certifications -->
        <rect x="16" y="179" width="40" height="4.5" fill="#0F172A"/>
        <circle cx="20" cy="187" r="1.2" fill="#475569"/>
        <rect x="25" y="185.5" width="105" height="3" rx="0.5" fill="#94A3B8"/>
      </svg>`
    },

    'project-focused': {
      id: 'project-focused',
      group: 'tech',
      name: 'Project Focused',
      category: 'Technical & Portfolio',
      badge: 'Portfolio',
      description: 'Projects straight after the summary, with their links on the right. A thick blue rule under the header and blue headings without lines.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'bottom-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'projects', 'experience', 'skills', 'education'],
      defaultVisibility: {
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
      style: { headingRule: 'none', headingColor: [0.11, 0.3, 0.6], headerRuleColor: [0.11, 0.3, 0.6], headerRuleWidth: 2, contactSeparator: '|', docxRule: null },
      cssClass: 'template-project-focused'
    },

    'career-transition': {
      id: 'career-transition',
      group: 'general',
      name: 'Career Transition',
      category: 'Career Change',
      badge: 'Pivot',
      description: 'A short summary and transferable skills before the dated work history. Green headings and rules.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'bottom-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'skills', 'experience', 'projects', 'education'],
      defaultVisibility: {
        summary: true,
        experience: true,
        education: true,
        projects: true,
        skills: true,
        certifications: true,
        achievements: false,
        volunteering: false,
        languages: false,
        academic: false
      },
      style: { headingColor: [0.02, 0.37, 0.27], ruleColor: [0.02, 0.37, 0.27], ruleWidth: 0.8, headerRuleColor: [0.02, 0.37, 0.27], docxRule: { val: 'single', sz: 6, color: '047857' } },
      cssClass: 'template-career-transition'
    },

    'compact-professional': {
      id: 'compact-professional',
      group: 'general',
      name: 'Compact Professional',
      category: 'Condensed Single-Page',
      badge: 'Dense',
      description: 'Efficient spacing and restrained hierarchy to fit rich qualifications into a dense, readable layout.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'subtle-weight',
      density: 'compact',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'experience', 'education', 'skills', 'projects'],
      defaultVisibility: {
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
      style: {},
      cssClass: 'template-compact-professional',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Compact Professional template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Compact Inline Header -->
        <rect x="12" y="10" width="75" height="6.5" rx="1" fill="#0F172A"/>
        <rect x="90" y="11" width="58" height="4" rx="0.5" fill="#475569"/>
        <rect x="12" y="19" width="136" height="2.5" rx="0.5" fill="#94A3B8"/>
        <line x1="12" y1="24" x2="148" y2="24" stroke="#0F172A" stroke-width="0.8"/>
        <!-- Dense Summary -->
        <rect x="12" y="27" width="35" height="3.5" fill="#0F172A"/>
        <rect x="12" y="32" width="136" height="2.5" rx="0.5" fill="#94A3B8"/>
        <rect x="12" y="36" width="130" height="2.5" rx="0.5" fill="#94A3B8"/>
        <!-- Dense Experience -->
        <rect x="12" y="42" width="45" height="3.5" fill="#0F172A"/>
        <line x1="12" y1="47" x2="148" y2="47" stroke="#CBD5E1" stroke-width="0.5"/>
        <rect x="12" y="50" width="80" height="3" fill="#1E293B"/>
        <rect x="115" y="50" width="33" height="2.5" fill="#64748B"/>
        <circle cx="15" cy="56" r="1" fill="#475569"/>
        <rect x="19" y="55" width="128" height="2.5" rx="0.5" fill="#94A3B8"/>
        <circle cx="15" cy="61" r="1" fill="#475569"/>
        <rect x="19" y="60" width="122" height="2.5" rx="0.5" fill="#94A3B8"/>
        <rect x="12" y="67" width="75" height="3" fill="#1E293B"/>
        <rect x="116" y="67" width="32" height="2.5" fill="#64748B"/>
        <circle cx="15" cy="73" r="1" fill="#475569"/>
        <rect x="19" y="72" width="126" height="2.5" rx="0.5" fill="#94A3B8"/>
        <circle cx="15" cy="78" r="1" fill="#475569"/>
        <rect x="19" y="77" width="120" height="2.5" rx="0.5" fill="#94A3B8"/>
        <rect x="12" y="84" width="70" height="3" fill="#1E293B"/>
        <rect x="118" y="84" width="30" height="2.5" fill="#64748B"/>
        <circle cx="15" cy="90" r="1" fill="#475569"/>
        <rect x="19" y="89" width="124" height="2.5" rx="0.5" fill="#94A3B8"/>
        <!-- Education -->
        <rect x="12" y="96" width="30" height="3.5" fill="#0F172A"/>
        <line x1="12" y1="101" x2="148" y2="101" stroke="#CBD5E1" stroke-width="0.5"/>
        <rect x="12" y="104" width="85" height="3" fill="#1E293B"/>
        <rect x="120" y="104" width="28" height="2.5" fill="#64748B"/>
        <!-- Skills -->
        <rect x="12" y="111" width="35" height="3.5" fill="#0F172A"/>
        <line x1="12" y1="116" x2="148" y2="116" stroke="#CBD5E1" stroke-width="0.5"/>
        <rect x="12" y="119" width="136" height="2.5" rx="0.5" fill="#94A3B8"/>
        <rect x="12" y="123.5" width="130" height="2.5" rx="0.5" fill="#94A3B8"/>
        <!-- Projects -->
        <rect x="12" y="130" width="30" height="3.5" fill="#0F172A"/>
        <line x1="12" y1="135" x2="148" y2="135" stroke="#CBD5E1" stroke-width="0.5"/>
        <rect x="12" y="138" width="70" height="3" fill="#1E293B"/>
        <circle cx="15" cy="144" r="1" fill="#475569"/>
        <rect x="19" y="143" width="126" height="2.5" rx="0.5" fill="#94A3B8"/>
      </svg>`
    },

    'academic-cv': {
      id: 'academic-cv',
      group: 'specialist',
      name: 'Academic / Research CV',
      category: 'Academia & Research',
      badge: 'Multi-Page CV',
      description: 'For a scholarly CV over several pages: education, publications, teaching, talks and grants. Left-aligned serif, headings in normal case, dates under each entry.',
      fontFamily: 'serif',
      headerAlign: 'left',
      headingAccent: 'title-case',
      density: 'standard',
      isAcademicCV: true,
      recommendedOrder: ['summary', 'education', 'publications', 'academic', 'experience', 'projects', 'skills'],
      defaultVisibility: {
        summary: true,
        experience: true,
        education: true,
        projects: false,
        skills: true,
        certifications: false,
        achievements: true,
        volunteering: false,
        languages: true,
        publications: true,
        academic: true
      },
      style: { headerAlign: 'left', nameCase: 'asis', headingCase: 'asis', datePlacement: 'below', ruleColor: [0.3, 0.3, 0.3], ruleWidth: 0.5, headerRuleWidth: 0.8, docxRule: { val: 'single', sz: 4, color: '4D4D4D' } },
      cssClass: 'template-academic-cv'
    },

    'ivy-classic': {
      id: 'ivy-classic',
      group: 'students',
      name: 'Ivy Classic',
      category: 'Students & Professionals',
      badge: 'Traditional',
      description: 'The university career-office format: centred name in normal case, serif type, full-width dark rules, and education first.',
      fontFamily: 'serif',
      headerAlign: 'center',
      headingAccent: 'dark-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['education', 'experience', 'projects', 'skills', 'achievements'],
      defaultVisibility: { summary: false, experience: true, education: true, projects: true, skills: true, certifications: false, achievements: true, volunteering: false, languages: false, academic: false },
      style: { headerAlign: 'center', nameCase: 'asis', nameSize: 20, ruleColor: [0.1, 0.1, 0.1], ruleWidth: 0.8, headerRule: 'none', docxRule: { val: 'single', sz: 8, color: '111111' } },
      skillLabels: { languages: 'Skills', frameworks: 'Software', tools: 'Technical', other: 'Interests' },
      cssClass: 'template-ivy-classic'
    },

    'software-engineer': {
      id: 'software-engineer',
      group: 'tech',
      name: 'Software Engineer',
      category: 'Technology',
      badge: 'Tech',
      description: 'Technical skills directly under the summary, then experience and projects with readable repository links. Built for developer, data, and DevOps roles.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'accent-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
      defaultVisibility: { summary: true, experience: true, education: true, projects: true, skills: true, certifications: false, achievements: false, volunteering: false, languages: false, academic: false },
      style: { headingColor: [0.07, 0.2, 0.4], ruleColor: [0.07, 0.2, 0.4], ruleWidth: 0.8, contactSeparator: '|', docxRule: { val: 'single', sz: 6, color: '12336B' } },
      skillLabels: { languages: 'Languages', frameworks: 'Frameworks & Libraries', tools: 'Tools & Platforms', other: 'Practices' },
      sectionLabels: { certifications: 'Certifications' },
      cssClass: 'template-software-engineer'
    },

    'campus-fresher': {
      id: 'campus-fresher',
      group: 'students',
      name: 'Campus Placement / Fresher',
      category: 'Students & Entry Level',
      badge: 'Fresher',
      description: 'Campus-placement layout: education with CGPA or percentage first, then projects, internships, certifications, achievements, and positions of responsibility.',
      fontFamily: 'sans',
      headerAlign: 'center',
      headingAccent: 'bottom-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['education', 'projects', 'experience', 'skills', 'certifications', 'achievements', 'volunteering'],
      defaultVisibility: { summary: false, experience: true, education: true, projects: true, skills: true, certifications: true, achievements: true, volunteering: true, languages: false, academic: false },
      style: { headerAlign: 'center', headingColor: [0.1, 0.16, 0.3], docxRule: { val: 'single', sz: 6, color: '94A3B8' } },
      skillLabels: { languages: 'Programming & Core', frameworks: 'Tools & Software', tools: 'Coursework', other: 'Soft Skills' },
      sectionLabels: { achievements: 'Achievements & Awards', volunteering: 'Positions of Responsibility', certifications: 'Certifications & Courses' },
      cssClass: 'template-campus-fresher'
    },

    'ats-strict': {
      id: 'ats-strict',
      group: 'general',
      name: 'Plain (No Lines)',
      category: 'Plain',
      badge: 'Plainest',
      description: 'No lines, colours or right-aligned dates: every detail reads top to bottom. Use it when a portal asks for the plainest possible file.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'none',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'],
      defaultVisibility: { summary: true, experience: true, education: true, projects: true, skills: true, certifications: false, achievements: false, volunteering: false, languages: false, academic: false },
      style: { nameCase: 'asis', headerRule: 'none', headingRule: 'none', datePlacement: 'below', contactSeparator: '|', linkColor: [0, 0, 0], metaColor: [0.15, 0.15, 0.15], docxRule: null },
      cssClass: 'template-ats-strict'
    },

    'executive-impact': {
      id: 'executive-impact',
      group: 'senior',
      name: 'Executive Impact',
      category: 'Senior & Executive',
      badge: 'Leadership',
      description: 'Selected achievements before the career history, a strong navy rule, and core competencies for director, VP, and C-level applications.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'thick-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'achievements', 'experience', 'skills', 'education', 'certifications'],
      defaultVisibility: { summary: true, experience: true, education: true, projects: false, skills: true, certifications: true, achievements: true, volunteering: false, languages: false, academic: false },
      style: { nameSize: 20, headingColor: [0.06, 0.16, 0.33], headingRule: 'thick', ruleColor: [0.06, 0.16, 0.33], headerRuleColor: [0.06, 0.16, 0.33], headerRuleWidth: 2, docxRule: { val: 'single', sz: 12, color: '0F2A54' } },
      skillLabels: { languages: 'Leadership', frameworks: 'Functional Expertise', tools: 'Systems & Tools', other: 'Industry Knowledge' },
      sectionLabels: { achievements: 'Selected Achievements', skills: 'Core Competencies' },
      cssClass: 'template-executive-impact'
    },

    'healthcare-licensed': {
      id: 'healthcare-licensed',
      group: 'specialist',
      name: 'Healthcare & Licensed Roles',
      category: 'Healthcare & Licensed',
      badge: 'Licensed',
      description: 'Licences and certifications near the top, followed by clinical or professional experience. Suits nursing, pharmacy, teaching, law, and accountancy.',
      fontFamily: 'sans',
      headerAlign: 'left',
      headingAccent: 'accent-rule',
      density: 'standard',
      isAcademicCV: false,
      recommendedOrder: ['summary', 'certifications', 'experience', 'education', 'skills', 'languages', 'volunteering'],
      defaultVisibility: { summary: true, experience: true, education: true, projects: false, skills: true, certifications: true, achievements: false, volunteering: false, languages: true, academic: false },
      style: { headingColor: [0.0, 0.3, 0.3], ruleColor: [0.0, 0.3, 0.3], ruleWidth: 0.8, docxRule: { val: 'single', sz: 6, color: '004D4D' } },
      skillLabels: { languages: 'Clinical / Core Skills', frameworks: 'Systems & Equipment', tools: 'Compliance & Procedures', other: 'Professional Skills' },
      sectionLabels: { certifications: 'Licences & Certifications' },
      cssClass: 'template-healthcare-licensed'
    },

    'finance-consulting': {
      id: 'finance-consulting',
      group: 'specialist',
      name: 'Finance & Consulting',
      category: 'Finance & Consulting',
      badge: 'One Page',
      description: 'Dense one-page serif format used in banking, consulting, and accounting: experience first, no summary by default, and dates aligned right.',
      fontFamily: 'serif',
      headerAlign: 'left',
      headingAccent: 'dark-rule',
      density: 'compact',
      isAcademicCV: false,
      recommendedOrder: ['experience', 'education', 'skills', 'certifications', 'achievements', 'summary'],
      defaultVisibility: { summary: false, experience: true, education: true, projects: false, skills: true, certifications: true, achievements: true, volunteering: false, languages: false, academic: false },
      style: { nameCase: 'asis', ruleColor: [0.1, 0.1, 0.1], ruleWidth: 0.8, headerRule: 'none', docxRule: { val: 'single', sz: 8, color: '111111' } },
      skillLabels: { languages: 'Financial Skills', frameworks: 'Software', tools: 'Data & Analytics', other: 'Languages & Interests' },
      sectionLabels: { certifications: 'Certifications & Licences', achievements: 'Awards' },
      cssClass: 'template-finance-consulting'
    }
  };

  // Shared visual defaults. These reproduce the original rendering exactly, so
  // a template only lists what makes it different.
  const DEFAULT_STYLE = {
    headerAlign: 'left',          // 'left' | 'center'
    nameCase: 'upper',            // 'upper' | 'asis'
    nameSize: null,               // points; null = 18 (16 compact)
    headerRule: 'single',         // 'single' | 'double' | 'none'
    headerRuleColor: [0.1, 0.1, 0.1],
    headerRuleWidth: 1.2,
    headingRule: 'line',          // 'line' | 'thick' | 'none'
    headingColor: [0, 0, 0],
    ruleColor: [0.65, 0.7, 0.75],
    ruleWidth: 0.6,
    datePlacement: 'right',       // 'right' | 'below' (dates on their own line)
    contactSeparator: '•',
    linkColor: [0.05, 0.35, 0.75],
    metaColor: [0.35, 0.4, 0.45],
    docxRule: { val: 'single', sz: 6, color: 'CBD5E1' }
  };

  // Gallery filter groups, in display order.
  const TEMPLATE_GROUPS = [
    { id: 'all', name: 'All' },
    { id: 'general', name: 'General' },
    { id: 'students', name: 'Students & freshers' },
    { id: 'tech', name: 'Tech' },
    { id: 'senior', name: 'Senior & executive' },
    { id: 'specialist', name: 'Specialist roles' }
  ];

  const SECTION_LABELS = {
    summary: 'Professional Summary',
    experience: 'Work Experience',
    education: 'Education',
    projects: 'Key Projects',
    skills: 'Skills & Competencies',
    certifications: 'Certifications & Credentials',
    achievements: 'Honors & Achievements',
    volunteering: 'Community & Leadership',
    languages: 'Languages',
    publications: 'Publications',
    teaching: 'Teaching Experience',
    presentations: 'Conference Presentations',
    grants: 'Research Grants',
    references: 'References',
    referencesOnRequest: 'Available on request.'
  };

  const SKILL_LABELS = {
    languages: 'Core Competencies',
    frameworks: 'Tools & Platforms',
    tools: 'Technical & Data Skills',
    other: 'Professional Skills'
  };

  const hex = rgb => rgb.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

  function getTemplate(id) {
    return TEMPLATES[id] || TEMPLATES['classic-professional'];
  }

  function getTemplateStyle(id) {
    const tmpl = getTemplate(id);
    const style = Object.assign({}, DEFAULT_STYLE, { headerAlign: tmpl.headerAlign || DEFAULT_STYLE.headerAlign }, tmpl.style || {});
    style.headingHex = hex(style.headingColor);
    style.ruleHex = hex(style.ruleColor);
    style.linkHex = hex(style.linkColor);
    style.metaHex = hex(style.metaColor);
    style.headerRuleHex = hex(style.headerRuleColor);
    return style;
  }

  // Fixed headings for sections without a user-editable title.
  function getSectionLabel(id, key) {
    const tmpl = getTemplate(id);
    return (tmpl.sectionLabels && tmpl.sectionLabels[key]) || SECTION_LABELS[key] || key;
  }

  // Heading for a section the user can rename; an untouched default title
  // follows the template's own wording.
  function getSectionTitle(data, id, key) {
    const custom = data && typeof data[key + 'Title'] === 'string' ? data[key + 'Title'].trim() : '';
    const legacyDefaults = { summary: ['Professional Summary'], experience: ['Work Experience'], education: ['Education'], projects: ['Projects', 'Key Projects', 'Key Projects & Initiatives'], skills: ['Skills', 'Skills & Competencies'] };
    if (custom && !(legacyDefaults[key] || []).includes(custom)) return custom;
    const tmpl = getTemplate(id);
    if (tmpl.sectionLabels && tmpl.sectionLabels[key]) return tmpl.sectionLabels[key];
    return custom || SECTION_LABELS[key];
  }

  // Row labels for the four skills fields: the person's own wording first,
  // then the template's, then the neutral defaults.
  function getSkillLabels(id, data) {
    const tmpl = getTemplate(id);
    const labels = Object.assign({}, SKILL_LABELS, tmpl.skillLabels || {});
    const custom = data && data.skillLabels;
    if (custom && typeof custom === 'object') {
      Object.keys(SKILL_LABELS).forEach(key => {
        if (typeof custom[key] === 'string' && custom[key].trim()) labels[key] = custom[key].trim();
      });
    }
    return labels;
  }

  function resolveTemplateId(data, options) {
    const opts = options || {};
    const candidates = [opts.template, opts.templateId, data && data.template, data && data.design && data.design.templateId];
    return candidates.find(id => typeof id === 'string' && TEMPLATES[id]) || 'classic-professional';
  }

  // Thumbnails for newer templates are drawn from the same style rules that
  // drive the PDF, so the gallery cannot drift from the download.
  function buildThumbnail(tmpl) {
    const style = getTemplateStyle(tmpl.id);
    const center = style.headerAlign === 'center';
    const ink = '#0F172A', grey = '#94A3B8', light = '#CBD5E1';
    const head = '#' + style.headingHex, rule = '#' + style.ruleHex;
    const parts = [`<rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>`];
    const bar = (x, y, w, h, fill) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.6" fill="${fill}"/>`);
    const x0 = 16, width = 128;
    const at = w => center ? (160 - w) / 2 : x0;
    const nameW = style.nameCase === 'upper' ? 78 : 64;
    bar(at(nameW), 14, nameW, style.nameSize && style.nameSize > 18 ? 8 : 7, ink);
    bar(at(56), 25, 56, 3.5, '#64748B');
    bar(at(100), 32, 100, 2.6, grey);
    let y = 39;
    if (style.headerRule === 'double') {
      parts.push(`<line x1="16" y1="${y}" x2="144" y2="${y}" stroke="${ink}" stroke-width="1"/>`, `<line x1="16" y1="${y + 2}" x2="144" y2="${y + 2}" stroke="${ink}" stroke-width="0.5"/>`);
      y += 7;
    } else if (style.headerRule === 'single') {
      parts.push(`<line x1="16" y1="${y}" x2="144" y2="${y}" stroke="#${style.headerRuleHex}" stroke-width="${style.headerRuleWidth > 1.5 ? 1.6 : 1}"/>`);
      y += 6;
    } else y += 3;
    const order = tmpl.recommendedOrder.filter(key => tmpl.defaultVisibility[key] !== false).slice(0, 5);
    for (const key of order) {
      if (y > 196) break;
      bar(x0, y, key === 'experience' ? 46 : 38, 3.6, head);
      y += 5.5;
      if (style.headingRule !== 'none') {
        parts.push(`<line x1="16" y1="${y}" x2="144" y2="${y}" stroke="${rule}" stroke-width="${style.headingRule === 'thick' ? 1.3 : 0.6}"/>`);
        y += 3.5;
      } else y += 1;
      const entries = ['experience', 'education', 'projects'].includes(key) ? 2 : 1;
      for (let e = 0; e < entries && y < 205; e++) {
        if (['experience', 'education', 'projects'].includes(key)) {
          bar(x0, y, 52, 3, '#334155');
          if (style.datePlacement === 'right') bar(144 - 24, y, 24, 2.6, grey);
          else { y += 4.5; bar(x0, y, 30, 2.4, grey); }
          y += 5;
        }
        const lines = key === 'summary' ? 3 : key === 'experience' ? 2 : 2;
        for (let l = 0; l < lines && y < 208; l++) {
          const bullet = ['experience', 'projects'].includes(key);
          if (bullet) parts.push(`<circle cx="${x0 + 2}" cy="${y + 1.2}" r="1" fill="#475569"/>`);
          bar(bullet ? x0 + 6 : x0, y, (bullet ? width - 6 : width) - (l === lines - 1 ? 22 : 0), 2.4, light);
          y += 4.4;
        }
        y += 1.5;
      }
      y += 3;
    }
    return `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${tmpl.name.replace(/[&<>"]/g, '')} template thumbnail">${parts.join('')}</svg>`;
  }

  Object.values(TEMPLATES).forEach(tmpl => { if (!tmpl.svgThumbnail) tmpl.svgThumbnail = buildThumbnail(tmpl); });

  /**
   * Migrate any v1 or unversioned resume data safely into v2 schema
   * Preserves ALL user fields, IDs, entries, visibility, and custom values.
   */
  function migrateResumeSchema(raw) {
    const schema = typeof ApplyReadySchema !== 'undefined' ? ApplyReadySchema
      : (typeof require === 'function' ? require('./resume-schema.js') : null);
    return schema ? schema.migrate(raw) : raw;
  }

  return {
    TEMPLATES,
    TEMPLATE_GROUPS,
    DEFAULT_STYLE,
    SECTION_LABELS,
    SKILL_LABELS,
    getTemplate,
    getTemplateStyle,
    getSectionLabel,
    getSectionTitle,
    getSkillLabels,
    resolveTemplateId,
    migrateResumeSchema
  };
});
