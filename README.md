# Gestara

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the application whenever a commit is pushed to `main`. It configures Angular for the repository URL at:

```text
https://thoratprashant.github.io/Gestara-dev/
```

Before the first deployment, open the repository on GitHub and select **Settings → Pages → Build and deployment → Source → GitHub Actions**. Then push this setup to `main`, or run the **Deploy Gestara to GitHub Pages** workflow manually from the repository's **Actions** tab.

The deployment includes a `404.html` fallback so Angular routes such as `/Gestara-dev/patient/dashboard` work when opened or refreshed directly.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
