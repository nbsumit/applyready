/* Resume data schema: allow-listed validation and lossless migration from versions 1, 2 and 3.

   Version 3 (November 2026) adds references, custom sections and a first-class Publications
   section (in versions 1 and 2 publications lived inside the Academic section). Every resume that
   reaches the editor, the library or an export passes through migrate(), which rebuilds the object
   from this allow-list. Entry ids always match ID_PATTERN because the editor puts them into HTML
   attributes without escaping. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadySchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CURRENT_VERSION = 3;
  const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
  const CUSTOM_PREFIX = 'custom:';
  const MAX_CUSTOM_SECTIONS = 20;
  const MAX_REFERENCES = 20;
  // Limits for one text box and one list. The editor stops input at these limits (js/resume.js),
  // so everything it saves passes validate(); migrate() shortens anything longer instead of dropping it.
  const MAX_TEXT = 50000;
  const MAX_ENTRIES = 150;
  // Fixed sections, in their default order. Custom sections join the order as "custom:<id>".
  const sections = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'publications', 'academic', 'references'];
  const LEGACY_SECTIONS = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'achievements', 'volunteering', 'languages', 'academic'];
  const templates = ['classic-professional', 'modern-minimal', 'graduate-early-career', 'experienced-professional', 'project-focused', 'career-transition', 'compact-professional', 'academic-cv', 'ivy-classic', 'software-engineer', 'campus-fresher', 'ats-strict', 'executive-impact', 'healthcare-licensed', 'finance-consulting'];
  // Retired template ids and the template that replaces them, so saved resumes always open.
  const templateAliases = {};
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
    grants: ['title', 'name', 'funder', 'year'],
    references: ['name', 'title', 'organization', 'contact'],
    customEntries: ['title', 'subtitle', 'date', 'bulletsText']
  };
  const TOP_LISTS = ['experience', 'education', 'projects', 'certifications', 'achievements', 'volunteering', 'languages'];
  const ACADEMIC_LISTS = ['teaching', 'presentations', 'grants'];
  const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const textWithinLimit = x => typeof x === 'string' && x.length <= MAX_TEXT;
  const anyText = x => typeof x === 'string';
  // At most MAX_TEXT characters, without leaving half of a surrogate pair at the end.
  const clip = x => {
    if (typeof x !== 'string') return '';
    if (x.length <= MAX_TEXT) return x;
    const cut = x.slice(0, MAX_TEXT);
    return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
  };
  const isCustomKey = key => typeof key === 'string' && key.startsWith(CUSTOM_PREFIX) && ID_PATTERN.test(key.slice(CUSTOM_PREFIX.length));
  const customKey = id => CUSTOM_PREFIX + id;
  const versionOk = v => v === undefined || [1, 2, 3].includes(v);

  // The custom-section keys a resume can have in its section order.
  function customKeysOf(data) {
    return (record(data) && Array.isArray(data.customSections) ? data.customSections : [])
      .filter(s => record(s) && ID_PATTERN.test(String(s.id || ''))).map(s => customKey(s.id));
  }

  /* Every fixed section exactly once plus every custom section of `data`, keeping the given order.
     A legacy order without "publications" gets it just before "academic", where publications used
     to print, so an old resume keeps its layout. */
  function normalizeSectionOrder(order, data) {
    const customs = customKeysOf(data);
    const allowed = key => sections.includes(key) || customs.includes(key);
    const given = Array.isArray(order) ? order.filter(allowed) : [];
    if (!given.includes('publications') && given.includes('academic')) given.splice(given.indexOf('academic'), 0, 'publications');
    return [...new Set([...given, ...sections, ...customs])];
  }

  /** The order in which the sections of `data` print. */
  function sectionKeys(data) {
    return normalizeSectionOrder(record(data) && record(data.design) ? data.design.sectionOrder : [], data);
  }

  /* True when `payload.data` is a resume this version can read. With { lenient: true } the length
     and count limits are not checked: the library uses that to open a record saved by an earlier
     release with text over the limits, which migrate() then shortens. */
  function validate(payload, options) {
    const lenient = !!(options && options.lenient);
    const text = lenient ? anyText : textWithinLimit;
    const fieldsValid = (obj, fields) => record(obj) && fields.every(key => obj[key] === undefined || text(obj[key]));
    if (!record(payload) || !record(payload.data)) return false;
    if (payload.app !== undefined && payload.app !== 'ApplyReady') return false;
    if (!versionOk(payload.version)) return false;
    const d = payload.data;
    if (!fieldsValid(d.personal, personalFields)) return false;
    if (!['experience', 'education', 'projects'].every(key => Array.isArray(d[key]))) return false;
    if (!versionOk(d.version) || !versionOk(d.schemaVersion)) return false;
    if (!['summary', 'summaryTitle', 'experienceTitle', 'educationTitle', 'projectsTitle', 'skillsTitle'].every(key => d[key] === undefined || text(d[key]))) return false;
    if (d.skills !== undefined && !fieldsValid(d.skills, skillFields)) return false;
    if (d.skillLabels !== undefined && !fieldsValid(d.skillLabels, skillFields)) return false;
    if (d.design !== undefined && !record(d.design)) return false;
    if (d.sectionVisibility !== undefined && (!record(d.sectionVisibility) || !sections.every(key => d.sectionVisibility[key] === undefined || typeof d.sectionVisibility[key] === 'boolean'))) return false;
    if (d.design && d.design.sectionOrder !== undefined && (!Array.isArray(d.design.sectionOrder) || d.design.sectionOrder.length > 60 || !d.design.sectionOrder.every(key => sections.includes(key) || isCustomKey(key)))) return false;
    const arrayValid = (array, keys, allowStrings, max) => Array.isArray(array) && (lenient || array.length <= (max || MAX_ENTRIES)) && array.every(item =>
      (allowStrings && text(item)) || (fieldsValid(item, keys) && (item.id === undefined || typeof item.id === 'string' || typeof item.id === 'number')));
    for (const key of TOP_LISTS) {
      if (d[key] !== undefined && !arrayValid(d[key], entries[key], ['achievements', 'languages'].includes(key))) return false;
    }
    if (d.publications !== undefined && !arrayValid(d.publications, entries.publications, true)) return false;
    if (d.academic !== undefined) {
      if (!record(d.academic)) return false;
      for (const key of ['publications', ...ACADEMIC_LISTS]) {
        if (d.academic[key] !== undefined && !arrayValid(d.academic[key], entries[key], key !== 'teaching')) return false;
      }
    }
    if (d.references !== undefined && !arrayValid(d.references, entries.references, false, MAX_REFERENCES)) return false;
    if (d.referencesOnRequest !== undefined && typeof d.referencesOnRequest !== 'boolean') return false;
    if (d.customSections !== undefined) {
      if (!Array.isArray(d.customSections) || (!lenient && d.customSections.length > MAX_CUSTOM_SECTIONS)) return false;
      for (const s of d.customSections) {
        if (!record(s) || !['title', 'text'].every(key => s[key] === undefined || text(s[key]))) return false;
        if (s.id !== undefined && typeof s.id !== 'string') return false;
        if (s.mode !== undefined && !['entries', 'text'].includes(s.mode)) return false;
        if (s.visible !== undefined && typeof s.visible !== 'boolean') return false;
        if (s.entries !== undefined && !arrayValid(s.entries, entries.customEntries, false)) return false;
      }
    }
    return true;
  }

  function migrate(raw) {
    const src = record(raw) ? (record(raw.data) ? raw.data : raw) : {};
    const design = record(src.design) ? src.design : {};
    const isV3 = src.schemaVersion === 3 || src.version === 3;
    const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
    const pickText = (obj, keys) => Object.fromEntries(keys.map(key => [key, clip(obj && obj[key])]));
    let nextId = 0;
    const usedIds = new Set();
    function freshId(candidate) {
      let id = String(candidate || '');
      if (!ID_PATTERN.test(id) || usedIds.has(id)) id = `entry-${++nextId}`;
      while (usedIds.has(id)) id = `entry-${++nextId}`;
      usedIds.add(id);
      return id;
    }
    function list(array, keys, stringField, max) {
      return (Array.isArray(array) ? array : []).slice(0, max || MAX_ENTRIES).filter(item => record(item) || anyText(item)).map(item => {
        const obj = typeof item === 'string' ? { [stringField || 'title']: item } : item;
        return { id: freshId(obj.id), ...pickText(obj, keys) };
      });
    }
    const aliased = id => (typeof id === 'string' && templateAliases[id]) || id;
    const template = enumValue(aliased(src.template), templates, enumValue(aliased(design.templateId), templates, 'classic-professional'));
    const srcVis = record(src.sectionVisibility) ? src.sectionVisibility : {};
    const vis = {};
    sections.forEach(key => { vis[key] = typeof srcVis[key] === 'boolean' ? srcVis[key] : LEGACY_SECTIONS.indexOf(key) > -1 && LEGACY_SECTIONS.indexOf(key) < 5; });
    // Before version 3 publications printed as part of Academic, so they share its visibility.
    if (!isV3 || typeof srcVis.publications !== 'boolean') vis.publications = typeof srcVis.academic === 'boolean' ? srcVis.academic : false;
    const acad = record(src.academic) ? src.academic : {};
    const customSections = (Array.isArray(src.customSections) ? src.customSections : []).slice(0, MAX_CUSTOM_SECTIONS).filter(record).map(s => ({
      id: freshId(s.id),
      title: clip(s.title).slice(0, 120),
      mode: enumValue(s.mode, ['entries', 'text'], 'entries'),
      visible: typeof s.visible === 'boolean' ? s.visible : true,
      text: clip(s.text),
      entries: list(s.entries, entries.customEntries)
    }));
    const result = {
      version: CURRENT_VERSION, schemaVersion: CURRENT_VERSION, app: 'ApplyReady', template,
      design: {
        templateId: template,
        fontFamily: enumValue(design.fontFamily || src.fontFamily, ['serif', 'sans'], 'serif'),
        fontSize: enumValue(design.fontSize, ['standard', 'comfortable', 'compact'], 'standard'),
        density: enumValue(design.density, ['standard', 'compact'], 'standard'),
        pageSize: enumValue(design.pageSize, ['a4', 'letter'], 'a4'), accentColor: 'navy',
        sectionOrder: []
      },
      sectionVisibility: vis, personal: pickText(src.personal, personalFields), skills: pickText(src.skills, skillFields),
      skillLabels: Object.fromEntries(Object.entries(pickText(src.skillLabels, skillFields)).map(([key, value]) => [key, value.slice(0, 60)])),
      summary: clip(src.summary),
      summaryTitle: clip(src.summaryTitle) || 'Professional Summary',
      experienceTitle: clip(src.experienceTitle) || 'Work Experience',
      educationTitle: clip(src.educationTitle) || 'Education',
      projectsTitle: clip(src.projectsTitle) || 'Projects',
      skillsTitle: clip(src.skillsTitle) || 'Skills',
      academic: {},
      publications: [],
      references: [],
      referencesOnRequest: src.referencesOnRequest === true,
      customSections
    };
    for (const key of TOP_LISTS) result[key] = list(src[key], entries[key], key === 'languages' ? 'name' : 'title');
    // Version 3 keeps publications at the top level. A version 3 backup may also carry a copy in
    // academic.publications for older importers; the top-level list is the authoritative one.
    result.publications = list(isV3 && Array.isArray(src.publications) ? src.publications : acad.publications, entries.publications);
    for (const key of ACADEMIC_LISTS) result.academic[key] = list(acad[key], entries[key]);
    result.references = list(src.references, entries.references, 'name', MAX_REFERENCES);
    result.design.sectionOrder = normalizeSectionOrder(design.sectionOrder, result);
    // Set once the person arranges the sections by hand; choosing a template then keeps their order.
    if (typeof design.orderCustom === 'boolean') result.design.orderCustom = design.orderCustom;
    return result;
  }

  /* A copy of migrated data that the version 2 importer (earlier ApplyReady releases) also accepts:
     version 2 markers, a section order made only of the sections it knows, and publications mirrored
     into academic.publications. The full version 3 order travels in design.sectionOrderV3, and
     migrate() reads it back, so nothing is lost when this release imports the file. */
  function toLegacyCompatible(data) {
    const d = migrate(data);
    const out = JSON.parse(JSON.stringify(d));
    out.version = 2;
    out.schemaVersion = CURRENT_VERSION;
    out.design.sectionOrderV3 = d.design.sectionOrder.slice();
    out.design.sectionOrder = d.design.sectionOrder.filter(key => LEGACY_SECTIONS.includes(key));
    out.academic.publications = d.publications.map(p => ({ id: p.id, title: p.title, citation: p.citation }));
    return out;
  }

  // Read the full order back from a file written by toLegacyCompatible().
  const migrateBase = migrate;
  function migrateWithOrder(raw) {
    const src = record(raw) ? (record(raw.data) ? raw.data : raw) : {};
    const design = record(src.design) ? src.design : null;
    if (design && Array.isArray(design.sectionOrderV3) && design.sectionOrderV3.length <= 60 && design.sectionOrderV3.every(key => sections.includes(key) || isCustomKey(key))) {
      const copy = Object.assign({}, src, { design: Object.assign({}, design, { sectionOrder: design.sectionOrderV3 }) });
      return migrateBase(copy);
    }
    return migrateBase(src);
  }

  return {
    validate, migrate: migrateWithOrder, normalizeSectionOrder, sectionKeys, customKeysOf, isCustomKey, customKey, toLegacyCompatible,
    sections, legacySections: LEGACY_SECTIONS, templates, templateAliases, entries, CURRENT_VERSION, ID_PATTERN, CUSTOM_PREFIX,
    MAX_CUSTOM_SECTIONS, MAX_REFERENCES, MAX_TEXT, MAX_ENTRIES
  };
});
