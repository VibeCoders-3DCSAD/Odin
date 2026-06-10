# Frontend Design Anti-Pattern Standards

Derived from a recursive inspection of the live pages linked from `https://impeccable.style/slop/`, including the main catalog, the `/docs/impeccable` guidance, and all 11 specimen pages under `/antipattern-examples/`.

## Scope inspected

- `/slop`
- `/docs/impeccable`
- `/docs/critique`
- `/designing`
- `/live-mode`
- `/antipattern-examples/purple-gradients.html`
- `/antipattern-examples/lazy-cool.html`
- `/antipattern-examples/lazy-impact.html`
- `/antipattern-examples/thick-border-cards.html`
- `/antipattern-examples/cardocalypse.html`
- `/antipattern-examples/layout-templates.html`
- `/antipattern-examples/inter-everywhere.html`
- `/antipattern-examples/massive-icons.html`
- `/antipattern-examples/bad-contrast.html`
- `/antipattern-examples/redundant-ux-writing.html`
- `/antipattern-examples/modal-abuse.html`

## How to use this standard

Each rule has four parts:

- `Anti-pattern`: what to avoid.
- `Correct pattern`: the team standard.
- `Bad example`: the failure mode shown on the site.
- `Better example`: a concrete rewrite direction.

## Core principles

- Design must look intentional, not statistically average.
- Theme, color, type, layout, and motion must come from a product or brand point of view, not from default generator taste.
- Decorative treatment is not a substitute for hierarchy, clarity, or information architecture.
- Accessibility and readability are baseline requirements, not polish.
- If a UI can be recognized instantly as generic AI output, it fails review.

## 1. Visual details

### 1. Border accent on rounded elements

- `Anti-pattern`: Thick colored left or right borders on rounded cards, callouts, or alerts.
- `Correct pattern`: If the card is rounded, use a full border, a background tint, a leading icon, or no accent at all.
- `Bad example`: The `thick-border-cards` specimen uses heavy side stripes on soft-radius service cards.
- `Better example`: Use a subtle tinted panel with a title, short description, and a small leading marker instead of a 4px colored side rail.

### 2. Glassmorphism everywhere

- `Anti-pattern`: Blur, translucent panels, frosted cards, and glow outlines used as the default visual language.
- `Correct pattern`: Use glass only when it solves a real layering problem, such as content over photography or map overlays.
- `Bad example`: The `lazy-cool` specimen leans on glow, blur, and “future” styling to manufacture depth.
- `Better example`: Use opaque surfaces with strong contrast and a deliberate elevation system.

### 3. Reaching for modals by reflex

- `Anti-pattern`: Large, multi-section workflows forced into a modal.
- `Correct pattern`: Put anything complex, stateful, or scroll-heavy on its own page or in an inline panel.
- `Bad example`: The `modal-abuse` specimen puts notifications, privacy, export, and API settings into one dialog.
- `Better example`: Open a dedicated settings page with section navigation and persistent save behavior.

### 4. Rounded rectangles with generic drop shadows

- `Anti-pattern`: White card, 16-24px radius, soft shadow, no other idea.
- `Correct pattern`: Make the container system support the content model. Some blocks need borders, some need separators, some need no box at all.
- `Bad example`: Multiple specimen pages wrap content in the same safe rounded panel with a stock shadow.
- `Better example`: Use stronger composition: asymmetric sections, dividers, inset panels, or edge-to-edge groups where appropriate.

### 5. Side-tab accent borders

- `Anti-pattern`: A thick colored strip on one side of a card as the main visual flourish.
- `Correct pattern`: Use hierarchy through spacing, color fields, iconography, or structure instead of side-tab decoration.
- `Bad example`: `thick-border-cards` makes the stripe the most memorable part of every card.
- `Better example`: Highlight an important card with a full background tint and stronger title treatment.

### 6. Sparklines as decoration

- `Anti-pattern`: Tiny charts that signal “data-rich” without conveying readable information.
- `Correct pattern`: Show charts only when users can compare, read, or act on them.
- `Bad example`: The catalog’s sparkline example pairs a large metric with a tiny, meaningless trend graphic.
- `Better example`: Replace the sparkline with a compact but legible chart, or remove it and surface a plain trend label.

## 2. Typography

### 7. Flat type hierarchy

