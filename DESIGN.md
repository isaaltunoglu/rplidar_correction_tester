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
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "19px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.65
  measurement:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "35px"
    fontWeight: 700
    lineHeight: 1.65
    letterSpacing: "-0.03em"
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
  control: "10px"
  field: "12px"
  section: "20px"
  column: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "42px"
  button-accent:
    backgroundColor: "{colors.plot-action}"
    textColor: "#122e40"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "42px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    padding: "0"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
  nav-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.blue}"
    rounded: "{rounded.nav}"
    padding: "11px 15px"
  badge-neutral:
    backgroundColor: "#e9eeec"
    textColor: "#50646e"
    rounded: "{rounded.field}"
    padding: "6px 10px"
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
  disclosure:
    textColor: "{colors.blue}"
    padding: "5px 0"
---

# Design System: RPLIDAR Lab

## Overview

**Creative North Star: "The Field Research Station"**

RPLIDAR Lab makes a local measuring instrument approachable to a first-time user. Ink blue horizontal navigation frames an offwhite working ground and a dark plotting surface. Larger Manrope text, familiar controls and short Turkish instructions establish a calm, practical hierarchy. The first visible choices explain the source, direction and result; technical settings remain available through labelled disclosures.

The terracotta angular selection and its plotted wedge retain the instrument's signature. They describe the same software filter, while clear source text distinguishes the USB sensor, computer-generated example and recorded data. Guided tests put preparation before measurement and readable conclusions before statistics. Recording is explained as measurement data rather than video, with playback available directly in the page.

This record refreshes the implemented beginner revision from `index.html`, `web/styles.css`, `web/app.js` and `web/core.js`, following the user's explicit request to simplify confusing experiments, files and playback. It supersedes the earlier dense layout and its rendered approval. The Field Research Station direction and palette remain: candidate 7, seed `5b3a139c`, corroborated by `.impeccable/questions/roll.json`. The original catalog roll was degraded; no quality-bar board or approved comp exists. The retrospective direction contract is `docs/UI_DIRECTION.md`; the explanatory user guide is `docs/QUICKSTART_TR.md`. The fresh finish reviewer returned **ship** after verifying the current captures, empty-recording control fix and persisted design system. This applies to the reviewed rendered software, not a novice user study or physical sensor behavior. Capture evidence and review limits are recorded in `docs/UI_REVIEW.md`.

**Key Characteristics:**

- Ink blue horizontal navigation, paper workspaces and a dark measurement canvas.
- Readable instructions and large direction/result controls before technical detail.
- Terracotta angular selections paired with their plotted sector.
- Guided questions, source-aware preparation and human-readable results.
- Explained recording files and direct in-page playback.
- Local assets, labelled native controls, visible focus and reduced-motion support.

## Colors

The incumbent cool instrument blues, warm paper and restrained terracotta remain normative in the frontmatter.

### Primary

- **Instrument Blue** (`blue`): horizontal navigation, primary actions, links and native range controls.
- **Instrument Blue Wash** (`blue-soft`): quiet action fills and numbered step markers.

### Secondary

- **Terracotta Annotation** (`accent`): angular readouts, text actions and source emphasis on light ground.
- **Terracotta Wash** (`accent-light`): the existing declared light-accent primitive, not a universal highlight fill.
- **Warm Plot Action** (`plot-action`): the prominent simulation action against the dark plot.
- **Terracotta Focus** (`focus`): keyboard focus outlines and the angular ribbon marker.

### Tertiary

- **Observed State Green** (`green`): an existing declared primitive. Source and proximity states use context-specific shades; green alone never supplies a safety conclusion.
- **Alert Red** (`danger`): recording and error emphasis with textual state descriptions.

### Neutral

- **Field Paper** (`paper`): working ground and selected navigation fill.
- **Clean White** (`white`): fields and bounded recording/replay containers.
- **Instrument Ink** (`ink`): text on light surfaces.
- **Muted Ink** (`muted`): subordinate labels and explanations.
- **Divider Grey** (`line`): structural boundaries and disclosure groups.
- **Plot Night** (`plot`): live polar plot and inline replay ground.

**The Source Before Color Rule.** Preserve visible source and state text whenever color indicates live data, simulation, replay, recording or missing data.

**The Paired Annotation Rule.** Keep direction presets, numeric angles and the plotted sector consistent. Color cannot replace the direction or angle description.

## Typography

**Headline and Body Font:** locally served Manrope from `/assets/fonts/manrope.ttf`, with Segoe UI and sans-serif fallbacks; implemented variable weights span (200–800).

**Raw Measurement Font:** UI monospace with a generic monospace fallback, limited to raw measurement cells.

