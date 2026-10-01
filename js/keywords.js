/* Job-description keyword matching. Runs on the device; nothing is stored or sent. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyKeywords = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Common English words plus job-advert filler that says nothing about the role.
  const STOPWORDS = new Set(('a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each either etc ever every few for from further get gets given had has have having he her here hers him his how however i if in into is it its itself just least less like made make makes many may me might more most much must my need needs no nor not now of off often on once one only or other our ours out over own per please plus rather same she should since so some such than that the their theirs them then there these they this those through thus to too under until up upon us use used using very via was way we well were what when where whether which while who whom whose why will with within without would yet you your yours ' +
    'ability able across apply applicant applicants applying benefits candidate candidates company competitive culture day days demonstrated desired duties environment equal excellent experience experienced familiarity fast full good great highly ideal ideally including job join key knowledge level looking minimum new opportunity paced plus position preferred proven qualification qualifications related relevant required requirement requirements responsibilities responsibility responsible role salary seeking skill skills strong success successful team teams time understanding work working world year years ' +
    'achieve assist build building collaborate communicate contribute create creating deliver delivering design develop developing drive ensure help identify implement improve lead maintain manage partner perform provide support write writing').split(/\s+/));

  // Light stemming so "reports", "reporting" and "reported" match each other.
  function stem(token) {
    if (token.length > 5 && /ing$/.test(token)) return token.slice(0, -3);
    if (token.length > 4 && /ed$/.test(token)) return token.slice(0, -2);
    if (token.length > 4 && /ies$/.test(token)) return token.slice(0, -3) + 'y';
    if (token.length > 3 && /s$/.test(token) && !/(ss|is|us)$/.test(token)) token = token.slice(0, -1);
    if (token.length > 4 && /e$/.test(token)) return token.slice(0, -1);
    return token;
  }

  function rawTokens(text) {
    return (String(text || '').normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}+#.&/-]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu) || [])
      .map(token => token.replace(/[./-]+$/, ''));
  }
  function tokenize(text) {
    return rawTokens(text).map(token => token.toLowerCase());
  }

  const meaningful = token => token.length > 1 && !STOPWORDS.has(token) && !/^\d+$/.test(token);

  /**
   * Most distinctive terms in a job description: capitalised names (Power BI,
   * Lean Six Sigma), repeated two-word phrases, and single words, ignoring
   * filler. Returns at most `limit` terms.
   */
  function extractKeywords(jobText, limit = 30) {
    // Phrases never span sentences, commas or brackets; only a real sentence
    // start makes an initial capital meaningless.
    const chunks = String(jobText || '').split(/[\n\r;:!?•·|]+|\.\s/)
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
        if (!isTerm(token)) return;
        if (token.length > 2 || /[+#]/.test(token)) bump(token, 1, originals[i], chunk.start && i === 0);
        const next = tokens[i + 1];
        if (next && isTerm(next)) bump(token + ' ' + next, 1.5, originals[i] + ' ' + originals[i + 1], chunk.start && i === 0);
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

  function containsTerm(stems, term) {
    const parts = tokenize(term).map(stem);
    for (let i = 0; i <= stems.length - parts.length; i++) {
      if (parts.every((part, j) => stems[i + j] === part)) return true;
    }
    return false;
  }

  /** Split job keywords into those present in the resume text and those missing. */
  function matchKeywords(jobText, resumeText, limit = 30) {
    const keywords = extractKeywords(jobText, limit);
    const stems = tokenize(resumeText).map(stem);
    const found = [], missing = [];
    keywords.forEach(term => (containsTerm(stems, term) ? found : missing).push(term));
    return { keywords, found, missing };
  }

  return { extractKeywords, matchKeywords, tokenize, stem };
});
