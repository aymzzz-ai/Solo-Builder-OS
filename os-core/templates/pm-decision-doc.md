<!-- Template for the pushed document body of a `decision` page (DEC-XXXX).
     Governed by os-core/schema/pm-content-standard.md. Frontmatter is NOT
     pushed, this is the pushed body only. The local file
     (decisions/DEC-XXXX-<slug>.md) keeps the full §3.1/§3.3 frontmatter plus
     this same TL;DR paragraph, byte-identical, as its stub.

     House style: NO EM DASHES. Use a period, a comma, or parentheses.
     scripts/pm-push.js refuses to push a body containing one.
     Expand every acronym on first use. Terms: meta/glossary.md. -->

> Authored by the <Business> OS. Edit in the OS, not here.   <!-- filled from config/businesses.md by scripts/pm-push.js -->

<!-- Status banner. Include ONLY when status is not current. Delete this line
     entirely for a current decision. -->
**⚠ SUPERSEDED by [DEC-XXXX: <title>](<url>).**

**TL;DR.** We decided to <X>, because <the one dominant reason>. Rejected:
<strongest alternative>, <why not>.
<!-- 2 to 4 sentences, byte-identical to the local stub. No forward references.
     The strongest rejected alternative belongs HERE, not only below: "why did we
     rule out X" is the most common follow-up to "why did we do Y". -->

## Rationale

<The why, in prose. One or two short paragraphs. If this is growing past a screen,
the decision is probably trying to also be a PRD. Split it.>

## Alternatives rejected

- **<option>**: <why not, 1 to 3 sentences>
- **<option>**: <why not, 1 to 3 sentences>

<!-- Optional. Delete this section if there is nothing beyond rationale and
     alternatives. -->
## Detail

<Additional detail that does not fit rationale or alternatives.>

## Metadata

- Discipline: <product | design | engineering | architecture>
- Created: <YYYY-MM-DD> · Updated: <YYYY-MM-DD>
<!-- Include only the rows below that actually apply. No empty rows. -->
- Review: <YYYY-MM-DD>
- Supersedes: [DEC-XXXX: <title>](<url>)
- Superseded by: [DEC-XXXX: <title>](<url>)
- Local record: `decisions/DEC-XXXX-<slug>.md`
- Glossary: [Glossary: <Business>](<url>)