The new reading hierarchy increases body text and controls while keeping units and subordinate explanations distinct. The body line height is (1.65), page-introduction paragraphs use (1.7), and detailed result explanations use (1.85). Ordinary paragraphs retain a maximum measure (75ch). Sentence case Turkish labels explain actions and data before file-format or statistics terminology.

### Hierarchy

- **Headline:** page headings use the headline token, with weight (750), line height (1.3) and tracking (-0.035em); responsive sizes are (27px) below (1050px) and (26px) below (760px).
- **Title:** general section headings use the title token, weight (750) and line height (1.5). Guided page/result headings use contextual sizes (18–23px); ordinary subheads use (16px).
- **Body:** the body token supplies instructions and explanations. Mobile introductions and test explanations use (14px), while ordinary body text remains (15px).
- **Label:** field labels use the label token; controls use (14–15px) on desktop. Secondary helpers use (13px), and plot state labels and footer metadata are at least (12px). Mobile navigation is (12px); mobile source selection is (16px).
- **Measurement:** the nearest-object result uses the measurement token and tabular numerals; mobile uses (32px). Units use (17px). Technical telemetry, initially disclosed closed, uses (25px). Recording totals use (30px), reduced to (28px) on mobile.
- **Raw:** raw cells retain the raw token; ordinary tables use Manrope (13px) with tabular numerals.

**The Aligned Values Rule.** Use tabular numerals for measurements, angles, elapsed time and data tables. Keep units visible and distinguish a missing measurement from zero.

## Layout

The shell uses horizontal ink blue navigation on all viewports. On desktop the brand sits left and the four destinations right, with header padding (20px 32px). The workspace occupies the full width. A secondary top bar has a minimum height (56px). Main content has a maximum width (1440px) and padding (26px 32px) at its top and sides.

The live page presents numbered source, direction and result steps. A source-choice band puts its explanation beside a selector (280px) on desktop. Below it, direction presets and the nearest-object result occupy a left column (310px); the plot occupies the flexible right column, separated by (32px). The interface uses dividers and open spacing rather than a dashboard of metric cards. Technical telemetry, filters, raw tables and exports start closed.

Guided tests use a centered column with maximum width (900px): a question selector, three preparation steps, reference/duration fields, start action and readable result. Desktop recording and playback use columns in the ratio (1:1.2), with a gap (28px); the player includes its own dark preview. A file-purpose glossary separates readable reports, recordings, single scans, tables and technical test evidence.

Responsive behavior is source-backed and captured in Chrome at desktop (1512 × 1100) and mobile (390 × 844). These are sampled viewports, not an exhaustive device study:

- At (1050px) and below, header padding and gaps tighten; the direction column becomes (280px), main side padding becomes (24px), and recording/playback stack.
- At (760px) and below, brand and four-item navigation form a top header, the breadcrumb is hidden, and main side padding becomes (16px). Source selection stacks with its explanation; the source select has a minimum height (46px).
- The mobile live sequence is direction choices, optional angle disclosure, plot, readable result, advanced settings, explanation and recording action. The four direction presets remain visible as a row. Technical telemetry stacks inside its closed disclosure.
- Guided fields stack on mobile, preparation and result panels reduce their padding, the file glossary becomes a vertical list, and table wrappers preserve horizontal scrolling.

The main plot uses aspect ratio (1.5), minimum height (380px) and maximum height (560px) on desktop. Below (1050px) its ratio becomes square with minimum height (390px); below (760px) its minimum is (345px), maximum (460px). The polar drawing reserves bottom label room. Inline replay is (320px) high, reduced to (300px) on mobile.

**The Explain Then Reveal Rule.** Present the useful next action and readable result first. Place filters, statistics and raw file exports in clearly labelled disclosures that start closed.

## Elevation & Depth

Resting surfaces remain flat. Tonal contrast, fine dividers and generous grouping create structure. Preparation and readable test results share a pale blue-grey fill (`#eaf0f1`); recording and playback use white bordered containers. The toast alone uses the existing soft shadow (`0 8px 25px #00000029`). Keyboard focus is an outline (3px) with an offset (3px).

Page activation retains a clipped reveal (0.28s, `cubic-bezier(0.16, 1, 0.3, 1)`). Button background and border transitions use (0.15s, ease). Reduced-motion preferences remove animations and transitions.

**The Flat Instrument Rule.** Use borders, spacing and tonal surfaces for persistent structure; reserve the documented soft shadow for transient feedback.

## Shapes

Fields and badges use the field radius, buttons and replay boundaries the control radius, preparation/result panels and navigation the navigation radius, recording/playback containers the container radius, and the main plot the plot radius. Numbered step markers are circular (27px). Direction presets are large bounded buttons with a short explanatory subtitle; the selected subtitle uses a darker readable tone.

