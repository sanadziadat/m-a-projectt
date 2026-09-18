/*
 * Strategic Rationale Diagnostic — dimension definitions.
 *
 * Each dimension has three pointed statements rated 1–5. A high rating means
 * the statement is well-supported by evidence; a low rating means it is not.
 * The diagnostic measures how well-supported and coherent the rationale is.
 * It does not predict whether the deal will succeed.
 *
 * For every statement we also carry:
 *   weak      — plain-language feedback when rated 1–2
 *   partial   — feedback when rated 3
 *   objective — a measurable objective template the eventual target should be
 *               held to if this statement is one of the strongest parts of
 *               the rationale. Square brackets mark values to fill in.
 */
window.SRD_DIMENSIONS = [
  {
    key: 'fit',
    name: 'Strategic fit',
    short: 'Fit',
    question: 'Does this deal serve a strategy that existed before the target did?',
    conditionHint: 'e.g. "Target\'s product roadmap aligns with our platform strategy"',
    strong: 'The strategic case is anchored in a pre-existing strategy, the gap it fills is nameable, and the target would sit inside the current operating model.',
    statements: [
      {
        text: 'The deal advances a strategy the company had already articulated before this target appeared. It is not a strategy written to justify the target.',
        weak: 'The strategy looks reverse-engineered from the target. Ask where this need was documented before the target surfaced. If nowhere, fit is an impression, not a rationale.',
        partial: 'The strategic link exists but is loose. Tighten it by pointing to the specific strategy document, board paper, or plan the deal serves.',
        objective: 'Within [12] months of close, the target\'s contribution to [the articulated strategic priority] is reported against the strategy\'s own KPIs, not against deal-specific measures.'
      },
      {
        text: 'We can state in one sentence which specific capability, market, or position this deal gives us that we lack today.',
        weak: 'The gap this deal fills cannot be stated crisply. Until it can, every other part of the rationale is built on an undefined foundation.',
        partial: 'The gap is described but not sharply. A one-sentence statement that a sceptical board member could repeat back is the test.',
        objective: 'The gap named in the rationale ([capability / market / position]) is measurably closed by [date], tracked as [metric, e.g. share in segment, capability live in production].'
      },
      {
        text: 'The target\'s core business would sit inside our operating model without forcing changes to how we go to market or run the business.',
        weak: 'The target would require operating-model changes on our side. That may be acceptable, but it is an integration cost currently being counted as fit.',
        partial: 'Some operating-model friction is expected. Name it explicitly so it is treated as an integration cost rather than absorbed into the fit argument.',
        objective: 'The target operates within our existing operating model with no more than [N] structural exceptions (separate sales motion, separate pricing, separate systems) at [month 12].'
      }
    ]
  },
  {
    key: 'value',
    name: 'Value creation logic',
    short: 'Value',
    question: 'Is there a single, mechanistic explanation of where the value comes from?',
    conditionHint: 'e.g. "Run-rate cost synergies of at least [X] are achievable within 24 months"',
    strong: 'A primary value source is named, each synergy has a mechanism and an owner, and the case does not collapse if the target underperforms modestly.',
    statements: [
      {
        text: 'The primary source of value is named (cost synergy, revenue synergy, capability, market access, or multiple arbitrage), and it is one primary source rather than a list.',
        weak: 'Value is described as a list of possibilities rather than one primary mechanism. Lists of synergies usually mean no single one has been tested hard enough to lead.',
        partial: 'A primary source is implied but competes with secondary ones for attention. Rank them and say which one the deal stands or falls on.',
        objective: 'Deliver the primary value source: [amount / metric] of [cost synergy / revenue synergy / capability / market access] by [end of year 2], reported separately from the target\'s standalone performance.'
      },
      {
        text: 'Each claimed synergy has an identified mechanism, meaning who does what differently after close, not just a number.',
        weak: 'Synergies are numbers without mechanisms. A number with no "who does what differently" behind it is a placeholder, not a plan.',
        partial: 'Some synergies have mechanisms, others are still top-down estimates. Separate the two and only count the first in the base case.',
        objective: 'Every synergy line has a named owner and a dated milestone plan; [80]% of milestones are hit by [month 18] and slippage is reported to the deal sponsor monthly.'
      },
      {
        text: 'The value case survives if the target\'s standalone plan is missed by a reasonable margin.',
        weak: 'The case depends on the target hitting its own plan. Sellers\' plans are rarely missed downward by less than 10 to 20 percent. The rationale has no margin of safety.',
        partial: 'The case has some buffer but it has not been stress-tested explicitly. Run the downside and record at what miss the deal stops making sense.',
        objective: 'The combined case still clears the investment hurdle if the target\'s standalone revenue is [15]% below its plan at [month 24]; this downside is tracked as a formal scenario.'
      }
    ]
  },
  {
    key: 'alternatives',
    name: 'Alternatives considered',
    short: 'Alternatives',
    question: 'Was this target chosen against real alternatives, or was it the only option on the table?',
    conditionHint: 'e.g. "Organic build would take longer than [N] months"',
    strong: 'Build, partner, minority stake and do-nothing were each assessed and rejected in writing, and at least one other target was compared on the same criteria.',
    statements: [
      {
        text: 'Organic build, partnership, minority stake, and "do nothing" were each evaluated with a written rationale for rejecting them.',
        weak: 'Alternatives to acquiring have not been written down and rejected. Without that, this is a decision to buy something, not a decision about how to achieve an outcome.',
        partial: 'Some alternatives were considered informally. Convert that into a short written comparison; it is the cheapest possible protection against confirmation bias.',
        objective: 'The target delivers what the rejected alternatives could not: [specific outcome, e.g. time-to-market of X months versus Y for organic build], verified at [month 12].'
      },
      {
        text: 'At least one other acquisition target was seriously assessed against the same criteria.',
        weak: 'This is the only target that has been looked at. A single-candidate process cannot tell you whether this is a good target or just an available one.',
        partial: 'Other targets were screened but not assessed on equal terms. Apply the same criteria to the runner-up and record the result.',
        objective: 'Post-close performance beats the benchmark set by the runner-up target on [the criteria used in the comparison] within [24] months.'
      },
      {
        text: 'The reasons this target beat the alternatives would still hold if the price rose materially.',
        weak: 'The case for this target over the alternatives depends on price. If price is the differentiator, the rationale is opportunistic rather than strategic, and it will erode in negotiation.',
        partial: 'The preference for this target is partly price-driven. State the price at which an alternative would become preferable, before negotiations move it.',
        objective: 'Return on the price actually paid clears [hurdle rate] on the base case, validating the choice over the lower-cost alternatives that were rejected.'
      }
    ]
  },
  {
    key: 'timing',
    name: 'Timing and market context',
    short: 'Timing',
    question: 'Why now, and is the market view our own?',
    conditionHint: 'e.g. "No competing bidder is currently in exclusivity"',
    strong: 'There is an evidence-backed reason to act now, the market view is independently grounded, and the case does not depend on valuations or financing staying where they are.',
    statements: [
      {
        text: 'There is a specific, evidence-backed reason this deal needs to happen now rather than in 12 to 24 months.',
        weak: 'No specific reason for acting now has been established. "Now" is usually driven by availability of the target or by a banker\'s process. Neither is a strategic reason.',
        partial: 'A timing argument exists but rests on assertion. Find the evidence: a competitor move, a regulatory date, a contract cycle, a technology inflection.',
        objective: 'The time-sensitive advantage identified ([window / first-mover position / pre-consolidation entry]) is captured by [date] and measured as [metric].'
      },
      {
        text: 'Our view of the market\'s direction (growth, consolidation, regulation, technology) is grounded in our own evidence, not the target\'s narrative.',
        weak: 'The market view has been taken largely from the target or its advisers. Sellers describe markets in the way that maximises their price. Form an independent view.',
        partial: 'The market view is partly independent. Identify which claims came from the seller and test them against third-party or internal data.',
        objective: 'The market direction assumption ([market metric]) moves as expected within [12] months; a miss triggers a formal review of the thesis.'
      },
      {
        text: 'We have assessed how current valuations and financing conditions affect the case, and the case does not depend on them staying as they are.',
        weak: 'The case has not been tested against a change in valuations or financing conditions. A rationale that works only in today\'s conditions is a market call, not a strategic one.',
        partial: 'Sensitivity to valuation and financing has been looked at but not built into the decision. Set the conditions under which the deal would no longer make sense.',
        objective: 'The case still clears the hurdle rate under [stress scenario: multiple compression of X turns / financing cost of Y%], re-tested at each financing decision.'
      }
    ]
  },
  {
    key: 'sponsorship',
    name: 'Executive sponsorship and alignment',
    short: 'Sponsorship',
    question: 'Does a named executive own this, and do the people who matter agree on why?',
    conditionHint: 'e.g. "Business unit leader agrees to own the integration"',
    strong: 'A named executive owns the thesis, the CEO, CFO and business unit leader agree on the reason for the deal, and the board has heard it without unresolved objections.',
    statements: [
      {
        text: 'A named executive owns the deal thesis and would be accountable for the outcome after close.',
        weak: 'No single executive owns the thesis. Deals without an owner are advocated by the corporate development team and abandoned by everyone else after close.',
        partial: 'An owner is implied but not formally accountable for the outcome. Make the accountability explicit before the rationale goes further.',
        objective: '[Named executive] reports to the board on delivery of the thesis at [quarterly] intervals for [3] years after close, using the objectives in this diagnostic.'
      },
      {
        text: 'The CEO, CFO, and the business unit leader who would run the target agree on why we are doing this.',
        weak: 'The CEO, CFO and the future operator of the target do not share the same reason for the deal. Divergent reasons produce divergent integration decisions.',
        partial: 'Senior leaders broadly agree but would describe the rationale differently. Get one written statement of the rationale that all three sign off.',
        objective: 'Integration decisions requiring CEO, CFO and business unit alignment are resolved within [N] weeks, with no escalation left open beyond [60] days.'
      },
      {
        text: 'The board has heard the rationale in its current form and has not raised unresolved objections.',
        weak: 'The board has not yet heard this version of the rationale, or has raised objections that remain open. An unresolved board objection is a structural weakness, whatever the score.',
        partial: 'The board has heard an earlier version. Confirm the current rationale has been presented and that earlier objections are closed.',
        objective: 'The rationale presented to the board is the one tracked after close; no restatement of the strategic reason for the deal within [3] years.'
      }
    ]
  },
  {
    key: 'risk',
    name: 'Risk to thesis',
    short: 'Risk',
    question: 'Do we know what would have to be true, and what would make us walk away?',
    conditionHint: 'e.g. "Customer concentration below [X]% confirmed in diligence"',
    strong: 'The critical assumptions are written down, each has an evidence test planned for diligence, and there is a stated walk-away condition.',
    statements: [
      {
        text: 'The two or three assumptions that, if wrong, would break the thesis have been written down explicitly.',
        weak: 'The assumptions the thesis depends on have not been written down. If you cannot name what would break the thesis, you cannot test it in diligence.',
        partial: 'Some critical assumptions are identified but the list is long or vague. Reduce it to the two or three that actually break the case.',
        objective: 'Each critical assumption has a leading indicator tracked from day one; [all] indicators remain inside tolerance at [month 12], with breaches reviewed by the sponsor.'
      },
      {
        text: 'For each critical assumption, we have identified what evidence in diligence would confirm or refute it.',
        weak: 'Diligence is not yet designed to test the assumptions that matter. Diligence that is not aimed at the thesis confirms the data room, not the deal.',
        partial: 'Diligence workstreams partly map to the critical assumptions. Make the mapping explicit so each assumption has a named test and a threshold.',
        objective: 'Diligence findings on every critical assumption are documented and closed before signing; post-close variance from the diligence view stays within [X]%.'
      },
      {
        text: 'There is a stated walk-away condition: a finding or price at which we would not proceed.',
        weak: 'There is no stated walk-away condition. Without one, momentum decides the outcome and the rationale becomes a justification for whatever price is eventually agreed.',
        partial: 'A walk-away condition exists informally. Write it down and share it with the sponsor and the board before negotiations begin.',
        objective: 'Walk-away conditions are converted into post-close tripwires ([finding / metric threshold]) with a defined governance response if triggered.'
      }
    ]
  }
];

window.SRD_RATING_LABELS = {
  1: 'Not supported',
  2: 'Weakly supported',
  3: 'Partially supported',
  4: 'Largely supported',
  5: 'Fully supported'
};

window.SRD_WEIGHT_LABELS = {
  1: 'Minor',
  2: 'Below normal',
  3: 'Normal',
  4: 'Important',
  5: 'Critical'
};
