# QA Checklist — NetLab

Manual checks

- Open `index.html` and verify links to Simulator and Pro modules.
- In `netlab-simulator.html`: verify devices panel, connect tool, dragging nodes, and packet animations.
- In `netlab-pro.html`: verify packet capture list updates and packet dissection.
- Accessibility: keyboard focus order, ARIA labels on topbars and main regions.

Automated checks (CI)

- ESLint passes (already in CI)
- Build completes (`npm run build`)
- Sanity tests (`npm run test`) pass

Release checks

- `dist/` contains `simulator.bundle.js` and `pro.bundle.js` after build
- GitHub Pages action publishes `dist/`