Iconography is shared inline stroked SVG with rounded caps and joins. General icons are (19px), action icons (17px); external links use the shared SVG symbol. Do not replace these with glyph characters. Native selects, number inputs, range controls and disclosure elements retain familiar shapes and keyboard behavior.

## Components

### Buttons

Primary actions use Instrument Blue with white text, secondary actions a white fill and fine border, and the empty plot's simulation action Warm Plot Action. Shared desktop padding and minimum height are specified in the frontmatter; `height` describes the minimum, not a fixed cap. Most actions use text (14px); test start actions use (15px). Mobile small top-bar actions use minimum height (36px), while ordinary actions retain the larger shared target.

Hover changes the fill and secondary border tone; disabled controls use opacity (0.48) and a not-allowed cursor. The plot download action stays dark with pale text and uses a lighter dark hover fill with white text. Focus remains visibly outlined. Text actions use terracotta with an underline on hover.

### Fields and direction presets

Fields use white fill, fine grey borders and field-radius corners, with text (15px), padding (9px 12px) and minimum height (44px). Labels explain the requested unit before input. Guided reference distance accepts centimetres with the example “100 cm = 1 metre”; internal millimetres remain a technical detail. The question selector is larger (17px, minimum height 50px) on desktop.

Direction presets use a two-by-two desktop grid with minimum height (61px), switching to four visible mobile options with minimum height (68px). They combine a familiar direction name, a short subtitle and selected styling. An optional custom-angle disclosure retains the ribbon and numeric controls.

### Navigation and source state

The horizontal ink blue header uses pale text, SVG icons and a paper-filled active destination with weight (750). Desktop items use padding (11px 15px) and text (14px). Mobile destinations wrap in a four-column grid with minimum height (68px). Source badges and notices retain explicit labels for sensor, computer example, recording, disconnected, paused and stale states. Source transitions clear prior data and reject stale-generation events until acknowledgment.

### Disclosures and guided tests

Native disclosures use blue summary text (14px, weight 700) with a minimum summary height (34px). Labels tell users what they gain by opening a section: different angles, advanced image settings, technical measurements, calculation details, chart, earlier tests or file details. The default beginner view does not require these sections.

Six test questions share source-aware preparation, a three-step explanation, reference/duration inputs and a readable result. Simulation preparation explicitly avoids asking users to place a physical object; the distance example includes a “100 cm” target preparation action. Result summaries explain values in centimetres and offer a human-readable HTML report. Statistics, chart and raw evidence remain available through disclosures.

### Containers, recording and playback

Recording and playback use white bordered containers with internal padding (25px), reduced to (20px) on mobile. Source, duration and measurement count explain what exists before the next action. Copy states that a recording contains measurement points and timing, not video, photographs, object names or colors.

A completed in-memory recording can be watched directly; the watch action remains disabled while no frames exist or a conflicting operation locks the controls. The inline player displays a dark canvas, play/stop/rewind actions, a time scrubber, named speed choices and elapsed/total time. Saving a recording file and opening one later are separate explicit actions. The file glossary explains each purpose; an incorrect JSON kind produces a plain explanation rather than treating all JSON files as interchangeable.

### Plot, results and technical data

The dark plot pairs selected direction with a pale terracotta wedge and selected returns. Its toolbar uses minimum height (52px) and padding (12px 16px), reduced to (12px) all around on mobile. Labels and readouts retain a (12px) minimum. Empty copy distinguishes disconnected, paused, stale and transitioning sources. The textual nearest-object result follows the plot on mobile and remains beside it on desktop.

Technical tables use thin separators, tabular numerals and overflow wrappers; raw cells add monospace. History and experiment charts show measured or explicitly simulated data. No synthetic sweep or invented live value fills an unavailable state, and no missing return is interpreted as proof of free space.

## Do's and Don'ts

### Do:

- **Do** preserve the horizontal ink blue header, paper working ground and dark plots.
- **Do** explain source, direction and the readable result before technical detail.
- **Do** retain labelled, initially closed disclosures for advanced controls and raw evidence.
- **Do** pair source color with source text and honest unavailable-data explanations.
- **Do** keep direction presets, angle values and the plotted sector consistent.
- **Do** explain a file's purpose before asking a beginner to save or open it.
- **Do** preserve local Manrope, tabular measurements, labelled native inputs, visible focus and reduced motion.
- **Do** obtain a revision-specific rendered review after material layout or workflow changes.

### Don't:

- **Don't** fabricate live measurements or draw a decorative scanning sweep.
- **Don't** present missing returns or proximity color as a safety conclusion.
- **Don't** require raw statistics, file-format knowledge or a download to understand the basic workflow.
- **Don't** call measurement recordings video or imply every JSON file is playable.
- **Don't** turn every measurement group into an elevated card.
- **Don't** substitute glyph characters for the shared SVG icons.
- **Don't** present rendered review as a novice user study or physical sensor validation.
