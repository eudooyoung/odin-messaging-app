# React Template

## About

How this template was created:

### Clean up

- Remove default styles and code

### Install packages

1. Command ` npm create vite@latest . -- --template react-ts` in the target directory to scaffold initial react app.
2. Install additional runtime dependencies:
   - react-router
3. Install additional development dependencies:
   - vitest
   - jsdom
   - @testing-library/jest-dom
   - @testing-library/react
   - @testing-library/user-event

### Modify configs

1. In eslint.config, update language options and rules:

   ```javascript
   languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
   ```

2. In package.json, add scripts `"test": "vitest",`

3. In tsconfig.app.json,
   - add `"@testing-library/jest-dom"` to types
   - add `"paths": {"@/*": ["./src/*"]}` to compiler options:

4. In vite.config,
   - add `/// <reference types="vitest/config" />` in the first line
   - add to definConfig option:
     ```javascript
      resolve: {
        alias: {
          "@": resolve(import.meta.dirname, "./src"),
        },
      },
     test: {
       globals: true,
       environment: "jsdom",
       setupFiles: "./src/tests/setup.ts",
     }
     ```

### Create utils

1. Create minimal router

   ```javascript
   // src/routes/router.tsx

   import App from "@/App.tsx";
   import { createBrowserRouter } from "react-router";

   const routes = [
     {
       path: "/",
       element: <App />,
     },
   ];

   export const router = createBrowserRouter(routes);
   ```

2. Update main.tsx to render `<RouterProvider router={router} />` instead of `<App />`

3. Create test setup script

   ```javascript
   // src/tests/setup.ts

   import { expect, afterEach, vi } from "vitest";
   import { cleanup } from "@testing-library/react";
   import * as matchers from "@testing-library/jest-dom/matchers";
   import "@testing-library/user-event";

   expect.extend(matchers);

   afterEach(() => {
     cleanup();
     vi.restoreAllMocks();
   });
   ```

### Gitignore

- Add .env and .vite to .gitignore

## Installed packages

- ### react
  - react
  - react-dom
  - react-router

- ### vite
  - vite
  - @vitejs/plugin-react

- ### typescript
  - typescript
  - @types/node
  - @types/react-dom
  - @types/react

- ### lint
  - eslint
  - typescript-eslint
  - @eslint/js
  - eslint-plugin-react-hooks
  - eslint-plugin-react-refresh

- ### test
  - vitest
  - @testing-library/jest-dom
  - @testing-library/react
  - @testing-library/user-event

- ### etc
  - jsdom
  - globals
