# Seminex

Seminex is a web app for managing seminar events at CCS Gordon College, built as a Progressive Web App. This repository holds the student-side front end.

## Stack

- Vite, React 19, TypeScript
- Tailwind CSS 4
- React Router 7
- vite-plugin-pwa for the service worker and installability

## Requirements

- Node.js 20 or newer (LTS recommended)
- Git

## Getting started

```bash
git clone <repository-url>
cd seminex
npm install
npm run dev
```

Open the local address printed in the terminal.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build in `dist` |
| `npm run preview` | Serve the production build locally |

## Project structure

- `src/app` - app root, routes, session guard
- `src/api` - API client, mock API, offline cache, shared types
- `src/components` - shared UI, shell (sidebar, top bar, bottom nav), auth layout
- `src/features` - screens grouped by feature
- `src/config.ts` - app-wide constants
- `public` - static assets and icons

## Data

The app currently runs against a mock API in `src/api/mock.ts`. No backend or environment variables are required yet.

## Contributing

1. Pull the latest `main`.
2. Create a branch: `feat/<short-name>` or `fix/<short-name>`.
3. Make one focused change per commit, with a plain-language commit message.
4. Push the branch and open a pull request into `main`.
5. Merge after review, then delete the branch.