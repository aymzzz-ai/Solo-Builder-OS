<!-- Template for the pushed document body of a `council` page (one per review
     event). Governed by os-core/schema/pm-content-standard.md. Frontmatter is
     NOT pushed. The local file (council/<YYYY-MM-DD>-<slug>.md) keeps the full
     §3.1/§3.5 frontmatter plus this same TL;DR paragraph, byte-identical, as
     its stub.

     THIS FILE IS THE ONLY AUTHORITATIVE SHAPE FOR A COUNCIL BODY. The skill
     (.claude/skills/council/SKILL.md) renders from here and does not carry a
     competing skeleton of its own.

     House style: NO EM DASHES. Use a period, a comma, or parentheses.
     scripts/pm-push.js refuses to push a body containing one.
     Expand every acronym on first use. Terms: meta/glossary.md. -->

> Authored by the <Business> OS. Edit in the OS, not here.   <!-- filled from config/businesses.md by scripts/pm-push.js -->

**TL;DR.** Verdict: <Expand | Hold | Reduce>. <The one biggest reason.>
<!-- 2 to 4 sentences, byte-identical to the local stub. The verdict leads. It is
     NOT restated as its own heading at the bottom: that taught readers to skip
     to the end for the answer. -->

## Per-persona critique

<One block per persona actually summoned. BULLETS, NOT A PARAGRAPH, and as many
bullets as the substance needs. A real critique routinely carries three distinct
and separately actionable points; compressing them into one bullet loses the two
that were not chosen.

Each bullet leads with a bold label naming what kind of point it is, so the shape
of a critique is visible before it is read. Labels in use: Strength, Risk,
Sequencing, Recommendation, Blocker. Never a transcript.>

**Architecture**
- Strength: <the specific thing that is genuinely solid, and why>
- Sequencing: <what has to land before what>
- Recommendation: <the concrete move, and what it costs to do later instead>

**Design / UX**
- <label>: <point>

**Business / Strategy**
- <label>: <point>

**User Advocate**
- <label>: <point>

**Skeptic**
- Blocker: <the thing that stops this, stated plainly>

## Cross-persona synthesis

**Agreements**
- <Flagged by two or more personas. This is the strongest signal in the review,
  so it goes first. Name which personas converged.>

**Conflicts**
- <Where lenses disagree. State BOTH sides, then how it resolves, or what must be
  traded off if it does not.>

**Blind spots**
- <Caught by only one lens but high-stakes. Name the lens.>

## Recommendation

<The concrete numbered actions. States plainly if this recommends /gate. A council
issues a SCOPE verdict and never mints a decision: decision content goes to
/decision-doc, which owns DEC-XXXX.>

1. **Build** <what, and under what condition>.
2. **Hold** <what, and until what lands>.

## Metadata

- Verdict: <expand | hold | reduce>
- Reviewed: [PRD: <bet name>](<url>)
- Personas: <architecture, design-ux, business-strategy, user-advocate, skeptic>
- Date: <YYYY-MM-DD>
- Local record: `council/<YYYY-MM-DD>-<slug>.md`
- Glossary: [Glossary: <Business>](<url>)
