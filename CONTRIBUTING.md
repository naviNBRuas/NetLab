# Contributing to NetLab

Thank you for your interest in improving NetLab! This document explains the preferred workflow and coding standards to keep the project maintainable and educational.

How to contribute

1. Fork the repository and create a feature branch: `feature/your-topic` or `fix/short-description`.
2. Keep changes focused and well-scoped; open a separate PR per feature or bugfix.
3. Write clear commit messages and add notes to the PR describing the change and why it's educationally useful.

Coding standards

- JavaScript: vanilla ES2020+ preferred. Keep the code readable and well-commented — aim to teach, not to obfuscate.
- UI: keep layout accessible; use semantic HTML and ARIA where appropriate.
- Tests: add Playwright or similar integration tests for interactive features where possible.

Pull requests

- Rebase or merge main before requesting review.
- Use small, incremental commits. Add screenshots or short screencasts for UI changes.
- PRs will be reviewed for clarity, correctness, and educational value.

Reporting issues

- Use GitHub Issues to report bugs or feature requests. Include steps to reproduce and environment/browser details.
