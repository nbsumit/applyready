/* Shared, allowlisted backup validation and lossless v1/v2 migration. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadySchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const sections = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'];
  const templates = ['classic-professional', 'modern-minimal', 'graduate-early-career', 'experienced-professional', 'project-focused', 'career-transition', 'compact-professional', 'academic-cv'];
  const personalFields = ['fullName', 'targetTitle', 'email', 'phone', 'location', 'linkedin', 'github', 'website'];
  const skillFields = ['languages', 'frameworks', 'tools', 'other'];
  const entries = {
    experience: ['role', 'company', 'duration', 'location', 'bulletsText'],
    education: ['degree', 'institution', 'duration', 'location', 'score'],
    projects: ['name', 'tech', 'link', 'bulletsText'],
    certifications: ['name', 'title', 'issuer', 'year', 'date'],
    achievements: ['title', 'text'],
    volunteering: ['role', 'organization', 'org', 'duration'],
    languages: ['name', 'proficiency'],
    publications: ['title', 'citation'],
    teaching: ['role', 'course', 'institution', 'term'],
    presentations: ['title', 'event'],
    grants: ['title', 'name', 'funder', 'year']
  };
  const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string' && x.length <= 50000;
  const fieldsValid = (obj, fields) => record(obj) && fields.every(key => obj[key] === undefined || text(obj[key]));
  function normalizeSectionOrder(order) {
    return [...new Set([...(Array.isArray(order) ? order.filter(key => sections.includes(key)) : []), ...sections])];
  }
  function validate(payload) {
    if (!record(payload) || !record(payload.data)) return false;
    if (payload.app !== undefined && payload.app !== 'ApplyReady') return false;
    if (payload.version !== undefined && ![1, 2].includes(payload.version)) return false;
    const d = payload.data;
    if (!fieldsValid(d.personal, personalFields)) return false;
    if (!['experience', 'education', 'projects'].every(key => Array.isArray(d[key]))) return false;
    if (d.version !== undefined && ![1, 2].includes(d.version)) return false;
    if (!['summary', 'summaryTitle', 'experienceTitle', 'educationTitle', 'projectsTitle', 'skillsTitle'].every(key => d[key] === undefined || text(d[key]))) return false;
    if (d.skills !== undefined && !fieldsValid(d.skills, skillFields)) return false;
    if (d.design !== undefined && !record(d.design)) return false;
    if (d.sectionVisibility !== undefined && (!record(d.sectionVisibility) || !sections.every(key => d.sectionVisibility[key] === undefined || typeof d.sectionVisibility[key] === 'boolean'))) return false;
    if (d.design && d.design.sectionOrder !== undefined && (!Array.isArray(d.design.sectionOrder) || d.design.sectionOrder.length > 30 || !d.design.sectionOrder.every(key => sections.includes(key)))) return false;
    const arrayValid = (array, keys, allowStrings) => Array.isArray(array) && array.length <= 150 && array.every(item =>
      (allowStrings && text(item)) || (fieldsValid(item, keys) && (item.id === undefined || typeof item.id === 'string' || typeof item.id === 'number')));
    for (const key of Object.keys(entries).slice(0, 7)) {
      if (d[key] !== undefined && !arrayValid(d[key], entries[key], ['achievements', 'languages'].includes(key))) return false;
    }
    if (d.academic !== undefined) {
      if (!record(d.academic)) return false;
      for (const key of ['publications', 'teaching', 'presentations', 'grants']) {
        if (d.academic[key] !== undefined && !arrayValid(d.academic[key], entries[key], key !== 'teaching')) return false;
      }
    }
    return true;
  }
  function migrate(raw) {
    const src = record(raw) ? (record(raw.data) ? raw.data : raw) : {};
    const design = record(src.design) ? src.design : {};
    const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
    const pickText = (obj, keys) => Object.fromEntries(keys.map(key => [key, text(obj && obj[key]) ? obj[key] : '']));
    let nextId = 0;
    const usedIds = new Set();
    function list(array, keys, stringField) {
      return (Array.isArray(array) ? array : []).slice(0, 150).filter(item => record(item) || text(item)).map(item => {
        const obj = typeof item === 'string' ? { [stringField || 'title']: item } : item;
        let id = String(obj.id || '');
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || usedIds.has(id)) id = `entry-${++nextId}`;
        while (usedIds.has(id)) id = `entry-${++nextId}`;
        usedIds.add(id);
        return { id, ...pickText(obj, keys) };
      });
    }
    const template = enumValue(src.template, templates, enumValue(design.templateId, templates, 'classic-professional'));
    const vis = {};
    sections.forEach((key, i) => { vis[key] = typeof (src.sectionVisibility || {})[key] === 'boolean' ? src.sectionVisibility[key] : i < 5; });
    const acad = record(src.academic) ? src.academic : {};
    const result = {
      version: 2, schemaVersion: 2, app: 'ApplyReady', template,
      design: {
        templateId: template,
        fontFamily: enumValue(design.fontFamily || src.fontFamily, ['serif', 'sans'], 'serif'),
        fontSize: enumValue(design.fontSize, ['standard', 'comfortable', 'compact'], 'standard'),
        density: enumValue(design.density, ['standard', 'compact'], 'standard'),
        pageSize: enumValue(design.pageSize, ['a4', 'letter'], 'a4'), accentColor: 'navy',
        sectionOrder: normalizeSectionOrder(design.sectionOrder)
      },
      sectionVisibility: vis, personal: pickText(src.personal, personalFields), skills: pickText(src.skills, skillFields),
      summary: text(src.summary) ? src.summary : '',
      summaryTitle: text(src.summaryTitle) && src.summaryTitle ? src.summaryTitle : 'Professional Summary',
      experienceTitle: text(src.experienceTitle) && src.experienceTitle ? src.experienceTitle : 'Work Experience',
      educationTitle: text(src.educationTitle) && src.educationTitle ? src.educationTitle : 'Education',
      projectsTitle: text(src.projectsTitle) && src.projectsTitle ? src.projectsTitle : 'Projects',
      skillsTitle: text(src.skillsTitle) && src.skillsTitle ? src.skillsTitle : 'Skills',
      academic: {}
    };
    for (const key of Object.keys(entries).slice(0, 7)) result[key] = list(src[key], entries[key], key === 'languages' ? 'name' : 'title');
    for (const key of ['publications', 'teaching', 'presentations', 'grants']) result.academic[key] = list(acad[key], entries[key]);
    return result;
  }
  return { validate, migrate, normalizeSectionOrder, sections };
});
