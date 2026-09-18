/*
 * Scoring and feedback engine. Pure functions over a deal object.
 *
 * Deal shape:
 * {
 *   id, name, target, stage, context, createdAt, updatedAt,
 *   weights:  { [dimKey]: 1..5 },
 *   dims:     { [dimKey]: { ratings: [0|1..5, x3], notes: '',
 *                           conditions: [{ id, text, status: 'untested'|'met'|'unmet' }] } },
 *   objectives: [{ id, text, source }]
 * }
 */
(function (global) {
  'use strict';

  var DIMENSIONS = global.SRD_DIMENSIONS;

  var BANDS = [
    { min: 4.25, key: 'strong',      label: 'Strong',
      text: 'The rationale is well-supported and internally coherent. Remaining work is about evidence quality and keeping the case honest as diligence proceeds.' },
    { min: 3.5,  key: 'supported',   label: 'Well-supported',
      text: 'The rationale holds together. The weaker points below are where a sceptical board member would push, so close them before the case goes further.' },
    { min: 2.5,  key: 'developing',  label: 'Developing',
      text: 'The rationale has real gaps. Some parts are asserted rather than supported. It is not yet a case that should carry a decision.' },
    { min: 0,    key: 'weak',        label: 'Weak',
      text: 'The rationale is largely unsupported. Either the thinking is early, or the deal is being justified rather than reasoned. Treat the score as a to-do list, not a verdict.' }
  ];

  function round1(n) { return Math.round(n * 10) / 10; }

  function bandFor(score) {
    if (score === null || score === undefined) return null;
    for (var i = 0; i < BANDS.length; i++) {
      if (score >= BANDS[i].min) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  function getDim(key) {
    for (var i = 0; i < DIMENSIONS.length; i++) if (DIMENSIONS[i].key === key) return DIMENSIONS[i];
    return null;
  }

  /* Score a single dimension. Returns null score when nothing has been rated. */
  function scoreDimension(deal, key) {
    var def = getDim(key);
    var data = (deal.dims && deal.dims[key]) || { ratings: [0, 0, 0], notes: '', conditions: [] };
    var ratings = (data.ratings || [0, 0, 0]).map(function (r) { return Number(r) || 0; });
    var rated = ratings.filter(function (r) { return r > 0; });
    var score = rated.length ? rated.reduce(function (a, b) { return a + b; }, 0) / rated.length : null;
    var weight = Number((deal.weights || {})[key]) || 3;
    var conditions = data.conditions || [];
    var unmet = conditions.filter(function (c) { return c.status === 'unmet' && (c.text || '').trim(); });
    var untested = conditions.filter(function (c) { return c.status === 'untested' && (c.text || '').trim(); });
    var notes = (data.notes || '').trim();

    var feedback = [];  // { level: 'weak'|'partial'|'note'|'strength'|'flag', text }

    if (rated.length === 0) {
      feedback.push({ level: 'note', text: 'Not yet assessed. Rate the three statements to score this dimension.' });
    } else {
      if (rated.length < 3) {
        feedback.push({ level: 'note', text: (3 - rated.length) + ' of 3 statements still unrated. The score reflects only what has been rated.' });
      }
      ratings.forEach(function (r, i) {
        if (r >= 1 && r <= 2) feedback.push({ level: 'weak', text: def.statements[i].weak, statement: i });
        else if (r === 3)     feedback.push({ level: 'partial', text: def.statements[i].partial, statement: i });
      });
      var max = Math.max.apply(null, rated), min = Math.min.apply(null, rated);
      if (max - min >= 3) {
        feedback.push({ level: 'note', text: 'Ratings inside this dimension are inconsistent (' + min + ' and ' + max + '). The rationale is strong on one point and weak on another, which usually means the dimension has not been thought through as a whole.' });
      }
      if (rated.length === 3 && min >= 4) {
        feedback.push({ level: 'strength', text: def.strong });
      }
      if (score >= 4 && notes.length < 40) {
        feedback.push({ level: 'note', text: 'High ratings with little or no evidence recorded. A well-supported rationale should point to documents, data, or conversations. Add them to the notes or lower the ratings.' });
      }
    }

    if (unmet.length) {
      feedback.unshift({ level: 'flag', text: 'Potential dealbreaker: ' + unmet.length + ' stated condition' + (unmet.length > 1 ? 's are' : ' is') + ' unmet (' + unmet.map(function (c) { return '"' + c.text.trim() + '"'; }).join(', ') + '). This flag is independent of the score.' });
    }
    if (untested.length) {
      feedback.push({ level: 'note', text: untested.length + ' condition' + (untested.length > 1 ? 's' : '') + ' still untested. The dimension cannot be considered settled until ' + (untested.length > 1 ? 'they are' : 'it is') + ' confirmed.' });
    }

    return {
      key: key,
      name: def.name,
      short: def.short,
      score: score === null ? null : round1(score),
      rawScore: score,
      ratings: ratings,
      ratedCount: rated.length,
      weight: weight,
      unmet: unmet,
      untested: untested,
      dealbreaker: unmet.length > 0,
      notesLength: notes.length,
      feedback: feedback
    };
  }

  /* Cross-dimension coherence checks. Each returns a sentence or null. */
  var COHERENCE_CHECKS = [
    function (s) {
      if (s.fit.score !== null && s.value.score !== null && s.fit.score >= 4 && s.value.score <= 2.5)
        return 'Strategic fit is rated highly but the value creation logic is weak. Fit without a value mechanism is a story, not a case. The fit rating may be doing work the value logic should be doing.';
      return null;
    },
    function (s) {
      var others = ['fit', 'value', 'timing'].filter(function (k) { return s[k].score !== null && s[k].score >= 4; });
      if (s.alternatives.score !== null && s.alternatives.score <= 2.5 && others.length >= 2)
        return 'Conviction is high on fit, value or timing while alternatives are barely considered. That pattern is the signature of confirmation bias: the target has been chosen and the rationale is catching up.';
      return null;
    },
    function (s) {
      if (s.timing.score !== null && s.sponsorship.score !== null && s.timing.score >= 4 && s.sponsorship.score <= 2.5)
        return 'The timing case says act now, but no executive clearly owns the deal. A window with no owner tends to close on the buyer\'s side, not the seller\'s.';
      return null;
    },
    function (s) {
      if (s.value.score !== null && s.risk.score !== null && s.value.score >= 4 && s.risk.score <= 2.5)
        return 'The value case is rated as strong but the assumptions behind it have not been named or tested. A strong value case with unexamined assumptions is the most common way a rationale fails after close.';
      return null;
    },
    function (s) {
      if (s.sponsorship.score !== null && s.sponsorship.score >= 4 && s.fit.score !== null && s.value.score !== null && s.fit.score <= 2.5 && s.value.score <= 2.5)
        return 'Sponsorship is strong while both fit and value are weak. Executive enthusiasm is carrying a rationale that has not been built. Check whether the sponsor\'s reason for the deal is the one written down here.';
      return null;
    }
  ];

  /* Score the whole deal. */
  function scoreDeal(deal) {
    var byKey = {};
    var dims = DIMENSIONS.map(function (d) { var r = scoreDimension(deal, d.key); byKey[d.key] = r; return r; });

    var rated = dims.filter(function (d) { return d.score !== null; });
    var wsum = 0, total = 0;
    rated.forEach(function (d) { wsum += d.weight; total += d.rawScore * d.weight; });
    var overall = rated.length ? total / wsum : null;
    var band = bandFor(overall);

    var dealbreakers = dims.filter(function (d) { return d.dealbreaker; });
    var unassessed = dims.filter(function (d) { return d.score === null; });
    var partially = dims.filter(function (d) { return d.score !== null && d.ratedCount < 3; });

    // What drags the score down, weighted by importance.
    var drags = rated
      .map(function (d) { return { dim: d, drag: (5 - d.rawScore) * d.weight }; })
      .filter(function (x) { return x.dim.rawScore < 4 && x.drag > 0; })
      .sort(function (a, b) { return b.drag - a.drag; });

    var summary = [];  // { level, text }

    if (overall === null) {
      summary.push({ level: 'note', text: 'Nothing has been rated yet. Work through the six dimensions; the summary updates as you go.' });
    } else {
      summary.push({ level: band.key === 'weak' || band.key === 'developing' ? 'weak' : 'strength', text: band.text });

      if (drags.length) {
        var top = drags.slice(0, 2);
        summary.push({
          level: 'weak',
          text: 'The score is being held down mostly by ' + top.map(function (x) {
            return x.dim.name.toLowerCase() + ' (' + x.dim.score + '/5' + (x.dim.weight >= 4 ? ', weighted as ' + global.SRD_WEIGHT_LABELS[x.dim.weight].toLowerCase() : '') + ')';
          }).join(' and ') + '. ' + (top[0].dim.weight >= 4
            ? 'Because you have weighted ' + top[0].dim.name.toLowerCase() + ' heavily, weakness there matters more than the overall number suggests.'
            : 'Start there.')
        });
      }

      var strongest = rated.filter(function (d) { return d.rawScore >= 4; });
      if (strongest.length && drags.length) {
        summary.push({ level: 'note', text: 'Strongest ground: ' + strongest.map(function (d) { return d.name.toLowerCase(); }).join(', ') + '. The objectives below are drawn from ' + (strongest.length > 1 ? 'these' : 'this') + '.' });
      }

      COHERENCE_CHECKS.forEach(function (check) {
        var t = check(byKey);
        if (t) summary.push({ level: 'weak', text: t });
      });

      if (unassessed.length) {
        summary.push({ level: 'note', text: unassessed.length + ' dimension' + (unassessed.length > 1 ? 's' : '') + ' not yet assessed (' + unassessed.map(function (d) { return d.name.toLowerCase(); }).join(', ') + '). The overall score only reflects what has been rated.' });
      } else if (partially.length) {
        summary.push({ level: 'note', text: 'Some statements remain unrated in ' + partially.map(function (d) { return d.name.toLowerCase(); }).join(', ') + '.' });
      }

      var weights = dims.map(function (d) { return d.weight; });
      var allEqual = weights.every(function (w) { return w === weights[0]; });
      if (allEqual && rated.length >= 4) {
        summary.push({ level: 'note', text: 'All six dimensions are weighted equally. Most deals hinge on one or two of them. If that is true here, adjust the weights so the score reflects it.' });
      }
    }

    if (dealbreakers.length) {
      summary.unshift({
        level: 'flag',
        text: 'Potential dealbreaker' + (dealbreakers.length > 1 ? 's' : '') + ' in ' + dealbreakers.map(function (d) { return d.name.toLowerCase(); }).join(', ') + ': a stated condition is unmet. This is flagged regardless of the score' + (overall !== null && overall >= 3.5 ? ', and the score is otherwise ' + band.label.toLowerCase() + ', which is exactly when this kind of flag gets ignored.' : '.')
      });
    }

    return {
      overall: overall === null ? null : round1(overall),
      rawOverall: overall,
      band: band,
      dims: dims,
      byKey: byKey,
      dealbreakers: dealbreakers,
      unassessed: unassessed,
      drags: drags,
      summary: summary,
      coverage: dims.reduce(function (n, d) { return n + d.ratedCount; }, 0)
    };
  }

  /*
   * Suggest two or three objectives from the strongest-scoring parts of the
   * rationale. We pick the highest-rated statements, preferring statements
   * rated 4 or 5, from at most two dimensions, weighted by dimension weight.
   */
  function suggestObjectives(deal) {
    var result = scoreDeal(deal);
    var candidates = [];
    result.dims.forEach(function (d) {
      var def = getDim(d.key);
      d.ratings.forEach(function (r, i) {
        if (r > 0) candidates.push({ dimKey: d.key, dimName: d.name, index: i, rating: r, weight: d.weight, dimScore: d.rawScore, text: def.statements[i].objective });
      });
    });
    if (!candidates.length) return [];

    candidates.sort(function (a, b) {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.dimScore !== a.dimScore) return b.dimScore - a.dimScore;
      return b.weight - a.weight;
    });

    var chosen = [], dimsUsed = {};
    for (var i = 0; i < candidates.length && chosen.length < 3; i++) {
      var c = candidates[i];
      var dimCount = Object.keys(dimsUsed).length;
      if (!dimsUsed[c.dimKey] && dimCount >= 2) continue;   // at most two dimensions
      if (chosen.length >= 2 && c.rating < 4) break;          // a third objective must come from a strong statement
      chosen.push(c);
      dimsUsed[c.dimKey] = true;
    }
    return chosen.map(function (c) {
      return { text: c.text, source: c.dimName + ' · statement ' + (c.index + 1) + ' (rated ' + c.rating + '/5)', dimKey: c.dimKey, index: c.index };
    });
  }

  global.SRD_SCORING = {
    scoreDeal: scoreDeal,
    scoreDimension: scoreDimension,
    suggestObjectives: suggestObjectives,
    bandFor: bandFor,
    BANDS: BANDS
  };
})(typeof window !== 'undefined' ? window : globalThis);
