/*
 * Scoring tests. Run with: node tests/scoring.test.js
 * No dependencies; the browser modules attach to a global and are loaded directly.
 */
'use strict';
globalThis.window = globalThis;
require('../js/dimensions.js');
require('../js/scoring.js');

var DIMS = window.SRD_DIMENSIONS;
var S = window.SRD_SCORING;

var failures = 0, checks = 0;
function ok(label, cond, extra) {
  checks++;
  if (cond) { console.log('  ok  ' + label); }
  else { failures++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(label, actual, expected) { ok(label + ' (' + JSON.stringify(actual) + ')', actual === expected, { actual: actual, expected: expected }); }
function group(name) { console.log('\n' + name); }

function blank() {
  var d = { id: 'd', name: 'Test', target: '', stage: 'Idea', context: '', weights: {}, dims: {}, objectives: [] };
  DIMS.forEach(function (dim) { d.weights[dim.key] = 3; d.dims[dim.key] = { ratings: [0, 0, 0], notes: '', conditions: [] }; });
  return d;
}
function setAll(d, value) { DIMS.forEach(function (dim) { d.dims[dim.key].ratings = [value, value, value]; }); return d; }

group('Empty deal');
(function () {
  var r = S.scoreDeal(blank());
  eq('overall is null when nothing is rated', r.overall, null);
  eq('coverage is zero', r.coverage, 0);
  eq('every dimension score is null', r.dims.every(function (x) { return x.score === null; }), true);
  ok('summary prompts the user to start', /Nothing has been rated/.test(r.summary[0].text));
})();

group('Dimension averaging ignores unrated statements');
(function () {
  var d = blank();
  d.dims.fit.ratings = [4, 2, 0];
  var r = S.scoreDimension(d, 'fit');
  eq('average of the two rated statements', r.score, 3);
  eq('rated count', r.ratedCount, 2);
  ok('notes that a statement is unrated', r.feedback.some(function (f) { return /1 of 3 statements still unrated/.test(f.text); }));
})();

group('Overall score is weighted');
(function () {
  var d = setAll(blank(), 3);
  eq('uniform ratings give that score', S.scoreDeal(d).overall, 3);

  d = blank();
  d.dims.fit.ratings = [5, 5, 5];
  d.dims.value.ratings = [1, 1, 1];
  eq('equal weights give the midpoint', S.scoreDeal(d).overall, 3);
  d.weights.value = 5; d.weights.fit = 1;
  eq('heavier weight on the weak dimension pulls the score down', S.scoreDeal(d).overall, 1.7);
  d.weights.value = 1; d.weights.fit = 5;
  eq('heavier weight on the strong dimension pulls it up', S.scoreDeal(d).overall, 4.3);
})();

group('Bands');
(function () {
  eq('4.5 is strong', S.bandFor(4.5).key, 'strong');
  eq('4.0 is well-supported', S.bandFor(4.0).key, 'supported');
  eq('3.0 is developing', S.bandFor(3.0).key, 'developing');
  eq('2.0 is weak', S.bandFor(2.0).key, 'weak');
})();

group('Feedback identifies what is weak');
(function () {
  var d = blank();
  d.dims.risk.ratings = [1, 3, 5];
  var r = S.scoreDimension(d, 'risk');
  ok('low rating produces the weak message', r.feedback.some(function (f) { return f.level === 'weak' && f.text === DIMS[5].statements[0].weak; }));
  ok('middling rating produces the partial message', r.feedback.some(function (f) { return f.level === 'partial' && f.text === DIMS[5].statements[1].partial; }));
  ok('spread inside a dimension is called out', r.feedback.some(function (f) { return /inconsistent/.test(f.text); }));

  var d2 = blank();
  d2.dims.fit.ratings = [5, 5, 5];
  ok('high ratings without evidence are challenged', S.scoreDimension(d2, 'fit').feedback.some(function (f) { return /little or no evidence/.test(f.text); }));
  d2.dims.fit.notes = 'Strategy paper section 3.2 names this gap; board minutes from March confirm the priority.';
  ok('recorded evidence clears that warning', !S.scoreDimension(d2, 'fit').feedback.some(function (f) { return /little or no evidence/.test(f.text); }));
  ok('a fully strong dimension is recognised', S.scoreDimension(d2, 'fit').feedback.some(function (f) { return f.level === 'strength'; }));
})();

group('Dealbreaker flags are independent of the score');
(function () {
  var d = setAll(blank(), 5);
  DIMS.forEach(function (dim) { d.dims[dim.key].notes = 'Evidence recorded in the diligence file and the board paper.'; });
  d.dims.timing.conditions = [{ id: 'c1', text: 'No competing bidder in exclusivity', status: 'unmet' }];
  var r = S.scoreDeal(d);
  eq('score stays at the top of the range', r.overall, 5);
  eq('the dimension is still flagged', r.byKey.timing.dealbreaker, true);
  eq('the deal reports one dealbreaker', r.dealbreakers.length, 1);
  ok('the flag leads the summary', r.summary[0].level === 'flag' && /Potential dealbreaker/.test(r.summary[0].text));
  ok('the summary warns that a high score hides it', /exactly when this kind of flag gets ignored/.test(r.summary[0].text));

  d.dims.timing.conditions[0].status = 'met';
  eq('a met condition clears the flag', S.scoreDeal(d).dealbreakers.length, 0);
  d.dims.timing.conditions[0].status = 'untested';
  var r3 = S.scoreDimension(d, 'timing');
  eq('an untested condition does not flag', r3.dealbreaker, false);
  ok('but it is noted', r3.feedback.some(function (f) { return /still untested/.test(f.text); }));
  d.dims.timing.conditions[0] = { id: 'c1', text: '   ', status: 'unmet' };
  eq('an empty condition never flags', S.scoreDimension(d, 'timing').dealbreaker, false);
})();

group('Cross-dimension coherence');
(function () {
  var d = blank();
  d.dims.fit.ratings = [5, 4, 4];
  d.dims.value.ratings = [2, 2, 2];
  ok('strong fit with weak value logic is challenged', S.scoreDeal(d).summary.some(function (f) { return /Fit without a value mechanism/.test(f.text); }));

  var d2 = blank();
  d2.dims.fit.ratings = [5, 4, 4];
  d2.dims.timing.ratings = [5, 4, 4];
  d2.dims.alternatives.ratings = [2, 2, 2];
  ok('conviction without alternatives is named as confirmation bias', S.scoreDeal(d2).summary.some(function (f) { return /confirmation bias/.test(f.text); }));

  var d3 = blank();
  d3.dims.value.ratings = [5, 4, 4];
  d3.dims.risk.ratings = [2, 2, 2];
  ok('strong value with untested assumptions is challenged', S.scoreDeal(d3).summary.some(function (f) { return /unexamined assumptions/.test(f.text); }));

  var d4 = blank();
  d4.dims.timing.ratings = [5, 4, 4];
  d4.dims.sponsorship.ratings = [2, 2, 2];
  ok('a timing case with no owner is challenged', S.scoreDeal(d4).summary.some(function (f) { return /window with no owner/.test(f.text); }));

  var d5 = blank();
  d5.dims.sponsorship.ratings = [5, 4, 4];
  d5.dims.fit.ratings = [2, 2, 2];
  d5.dims.value.ratings = [2, 2, 2];
  ok('sponsorship carrying an unbuilt case is challenged', S.scoreDeal(d5).summary.some(function (f) { return /Executive enthusiasm/.test(f.text); }));
})();

group('Weakest points are ranked by weight');
(function () {
  var d = blank();
  d.dims.fit.ratings = [2, 2, 2];
  d.dims.value.ratings = [3, 3, 3];
  d.weights.value = 5; d.weights.fit = 1;
  var r = S.scoreDeal(d);
  eq('the heavily weighted dimension leads', r.drags[0].dim.key, 'value');
  ok('the summary explains why weight matters', r.summary.some(function (f) { return /weighted as critical/.test(f.text); }));
})();

group('Equal weights prompt a nudge');
(function () {
  var d = setAll(blank(), 3);
  ok('all-equal weights are called out', S.scoreDeal(d).summary.some(function (f) { return /weighted equally/.test(f.text); }));
  d.weights.value = 5;
  ok('once weights differ, the nudge stops', !S.scoreDeal(d).summary.some(function (f) { return /weighted equally/.test(f.text); }));
})();

group('Objectives come from the strongest rationale');
(function () {
  eq('nothing rated yields no objectives', S.suggestObjectives(blank()).length, 0);

  var d = blank();
  d.dims.fit.ratings = [5, 4, 1];
  d.dims.risk.ratings = [2, 2, 2];
  var o = S.suggestObjectives(d);
  ok('between two and three objectives are produced', o.length >= 2 && o.length <= 3, o.length);
  eq('the highest-rated statement leads', o[0].dimKey + ':' + o[0].index, 'fit:0');
  ok('weak statements are not used', o.every(function (x) { return !(x.dimKey === 'fit' && x.index === 2); }));
  ok('each objective cites its source', o.every(function (x) { return /rated \d\/5/.test(x.source); }));

  var d2 = blank();
  d2.dims.fit.ratings = [5, 5, 5];
  d2.dims.value.ratings = [5, 5, 5];
  d2.dims.timing.ratings = [5, 5, 5];
  var o2 = S.suggestObjectives(d2);
  eq('at most three objectives', o2.length, 3);
  var used = {};
  o2.forEach(function (x) { used[x.dimKey] = true; });
  ok('drawn from at most two dimensions', Object.keys(used).length <= 2, Object.keys(used));
})();

group('Unassessed dimensions are reported, not counted as zero');
(function () {
  var d = blank();
  d.dims.fit.ratings = [4, 4, 4];
  var r = S.scoreDeal(d);
  eq('overall reflects only what is rated', r.overall, 4);
  eq('five dimensions are unassessed', r.unassessed.length, 5);
  ok('the summary says so', r.summary.some(function (f) { return /5 dimensions not yet assessed/.test(f.text); }));
})();

console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'All ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
