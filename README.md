# Seminex — Frontend Development Structure

Static HTML/CSS multi-portal web application for seminar management.

---

## Entry Point

Open `index.html` in a browser or serve from any static file server.
This is the root landing page — it routes to both portals.

---

## Project Structure

```
seminex-dev/
├── index.html                      ← Entry point. Start here.
│
├── src/
│   ├── attendee/                   ← Attendee portal pages
│   │   ├── signin.html
│   │   ├── signup.html
│   │   ├── home.html
│   │   ├── available-seminar.html
│   │   ├── available-seminar-detail.html
│   │   ├── seminar-detail.html
│   │   ├── your-seminar.html
│   │   ├── history.html
│   │   ├── history-seminar-detail.html
│   │   └── profile.html
│   │
│   ├── org/                        ← Organization portal pages
│   │   ├── org-signin.html
│   │   ├── org-signup.html
│   │   ├── org-home.html
│   │   ├── org-create-seminar.html
│   │   ├── org-your-seminar.html
│   │   ├── org-history.html
│   │   └── org-profile.html
│   │
│   ├── shared/
│   │   └── css/
│   │       ├── tokens.css              ← Design tokens (colors, fonts, spacing)
│   │       └── attendee-portal.min.css ← Attendee typography system
│   │
│   └── assets/
│       ├── svg/                    ← Place seminex-logo-white.svg here
│       └── fonts/                  ← Place self-hosted fonts here (optional)
│
└── public/                         ← Static output for deployment (if needed)
```

---

## Portals

### Attendee Portal — `src/attendee/`
Entry: `signin.html` → `signup.html` → `home.html`

| Page | Purpose |
|------|---------|
| signin.html | Login screen |
| signup.html | Registration screen |
| home.html | Dashboard |
| available-seminar.html | Browse open seminars |
| available-seminar-detail.html | Seminar info + registration |
| seminar-detail.html | Registered seminar detail |
| your-seminar.html | My registered seminars |
| history.html | Past seminar history |
| history-seminar-detail.html | Past seminar detail + certificate |
| profile.html | User profile management |

### Organization Portal — `src/org/`
Entry: `org-signin.html` → `org-signup.html` → `org-home.html`

| Page | Purpose |
|------|---------|
| org-signin.html | Organization login |
| org-signup.html | Organization registration |
| org-home.html | Dashboard |
| org-create-seminar.html | Create / edit seminar |
| org-your-seminar.html | Manage seminars + attendee lists |
| org-history.html | Past seminars |
| org-profile.html | Organization profile |

---

## Shared Assets

### Design Tokens — `src/shared/css/tokens.css`
Single source of truth for the design system:
- Color palette (cream, maroon, orange accent)
- Typography (Lora display, DM Sans body, Plus Jakarta Sans)
- Border radius, spacing scale, shadows

Import this first in any new page:
```html
<link rel="stylesheet" href="../shared/css/tokens.css">
```

### Attendee Typography — `src/shared/css/attendee-portal.min.css`
Scoped to `.attendee-portal` class. Handles responsive type scale.

### SVG Assets — `src/assets/svg/`
Place `seminex-logo-white.svg` here.
Referenced in pages as `../assets/svg/seminex-logo-white.svg`.

---

## Running Locally

No build step required. Open directly in browser:

```bash
# Option 1 — Direct file open
open index.html

# Option 2 — Python static server (recommended, avoids CORS on local fonts)
python3 -m http.server 3000
# → http://localhost:3000

# Option 3 — Node static server
npx serve .
# → http://localhost:3000
```

---

## What Was Reorganized

| Before | After | Reason |
|--------|-------|--------|
| `ATTENDEE SIDE/` | `src/attendee/` | Normalized naming, no spaces in path |
| `ORGANIZATION SIDE/` | `src/org/` | Normalized naming |
| `ATTENDEE SIDE/html/` | Removed | Exact duplicates with broken relative paths |
| `ASSET-COMPONENT/` | `src/assets/` + `src/shared/css/` | Split CSS from SVG assets |
| *(none)* | `index.html` | Added entry point |
| *(none)* | `src/shared/css/tokens.css` | Extracted design tokens |
| *(none)* | `README.md` | This file |

---

## Next Steps (Backend Integration)

When connecting to a backend:

1. Replace `onclick="window.location.href='signin.html'"` logout handlers with API call + redirect
2. Replace static form submissions with `fetch()` calls to the API
3. Add a `src/shared/js/` directory for shared utilities (auth, API client, toast notifications)
4. Replace hardcoded seminar card data with dynamic rendering from API responses
