# VLESS Mesh Login/Requests UI — design blueprint

## General tone
- Dark, deep-blue backdrop with subtle radial glows to imply depth. Use layered gradients rather than flat fills.
- Typography: Sora (bold for titles, semibold for labels), high contrast for headers, muted for helper text.
- Glass effect is **selective**: only on beta badge and primary CTAs; core cards remain semi-opaque panels without liquid distortion.
- Roundness: cards radius ~24–28px; inputs radius ~16px; buttons radius ~20px.
- Lighting: soft inner highlights + outer glow only where needed (buttons, badge). Avoid noisy distortions.

## Layout
- Two-column hero: left “Вход”, right “Заявка на регистрацию”. Shared vertical alignment, equal widths, consistent gutters.
- Header stack above: product tag, main H1, supporting paragraph, beta badge in top-right.
- Spacing: generous top padding (~64px), consistent vertical rhythm (16–20px between text blocks, 24px between groups).

## Background
- Layered gradients: `linear-gradient(145deg, #04101b 0%, #0a1f33 100%)` plus radial glows (e.g., rgba(36,170,255,0.14) at top-left, rgba(20,120,255,0.16) at top-right) to create depth.
- No texture noise; keep smooth.

## Cards
- **Login card**: solid dark panel (e.g., rgba(10,20,30,0.92)), subtle outline (1px rgba(255,255,255,0.04)), soft shadow (0 10px 24px rgba(0,0,0,0.35)). No liquid/blur sheen.
- **Request card**: may retain mild glass sheen: background gradient (rgba(16,76,124,0.55) → rgba(5,30,52,0.75)), inset outline 1px rgba(255,255,255,0.05), soft outer glow (0 12px 48px rgba(60,180,255,0.25)).
- Inner padding ~24–26px; maintain consistent line heights.

## Beta badge (only element with liquid glass)
- Pill background rgba(255,255,255,0.04), border 1px rgba(120,220,255,0.18), inner glow shadow.
- Blur halo via pseudo-element: radial gradients with low opacity, subtle pulsing animation (8s, small translate/scale).
- Size: comfortable tap target (~34–38px height), medium weight text.

## Inputs
- Height ~52px, radius 16px.
- Background: transparent-to-dark gradient, thin border rgba(120,220,255,0.18).
- Focus: border-color shift to rgba(120,230,255,0.55), slight background lift.
- Placeholders muted (#7fb1c9).
- Login field accepts plain text (email or login), no browser email validation errors.

## Buttons (CTA) — 3D liquid-glass
- Background gradient (e.g., rgba(100,215,255,0.95) → rgba(18,138,240,0.92)).
- Radii 20px; inner highlights via ::before (top glossy band), soft sparkles via ::after radial gradients.
- Shadows: inset top light, inset bottom dark, outer glow (0 14px 38px rgba(78,208,255,0.5)).
- Hover: slight lift and stronger glow; Active: reset translation.
- Full-width within the form for clarity.

## Text & hierarchy
- H1: large (clamp 40–52px), uppercase, high contrast.
- Section titles (Вход / Заявка на регистрацию): bold, 20–22px.
- Body copy: muted (#7fb1c9), 15–16px; helper texts smaller (13–14px).
- Maintain consistent left alignment; avoid center alignment in forms.

## States & validation
- Show inline error text under form (muted red or desaturated warning), no browser default popups.
- No glass sheen on error surfaces; keep flat, readable.

## Responsive behavior
- Break to single column on <960px; stack cards vertically with maintained padding.
- Ensure buttons and inputs remain full-width on mobile.
- Badge stays top-right; if constrained, move below header but keep separation.

## Assets & effects checklist
- Keep `filter:url(#liquid-distort)` only on elements explicitly allowed (badge, CTA overlays), not on cards/inputs.
- Avoid clip-paths on cards to keep clean geometry; use gradients/blurs instead.
- Background glow layers should not bleed into text areas; ensure sufficient contrast for WCAG legibility in body text.