- `Anti-pattern`: Heading, subheading, and body sizes are too close together.
- `Correct pattern`: Use fewer sizes with stronger contrast. A ratio of at least `1.25` between steps is a good floor.
- `Bad example`: The catalog shows heading, subheading, and body text nearly collapsing into one size band.
- `Better example`: Distinguish hero, section, card title, and body with clear jumps in size, weight, and spacing.

### 8. Icon tile stacked above heading

- `Anti-pattern`: A centered or top-stacked rounded-square icon tile above a short feature heading.
- `Correct pattern`: Let icons support the label, not dominate it. Prefer inline, side-by-side, or unboxed icons.
- `Bad example`: `massive-icons` turns the icon tile into the main event and the copy into the footnote.
- `Better example`: Place a small icon to the left of the feature title and let the text carry the value.

### 9. Monospace as “technical” shorthand

- `Anti-pattern`: Switching to monospace to communicate “developer,” “cyber,” or “advanced.”
- `Correct pattern`: Choose typography based on reading function and brand voice, not stereotype.
- `Bad example`: `lazy-cool` uses terminal-flavored wording and code styling as a shortcut to technical credibility.
- `Better example`: Keep body copy in a readable text face and reserve monospace for actual code, data, or tokens.

### 10. Overused fonts

- `Anti-pattern`: Using Inter, Roboto, Open Sans, Lato, Montserrat, or Arial because they are the easiest answer.
- `Correct pattern`: Choose type with a point of view that fits the product or brand.
- `Bad example`: `inter-everywhere` explicitly demonstrates a whole page built from Inter weights alone.
- `Better example`: Pair a distinctive display face with a calm body face, or use one family with real stylistic range and purpose.

### 11. Single font for everything

- `Anti-pattern`: One family across headlines, labels, UI chrome, body, and marketing copy with no tonal shift.
- `Correct pattern`: Build hierarchy through family pairing, weight, optical size, tracking, and case discipline.
- `Bad example`: `inter-everywhere` makes every surface feel tonally identical.
- `Better example`: Use a display face for headings and a quieter sans or serif for body copy and controls.

### 12. All-caps body text

- `Anti-pattern`: Long runs of uppercase text in sentences, paragraphs, or explanatory blocks.
- `Correct pattern`: Reserve uppercase for short labels, eyebrow text, or compact control names.
- `Bad example`: The catalog flags all-caps body text as a readability failure.
- `Better example`: Use sentence case for prose and rely on weight and spacing for emphasis.

## 3. Color and contrast

### 13. AI color palette

- `Anti-pattern`: Purple-to-blue gradients, cyan on dark, and default “AI startup” color choices.
- `Correct pattern`: Choose a palette from a deliberate color strategy: restrained, committed, full palette, or drenched.
- `Bad example`: `purple-gradients` uses violet-blue gradients across the hero, CTA, and metrics.
- `Better example`: Pick one anchor hue, tint neutrals toward it, and use saturation sparingly where attention matters.

### 14. Dark mode with glowing accents

- `Anti-pattern`: Near-black background plus colored glow shadows to look futuristic.
- `Correct pattern`: If dark mode is justified, keep lighting subtle and grounded in function.
- `Bad example`: `lazy-cool` depends on dark, neon, and glow to create drama.
- `Better example`: Use a dark theme only when the context demands it, and use quiet separation, not glow spam.

### 15. Defaulting to dark mode for “safety”

- `Anti-pattern`: Picking dark because it feels cooler, or light because it feels safer, without a usage context.
- `Correct pattern`: Decide theme from the actual scene of use.
- `Bad example`: The catalog calls out both reflexes as a retreat from a real design decision.
- `Better example`: Write a one-sentence usage scene and choose the theme that supports it.

### 16. Gradient text

- `Anti-pattern`: Gradient-filled headings, stats, or labels.
- `Correct pattern`: Text should use solid color; emphasis should come from type, spacing, and hierarchy.
- `Bad example`: `purple-gradients` and `lazy-impact` both rely on decorative text treatment and gradient-heavy emphasis.
- `Better example`: Use a single strong text color and reserve gradients for occasional non-text surfaces if needed.

### 17. Gray text on colored backgrounds

- `Anti-pattern`: Neutral gray copy placed over tinted cards or color fields.
- `Correct pattern`: Use a darker shade of the background family or a high-contrast light color.
- `Bad example`: `bad-contrast` demonstrates low-energy gray labels against colored panels.
- `Better example`: On blue surfaces, use blue-black text or near-white text, not unrelated gray.

