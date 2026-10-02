# Cargo Twin v4 reviewed source candidate

Creator and project lead: **UNG Sethy Pagna (James)**. Codex assisted implementation, integration, review, verification and release preparation. Historical AInnovator, Claude and Figma attribution is preserved in [credits](../../CREDITS.md).

This candidate publishes the already-built v4 studio from the local verified snapshot. It adds the three-step space/cargo/review workflow, responsive editors and labeled 3D controls, named local projects and recoverable drafts, project-aware history, validated interchange and printable load sheets. The earlier aircraft workspace and historical prototype remain intact. This is a reviewed source candidate, not a zero-bug or operational-safety guarantee.

## Verification — 2026-10-02 UTC

Fresh commands in the separate publication checkout, with Node v24.15.0, npm 11.12.1 and `NODE_OPTIONS=--max-old-space-size=4096`:

```powershell
npm.cmd --prefix cargo-twin test -- --maxWorkers=1
npm.cmd --prefix cargo-twin run build
```

- **191 tests / 12 files passed**, 6.76 seconds after the EOF cleanup; strict TypeScript and Vite 8.3.1 production build passed, **89 modules**.
- Final app implementation matches the verified local candidate. Publication trims redundant trailing blank lines in seven source/QA files to satisfy the staged diff check; other app inputs remain byte-identical. Every one of the **16 rebuilt browser assets** matches the actual smoke-tested output byte-for-byte, checked twice. Documentation and supplied notices are the other publication-specific changes.
- Browser-output tree SHA-256: `06c12dc501925e1280ab6c2e3c6d87b7d33d3f692fd5f6bf1ff974b630557000`. The tree hash covers relative path, NUL, byte count, NUL, lowercase file SHA-256 and LF in sorted manifest order.
- The actual packaged browser smoke used isolated headless Chromium 153.0.8010.12: initial **40/40** load; Everyday cartons **16→17** and rebuilt **41/41**; named save; actual JSON download/import; saved-project reopen and reload preserving the same project ID and edited quantity.
- Smoke observed **zero application/page/console errors** and no failed requests or HTTP error responses on reopen/reload. Four WebGL GPU-stall warnings before reload were retained. The final reload context had zero console errors/warnings. This smoke was run against the identical browser assets before publication; it was not rerun merely to rename the source checkout.
- Actual [3D canvas screenshot](v4-canvas.png) and [exported sample project JSON](v4-example-project.json) are included. The browser and owned loopback preview were closed after the smoke. No tooling or dependencies were installed for publication verification.

## Scope and limits

Prior implementation and usability review records are preserved under `docs/progress/`; their original dates and role-specific verification limits remain explicit. Public machine paths and harness run identifiers were sanitized. No dependencies, build caches, browser profiles, authentication stores or raw private task records are in the source payload. The historical public Supabase anonymous client key and original assets are unchanged; no new privileged credential was introduced.

The fresh suite/build and representative browser smoke do not establish physical-device, OS-generated PDF/printer, first-time human usability, deployment or operational transport acceptance. Packing uses rectangular cargo/spaces, static support, deterministic heuristics and illustrative equipment data. Real restraints, loading access, dynamics, structural/vehicle/aircraft safety and certification need their own validation. Prior print checks stubbed printing; actual PDF output was not accepted.

Actual library/font license texts accompany [third-party notices](../../THIRD-PARTY-NOTICES.md); historical shadcn/ui and Unsplash attribution remains preserved. Individual third-party asset rights were not exhaustively audited. Absence of a project-wide LICENSE does not by itself establish that publication is forbidden; this candidate does not grant a new project license.

This source branch is intended for draft review. No merge, deployment or deletion of prior versions is part of this delivery.
