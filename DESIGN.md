---
name: RPLIDAR Lab
description: A local field research station for traceable LiDAR observation.
colors:
  paper: "#f6f5f0"
  white: "#fff"
  ink: "#193b51"
  muted: "#60717b"
  line: "#dce2df"
  blue: "#123d61"
  blue-soft: "#e5eef3"
  accent: "#a64a29"
  accent-light: "#f9ede5"
  green: "#247364"
  danger: "#b94738"
  plot: "#102c40"
  focus: "#bd5b34"
  plot-action: "#e9a37c"
typography:
  headline:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "clamp(23px, 2.2vw, 31px)"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.6
  measurement:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "-0.045em"
  raw:
    fontFamily: "ui-monospace, monospace"
    fontSize: "12px"
rounded:
  field: "4px"
  control: "5px"
  nav: "6px"
  container: "7px"
  plot: "8px"
spacing:
  compact: "7px"
  control: "8px"
  field: "12px"
  section: "17px"
  column: "24px"
  workspace: "35px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "36px"
  button-accent:
    backgroundColor: "{colors.plot-action}"
    textColor: "#122e40"
    rounded: "{rounded.control}"
    padding: "8px 13px"
    height: "36px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    padding: "0"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  nav-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.blue}"
    rounded: "{rounded.nav}"
    padding: "12px 13px"
  badge-neutral:
    backgroundColor: "#e9eeec"
    textColor: "#50646e"
    rounded: "{rounded.field}"
    padding: "5px 9px"
  container:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "25px"
  plot:
    backgroundColor: "{colors.plot}"
    textColor: "#d8e7ee"
    rounded: "{rounded.plot}"
  angle-ribbon:
    textColor: "{colors.accent}"
---

# Design System: RPLIDAR Lab

## Overview

**Creative North Star: "The Field Research Station"**

RPLIDAR Lab is a compact local instrument: ink blue navigation frames an offwhite working ground, and a dark plotting surface holds the measurements. The character is calm, precise and practical. Separators, aligned values and restrained color communicate structure without turning every group into a card.

A terracotta angular ribbon and the corresponding plotted sector form the signature. They describe the same software selection; the plotted geometry is evidence-bearing rather than decorative. Locally served Manrope gives controls and measurements one consistent voice. Data source, stale data, disconnected hardware, simulation, replay and pause remain explicit product states.

This record refreshes the incumbent direction from `web/styles.css`, `index.html` and the canvas drawing code in `web/app.js`. Visual decisions were delegated in Operate mode. The field research station direction was selected from seven considered directions; the online catalog and generated comparisons were unavailable. No actual desktop or mobile browser screenshots were captured in this sandbox, and this document does not grant visual ship approval. Review evidence and the remaining recapture disposition are recorded in `docs/UI_REVIEW.md`.

**Key Characteristics:**

- Ink blue navigation, offwhite workspaces and a dark measurement canvas.
- Compact controls, deliberate dividers and tabular measurement numerals.
- A terracotta selection ribbon paired with the plotted angular sector.
- Explicit provenance and honest unavailable-data states.
- Local assets, visible keyboard focus and reduced-motion support.

## Colors

The palette combines cool instrument blues with warm paper and restrained terracotta; the frontmatter contains the normative values.

### Primary

- **Instrument Blue** (`blue`): navigation, primary actions, links and native range controls.
- **Instrument Blue Wash** (`blue-soft`): quiet secondary actions and selection context.

### Secondary

- **Terracotta Annotation** (`accent`): angular readouts, text actions and measurement annotations on light ground.
- **Terracotta Wash** (`accent-light`): the existing light accent primitive; do not infer that all highlighted surfaces use this token.
- **Warm Plot Action** (`plot-action`): high contrast action fill against the dark plotting context.
- **Terracotta Focus** (`focus`): the keyboard focus outline and angular ribbon marker.

### Tertiary

- **Observed State Green** (`green`): an existing semantic primitive. Live, proximity and sidebar states also use context-specific green shades in source; green never supplies a safety conclusion by itself.
- **Alert Red** (`danger`): recording and error emphasis. Warnings and proximity states retain their distinct textual descriptions.