### 18. Pure black backgrounds

- `Anti-pattern`: Literal `#000000` used as a default dark surface.
- `Correct pattern`: Tint dark neutrals toward the brand hue and reduce chroma near black.
- `Bad example`: The catalog calls pure black harsh and unnatural.
- `Better example`: Use a very dark tinted neutral rather than absolute black.

## 4. Layout and space

### 19. Everything centered

- `Anti-pattern`: Every heading, paragraph, stat, card, and button centered by default.
- `Correct pattern`: Use centered alignment only where the content model truly benefits from it, usually short hero content or isolated CTAs.
- `Bad example`: Several specimen pages center entire sections, flattening rhythm and scan paths.
- `Better example`: Left-align most reading content and use asymmetry to create structure.

### 20. Hero metric layout

- `Anti-pattern`: Big number, tiny label, supporting stats underneath, often with gradient accents.
- `Correct pattern`: Use metrics only when they carry proof or decision value, and design them around the story they tell.
- `Bad example`: `purple-gradients` and `lazy-impact` both lean on stock hero metrics.
- `Better example`: If the metric matters, give it context, comparison, and a reason to trust it.

### 21. Identical card grids

- `Anti-pattern`: Repeating the same icon-heading-text card six or eight times with no pacing or contrast.
- `Correct pattern`: Vary structure according to content importance. Not every feature deserves the same container.
- `Bad example`: `massive-icons` and `layout-templates` show repeated tiles with almost no hierarchy.
- `Better example`: Lead with one primary story block, group secondary items compactly, and mix formats where the content differs.

### 22. Monotonous spacing

- `Anti-pattern`: One spacing token used everywhere, producing no rhythm.
- `Correct pattern`: Tight spacing for local relationships, generous spacing between conceptual groups.
- `Bad example`: `layout-templates` repeats the same structural cadence across block after block.
- `Better example`: Use closer spacing between title and supporting copy, and larger separation between sections or mode changes.

### 23. Nested cards

- `Anti-pattern`: Cards inside cards inside cards, each with its own padding and radius.
- `Correct pattern`: Flatten the hierarchy. Use typography, grouping, and dividers before adding another container.
- `Bad example`: `cardocalypse` is a deliberate example of excessive nesting depth.
- `Better example`: Keep one primary surface, then organize subsections with spacing and list structure.

### 24. Wrapping everything in cards

- `Anti-pattern`: Treating every object as a card whether or not it needs enclosure.
- `Correct pattern`: Use cards only when the content benefits from bounded ownership, affordance, or modularity.
- `Bad example`: Most specimens use cards as the universal answer, even for simple text groups.
- `Better example`: Present secondary metadata as plain rows, not boxed widgets.

### 25. Line length too long

- `Anti-pattern`: Paragraphs running wider than roughly `75ch`.
- `Correct pattern`: Keep reading widths around `65ch` to `75ch`.
- `Bad example`: The catalog explicitly flags oversized text lines as a browser-detected quality issue.
- `Better example`: Apply `max-width` to prose containers and avoid edge-to-edge body copy.

## 5. Motion

### 26. Bounce or elastic easing

- `Anti-pattern`: Bouncy CTAs, springy badges, or elastic transitions used to fake excitement.
- `Correct pattern`: Use smooth deceleration curves such as ease-out quart, quint, or expo.
- `Bad example`: `lazy-impact` is framed around motion-first “look alive” styling.
- `Better example`: Use one clear entrance or feedback animation with a physically believable ease.

### 27. Layout property animation

- `Anti-pattern`: Animating width, height, margin, or padding directly.
- `Correct pattern`: Prefer transform and opacity, or use layout-safe patterns such as `grid-template-rows` when needed.
- `Bad example`: The catalog marks layout-property animation as both visually janky and technically expensive.
- `Better example`: Scale, translate, or fade the element rather than making surrounding layout thrash.

## 6. Interaction

### 28. Every button is a primary button

- `Anti-pattern`: Save, Cancel, Delete, and Learn More all styled with equal visual weight.
- `Correct pattern`: Build a clear action hierarchy with primary, secondary, ghost, and destructive treatments.
- `Bad example`: The catalog’s interaction example shows every action shouting at the same volume.
- `Better example`: Keep one primary action, demote secondary actions, and isolate destructive actions.

### 29. Redundant information

