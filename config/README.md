# Project configuration

| File                      | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `vite.config.ts`          | Frontend build, development server, Worker integration, and HTML entries |
| `tsconfig.json`           | TypeScript compiler settings and source inclusions                       |
| `eslint.config.js`        | Code checks and domain import boundaries                                 |
| `prettier.config.js`      | Formatting settings                                                      |
| `assets-source-lock.json` | Pinned upstream asset revisions                                          |
| `image-content-lock.json` | Reviewed image content                                                   |

Run the npm commands from the project root; they pass configuration paths explicitly.

```bash
npm run frontend:dev
npm run frontend:bundle
npm run typecheck
npm run lint
npm run format:check
```

The application document is `src/index.html`; the build publishes it as `index.html` and development serves it at `/`.
The visual-test document is `test/fixtures/acceptance/harness.html`; its build is opt-in and publishes `acceptance.html` only for that test harness.

`package.json`, `package-lock.json`, `.gitignore`, `.prettierignore`, and `.graphifyignore` remain at the root for their tools' discovery and path conventions.
`.node-version` is optional version-manager metadata; it remains at the root so compatible version managers can select Node automatically.
`package.json` separately declares the required Node version.
Test-specific configuration lives under `test/config/`.
