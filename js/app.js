/*
 * Strategic Rationale Diagnostic — application.
 * Client-side only. State lives in localStorage; Export/Import moves it between devices.
 */
(function () {
  'use strict';

  var DIMS = window.SRD_DIMENSIONS;
  var SCORING = window.SRD_SCORING;
  var RATING_LABELS = window.SRD_RATING_LABELS;
  var WEIGHT_LABELS = window.SRD_WEIGHT_LABELS;
  var STORAGE_KEY = 'srd:data:v1';
  var SCHEMA_VERSION = 1;
  var STAGES = ['Idea', 'Screening', 'Rationale under review', 'Approved to proceed', 'Parked', 'Rejected'];

  /* ---------- utilities ---------- */

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nowIso() { return new Date().toISOString(); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtRelative(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '';
    var m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' h ago';
    var d = Math.round(h / 24);
    if (d < 30) return d + ' d ago';
    return fmtDate(iso);
  }
  function scoreClass(score) {
    if (score === null || score === undefined) return '';
    if (score < 2.5) return 'low';
    if (score < 3.5) return 'mid';
    return 'high';
  }
  function chipClass(band) { return band ? 'chip-' + band.key : 'chip-none'; }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- state ---------- */

  var state = { version: SCHEMA_VERSION, deals: [], activeDealId: null, view: 'deal', compareIds: null };
  var storageOk = true;

  function emptyDimData() { return { ratings: [0, 0, 0], notes: '', conditions: [] }; }

  function newDeal(name) {
    var d = {
      id: uid(), name: name || 'Untitled deal', target: '', stage: STAGES[0], context: '',
      createdAt: nowIso(), updatedAt: nowIso(), weights: {}, dims: {}, objectives: []
    };
    DIMS.forEach(function (dim) { d.weights[dim.key] = 3; d.dims[dim.key] = emptyDimData(); });
    return d;
  }

  /* Bring a deal object (possibly from an older or foreign file) to the current shape. */
  function normalizeDeal(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var d = newDeal(typeof raw.name === 'string' ? raw.name : 'Untitled deal');
    if (typeof raw.id === 'string' && raw.id) d.id = raw.id;
    d.target = typeof raw.target === 'string' ? raw.target : '';
    d.stage = STAGES.indexOf(raw.stage) >= 0 ? raw.stage : STAGES[0];
    d.context = typeof raw.context === 'string' ? raw.context : '';
    d.createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : d.createdAt;
    d.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : d.updatedAt;
    DIMS.forEach(function (dim) {
      var w = Number(raw.weights && raw.weights[dim.key]);
      d.weights[dim.key] = (w >= 1 && w <= 5) ? Math.round(w) : 3;
      var src = (raw.dims && raw.dims[dim.key]) || {};
      var ratings = Array.isArray(src.ratings) ? src.ratings : [];
      d.dims[dim.key].ratings = [0, 1, 2].map(function (i) { var r = Math.round(Number(ratings[i]) || 0); return (r >= 1 && r <= 5) ? r : 0; });
      d.dims[dim.key].notes = typeof src.notes === 'string' ? src.notes : '';
      d.dims[dim.key].conditions = (Array.isArray(src.conditions) ? src.conditions : []).filter(function (c) { return c && typeof c === 'object'; }).map(function (c) {
        return { id: typeof c.id === 'string' ? c.id : uid(), text: typeof c.text === 'string' ? c.text : '', status: ['untested', 'met', 'unmet'].indexOf(c.status) >= 0 ? c.status : 'untested' };
      });
    });
    d.objectives = (Array.isArray(raw.objectives) ? raw.objectives : []).filter(function (o) { return o && typeof o === 'object'; }).map(function (o) {
      return { id: typeof o.id === 'string' ? o.id : uid(), text: typeof o.text === 'string' ? o.text : '', source: typeof o.source === 'string' ? o.source : '' };
    });
    return d;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.deals)) {
        state.deals = parsed.deals.map(normalizeDeal).filter(Boolean);
        state.activeDealId = typeof parsed.activeDealId === 'string' ? parsed.activeDealId : null;
        state.view = ['deal', 'compare', 'about'].indexOf(parsed.view) >= 0 ? parsed.view : 'deal';
        state.compareIds = Array.isArray(parsed.compareIds) ? parsed.compareIds : null;
      }
    } catch (e) {
      storageOk = false;
      console.warn('Could not read saved data', e);
    }
  }

  var save = debounce(function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
      toast('Could not save to this browser\'s storage. Export your data to avoid losing it.');
    }
    var note = $('#storageNote');
    if (note) note.textContent = storageOk ? 'Saved in this browser only. Use Export to back up or move it.' : 'Warning: browser storage is unavailable. Changes will not persist. Export to keep your work.';
  }, 250);

  function activeDeal() {
    for (var i = 0; i < state.deals.length; i++) if (state.deals[i].id === state.activeDealId) return state.deals[i];
    return null;
  }
  function touch(deal) { deal.updatedAt = nowIso(); save(); }

  /* ---------- example deal ---------- */

  function exampleDeal() {
    var d = newDeal('Project Harbor');
    d.target = 'Mid-size fleet-routing software vendor';
    d.stage = 'Rationale under review';
    d.context = 'Trigger: our two largest logistics customers have asked for route optimisation inside our fleet-telematics platform, and a competitor announced a bundled offer last quarter. Building in-house was scoped at 24-30 months. The target came to market through a banker process in Q2.';
    d.weights = { fit: 4, value: 5, alternatives: 3, timing: 4, sponsorship: 3, risk: 3 };
    d.dims.fit.ratings = [4, 5, 3];
    d.dims.fit.notes = 'Routing was named as a platform priority in the FY strategy paper (section 3.2) before the target surfaced. Gap: no optimisation engine; customers churn to bundled competitors. Target sells direct to enterprise; we sell through channel partners, so some GTM friction is expected.';
    d.dims.value.ratings = [4, 3, 2];
    d.dims.value.notes = 'Primary source: revenue synergy from attaching routing to our installed base (about 1,800 fleets). Attach-rate assumptions are top-down; no customer has been asked about willingness to pay. Case assumes the target hits its standalone plan.';
    d.dims.alternatives.ratings = [3, 2, 3];
    d.dims.alternatives.notes = 'Build was scoped and rejected on time. Partnership with a routing API vendor was discussed but not written up. No second target has been assessed on the same criteria.';
    d.dims.timing.ratings = [4, 3, 3];
    d.dims.timing.notes = 'Competitor bundle launches in six months; two customer renewals fall inside that window. Market growth view is largely from the target\'s CIM.';
    d.dims.sponsorship.ratings = [5, 3, 2];
    d.dims.sponsorship.notes = 'COO owns the thesis and would run the target. CFO is cautious about price; CEO supportive. Board has heard an early version only.';
    d.dims.risk.ratings = [3, 2, 2];
    d.dims.risk.notes = 'Critical assumptions: attach rate above 20%, engineering team retained, no lock-in from the target\'s largest customer. Diligence plan not yet mapped to these. No walk-away price agreed.';
    d.dims.fit.conditions = [{ id: uid(), text: 'Target\'s engine can integrate with our telematics data model without a rewrite', status: 'untested' }];
    d.dims.value.conditions = [{ id: uid(), text: 'At least five existing customers confirm willingness to pay for routing', status: 'untested' }];
    d.dims.sponsorship.conditions = [{ id: uid(), text: 'CFO and COO agree a walk-away price before the first bid', status: 'unmet' }];
    d.dims.risk.conditions = [{ id: uid(), text: 'Founding engineering leads commit to a 24-month retention package', status: 'untested' }];
    return d;
  }

  /* ---------- modal & toast ---------- */

  function showModal(opts) {
    return new Promise(function (resolve) {
      var root = $('#modalRoot');
      root.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
          '<div class="modal-body"><h3 id="modalTitle">' + esc(opts.title) + '</h3>' +
          (opts.body ? '<p>' + opts.body + '</p>' : '') +
          (opts.input !== undefined ? '<input class="input mt-12" id="modalInput" value="' + esc(opts.input) + '" placeholder="' + esc(opts.placeholder || '') + '">' : '') +
          '</div>' +
          '<div class="modal-actions">' + opts.actions.map(function (a, i) {
            return '<button class="btn ' + (a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : '') + '" data-modal-idx="' + i + '">' + esc(a.label) + '</button>';
          }).join('') + '</div>' +
        '</div>';
      root.hidden = false;
      var input = $('#modalInput');
      if (input) { input.focus(); input.select(); } else { var first = $('.btn-primary', root) || $('.btn', root); if (first) first.focus(); }
      function done(val) { root.hidden = true; root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(val); }
      function onKey(e) {
        if (e.key === 'Escape') done(null);
        if (e.key === 'Enter' && input && document.activeElement === input) {
          var p = opts.actions.filter(function (a) { return a.kind === 'primary'; })[0];
          if (p) done({ value: p.value, input: input.value });
        }
      }
      document.addEventListener('keydown', onKey);
      root.onclick = function (e) {
        var b = e.target.closest('[data-modal-idx]');
        if (b) { var a = opts.actions[Number(b.getAttribute('data-modal-idx'))]; done({ value: a.value, input: input ? input.value : undefined }); }
        else if (e.target === root) done(null);
      };
    });
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ---------- sidebar ---------- */

  function renderSidebar() {
    var list = $('#dealList');
    if (!state.deals.length) {
      list.innerHTML = '<li class="deal-empty">No deals yet. Create one to start the diagnostic.</li>';
      return;
    }
    var sorted = state.deals.slice().sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
    list.innerHTML = sorted.map(function (d) {
      var r = SCORING.scoreDeal(d);
      var chip = r.overall === null ? '<span class="chip chip-none">—</span>' : '<span class="chip ' + chipClass(r.band) + '">' + r.overall.toFixed(1) + '</span>';
      var flag = r.dealbreakers.length ? '<span class="chip chip-flag" title="Potential dealbreaker">!</span>' : '';
      return '<li><button class="deal-item' + (d.id === state.activeDealId && state.view === 'deal' ? ' active' : '') + '" data-open-deal="' + esc(d.id) + '">' +
        '<div class="deal-item-row"><span class="deal-item-name">' + esc(d.name || 'Untitled deal') + '</span><span class="row" style="gap:4px">' + flag + chip + '</span></div>' +
        '<div class="deal-item-meta"><span>' + esc(d.target || d.stage) + '</span><span>·</span><span>' + esc(fmtRelative(d.updatedAt)) + '</span></div>' +
      '</button></li>';
    }).join('');
  }

  /* ---------- deal view ---------- */

  function renderMain() {
    var main = $('#main');
    $all('.nav-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === state.view); });
    if (state.view === 'compare') { main.innerHTML = compareHtml(); return; }
    if (state.view === 'about') { main.innerHTML = aboutHtml(); return; }
    var deal = activeDeal();
    if (!deal) { main.innerHTML = emptyHtml(); return; }
    main.innerHTML = dealHtml(deal);
    updateSummary();
  }

  function emptyHtml() {
    return '<div class="empty">' +
      '<h1>' + (state.deals.length ? 'Select a deal' : 'Start a diagnostic') + '</h1>' +
      '<p>Rate how well-supported and coherent the strategic rationale for a candidate deal is, across six dimensions. Weight what matters for this deal, flag unmet conditions as potential dealbreakers, and compare candidates side by side.</p>' +
      '<div class="actions"><button class="btn btn-primary" id="emptyNew">+ New deal</button>' +
      (state.deals.length ? '' : '<button class="btn" id="emptyExample">Load an example</button>') + '</div>' +
      '<p class="small muted mt-16">Everything stays in this browser. Nothing is sent anywhere.</p>' +
    '</div>';
  }

  function dealHtml(deal) {
    return '<div class="deal-header">' +
      '<div style="flex:1;min-width:240px">' +
        '<input class="input title-input" data-field="name" value="' + esc(deal.name) + '" placeholder="Deal name" aria-label="Deal name">' +
        '<div class="row small muted mt-8"><span>Created ' + esc(fmtDate(deal.createdAt)) + '</span><span>·</span><span id="updatedAt">Updated ' + esc(fmtRelative(deal.updatedAt)) + '</span></div>' +
      '</div>' +
      '<div class="deal-header-actions">' +
        '<button class="btn btn-sm" data-action="duplicate">Duplicate</button>' +
        '<button class="btn btn-sm" data-action="export-one">Export this deal</button>' +
        '<button class="btn btn-sm" data-action="print">Print</button>' +
        '<button class="btn btn-sm btn-danger" data-action="delete">Delete</button>' +
      '</div>' +
    '</div>' +
    '<div class="deal-grid">' +
      '<div class="deal-col">' +
        contextCardHtml(deal) +
        weightsCardHtml(deal) +
        '<div class="scale-legend" aria-label="Rating scale">' + [1, 2, 3, 4, 5].map(function (n) { return '<span><b>' + n + '</b> ' + RATING_LABELS[n] + '</span>'; }).join('') + '<span class="muted">Click a selected rating again to clear it.</span></div>' +
        DIMS.map(function (dim) { return dimCardHtml(deal, dim); }).join('') +
        objectivesCardHtml(deal) +
      '</div>' +
      '<div class="summary-col"><div class="card" id="summaryCard"></div></div>' +
    '</div>';
  }

  function contextCardHtml(deal) {
    return '<div class="card"><div class="card-head"><div class="card-title-block"><div class="card-kicker">Deal context</div><h2>What is behind this deal?</h2></div></div>' +
      '<div class="card-body stack">' +
        '<div class="field-row">' +
          '<div class="field"><label for="f-target">Candidate target</label><input id="f-target" class="input" data-field="target" value="' + esc(deal.target) + '" placeholder="Company or description"></div>' +
          '<div class="field"><label for="f-stage">Stage</label><select id="f-stage" class="select" data-field="stage">' + STAGES.map(function (s) { return '<option' + (s === deal.stage ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="field"><label for="f-context">Business context or trigger</label>' +
          '<textarea id="f-context" class="textarea" data-field="context" rows="4" placeholder="What happened that put this deal on the table? A customer demand, a competitor move, a capability gap, a banker\'s call, a strategic review...">' + esc(deal.context) + '</textarea>' +
          '<span class="hint">Be specific about the trigger. A rationale that cannot name its trigger is usually a rationale looking for a deal.</span></div>' +
      '</div></div>';
  }

  function weightsCardHtml(deal) {
    return '<div class="card"><div class="card-head"><div class="card-title-block"><div class="card-kicker">Weighting</div><h2>What does this deal hinge on?</h2><p class="card-question">Give more weight to the dimensions this particular deal depends on. Weights change the overall score, not the dimension scores.</p></div></div>' +
      '<div class="card-body"><div class="weights">' + DIMS.map(function (dim) {
        var w = deal.weights[dim.key];
        return '<div class="weight-row"><span class="weight-name">' + esc(dim.name) + '</span><span class="weight-label" id="wl-' + dim.key + '">' + esc(WEIGHT_LABELS[w]) + ' (' + w + ')</span>' +
          '<input type="range" min="1" max="5" step="1" value="' + w + '" data-weight="' + dim.key + '" aria-label="Weight for ' + esc(dim.name) + '"></div>';
      }).join('') + '</div></div></div>';
  }

  function dimCardHtml(deal, dim) {
    var data = deal.dims[dim.key];
    return '<div class="card dim-card" data-dim="' + dim.key + '" id="dim-' + dim.key + '">' +
      '<div class="card-head"><div class="card-title-block"><div class="card-kicker">Dimension</div><h2>' + esc(dim.name) + '</h2><p class="card-question">' + esc(dim.question) + '</p></div>' +
        '<div class="dim-score" id="ds-' + dim.key + '"></div></div>' +
      '<div class="card-body">' +
        dim.statements.map(function (s, i) {
          return '<div class="statement"><div class="statement-text"><span class="n">' + (i + 1) + '</span>' + esc(s.text) + '</div>' +
            '<div class="rating-wrap"><div class="rating" role="group" aria-label="Rating for statement ' + (i + 1) + '">' +
              [1, 2, 3, 4, 5].map(function (v) {
                var on = data.ratings[i] === v;
                return '<button type="button" data-rate="' + v + '" data-idx="' + i + '" class="' + (on ? 'on ' + scoreClass(v) : '') + '" aria-pressed="' + on + '" title="' + esc(RATING_LABELS[v]) + '">' + v + '</button>';
              }).join('') +
            '</div><span class="rating-label" id="rl-' + dim.key + '-' + i + '">' + (data.ratings[i] ? esc(RATING_LABELS[data.ratings[i]]) : '') + '</span></div></div>';
        }).join('') +
        '<div class="field dim-notes"><label for="notes-' + dim.key + '">Evidence and doubts</label>' +
          '<textarea id="notes-' + dim.key + '" class="textarea" data-notes="' + dim.key + '" rows="3" placeholder="What supports these ratings? Documents, data, conversations. What are you unsure about?">' + esc(data.notes) + '</textarea></div>' +
        '<div class="conditions"><div class="conditions-head"><span class="field-label">Conditions and assumptions</span><span class="hint">Anything marked unmet flags this dimension as a potential dealbreaker, whatever the score.</span></div>' +
          '<div id="conds-' + dim.key + '">' + conditionsHtml(dim, data) + '</div>' +
          '<button type="button" class="add-link" data-add-cond="' + dim.key + '">+ Add condition</button></div>' +
        '<div class="feedback" id="fb-' + dim.key + '"></div>' +
      '</div></div>';
  }

  function conditionsHtml(dim, data) {
    if (!data.conditions.length) return '<div class="small muted">None recorded. ' + esc(dim.conditionHint) + '</div>';
    return data.conditions.map(function (c) {
      return '<div class="condition-row ' + esc(c.status) + '" data-cond="' + esc(c.id) + '">' +
        '<input class="input" data-cond-text value="' + esc(c.text) + '" placeholder="' + esc(dim.conditionHint) + '" aria-label="Condition">' +
        '<select class="select ' + esc(c.status) + '" data-cond-status aria-label="Condition status">' +
          ['untested', 'met', 'unmet'].map(function (s) { return '<option value="' + s + '"' + (s === c.status ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('') +
        '</select>' +
        '<button type="button" class="remove-btn" data-remove-cond title="Remove condition" aria-label="Remove condition">×</button></div>';
    }).join('');
  }

  function objectivesCardHtml(deal) {
    return '<div class="card" id="objectivesCard"><div class="card-head"><div class="card-title-block"><div class="card-kicker">Objectives</div><h2>What should the target be measured against?</h2><p class="card-question">The strongest parts of the rationale, translated into two or three concrete objectives. Edit the bracketed values so each one is measurable.</p></div></div>' +
      '<div class="card-body" id="objectivesBody">' + objectivesBodyHtml(deal) + '</div></div>';
  }

  function objectivesBodyHtml(deal) {
    var html = '';
    if (deal.objectives.length) {
      html += deal.objectives.map(function (o) {
        return '<div class="objective" data-obj="' + esc(o.id) + '"><div><textarea class="textarea" data-obj-text rows="2" aria-label="Objective">' + esc(o.text) + '</textarea>' +
          (o.source ? '<div class="objective-src">From: ' + esc(o.source) + '</div>' : '') + '</div>' +
          '<button type="button" class="remove-btn" data-remove-obj title="Remove objective" aria-label="Remove objective">×</button></div>';
      }).join('');
      html += '<div class="row mt-12"><button type="button" class="add-link" data-action="add-objective">+ Add objective</button><span class="spacer"></span><button type="button" class="btn btn-sm" data-action="regen-objectives">Regenerate from strongest rationale</button></div>';
    } else {
      var sugg = SCORING.suggestObjectives(deal);
      if (!sugg.length) {
        html += '<p class="small muted">Rate the statements above and suggested objectives will appear here, drawn from the strongest-scoring parts of the rationale.</p>';
        html += '<div class="mt-12"><button type="button" class="add-link" data-action="add-objective">+ Add an objective manually</button></div>';
      } else {
        html += '<div class="suggestion"><div class="small"><b>Suggested from the strongest-scoring rationale</b></div><ol>' + sugg.map(function (s) {
          return '<li>' + esc(s.text) + '<small>' + esc(s.source) + '</small></li>';
        }).join('') + '</ol><div class="row"><button type="button" class="btn btn-primary btn-sm" data-action="adopt-objectives">Use these objectives</button><button type="button" class="add-link" data-action="add-objective">or write your own</button></div></div>';
      }
    }
    return html;
  }

  /* Partial updates so typing never loses focus. */
  function updateDimCard(deal, key) {
    var r = SCORING.scoreDimension(deal, key);
    var ds = $('#ds-' + key);
    if (ds) ds.innerHTML = (r.score === null ? '<div class="num muted">—<small> /5</small></div>' : '<div class="num">' + r.score.toFixed(1) + '<small> /5</small></div>') +
      '<div class="wt">weight ' + r.weight + (r.dealbreaker ? ' · <span style="color:var(--bad);font-weight:600">flag</span>' : '') + '</div>';
    var fb = $('#fb-' + key);
    if (fb) fb.innerHTML = r.feedback.map(function (f) { return '<div class="fb fb-' + f.level + '">' + esc(f.text) + '</div>'; }).join('');
  }

  function updateSummary() {
    var deal = activeDeal();
    if (!deal) return;
    var r = SCORING.scoreDeal(deal);
    DIMS.forEach(function (d) { updateDimCard(deal, d.key); });
    var card = $('#summaryCard');
    if (!card) return;
    var maxW = Math.max.apply(null, r.dims.map(function (d) { return d.weight; }));
    card.innerHTML = '<div class="card-body">' +
      '<div class="card-kicker">Rationale strength</div>' +
      '<div class="overall mt-8">' +
        '<div class="overall-num">' + (r.overall === null ? '<span class="muted">—</span>' : r.overall.toFixed(1)) + '<small> /5</small></div>' +
        '<div class="overall-meta"><div class="overall-band">' + (r.band ? '<span class="chip ' + chipClass(r.band) + '">' + esc(r.band.label) + '</span>' : '<span class="chip chip-none">Not yet rated</span>') + '</div>' +
        '<div class="overall-sub">' + r.coverage + ' of 18 statements rated' + (r.dealbreakers.length ? ' · <span style="color:var(--bad);font-weight:600">' + r.dealbreakers.length + ' potential dealbreaker' + (r.dealbreakers.length > 1 ? 's' : '') + '</span>' : '') + '</div></div>' +
      '</div>' +
      '<div class="bars">' + r.dims.map(function (d) {
        var pct = d.score === null ? 0 : (d.score / 5) * 100;
        return '<div class="bar-row"><span class="bar-name" title="' + esc(d.name) + ' · weight ' + d.weight + '">' + esc(d.short) + (d.dealbreaker ? '<span class="flag" title="Potential dealbreaker">!</span>' : '') + '</span>' +
          '<span class="bar" title="weight ' + d.weight + ' of ' + maxW + '"><i class="' + scoreClass(d.score) + '" style="width:' + pct + '%;opacity:' + (0.45 + 0.55 * (d.weight / 5)).toFixed(2) + '"></i></span>' +
          '<span class="bar-val">' + (d.score === null ? '—' : d.score.toFixed(1)) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="summary-list">' + r.summary.map(function (f) { return '<div class="fb fb-' + f.level + '">' + esc(f.text) + '</div>'; }).join('') + '</div>' +
      '<div class="method-note">Weighted average of dimension scores (bar opacity reflects weight). This measures how well-supported and coherent the rationale is. It does not predict whether the deal will succeed.</div>' +
    '</div>';
    var ua = $('#updatedAt'); if (ua) ua.textContent = 'Updated ' + fmtRelative(deal.updatedAt);
    renderSidebar();
  }

  function refreshObjectives(deal) {
    var body = $('#objectivesBody');
    if (body) body.innerHTML = objectivesBodyHtml(deal);
  }

  /* ---------- compare view ---------- */

  function compareHtml() {
    if (!state.deals.length) {
      return '<div class="empty"><h1>Nothing to compare yet</h1><p>Run at least two candidate deals through the diagnostic and they will appear here side by side.</p><div class="actions"><button class="btn btn-primary" id="emptyNew">+ New deal</button></div></div>';
    }
    var selected = state.compareIds ? state.deals.filter(function (d) { return state.compareIds.indexOf(d.id) >= 0; }) : state.deals.slice();
    if (!selected.length && !state.compareIds) selected = state.deals.slice();
    var results = selected.map(function (d) { return { deal: d, r: SCORING.scoreDeal(d) }; });

    function best(vals) {
      var nums = vals.filter(function (v) { return v !== null && v !== undefined; });
      if (nums.length < 2) return null;
      var m = Math.max.apply(null, nums);
      return nums.filter(function (v) { return v === m; }).length === nums.length ? null : m; // no "best" if all equal
    }
    function numRow(label, getter, fmt, extra) {
      var vals = results.map(getter);
      var b = best(vals);
      return '<tr><th>' + label + '</th>' + results.map(function (x, i) {
        var v = vals[i];
        return '<td class="' + (b !== null && v === b ? 'best' : '') + '">' + (v === null || v === undefined ? '<span class="muted">—</span>' : fmt(v, x)) + (extra ? extra(x) : '') + '</td>';
      }).join('') + '</tr>';
    }
    function textRow(label, getter) {
      return '<tr><th>' + label + '</th>' + results.map(function (x) { return '<td><div class="cell-text">' + getter(x) + '</div></td>'; }).join('') + '</tr>';
    }
    function section(label) { return '<tr class="section"><th>' + label + '</th>' + results.map(function () { return '<th></th>'; }).join('') + '</tr>'; }
    function bar(v) { return '<span class="mini-bar"><i class="' + scoreClass(v) + '" style="width:' + (v / 5 * 100) + '%"></i></span>'; }

    var picker = '<div class="compare-picker">' + state.deals.map(function (d) {
      var on = selected.some(function (s) { return s.id === d.id; });
      return '<label><input type="checkbox" data-compare-toggle="' + esc(d.id) + '"' + (on ? ' checked' : '') + '> ' + esc(d.name || 'Untitled deal') + '</label>';
    }).join('') + '</div>';

    var table = results.length ? '<div class="card"><div class="table-wrap"><table class="compare">' +
      '<thead><tr><th>Dimension</th>' + results.map(function (x) {
        return '<th><div class="compare-deal-head"><button class="add-link" style="text-align:left;padding:0;font-size:14px" data-open-deal="' + esc(x.deal.id) + '">' + esc(x.deal.name || 'Untitled deal') + '</button><span class="sub muted small">' + esc(x.deal.target || x.deal.stage) + '</span></div></th>';
      }).join('') + '</tr></thead><tbody>' +
      section('Overall') +
      numRow('Rationale strength', function (x) { return x.r.overall; }, function (v, x) { return '<b>' + v.toFixed(1) + '</b> /5 <span class="chip ' + chipClass(x.r.band) + '" style="margin-left:6px">' + esc(x.r.band.label) + '</span>'; }) +
      textRow('Potential dealbreakers', function (x) { return x.r.dealbreakers.length ? '<span style="color:var(--bad);font-weight:600">' + x.r.dealbreakers.length + '</span> · ' + esc(x.r.dealbreakers.map(function (d) { return d.name; }).join(', ')) : '<span class="muted">None flagged</span>'; }) +
      textRow('Coverage', function (x) { return x.r.coverage + ' of 18 statements rated'; }) +
      textRow('Stage', function (x) { return esc(x.deal.stage); }) +
      textRow('Last updated', function (x) { return esc(fmtDate(x.deal.updatedAt)) + ' <span class="muted">(' + esc(fmtRelative(x.deal.updatedAt)) + ')</span>'; }) +
      section('Dimensions · score and weight') +
      DIMS.map(function (dim) {
        return numRow(esc(dim.name), function (x) { return x.r.byKey[dim.key].score; }, function (v) { return v.toFixed(1) + bar(v); }, function (x) {
          var d = x.r.byKey[dim.key];
          return '<span class="sub">weight ' + d.weight + (d.dealbreaker ? ' · <span style="color:var(--bad);font-weight:600">unmet condition</span>' : '') + (d.untested.length ? ' · ' + d.untested.length + ' untested' : '') + '</span>';
        });
      }).join('') +
      section('Weakest point') +
      textRow('Held down most by', function (x) { return x.r.drags.length ? esc(x.r.drags[0].dim.name) + ' <span class="muted">(' + x.r.drags[0].dim.score.toFixed(1) + ', weight ' + x.r.drags[0].dim.weight + ')</span>' : '<span class="muted">—</span>'; }) +
      section('Context') +
      textRow('Trigger', function (x) { var t = (x.deal.context || '').trim(); return t ? esc(t.length > 220 ? t.slice(0, 220) + '…' : t) : '<span class="muted">Not recorded</span>'; }) +
      textRow('Objectives', function (x) { return x.deal.objectives.length ? '<ol style="margin:0;padding-left:18px">' + x.deal.objectives.map(function (o) { return '<li>' + esc(o.text.length > 160 ? o.text.slice(0, 160) + '…' : o.text) + '</li>'; }).join('') + '</ol>' : '<span class="muted">None set</span>'; }) +
      '</tbody></table></div></div>' : '<p class="muted">Select at least one deal above.</p>';

    return '<div class="compare-head"><div><div class="card-kicker">Compare</div><h1>Candidate deals side by side</h1><p class="muted small mt-8">Bold green marks the strongest on each row. Scores measure how well-supported each rationale is, not which deal will succeed.</p></div>' +
      '<div class="row"><button class="btn btn-sm" data-action="print">Print</button></div></div>' + picker + table;
  }

  /* ---------- about view ---------- */

  function aboutHtml() {
    return '<div class="prose">' +
      '<div class="card-kicker">Method</div><h1>How the diagnostic works</h1>' +
      '<p>This tool assesses the <b>strategic rationale</b> for a candidate acquisition: how well-supported and internally coherent the reasoning is at the point before diligence begins. It is deliberately not a prediction of deal success. A rationale can be excellent and the deal can still fail; a weak rationale can get lucky. What the tool measures is whether the case, as it stands, could survive a sceptical examination.</p>' +
      '<h2>Six dimensions, eighteen statements</h2>' +
      '<p>Each dimension has three pointed statements. Rate each from 1 (not supported) to 5 (fully supported by evidence). A rating is a judgement about evidence, not about enthusiasm: a 5 means you could show a board member the document, the data, or the conversation that backs it.</p>' +
      '<ul>' + DIMS.map(function (d) { return '<li><b>' + esc(d.name) + '</b>: ' + esc(d.question) + '</li>'; }).join('') + '</ul>' +
      '<h2>Scores</h2>' +
      '<p>A dimension score is the average of its rated statements. The overall rationale-strength score is a weighted average of the dimension scores, using the weights you set. Unrated statements are excluded rather than counted as zero, and the summary tells you how much has been covered.</p>' +
      '<table><tr><th>Score</th><th>Band</th><th>Meaning</th></tr>' + SCORING.BANDS.map(function (b, i) {
        var upper = i === 0 ? '5.0' : SCORING.BANDS[i - 1].min.toFixed(2);
        return '<tr><td>' + b.min.toFixed(2) + ' – ' + upper + '</td><td>' + esc(b.label) + '</td><td>' + esc(b.text) + '</td></tr>';
      }).join('') + '</table>' +
      '<h2>Feedback</h2>' +
      '<p>Every statement rated 1 to 3 produces plain-language feedback about what is actually weak and what to do about it. The tool also checks for patterns across dimensions that a number would hide: high fit with weak value logic, high conviction with untested alternatives, a timing case with no sponsor, and so on. High ratings without recorded evidence are called out, because the point is a well-supported rationale, not a well-scored one.</p>' +
      '<h2>Weights</h2>' +
      '<p>Deals differ in what they hinge on. Set each dimension\'s weight from 1 (minor) to 5 (critical). Weights change only the overall score and the ordering of what is flagged as holding the score down.</p>' +
      '<h2>Dealbreakers</h2>' +
      '<p>Under each dimension you can record conditions or assumptions the rationale depends on, and mark each as untested, met, or unmet. Any unmet condition flags that dimension as a potential dealbreaker. This flag is independent of the score: a rationale can be strong on average and still rest on a condition that has failed.</p>' +
      '<h2>Objectives</h2>' +
      '<p>The strongest-scoring parts of the rationale are translated into two or three objectives the eventual target should be measured against after close. They are templates with bracketed values; make them specific to the deal, and keep them as the standard the acquisition is judged by later.</p>' +
      '<h2>Data</h2>' +
      '<p>Everything is stored in this browser\'s local storage. Nothing is sent to a server. Use <b>Export</b> to download a JSON backup and <b>Import</b> to restore it on another device or browser. Import lets you merge with existing deals or replace them.</p>' +
      (state.deals.length ? '' : '<p class="mt-16"><button class="btn" id="emptyExample">Load an example deal</button></p>') +
    '</div>';
  }

  /* ---------- export / import ---------- */

  function exportData(deals, filenameHint) {
    var payload = { app: 'strategic-rationale-diagnostic', version: SCHEMA_VERSION, exportedAt: nowIso(), deals: deals };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = (filenameHint ? filenameHint.replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'deal' : 'rationale-diagnostic-backup') + '-' + stamp + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Exported ' + deals.length + ' deal' + (deals.length === 1 ? '' : 's') + '.');
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(reader.result); } catch (e) { toast('That file is not valid JSON.'); return; }
      var rawDeals = parsed && Array.isArray(parsed.deals) ? parsed.deals : (Array.isArray(parsed) ? parsed : null);
      if (!rawDeals) { toast('That file does not look like a diagnostic backup.'); return; }
      var incoming = rawDeals.map(normalizeDeal).filter(Boolean);
      if (!incoming.length) { toast('No deals found in that file.'); return; }

      var actions = [{ label: 'Cancel', value: 'cancel' }];
      if (state.deals.length) actions.push({ label: 'Replace all', value: 'replace', kind: 'danger' });
      actions.push({ label: state.deals.length ? 'Merge' : 'Import', value: 'merge', kind: 'primary' });
      showModal({
        title: 'Import ' + incoming.length + ' deal' + (incoming.length === 1 ? '' : 's'),
        body: state.deals.length
          ? '<b>Merge</b> adds new deals and updates existing ones with the same ID when the imported copy is newer. <b>Replace all</b> deletes the ' + state.deals.length + ' deal' + (state.deals.length === 1 ? '' : 's') + ' currently in this browser first.'
          : 'The deals in this file will be added to this browser.',
        actions: actions
      }).then(function (res) {
        if (!res || res.value === 'cancel') return;
        var added = 0, updated = 0, skipped = 0;
        if (res.value === 'replace') { state.deals = incoming; added = incoming.length; }
        else {
          incoming.forEach(function (d) {
            var idx = -1;
            for (var i = 0; i < state.deals.length; i++) if (state.deals[i].id === d.id) { idx = i; break; }
            if (idx < 0) { state.deals.push(d); added++; }
            else if ((d.updatedAt || '') > (state.deals[idx].updatedAt || '')) { state.deals[idx] = d; updated++; }
            else skipped++;
          });
        }
        if (!activeDeal()) state.activeDealId = state.deals.length ? state.deals[0].id : null;
        state.compareIds = null;
        save(); renderSidebar(); renderMain();
        toast('Imported: ' + added + ' added' + (updated ? ', ' + updated + ' updated' : '') + (skipped ? ', ' + skipped + ' unchanged' : '') + '.');
      });
    };
    reader.onerror = function () { toast('Could not read that file.'); };
    reader.readAsText(file);
  }

  /* ---------- actions ---------- */

  function openDeal(id) {
    state.activeDealId = id; state.view = 'deal'; save();
    renderSidebar(); renderMain(); closeSidebar();
    $('#main').scrollTo && window.scrollTo({ top: 0 });
  }
  function createDeal() {
    showModal({ title: 'New candidate deal', body: 'Give it a working name. You can change it later.', input: '', placeholder: 'e.g. Project Harbor', actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', value: 'create', kind: 'primary' }] })
      .then(function (res) {
        if (!res || res.value !== 'create') return;
        var d = newDeal((res.input || '').trim() || 'Untitled deal');
        state.deals.push(d); openDeal(d.id);
        var t = $('.title-input'); if (t && d.name === 'Untitled deal') { t.focus(); t.select(); }
      });
  }
  function loadExample() { var d = exampleDeal(); state.deals.push(d); openDeal(d.id); toast('Example deal loaded. Edit or delete it freely.'); }
  function duplicateDeal(deal) {
    var copy = normalizeDeal(JSON.parse(JSON.stringify(deal)));
    copy.id = uid(); copy.name = deal.name + ' (copy)'; copy.createdAt = nowIso(); copy.updatedAt = nowIso();
    DIMS.forEach(function (dim) { copy.dims[dim.key].conditions.forEach(function (c) { c.id = uid(); }); });
    copy.objectives.forEach(function (o) { o.id = uid(); });
    state.deals.push(copy); openDeal(copy.id); toast('Duplicated.');
  }
  function deleteDeal(deal) {
    showModal({ title: 'Delete "' + deal.name + '"?', body: 'This removes the deal from this browser. It cannot be undone unless you have an export.', actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete', value: 'delete', kind: 'danger' }] })
      .then(function (res) {
        if (!res || res.value !== 'delete') return;
        state.deals = state.deals.filter(function (d) { return d.id !== deal.id; });
        if (state.compareIds) state.compareIds = state.compareIds.filter(function (id) { return id !== deal.id; });
        state.activeDealId = state.deals.length ? state.deals.slice().sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); })[0].id : null;
        save(); renderSidebar(); renderMain(); toast('Deleted.');
      });
  }
  function adoptObjectives(deal, replace) {
    var sugg = SCORING.suggestObjectives(deal);
    if (!sugg.length) { toast('Rate some statements first.'); return; }
    function apply() {
      deal.objectives = sugg.map(function (s) { return { id: uid(), text: s.text, source: s.source }; });
      touch(deal); refreshObjectives(deal);
    }
    if (replace && deal.objectives.length) {
      showModal({ title: 'Replace current objectives?', body: 'The ' + deal.objectives.length + ' objective' + (deal.objectives.length === 1 ? '' : 's') + ' you have now will be replaced with suggestions drawn from the strongest-scoring parts of the rationale.', actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Replace', value: 'ok', kind: 'primary' }] })
        .then(function (res) { if (res && res.value === 'ok') apply(); });
    } else apply();
  }

  function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarBackdrop').classList.add('show'); $('#menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarBackdrop').classList.remove('show'); $('#menuBtn').setAttribute('aria-expanded', 'false'); }

  /* ---------- events ---------- */

  function bindEvents() {
    $('#newDealBtn').addEventListener('click', createDeal);
    $('#exportBtn').addEventListener('click', function () {
      if (!state.deals.length) { toast('Nothing to export yet.'); return; }
      exportData(state.deals);
    });
    $('#importBtn').addEventListener('click', function () { $('#importFile').value = ''; $('#importFile').click(); });
    $('#importFile').addEventListener('change', function (e) { if (e.target.files && e.target.files[0]) importFile(e.target.files[0]); });
    $('#menuBtn').addEventListener('click', function () { $('#sidebar').classList.contains('open') ? closeSidebar() : openSidebar(); });
    $('#sidebarBackdrop').addEventListener('click', closeSidebar);
    $all('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.getAttribute('data-view');
        if (state.view === 'deal' && !activeDeal() && state.deals.length) state.activeDealId = state.deals[0].id;
        save(); renderSidebar(); renderMain(); closeSidebar();
      });
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      var el;

      if ((el = t.closest('[data-open-deal]'))) { openDeal(el.getAttribute('data-open-deal')); return; }
      if (t.id === 'emptyNew') { createDeal(); return; }
      if (t.id === 'emptyExample') { loadExample(); return; }

      if ((el = t.closest('[data-compare-toggle]'))) {
        var id = el.getAttribute('data-compare-toggle');
        var ids = state.compareIds ? state.compareIds.slice() : state.deals.map(function (d) { return d.id; });
        if (el.checked) { if (ids.indexOf(id) < 0) ids.push(id); } else ids = ids.filter(function (x) { return x !== id; });
        state.compareIds = ids; save(); renderMain(); return;
      }

      var deal = activeDeal();
      if ((el = t.closest('[data-action]'))) {
        var action = el.getAttribute('data-action');
        if (action === 'print') { window.print(); return; }
        if (!deal) return;
        if (action === 'duplicate') duplicateDeal(deal);
        else if (action === 'delete') deleteDeal(deal);
        else if (action === 'export-one') exportData([deal], deal.name);
        else if (action === 'adopt-objectives') adoptObjectives(deal, false);
        else if (action === 'regen-objectives') adoptObjectives(deal, true);
        else if (action === 'add-objective') {
          deal.objectives.push({ id: uid(), text: '', source: '' }); touch(deal); refreshObjectives(deal);
          var tas = $all('[data-obj-text]'); if (tas.length) tas[tas.length - 1].focus();
        }
        return;
      }
      if (!deal) return;

      var dimEl = t.closest('[data-dim]');
      var dimKey = dimEl ? dimEl.getAttribute('data-dim') : null;

      if ((el = t.closest('[data-rate]')) && dimKey) {
        var v = Number(el.getAttribute('data-rate')), idx = Number(el.getAttribute('data-idx'));
        var cur = deal.dims[dimKey].ratings[idx];
        deal.dims[dimKey].ratings[idx] = cur === v ? 0 : v;
        touch(deal);
        var group = el.parentNode;
        $all('button', group).forEach(function (b) {
          var on = Number(b.getAttribute('data-rate')) === deal.dims[dimKey].ratings[idx];
          b.className = on ? 'on ' + scoreClass(Number(b.getAttribute('data-rate'))) : '';
          b.setAttribute('aria-pressed', on);
        });
        var lbl = $('#rl-' + dimKey + '-' + idx); if (lbl) lbl.textContent = deal.dims[dimKey].ratings[idx] ? RATING_LABELS[deal.dims[dimKey].ratings[idx]] : '';
        updateSummary(); if (!deal.objectives.length) refreshObjectives(deal);
        return;
      }
      if ((el = t.closest('[data-add-cond]'))) {
        var k = el.getAttribute('data-add-cond');
        deal.dims[k].conditions.push({ id: uid(), text: '', status: 'untested' });
        touch(deal);
        $('#conds-' + k).innerHTML = conditionsHtml(DIMS.filter(function (d) { return d.key === k; })[0], deal.dims[k]);
        var inputs = $all('#conds-' + k + ' [data-cond-text]'); if (inputs.length) inputs[inputs.length - 1].focus();
        updateSummary(); return;
      }
      if ((el = t.closest('[data-remove-cond]')) && dimKey) {
        var cid = el.closest('[data-cond]').getAttribute('data-cond');
        deal.dims[dimKey].conditions = deal.dims[dimKey].conditions.filter(function (c) { return c.id !== cid; });
        touch(deal);
        $('#conds-' + dimKey).innerHTML = conditionsHtml(DIMS.filter(function (d) { return d.key === dimKey; })[0], deal.dims[dimKey]);
        updateSummary(); return;
      }
      if ((el = t.closest('[data-remove-obj]'))) {
        var oid = el.closest('[data-obj]').getAttribute('data-obj');
        deal.objectives = deal.objectives.filter(function (o) { return o.id !== oid; });
        touch(deal); refreshObjectives(deal); return;
      }
    });

    document.addEventListener('input', function (e) {
      var deal = activeDeal(); if (!deal) return;
      var t = e.target, el;

      if (t.hasAttribute('data-field')) {
        var f = t.getAttribute('data-field');
        deal[f] = t.value;
        touch(deal);
        if (f === 'name') renderSidebar();
        var ua = $('#updatedAt'); if (ua) ua.textContent = 'Updated just now';
        return;
      }
      if (t.hasAttribute('data-weight')) {
        var k = t.getAttribute('data-weight'), w = Number(t.value);
        deal.weights[k] = w; touch(deal);
        $('#wl-' + k).textContent = WEIGHT_LABELS[w] + ' (' + w + ')';
        updateSummary(); return;
      }
      if (t.hasAttribute('data-notes')) {
        var nk = t.getAttribute('data-notes');
        deal.dims[nk].notes = t.value; touch(deal);
        debouncedDimRefresh(deal, nk); return;
      }
      if (t.hasAttribute('data-cond-text') || t.hasAttribute('data-cond-status')) {
        var dimEl = t.closest('[data-dim]'), row = t.closest('[data-cond]');
        if (!dimEl || !row) return;
        var dk = dimEl.getAttribute('data-dim'), cid = row.getAttribute('data-cond');
        var cond = deal.dims[dk].conditions.filter(function (c) { return c.id === cid; })[0];
        if (!cond) return;
        if (t.hasAttribute('data-cond-text')) cond.text = t.value;
        else { cond.status = t.value; row.className = 'condition-row ' + cond.status; t.className = 'select ' + cond.status; }
        touch(deal); debouncedSummary(); return;
      }
      if (t.hasAttribute('data-obj-text')) {
        var oid = t.closest('[data-obj]').getAttribute('data-obj');
        var obj = deal.objectives.filter(function (o) { return o.id === oid; })[0];
        if (obj) { obj.text = t.value; touch(deal); }
        return;
      }
    });

    // Keep sidebar relative times fresh.
    setInterval(function () { if (state.deals.length) renderSidebar(); }, 60000);
  }

  var debouncedSummary = debounce(updateSummary, 200);
  var debouncedDimRefresh = debounce(function (deal, key) { updateDimCard(deal, key); renderSidebar(); }, 300);

  /* ---------- boot ---------- */

  load();
  if (state.view === 'deal' && !activeDeal() && state.deals.length) state.activeDealId = state.deals[0].id;
  bindEvents();
  renderSidebar();
  renderMain();
})();