### Neutral

- **Field Paper** (`paper`): main working ground and active navigation fill.
- **Clean White** (`white`): form fields and bounded recording/replay containers.
- **Instrument Ink** (`ink`): text on light surfaces.
- **Muted Ink** (`muted`): labels and secondary explanations.
- **Divider Grey** (`line`): structural boundaries and data grouping.
- **Plot Night** (`plot`): full polar plot ground, with its own pale labels and muted contextual points.

**The Source Before Color Rule.** Preserve visible source and state text whenever color indicates live data, simulation, replay, recording or missing data.

**The Paired Annotation Rule.** Keep selection annotations consistent with the plotted sector. Color cannot substitute for the angle values or sector description.

## Typography

**Headline and Body Font:** Manrope, served locally from `/assets/fonts/manrope.ttf`, with Segoe UI and sans-serif fallbacks. The variable face provides the implemented weight range (200–800).

**Raw Measurement Font:** UI monospace with a generic monospace fallback, limited to the raw measurement table.

The hierarchy is compact and functional. Sentence case labels and short explanatory text accompany values; body paragraphs have a maximum measure (75ch). There is no decorative display tier.

### Hierarchy

- **Headline:** page headings use the fluid headline token; narrower layouts set page headings to (24px).
- **Title:** section headings use the title token; small subheads use (13px, weight 750).
- **Body:** the body token supplies the overall reading rhythm.
- **Label:** fields, table labels, helpers and controls use the compact label size. Controls generally use weight (700), helpers weight (400), and field labels weight (650).
- **Measurement:** telemetry uses the measurement token with tabular numerals; responsive overrides use (24px) below (1200px) and (25px) below (680px). Recording totals use (32px), reduced to (28px) on narrow screens.
- **Raw:** raw table cells use the raw token; ordinary tables retain Manrope with tabular numerals.

**The Aligned Values Rule.** Use tabular numerals for measurements, angles, elapsed values and data tables. Keep units visually subordinate without hiding them.

## Layout

The desktop shell has a fixed left navigation rail (218px) and a workspace of the remaining width. A top bar (72px) anchors navigation context and acquisition state. Main content has horizontal working margins (35px), a maximum width (1780px), and compact vertical spacing.

The live view divides a flexible plot from a settings column (280px) with a gap (24px). A four-part telemetry band and directional summary use shared dividers. Recording and device views use two columns; experiments use a selector beside a workbench. Reused spacing is intentionally dense: control gaps (7–8px), paired fields (12px), field separation (17px), and larger working gaps (24–35px).

Responsive changes are source-backed, pending rendered verification:

- At (1600px) and above, settings widen to (305px) and the plot uses a wider aspect ratio (1.6).
- At (1200px) and below, the rail narrows to (190px), working margins to (24px), and settings to (248px).
- At (960px) and below, the rail narrows to (168px); plot and settings stack, settings become a two-column grid, and multi-column secondary pages stack. The decorative connector ribbon and its duplicate note are hidden; labelled angular controls and the plot remain.
- At (680px) and below, navigation becomes a four-item horizontal row above the workspace. Working margins become (16px), telemetry becomes two columns, top actions wrap, and footer content stacks. Tables keep horizontal scrolling rather than compressing measurement columns.

The plot wrapper changes aspect ratio with the layout and uses a minimum height (350px) on desktop, (380px) in the intermediate stacked layout, and (320px) on narrow screens. Canvas content scales to its wrapper. Do not infer mobile clipping or touch usability approval from these source rules.

## Elevation & Depth

Resting surfaces are flat. Tonal contrast and fine borders separate the navigation, paper workspace, plot and bounded form containers. There are no offset panel shadows. The toast is the only elevated overlay, using a soft shadow (`0 8px 25px #00000029`). Keyboard focus is an outline (3px) with an offset (3px), independent of elevation.

