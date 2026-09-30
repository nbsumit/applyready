const { migrate } = require('../js/resume-schema');
function resumeFixture() {
  return migrate({
    personal: { fullName: 'Jordan Lee', email: 'jordan@example.com', phone: '+91 90000 00000', targetTitle: 'Operations Analyst', location: 'Bengaluru, India', website: 'example.com/portfolio' },
    summary: 'Operations analyst improving processes and creating practical reporting tools.',
    experience: [{ id: 'role-1', role: 'Analyst', company: 'Example Company', duration: '2022 – Present', bulletsText: 'Improved reporting turnaround by 25%.\nBuilt a shared dashboard used by 12 teams.' }],
    education: [{ id: 'edu-1', degree: 'Bachelor of Commerce', institution: 'Example University', duration: '2018 – 2022' }],
    projects: [{ id: 'project-1', name: 'Reporting dashboard', tech: 'Spreadsheets', link: 'https://example.com/project', bulletsText: 'Created an accessible dashboard with clear monthly targets.' }],
    skills: { languages: 'Analysis, Operations', frameworks: 'Spreadsheets', tools: 'SQL', other: 'Communication' },
    certifications: [{ name: 'CERTIFICATE_MARKER', issuer: 'Example Institute', year: '2025' }],
    achievements: ['AWARD_MARKER'],
    volunteering: [{ role: 'VOLUNTEER_MARKER', organization: 'Community Group', duration: '2023' }],
    languages: [{ name: 'LANGUAGE_MARKER', proficiency: 'Professional working' }],
    academic: { publications: ['PUBLICATION_MARKER'], teaching: [{ role: 'TEACHING_MARKER', institution: 'Example University', term: '2024' }], presentations: ['PRESENTATION_MARKER'], grants: [{ title: 'GRANT_MARKER', funder: 'Research Council', year: '2024' }] },
    sectionVisibility: { certifications: true, achievements: true, volunteering: true, languages: true, academic: true }
  });
}
module.exports = { resumeFixture };
