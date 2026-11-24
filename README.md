# AI DevOps Risk Analyzer for VS Code

This extension sends only the current changed document, selected text, or Git working-tree/index changes to the FastAPI backend. It does not run AI models locally.

Configure `aiDevOpsRisk.apiUrl` and a backend JWT in `aiDevOpsRisk.accessToken`. The backend endpoint is `POST /risk/editor/analyze` and therefore uses the existing authentication middleware.

Run `npm install`, then `npm run compile`. Use `F5` in VS Code to launch an Extension Development Host.

The Activity Bar shows findings; the Problems panel, hovers, diagnostics, status bar, commands, and preview-before-apply quick fixes all use the same backend response.