- `Anti-pattern`: Repeating the title in the intro, repeating the label in the helper text, and repeating the CTA in a caption.
- `Correct pattern`: Every text element must add new information.
- `Bad example`: `redundant-ux-writing` repeats “Create Your Account” at page and section level, then repeats every field instruction in three forms.
- `Better example`: Use one heading, one concise intro, and helper text only where it changes behavior or reduces errors.

## 7. Responsive behavior

### 30. Amputating features on mobile

- `Anti-pattern`: Hiding important functions on small screens because the desktop layout does not adapt.
- `Correct pattern`: Preserve capability and adapt the interface model.
- `Bad example`: The catalog cites “Export to CSV not available on mobile” as the wrong move.
- `Better example`: Move secondary actions into a sheet, overflow menu, or stacked action bar instead of removing them.

## 8. General quality

### 31. Cramped padding

- `Anti-pattern`: Text pressed against borders, fills, or hit areas.
- `Correct pattern`: Give bordered or tinted containers at least `8px` of internal padding, usually `12px` to `16px` or more.
- `Bad example`: The catalog shows controls with visibly starved vertical padding.
- `Better example`: Increase interior space until text and touch targets breathe.

### 32. Justified text

- `Anti-pattern`: Fully justified body text on screens without careful hyphenation support.
- `Correct pattern`: Use left-aligned body copy for digital interfaces.
- `Bad example`: The catalog calls out “rivers” of whitespace caused by justification.
- `Better example`: Keep paragraphs ragged-right and tune width, line-height, and paragraph spacing instead.

### 33. Low contrast text

- `Anti-pattern`: Body text that fails WCAG AA contrast.
- `Correct pattern`: Minimum `4.5:1` for normal body text and `3:1` for large text.
- `Bad example`: `bad-contrast` shows washed-out labels and marketing claims on light surfaces.
- `Better example`: Darken text, lighten the background, or simplify the palette until it passes.

### 34. Skipped heading levels

- `Anti-pattern`: Jumping from `h1` to `h3` or otherwise breaking document hierarchy.
- `Correct pattern`: Keep heading levels sequential so assistive tech and outline logic remain intact.
- `Bad example`: The catalog uses an `h1` followed by an `h3` as the canonical failure.
- `Better example`: Use `h2` sections under the page title, then `h3` for subsections inside them.

### 35. Tight line height

- `Anti-pattern`: Multi-line body copy with leading below about `1.3`.
- `Correct pattern`: Body copy should usually sit in the `1.5` to `1.7` range.
- `Bad example`: The catalog frames tight leading as a major readability problem.
- `Better example`: Increase line height until multi-line paragraphs scan without crowding.

### 36. Tiny body text

- `Anti-pattern`: Body copy below `12px`, especially disclaimers and helper text.
- `Correct pattern`: Default body copy should usually be `14px` minimum, `16px` preferred.
- `Bad example`: The catalog calls out unreadable fine print at `9px`.
- `Better example`: If information matters enough to show, size it so it can actually be read.

### 37. Wide letter spacing on body text

- `Anti-pattern`: Tracking above roughly `0.05em` on running text.
- `Correct pattern`: Keep body text tracking neutral; reserve expanded tracking for short uppercase labels only.
- `Bad example`: The catalog notes that wide body tracking slows reading by breaking word shape.
- `Better example`: Use standard tracking for paragraphs and apply spacing only to micro-labels or display treatments.

## Practical review checklist

- Is the visual idea specific to this product, or does it look like a generated template?
- Are theme and palette justified by actual usage context?
- Does typography create hierarchy without relying on decoration?
- Are cards solving a real UI problem, or masking weak structure?
- Is every piece of copy adding information?
- Can the design survive without gradients, glow, blur, and oversized icons?
- Does the mobile version preserve capability?
- Does the page meet baseline readability and accessibility rules?

## Default rewrite moves

When a page fails this standard, the safest corrections are:

- Remove decorative gradients from text.
- Replace side-border accents with tinted surfaces or structural hierarchy.
- Reduce icon size and let copy lead.
- Flatten nested cards into one parent surface with dividers.
- Left-align long-form reading content.
- Replace redundant helper text with one useful sentence or nothing.
- Demote non-primary buttons.
- Move complex modals into real pages.
- Tighten the color system to tinted neutrals plus one intentional accent.
- Fix line length, line height, and contrast before adding new visual flourishes.
