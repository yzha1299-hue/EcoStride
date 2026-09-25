# EcoStride accessibility report (WCAG 2.1 AA)

**Target:** WCAG 2.1 level AA across the whole app.
**Build audited:** production build (`vite build` + `vite preview`), 24 September 2026.
**Status:** automated scan, keyboard walkthrough and code review done; the rows marked **TO DO** need a manual run before submission (see "Still to do").

## 1. Tools and method

| Method | What it covers | Pages |
| --- | --- | --- |
| axe-core 4 (via `@axe-core/playwright`, headless Chrome), rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice` | Automatically detectable failures: names, labels, contrast, ARIA, landmarks, headings | All pages reachable without signing in, at 1280 px and 375 px wide |
| Scripted keyboard walkthrough (Playwright, real key presses) | Skip link, focus after navigation, visible focus, map markers, toggles | Home, Active Travel |
| Contrast calculations (WCAG relative-luminance formula) | Every brand colour and badge pairing used in the app | Whole app |
| Code review of every view and component | Labels, error association, live regions, dialog behaviour, alt text, dead links | Whole app, including signed-in pages |
| Lighthouse (Chrome DevTools) | Accessibility score | **TO DO** |
| axe DevTools browser extension | Signed-in pages, which the headless scan can't reach | **TO DO** |
| NVDA + Chrome spot check | Sign-in, event registration, one table page | **TO DO** |

## 2. Automated results

Final axe-core run after fixes (violations / passed rules):

| Page | 1280 px | 375 px |
| --- | --- | --- |
| Home (`/`) | 0 / 36 | 0 / 35 |
| Active Travel (`/active-travel`) | 0 / 49 | 0 / 47 |
| Sign in (`/FireLogin`) | 0 / 43 | 0 / 41 |
| Register (`/FireRegister`) | 0 / 44 | 0 / 42 |
| Reset password (`/forgot-password`) | 0 / 38 | 0 / 41 |
| Access denied (`/unauthorized`) | 0 / 28 | 0 / 33 |

The first run found one critical violation: the role `<select>` on Register had no accessible name (fixed, see section 4).

Lighthouse accessibility scores (**TO DO**; record them here):

| Page | Score | Notes |
| --- | --- | --- |
| Home | | |
| Active Travel | | |
| Events (list and map) | | |
| Manage events | | |
| Event roster | | |
| Event form | | |
| Email registrants | | |
| Sign in / Register | | |

## 3. Manual checklist

| Check (WCAG criterion) | Result | Evidence |
| --- | --- | --- |
| Skip link (2.4.1) | Pass | First Tab on any page shows "Skip to main content"; Enter moves focus to `<main>`. |
| Page titles (2.4.2) | Pass | Every route has its own title, e.g. "Find safe routes \| EcoStride Melbourne", including on first load. |
| Focus order and focus after navigation (2.4.3) | Pass | After following a link, focus moves to the new page's `<h1>`. Dialogs and forms move focus to what changed (new directions, first invalid field, first address match). |
| Visible focus (2.4.7) | Pass | No `outline: none` anywhere; Bootstrap focus rings on controls, a 3 px outline on map markers. |
| Keyboard operation (2.1.1) | Pass | Map markers are focusable and select with Enter or Space; star ratings, toggles, table sorting, pagination and the registration dialog all work by keyboard. |
| No keyboard trap (2.1.2) | Pass | The registration dialog wraps Tab on purpose but closes with Escape, Cancel or Close; the map releases focus with Tab. |
| Labels and instructions (3.3.2, 1.3.1) | Pass | Every input, select and textarea has a `<label>` (or a visually hidden one for table searches). |
| Errors identified and described (3.3.1, 3.3.3) | Pass | Field errors are linked with `aria-describedby`, set `aria-invalid`, are summarised in an alert, and focus moves to the first invalid field. |
| Status messages (4.1.3) | Pass | Registration, cancellation, exports, emails, search results, directions and table sorting/paging are announced through `role="status"`, `role="alert"` or `aria-live` regions that exist before their text changes. |
| Name, role, value (4.1.2) | Pass | Toggles and pressed buttons use `aria-pressed`, sortable headers `aria-sort`, current page `aria-current`, the dialog `aria-labelledby`. |
| Text contrast (1.4.3) | Pass | See section 5; the lowest pairing used is 4.53:1. |
| Non-text contrast (1.4.11) | Pass | Stars 4.7:1 and 5.6:1, map amenity markers 5.1-6.0:1, form borders are Bootstrap defaults. |
| Use of colour (1.4.1) | Pass | Stars differ in shape (★/☆); amenity markers carry a letter (P, W, T); status is always shown as text. |
| Images (1.1.1) | Pass | Informative hero image has alt text; card and story images next to a heading with the same text are `alt=""`. |
| Text alternative for maps (1.1.1) | Pass | Route lists, distances, step-by-step directions and nearby-facility counts are text beside every map; the map region is labelled. |
| Reflow (1.4.10) | Pass | Scanned at 375 px; tables scroll inside their own container, the map shrinks to 20 rem. |
| No dead links or no-op buttons | Pass | All `href="#"` links removed; unbuilt features show a non-interactive "Coming soon" label. |
| Language (3.1.1) | Pass | `<html lang="en">`. |

## 4. Issues found and fixed

| Issue | WCAG | Fix |
| --- | --- | --- |
| No skip link | 2.4.1 | "Skip to main content" link; `<main id="main-content" tabindex="-1">`. |
| Same page title on every page | 2.4.2 | Per-route titles set in the router. |
| Focus stayed on the old link after navigation | 2.4.3 | Focus moves to the new page's `<h1>`. |
| Sign-in, register and reset-password inputs had only placeholders, and the role `<select>` had no name at all (axe: critical) | 1.3.1, 3.3.2, 4.1.2 | Real `<label>` elements, a password hint linked with `aria-describedby`, and proper `<form>`s so Enter submits. |
| Reset-password errors weren't announced and showed raw Firebase messages | 4.1.3, 3.3.3 | `role="alert"` / `role="status"` and friendly messages. |
| Interactive star rating sat inside `role="img"`, which hid its five buttons from screen readers | 4.1.2 | Read-only stars are an image; interactive stars are a labelled group of buttons with `aria-pressed`. |
| Star colours 1.4:1 and 2.0:1 on white | 1.4.11 | 4.7:1 and 5.6:1, plus distinct filled and empty shapes. |
| Rating feedback appeared without being announced | 4.1.3 | Always-present `role="status"`. |
| Signed-in user's role/email used Bootstrap's disabled colour (about 2.5:1) | 1.4.3 | `navbar-text` (about 5.7:1). |
| "Registered" badge at exactly 4.50:1 | 1.4.3 | Darker blue, 5.8:1. |
| Dead links: Gear and Help in the header; About, Privacy, Accessibility and Contact in the footer; "Start audit", "Open carpools", "View guides", "Go", "Log a trip", "Read all" | 2.4.4, honesty | Removed, or replaced by a non-interactive "Coming soon" label. |
| Card and story images repeated the heading next to them as alt text | 1.1.1 | Marked decorative (`alt=""`). |
| Impact page progress bar had no accessible name (Lighthouse) | 4.1.2 | Named by its visible heading "Personal CO2 tracker" (`aria-labelledby`). |
| Table page buttons were small and their borders overlapped (Lighthouse, roster) | 2.5.8 (WCAG 2.2) | Full-size page buttons with a gap between them. |
| Map markers were exactly 24 px and could sit on top of each other (Lighthouse, events map) | 2.5.8 (WCAG 2.2) | 32 px marker target around the same 24 px dot; the map first zooms to fit all markers so nearby ones are drawn apart. |
| "You're registered for ..." was not spoken by NVDA: focus moved to the new Cancel button at the same moment, and NVDA drops queued live-region speech on a focus change (NVDA spot check) | 4.1.3 | The status is written after focus has settled; after cancelling, focus moves to the new Register button instead of being lost. In the dialog, the "now full" message is also attached to the focused Close button with `aria-describedby`. |

Earlier tickets were built to these rules from the start: the registration dialog (focus moved in, trapped, Escape closes, focus returned), the table component (`aria-sort`, labelled searches, accessible pagination, live summary), field-level errors on the event, registration and email forms, and text alternatives for every map.

## 5. Colour contrast

| Pairing | Ratio | Needed |
| --- | --- | --- |
| Brand green `#1b7a4e` text on white / white on brand green (buttons, date badges) | 5.33 | 4.5 |
| Brand dark `#145c3a` text on white / white on it (hover) | 8.01 | 4.5 |
| Brand green on hero soft green `#e8f5ee` | 4.75 | 4.5 |
| Muted text on white / hero / footer / light sections | 6.36-6.73 | 4.5 |
| Footer text `#345044` on `#f6faf7` | 8.39 | 4.5 |
| White on status badges: success, secondary, danger, primary (adjusted) | 4.53 / 4.69 / 4.53 / 5.84 | 4.5 |
| Black on warning badge | 12.88 | 4.5 |
| Error text `#dc3545` on white | 4.53 | 4.5 |
| Amenity markers (white letter on `#0b5ed7`, `#087990`, `#a14a00`) | 5.84 / 5.06 / 6.01 | 3 (graphic) and 4.5 (letter) |

