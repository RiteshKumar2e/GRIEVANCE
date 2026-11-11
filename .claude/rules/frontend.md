# Frontend conventions

- Data comes from the API via `src/lib/api.ts` + React Query. No hardcoded demo arrays or metrics.
- Every data view handles loading (`SkeletonRows`/`Spinner`), empty (`EmptyState`) and error (`ErrorState`) states.
- Status is never colour-only: pair status colours with an icon and text (`SlaIndicator`, `Badge`).
- Citizen-facing strings go through `useI18n().t()` with en / hi / mr entries.
- Charts use `src/components/charts.tsx` (validated palette, tooltips, legends for 2+ series).
