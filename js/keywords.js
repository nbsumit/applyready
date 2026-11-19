/* Job-description keyword matching. Runs on the device; nothing is stored or sent. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyKeywords = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Common English words plus job-advert filler that says nothing about the role.
  const STOPWORDS = new Set(('a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each either etc ever every few for from further get gets given had has have having he her here hers him his how however i if in into is it its itself just least less like made make makes many may me might more most much must my need needs no nor not now of off often on once one only or other our ours out over own per please plus rather same she should since so some such than that the their theirs them then there these they this those through thus to too under until up upon us use used using very via was way we well were what when where whether which while who whom whose why will with within without would yet you your yours ' +
    'ability able across apply applicant applicants applying benefits candidate candidates company competitive culture day days demonstrated desired duties environment equal excellent experience experienced familiarity fast full good great highly ideal ideally including job join key knowledge level looking minimum new opportunity paced plus position preferred proven qualification qualifications related relevant required requirement requirements responsibilities responsibility responsible role salary seeking skill skills strong success successful team teams time understanding work working world year years ' +
    'achieve assist build building collaborate communicate contribute create creating deliver delivering design develop developing drive ensure help identify implement improve lead maintain manage partner perform provide support write writing ' +
    // Verbs and fillers of job adverts ("Must know", "is a bonus", "will include", "juniors").
    'bonus e.g expect expected exposure hands i.e include includes juniors know known knows nice offer offers run running seniors want wants ' +
    // Words about the degree or seniority asked for, not about the work itself.
    'bachelor bachelors degree degrees equivalent field fields gather gathering graduates hire hiring junior senior').split(/\s+/));

  // British and American spellings meet in one form (visualise and visualize, colour and color,
  // modelling and modeling, centre and center, programme and program).
  function spelling(token) {
    if (token.length < 5) return token;
    return token
      .replace(/^licence/, 'license').replace(/^defence/, 'defense')
      .replace(/([a-z]{2})is(e|es|ed|ing|ation|ations|er|ers)$/, '$1iz$2')
      .replace(/([a-z]{2})ys(e|es|ed|ing|er|ers)$/, '$1yz$2')
      .replace(/([a-z]{2})our(s|ed|ing|ite|ites)?$/, '$1or$2')
      .replace(/([a-z]{3})ell(ing|ed|er|ers)$/, '$1el$2')
      .replace(/([a-z]{2})tre(s)?$/, '$1ter$2')
      .replace(/mme(s)?$/, 'm$1')
      .replace(/logue(s)?$/, 'log$1');
  }

  // Light stemming so "reports", "reporting" and "reported" match each other.
  function stem(token) {
    token = spelling(token);
    // "visualization" meets "visualize", "automation" meets "automate".
    if (token.length > 7 && /izations?$/.test(token)) return token.replace(/izations?$/, 'iz');
    if (token.length > 6 && /ations?$/.test(token)) return token.replace(/ations?$/, 'at');
    if (token.length > 5 && /ing$/.test(token)) return token.slice(0, -3);
    if (token.length > 4 && /ed$/.test(token)) return token.slice(0, -2);
    if (token.length > 4 && /ies$/.test(token)) return token.slice(0, -3) + 'y';
    if (token.length > 3 && /s$/.test(token) && !/(ss|is|us)$/.test(token)) token = token.slice(0, -1);
    if (token.length > 4 && /e$/.test(token)) return token.slice(0, -1);
    return token;
  }

  // Words, keeping what makes a technology name: C++, C#, Node.js, CI/CD and a leading dot (.NET).
  function rawTokens(text) {
    return (String(text || '').normalize('NFKC').match(/(?:(?<![\p{L}\p{N}.])\.(?=\p{L}))?[\p{L}\p{N}][\p{L}\p{N}+#.&/-]*[\p{L}\p{N}+#]|(?:(?<![\p{L}\p{N}.])\.(?=\p{L}))?[\p{L}\p{N}]/gu) || [])
      .map(token => token.replace(/[./-]+$/, ''));
  }
  function tokenize(text) {
    return rawTokens(text).map(token => token.toLowerCase());
  }

  const meaningful = token => token.length > 1 && !STOPWORDS.has(token) && !/^\d+$/.test(token);

  /* Short names that are skills only as written: the languages R, C and Go (capitalised, not at the
     start of a sentence, where "Go" is a verb) and a short list of two-letter skill acronyms in
     capitals. Other capitals of two letters are usually not skills (send your CV to HR, a DL, a valid
     ID, BA or MA, UK based, 5 PM), so only this list is kept. They are matched in the resume with the
     same capitals, so "go live" is not the language Go. */
  const SHORT_SKILLS = new Set(['AI', 'ML', 'QA', 'QC', 'UI', 'UX', 'BI', 'AR', 'VR', 'CI', 'CD', 'JS', 'TS', 'RF']);
  function shortName(original, sentenceStart) {
    if (original === 'R' || original === 'C') return true;
    if (original === 'Go') return !sentenceStart;
    return SHORT_SKILLS.has(original);
  }
  const isShortTerm = term => /^(\p{L}{1,2})$/u.test(term);

  // Two-word terms that are one skill even when written once ("unit tests", "problem solving"), where
  // neither word means much alone. Compared by stem, so "unit testing" is the same term.
  const COMPOUNDS = new Set(['unit tests', 'integration tests', 'a/b tests', 'test automation', 'code reviews', 'version control',
    'problem solving', 'machine learning', 'deep learning', 'computer vision', 'data structures', 'data entry', 'supply chain',
    'customer service', 'quality assurance', 'cloud computing'].map(phrase => phrase.split(' ').map(word => stem(word)).join(' ')));

  /**
   * Most distinctive terms in a job description: capitalised names (Power BI,
   * Lean Six Sigma), repeated two-word phrases, and single words, ignoring
   * filler. Returns at most `limit` terms.
   */
  function extractKeywords(jobText, limit = 30) {
    // Phrases never span sentences, commas, brackets or a spaced dash (a title line such as
    // "Business Analyst - Graduate Programme" holds two terms); only a real sentence start makes an
    // initial capital meaningless.
    const chunks = String(jobText || '').split(/[\n\r;:!?•·|]+|\.\s|\s[-–—]+\s/)
      .flatMap(sentence => sentence.split(/[()[\],]+/).map((text, index) => ({ text, start: index === 0 })));
    const counts = new Map();
    const display = new Map();
    const bump = (term, weight, original, sentenceStart) => {
      counts.set(term, (counts.get(term) || 0) + weight);
      // Prefer how the term is written mid-sentence, where capitals are meaningful.
      const shown = sentenceStart && /^\p{Lu}\p{Ll}+(\s|$)/u.test(original) ? original.charAt(0).toLowerCase() + original.slice(1) : original;
      if (!display.has(term) || (display.get(term).sentenceStart && !sentenceStart)) display.set(term, { shown, sentenceStart });
    };
    const isTerm = token => meaningful(token) && /\p{L}/u.test(token);
    for (const chunk of chunks) {
      const originals = rawTokens(chunk.text);
      const tokens = originals.map(token => token.toLowerCase());
      let run = [];
      const flushRun = () => {
        if (run.length >= 2 && run.length <= 5) bump(run.map(i => tokens[i]).join(' '), 3, run.map(i => originals[i]).join(' '), false);
        run = [];
      };
      tokens.forEach((token, i) => {
        if (/^[\p{Lu}\d]/u.test(originals[i]) && isTerm(token)) run.push(i); else flushRun();
        if (token.length <= 2 && shortName(originals[i], chunk.start && i === 0)) { bump(token, 1, originals[i], false); return; }
        if (!isTerm(token)) return;
        if (token.length > 2 || /[+#]/.test(token)) bump(token, 1, originals[i], chunk.start && i === 0);
        const next = tokens[i + 1];
        if (next && isTerm(next)) bump(token + ' ' + next, COMPOUNDS.has(stem(token) + ' ' + stem(next)) ? 3 : 1.5, originals[i] + ' ' + originals[i + 1], chunk.start && i === 0);
      });
      flushRun();
    }
    const ranked = [...counts.entries()]
      .filter(([term, score]) => term.includes(' ') ? score >= 3 : score >= 1)
      .sort((a, b) => b[1] - a[1] || b[0].split(' ').length - a[0].split(' ').length || a[0].localeCompare(b[0]))
      .map(([term]) => term);
    // Drop words and phrases already contained in a longer chosen phrase.
    const phrases = ranked.filter(term => term.includes(' '));
    const covered = term => phrases.some(phrase => phrase !== term && phrase.length > term.length && ` ${phrase} `.includes(` ${term} `) && ranked.indexOf(phrase) < ranked.indexOf(term) + 40);
    const chosen = ranked.filter(term => !covered(term)).slice(0, limit);
    // Acronyms and product names keep their capitals (SQL, Power BI, Tableau).
    return chosen.map(term => (display.get(term) || { shown: term }).shown);
  }

  function containsTerm(stems, term, originals) {
    // R, C, Go, AI: only the same word in the same capitals counts.
    if (isShortTerm(term) && originals) return originals.some(word => word === term || word.split('/').includes(term));
    const parts = tokenize(term).map(stem);
    // .NET is matched by .NET or by a name that ends in it (ASP.NET), never by the word "net".
    if (parts.length === 1 && parts[0].startsWith('.')) return stems.some(s => s === parts[0] || s.endsWith(parts[0]));
    for (let i = 0; i <= stems.length - parts.length; i++) {
      if (parts.every((part, j) => stems[i + j] === part)) return true;
    }
    return false;
  }

  /** Split job keywords into those present in the resume text and those missing. */
  function matchKeywords(jobText, resumeText, limit = 30) {
    const keywords = extractKeywords(jobText, limit);
    const originals = rawTokens(resumeText);
    const stems = originals.map(token => stem(token.toLowerCase()));
    const found = [], missing = [];
    keywords.forEach(term => (containsTerm(stems, term, originals) ? found : missing).push(term));
    return { keywords, found, missing };
  }

  return { extractKeywords, matchKeywords, tokenize, stem };
});