Page activation uses a short clipped reveal (0.28s, `cubic-bezier(0.16, 1, 0.3, 1)`). Button background and border transitions use (0.15s, ease). The reduced-motion media query removes animations and transitions.

**The Flat Instrument Rule.** Use borders, spacing and tonal surfaces for persistent structure; reserve the documented soft shadow for transient feedback.

## Shapes

Corners are restrained: fields and badges use the field radius, buttons and table boundaries the control radius, navigation the navigation radius, recording/replay containers the container radius, and the main plot the plot radius. Dots remain circular and communicate state alongside text. Native range inputs and familiar form controls carry adjustment behavior.

Iconography is inline stroked SVG with rounded caps and joins. General icons are (19px) with stroke width (1.65); buttons and navigation use smaller variants. Do not introduce glyph characters as icon replacements.

## Components

### Buttons

Compact, familiar controls carry the operation. Primary actions use Instrument Blue with white text; secondary actions use a white fill, fine grey border and Instrument Ink. The shared control padding and minimum height are specified in the frontmatter; `height` describes the implemented minimum, not a fixed cap. Warm Plot Action marks the prominent empty-plot action. Text actions use Terracotta Annotation without a container.

Hover changes the fill and, for secondary actions, border tone. Focus uses the shared visible outline. Disabled native controls use opacity (0.48) and a not-allowed cursor. Small top-bar controls have a minimum height (31px), reduced to (28px) on narrow screens.

### Fields

White fill, a fine grey border, compact padding and field-radius corners keep number, text and select controls recognizable. Every field retains its visible label; range controls pair a label with a tabular value output. Native controls carry keyboard behavior. File selection keeps the real file input and uses a visible outline on focus within its button.

### Navigation

Instrument Blue surrounds pale navigation text and stroked icons. The selected item uses Field Paper, Instrument Blue text and a stronger weight (750). Hover adds a lighter blue fill. Mobile navigation keeps the four destinations visible and allows their labels to wrap; the auxiliary count, dot and sidebar footer are hidden.

### State badges and notices

Compact badges pair short source labels with restrained state fills: neutral grey, simulation terracotta, live green, replay violet, error red. Source notices repeat the current provenance with explanatory text. Proximity feedback retains neutral, warning, danger and observed-clear treatments; missing data must remain explicit rather than borrowing a green result.

### Containers and tables

Most groups use separators on the paper ground. Recording and replay use white, bordered containers with modest corner rounding and internal padding (25px), reduced on smaller layouts. Tables use a subdued header fill, fine row separators, tabular numerals and an overflow wrapper. Raw data adds monospace; it does not change the surrounding interface type.

### Polar plot and angular ribbon

The plot is a dark bounded instrument surface with toolbar, source watermark, scale, contextual points, selected points, angular sector and footer legend. The terracotta ribbon gives start and end angles on the light settings ground; the plot uses a lighter related terracotta for its wedge boundary and selected points. The wedge follows the actual angular configuration. It is a software filter on physical full-circle coverage.

Plot empty states include an explanation and action. The canvas has a textual measurement alternative. Do not draw a synthetic sweep or fabricate live values to fill unavailable data. The history chart and experiment chart carry measured or explicitly simulated series, not decoration.

## Do's and Don'ts

### Do:

- **Do** retain the ink blue rail, paper ground and dark plot as distinct working surfaces.
- **Do** pair source color with visible source text and unavailable-data explanations.
- **Do** keep the angular controls, ribbon values and plotted sector consistent.
- **Do** use locally served Manrope, tabular data numerals and monospace raw cells.
- **Do** preserve visible focus, native labelled inputs and reduced-motion behavior.
- **Do** verify desktop and mobile rendered states before granting visual ship approval.

### Don't:

- **Don't** fabricate live measurements or add a decorative scanning sweep.
- **Don't** present missing data or a proximity color as a safety conclusion.
- **Don't** turn every measurement group into an elevated card.
- **Don't** substitute glyph characters for the existing SVG icon system.
- **Don't** treat source inspection or DOM tests as a completed browser screenshot review.
