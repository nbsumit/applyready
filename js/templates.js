/**
 * ApplyReady.in - 8 Distinct ATS-Friendly Resume Templates
 * Shared configuration, metadata, visual hierarchy definitions,
 * and precomputed thumbnail SVGs.
 * 100% Client-Side & Node.js Compatible.
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
      name: 'Graduate / Early Career',
      category: 'Students & Entry Level',
      badge: 'Entry Level',
      description: 'Education, academic projects, internships, and activities prominent; no mandatory work-experience requirement.',
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
      cssClass: 'template-graduate-early-career',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graduate Early Career template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Header -->
        <rect x="16" y="14" width="85" height="7.5" rx="1" fill="#0F172A"/>
        <rect x="16" y="24" width="60" height="4" rx="1" fill="#475569"/>
        <rect x="16" y="31" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <line x1="16" y1="38" x2="144" y2="38" stroke="#0F172A" stroke-width="1"/>
        <!-- 1. Education Prominent at Top -->
        <rect x="16" y="44" width="40" height="5" fill="#0F172A"/>
        <line x1="16" y1="51" x2="144" y2="51" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="56" width="85" height="3.5" fill="#1E293B"/>
        <rect x="114" y="56" width="30" height="3" fill="#64748B"/>
        <rect x="16" y="62" width="100" height="3" fill="#64748B"/>
        <circle cx="20" cy="69" r="1.2" fill="#475569"/>
        <rect x="25" y="67.5" width="90" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- 2. Projects Prominent -->
        <rect x="16" y="77" width="50" height="5" fill="#0F172A"/>
        <line x1="16" y1="84" x2="144" y2="84" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="89" width="75" height="3.5" fill="#1E293B"/>
        <rect x="105" y="89" width="39" height="3" fill="#2563EB"/>
        <circle cx="20" cy="97" r="1.2" fill="#475569"/>
        <rect x="25" y="95.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="103" r="1.2" fill="#475569"/>
        <rect x="25" y="101.5" width="112" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="111" width="70" height="3.5" fill="#1E293B"/>
        <circle cx="20" cy="119" r="1.2" fill="#475569"/>
        <rect x="25" y="117.5" width="116" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- 3. Internships / Experience -->
        <rect x="16" y="129" width="60" height="5" fill="#0F172A"/>
        <line x1="16" y1="136" x2="144" y2="136" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="141" width="75" height="3.5" fill="#1E293B"/>
        <rect x="114" y="141" width="30" height="3" fill="#64748B"/>
        <circle cx="20" cy="149" r="1.2" fill="#475569"/>
        <rect x="25" y="147.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- 4. Technical Skills -->
        <rect x="16" y="159" width="32" height="5" fill="#0F172A"/>
        <line x1="16" y1="166" x2="144" y2="166" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="170" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="176" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- 5. Achievements / Honors -->
        <rect x="16" y="187" width="55" height="5" fill="#0F172A"/>
        <line x1="16" y1="194" x2="144" y2="194" stroke="#E2E8F0" stroke-width="0.75"/>
        <circle cx="20" cy="201" r="1.2" fill="#475569"/>
        <rect x="25" y="199.5" width="112" height="3" rx="0.5" fill="#94A3B8"/>
      </svg>`
    },

    'experienced-professional': {
      id: 'experienced-professional',
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
      name: 'Project Focused',
      category: 'Technical & Portfolio',
      badge: 'Portfolio',
      description: 'Projects and case studies prominent with readable links and clear contribution descriptions for technical disciplines.',
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
      cssClass: 'template-project-focused',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Project Focused template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Left Header -->
        <rect x="16" y="14" width="80" height="7.5" rx="1" fill="#0F172A"/>
        <rect x="16" y="24" width="60" height="4" rx="1" fill="#2563EB"/>
        <rect x="16" y="31" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <line x1="16" y1="38" x2="144" y2="38" stroke="#0F172A" stroke-width="1"/>
        <!-- Summary -->
        <rect x="16" y="44" width="35" height="4.5" fill="#0F172A"/>
        <rect x="16" y="51" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Projects Section Prominent (Position #2) -->
        <rect x="16" y="62" width="65" height="5" fill="#0F172A"/>
        <line x1="16" y1="69" x2="144" y2="69" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="74" width="75" height="3.5" fill="#1E293B"/>
        <rect x="95" y="74" width="49" height="3" fill="#2563EB"/>
        <circle cx="20" cy="82" r="1.2" fill="#475569"/>
        <rect x="25" y="80.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="88" r="1.2" fill="#475569"/>
        <rect x="25" y="86.5" width="112" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="96" width="70" height="3.5" fill="#1E293B"/>
        <rect x="92" y="96" width="52" height="3" fill="#2563EB"/>
        <circle cx="20" cy="104" r="1.2" fill="#475569"/>
        <rect x="25" y="102.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Work Experience -->
        <rect x="16" y="116" width="45" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="123" x2="144" y2="123" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="128" width="75" height="3.5" fill="#1E293B"/>
        <rect x="114" y="128" width="30" height="3" fill="#64748B"/>
        <circle cx="20" cy="136" r="1.2" fill="#475569"/>
        <rect x="25" y="134.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Skills -->
        <rect x="16" y="148" width="35" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="155" x2="144" y2="155" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="160" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="166" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Education -->
        <rect x="16" y="178" width="30" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="185" x2="144" y2="185" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="190" width="85" height="3.5" fill="#1E293B"/>
        <rect x="115" y="190" width="29" height="3" fill="#64748B"/>
      </svg>`
    },

    'career-transition': {
      id: 'career-transition',
      name: 'Career Transition',
      category: 'Career Change',
      badge: 'Pivot',
      description: 'Short summary and transferable skills prominent at the top, supported by a complete dated work-history section.',
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
      cssClass: 'template-career-transition',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Career Transition template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Left Header -->
        <rect x="16" y="14" width="80" height="7.5" rx="1" fill="#0F172A"/>
        <rect x="16" y="24" width="65" height="4" rx="1" fill="#047857"/>
        <rect x="16" y="31" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <line x1="16" y1="38" x2="144" y2="38" stroke="#0F172A" stroke-width="1"/>
        <!-- Targeted Career Transition Summary -->
        <rect x="16" y="44" width="55" height="5" fill="#0F172A"/>
        <line x1="16" y1="51" x2="144" y2="51" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="55" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="60" width="124" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Transferable Core Competencies (Position #2) -->
        <rect x="16" y="70" width="65" height="5" fill="#0F172A"/>
        <line x1="16" y1="77" x2="144" y2="77" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="82" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="88" width="124" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="94" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Chronological Work History -->
        <rect x="16" y="106" width="50" height="5" fill="#0F172A"/>
        <line x1="16" y1="113" x2="144" y2="113" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="118" width="75" height="3.5" fill="#1E293B"/>
        <rect x="112" y="118" width="32" height="3" fill="#64748B"/>
        <circle cx="20" cy="126" r="1.2" fill="#475569"/>
        <rect x="25" y="124.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="132" r="1.2" fill="#475569"/>
        <rect x="25" y="130.5" width="110" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="140" width="70" height="3.5" fill="#1E293B"/>
        <rect x="114" y="140" width="30" height="3" fill="#64748B"/>
        <circle cx="20" cy="148" r="1.2" fill="#475569"/>
        <rect x="25" y="146.5" width="116" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Projects & Education -->
        <rect x="16" y="160" width="40" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="167" x2="144" y2="167" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="172" width="75" height="3.5" fill="#1E293B"/>
        <rect x="16" y="184" width="30" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="191" x2="144" y2="191" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="196" width="85" height="3.5" fill="#1E293B"/>
      </svg>`
    },

    'compact-professional': {
      id: 'compact-professional',
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
      name: 'Academic / Research CV',
      category: 'Academia & Research',
      badge: 'Multi-Page CV',
      description: 'Structured for scholarly curriculum vitae. Includes publications, teaching, research appointments, grants, and awards.',
      fontFamily: 'serif',
      headerAlign: 'center',
      headingAccent: 'classic-uppercase',
      density: 'standard',
      isAcademicCV: true,
      recommendedOrder: ['summary', 'education', 'academic', 'experience', 'projects', 'skills'],
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
        academic: true
      },
      cssClass: 'template-academic-cv',
      svgThumbnail: `<svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Academic Research CV template thumbnail">
        <rect width="160" height="220" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" rx="4"/>
        <!-- Formal Academic Header -->
        <rect x="30" y="14" width="100" height="8" rx="1" fill="#0F172A"/>
        <rect x="42" y="24" width="76" height="4" rx="1" fill="#475569"/>
        <rect x="26" y="31" width="108" height="3" rx="0.5" fill="#94A3B8"/>
        <line x1="16" y1="38" x2="144" y2="38" stroke="#0F172A" stroke-width="1"/>
        <!-- Research Interests / Summary -->
        <rect x="16" y="44" width="55" height="4.5" fill="#0F172A"/>
        <rect x="16" y="51" width="128" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Academic Appointments & Education -->
        <rect x="16" y="60" width="40" height="4.5" fill="#0F172A"/>
        <rect x="16" y="67" width="95" height="3.5" fill="#1E293B"/>
        <rect x="118" y="67" width="26" height="3" fill="#64748B"/>
        <circle cx="20" cy="74" r="1.2" fill="#475569"/>
        <rect x="25" y="72.5" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="16" y="80" width="90" height="3.5" fill="#1E293B"/>
        <rect x="118" y="80" width="26" height="3" fill="#64748B"/>
        <!-- Peer-Reviewed Publications -->
        <rect x="16" y="91" width="68" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="97" x2="144" y2="97" stroke="#E2E8F0" stroke-width="0.75"/>
        <circle cx="20" cy="103" r="1.2" fill="#475569"/>
        <rect x="25" y="101.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <rect x="25" y="106" width="105" height="3" rx="0.5" fill="#94A3B8"/>
        <circle cx="20" cy="114" r="1.2" fill="#475569"/>
        <rect x="25" y="112.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Teaching Experience -->
        <rect x="16" y="125" width="55" height="4.5" fill="#0F172A"/>
        <line x1="16" y1="131" x2="144" y2="131" stroke="#E2E8F0" stroke-width="0.75"/>
        <rect x="16" y="136" width="80" height="3.5" fill="#1E293B"/>
        <rect x="116" y="136" width="28" height="3" fill="#64748B"/>
        <circle cx="20" cy="144" r="1.2" fill="#475569"/>
        <rect x="25" y="142.5" width="115" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Conference Presentations -->
        <rect x="16" y="155" width="60" height="4.5" fill="#0F172A"/>
        <circle cx="20" cy="163" r="1.2" fill="#475569"/>
        <rect x="25" y="161.5" width="118" height="3" rx="0.5" fill="#94A3B8"/>
        <!-- Awards & Grants -->
        <rect x="16" y="174" width="48" height="4.5" fill="#0F172A"/>
        <circle cx="20" cy="182" r="1.2" fill="#475569"/>
        <rect x="25" y="180.5" width="110" height="3" rx="0.5" fill="#94A3B8"/>
      </svg>`
    }
  };

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
    migrateResumeSchema
  };
});