## 6. Screen-reader spot check (NVDA)

**TO DO.** Suggested script (NVDA + Chrome), record what was heard:

1. Sign in: labels read for email and password; a wrong password is announced.
2. Events: Register opens a dialog named "Register for ..."; the name field is read; submitting announces "You're registered for ..."; the card now reads "Registered".
3. Manage events or a roster: the table caption is read; a sortable header reads as a button with its sort state; typing in a column search announces "Showing 1-n of N".

| Step | Heard | Pass/fail |
| --- | --- | --- |
| 1 | | |
| 2 | | |
| 3 | | |

## 7. Known limitations

- **Map imagery.** OpenStreetMap tiles are pictures without text. Everything a user needs from them is also given as text: route lists with distances, step-by-step directions, facility counts and names, and event details.
- **Facility markers aren't in the Tab order.** There can be dozens along a route; they have accessible names, and the same places are listed as text beside the map.
- **Keyboard map panning** relies on Leaflet's built-in arrow-key and +/- handling once the map is focused.
- **PDF exports** use jsPDF's built-in fonts (Western European characters only) and are not tagged PDFs. The CSV export carries the same data and is fully accessible.
- **Third-party pages.** Google's sign-in popup and emails rendered by mail clients are outside the app's control.
- **Service availability.** The public Overpass server sometimes rations requests; the app then says so and offers "Try again" instead of failing silently.

## 8. Still to do before submission

- [ ] Lighthouse accessibility audit on each page in section 2 and record the scores.
- [ ] axe DevTools on the signed-in pages (Events list/map, Manage events, roster, event form, email registrants) and record the results.
- [ ] NVDA spot check (section 6).
