---
name: high-end-visual-design
description: 'Use when the user explicitly requests premium, agency-quality, or luxury visual design instead of design-taste-frontend - exact fonts, spacing, shadows, and animations; blocks cheap AI defaults.'
disable-model-invocation: true
---

# High-End Visual Design

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Typography does the work.** Editorial pairings, generous spacing. No system fonts in prod.
- **Restraint signals quality.** Less is more. Empty space is content.
- **Real type families.** Inter, Söhne, GT America, Editorial New, Migra, etc.
- **Real motion.** Spring physics, view transitions, 60fps. No bounces.
- **Real photography.** No stock, no AI-generated generic.
</EXTREMELY-IMPORTANT>

## Typography (Editorial)

- **Display**: a serif or display sans (Editorial New, Migra, GT Sectra, Migra, Fraunces) for hero
- **Body**: a clean grotesque (Söhne, Inter, GT America) for body
- **Mono**: a real mono (Berkeley Mono, JetBrains Mono) for code
- Sizes: 14-16 body, 18-20 subhead, 24-32 section, 48-96 hero, 120+ display
- Letter-spacing: tight (-0.02em) for display, normal for body
- Pair display + body + mono, never more

## Color (Restrained)

- **One brand color, used once or twice.** Not everywhere.
- **Neutrals**: 9-step warm/cool ramp, not pure black/white
- **Accents**: status only (success, warn, error)
- High-contrast for hero, low-contrast for body
- Test on real device, light + dark

## Spacing

- 8pt base scale, generously applied
- Section padding: 96-160px desktop, 48-80px mobile
- Hero: 30-50% of viewport height
- Whitespace is the design — don't fill

## Imagery

- **Photography**: real, specific, professional. Custom shoots > Unsplash.
- **Illustration**: custom style, not generic. Editorial illustration if budget allows.
- **Iconography**: minimal, single-style (line OR fill, not both), 1.5-2px stroke
- **No stock photos of "people pointing at screens"**
- **No AI-generated portraits** (uncanny valley, dated fast)

## Motion

- **Real physics**: spring(0.6, 0.8) for entrances
- **View transitions API** for page-to-page (where supported)
- **No bounces, no elastic, no easeInOutBack** (LLM defaults)
- **60fps target**. `transform` + `opacity` only.
- **Reduced motion** is first-class.

## Detail Level

- Custom cursor on hero (where appropriate)
- Hover states with intent (color shift, slight scale, underline animation)
- Loading skeletons that match the actual layout
- Error states with character (illustrated, helpful, not apologetic)
- Empty states that teach (illustration + CTA)

## Anti-Patterns (LLM premium defaults)

Centered everything; gold/silver gradients; glassmorphism; "AI" purple/blue; abstract gradient hero; stock laptops; "tap to learn more"; 3-line testimonials; 20-logo "trusted by"; "we are passionate"; lorem ipsum; missing focus.

## The "Agency" Test

If you showed this to a creative director at a top agency, would they say "nice work" or "I've seen this 100 times"? Aim for "nice work" — meaning the design has a perspective, not just a template.

## Red Flags

System fonts in production; "AI purple" accent; abstract gradient hero; stock photos; bounce animations; emoji in copy; "trusted by" with fake logos; "we are passionate"; "tap to learn more"; lorem ipsum anywhere; multiple accent colors; missing focus states; pure black/white.
