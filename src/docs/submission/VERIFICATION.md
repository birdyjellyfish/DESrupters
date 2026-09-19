# Submission verification — 19 September 2026

After reorganising the repository with the runnable project in `src/`:

- Setup was checked in an isolated temporary directory: it reads the root `.env.example`, generates matching database URL/password settings and leaves existing settings unchanged. Temporary verification files were removed.
- `npm test`: 17 suites, 59 tests passed.
- `npm run build`: production compilation, type/lint checks and static page generation passed. Webpack emitted a cache-snapshot warning; the build completed successfully.
- All eight local Markdown links resolved after the move.
- Local and cloud Compose configuration validated. No services were started and no Google Cloud resources were created.
- Targeted source/history audit passed; see the generated `docs/REFERENCE-AUDIT.md` for its coverage and exclusions.

An independent dependency install and production HTTP checks passed before the directory move. Generated submission exports and the archive-generation command have since been removed; submit the repository directly.

These checks do not establish live provider availability, cloud deployment success, or real-phone behavior. The final committed GitHub clone, live journey with valid credentials, phone check and demo recording remain pending in [CHECKLIST.md](CHECKLIST.md).
