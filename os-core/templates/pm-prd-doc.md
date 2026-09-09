<!-- Template for the pushed document body of a `prd` page (one per bet's project).
     Governed by os-core/schema/pm-content-standard.md, the PM-tool-native
     rendering of contract §3.4's PRD section order. Frontmatter is NOT pushed.
     The local file (prds/<slug>.md) keeps the full §3.1/§3.4 frontmatter plus
     this same TL;DR paragraph, byte-identical, as its stub.

     House style: NO EM DASHES. Use a period, a comma, or parentheses.
     scripts/pm-push.js refuses to push a body containing one.
     Expand every acronym on first use. Terms: meta/glossary.md. -->

> Authored by the <Business> OS. Edit in the OS, not here.   <!-- filled from config/businesses.md by scripts/pm-push.js -->

**TL;DR.** <Bet> helps <who> <do what> by <how>. Status: <stage>, <the one thing
that is true right now>.
<!-- 2 to 4 sentences, byte-identical to the local stub. No forward references. -->

## Problem / Opportunity

<What is broken or missing today, and why it is worth solving now. Concrete, not
abstract: name the moment where it goes wrong.>

## Goals and Non-goals

**Goals**
- <What this bet is trying to achieve, in outcome terms rather than feature terms.>

**Non-goals**
- <What this bet deliberately will NOT do, and one clause on why.>

<!-- Non-goals is ALWAYS present. It is the highest-leverage line in the document:
     it ends scope questions before they are asked. If nothing is out of scope,
     the bet is not scoped yet. -->

## Requirements

<User stories, grouped by priority. Same content a flat list would carry, ordered
so the reason sits in the same sentence as the requirement.>

**Must**
- As a <role>, I can <capability>, so that <outcome>.

**Should**
- As a <role>, I can <capability>, so that <outcome>.

**Could**
- As a <role>, I can <capability>, so that <outcome>.

## Success Metrics

| Metric | Target | Confidence | Actual |
|---|---|---|---|
| <name, acronym expanded on first use> | <hypothesis pre-launch> | <high/medium/low> | <blank until /harvest> |

<!-- Pre-launch, Target is a hypothesis and Confidence is explicit. Actual stays
     empty until /harvest fills it after ship. Where a metric rolls up to the
     north-star in strategy.md, say so on the row. -->

<!-- Delete this section entirely unless ai_feature: true locally. -->
## AI Behavior Contract

- **Primary task:** <what the model is asked to do>
- **Inputs available:** <what it can see>
- **Constraints:** <brand, privacy, compliance>
- **Disallowed:** <PII echo, jailbreak classes, anything it must refuse>

| Case | Expected behavior |
|---|---|
| Happy path | <what good looks like> |
| Edge case | <how it degrades gracefully> |
| Should reject | <what it refuses, and how> |

## Risks

- **<Risk>.** Mitigation: <what reduces it, or what would tell us early>.

## Open questions

- **<Question>.** Resolved by: <who, what evidence, or which command>.

<!-- Risks and Open questions are separate on purpose. A risk carries a
     mitigation; an open question carries whatever will settle it. -->

## Key decisions

- [DEC-XXXX: <title>](<url>)

## Council reviews

- [Council <YYYY-MM-DD>: <bet name>](<url>)

<!-- Delete this section until stage: results locally. -->
## Results

<Appended by /harvest after ship. What actually happened, including the Actual
column above, and what was learned that the spec got wrong.>

## Metadata

- Stage: <discovery | spec | results>
- Created: <YYYY-MM-DD> · Updated: <YYYY-MM-DD>
- Local record: `prds/<slug>.md`
- Glossary: [Glossary: <Business>](<url>)
