import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, ErrorState, Field, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";

interface Overview {
  summary: Record<string, Record<string, number>>;
  schemas: Record<string, { description: string; columns: Record<string, { aliases: string[]; required?: boolean; type?: string }> }>;
  imports: { id: number; kind: string; filename: string; data_source: string; status: string; rows_total: number; rows_created: number; rows_updated: number; rows_skipped: number; errors: { row: number; error: string }[]; imported_by: string; created_at: string }[];
}
interface Result { dry_run: boolean; total: number; created: number; updated: number; skipped: number; errors: { row: number; error: string }[]; unmapped_columns: string[]; preview: Record<string, unknown>[] }

const KINDS = [
  ["departments", "Department Directory"],
  ["categories", "Grievance Category Master"],
  ["officers", "Officers"],
  ["grievance_history", "Mock Grievance History"],
] as const;

export default function AdminDatasets() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "datasets"], queryFn: () => api<Overview>("/admin/datasets") });
  const [kind, setKind] = useState<string>("categories");
  const [source, setSource] = useState("OFFICIAL");
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const upload = useMutation({
    mutationFn: (dryRun: boolean) => {
      const f = new FormData();
      f.append("kind", kind);
      f.append("data_source", source);
      f.append("dry_run", String(dryRun));
      f.append("replace_other_sources", String(replace));
      f.append("file", file!);
      return api<Result>("/admin/datasets/import", { form: f });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "datasets"] }),
  });
  const schema = q.data?.schemas[kind];
  const r = upload.data;

  return (
    <div>
      <PageHeader title="Datasets" subtitle="Official HackFusion datasets are not yet available — the platform runs on clearly labelled SYNTHETIC data. Import the official files here; column names are mapped automatically using the schema below." />
      {q.isError && <ErrorState error={q.error} />}
      {q.isLoading && <SkeletonRows />}
      {q.data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Object.entries(q.data.summary).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line bg-white p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{k.replace("_", " ")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(v).length === 0 && <span className="text-sm text-ink-muted">none</span>}
                {Object.entries(v).map(([src, n]) => <Badge key={src} tone={src === "SYNTHETIC" ? "saffron" : src === "OFFICIAL" ? "brand" : "neutral"}>{src} {n}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card title="Import a CSV / XLSX file">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dataset" htmlFor="k">
                <Select id="k" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Tag rows as" htmlFor="s">
                <Select id="s" value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="OFFICIAL">OFFICIAL</option>
                  <option value="SYNTHETIC">SYNTHETIC</option>
                </Select>
              </Field>
            </div>
            <Field label="File" htmlFor="f" hint="Import order: departments → categories → officers → history.">
              <input id="f" type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-canvas" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-800" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>Allow overwriting records from another source (e.g. replace SYNTHETIC categories with OFFICIAL ones). Off by default — conflicting rows are skipped and reported.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={!file} loading={upload.isPending && upload.variables === true} onClick={() => upload.mutate(true)}>Validate (dry run)</Button>
              <Button disabled={!file} loading={upload.isPending && upload.variables === false} onClick={() => upload.mutate(false)}>Import</Button>
            </div>
            {upload.error && <Alert tone="critical">{upload.error.message}</Alert>}
            {r && (
              <Alert tone={r.errors.length ? "warning" : "good"} title={r.dry_run ? "Dry run — nothing written" : "Import complete"}>
                <p>{r.total} rows · {r.created} created · {r.updated} updated · {r.skipped} skipped</p>
                {!!r.unmapped_columns.length && <p className="mt-1">Ignored columns: {r.unmapped_columns.join(", ")}</p>}
                {!!r.errors.length && (
                  <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
                    {r.errors.slice(0, 30).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                  </ul>
                )}
              </Alert>
            )}
          </div>
        </Card>

        <Card title="Expected columns" subtitle={schema?.description}>
          {schema && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="pb-2">Field</th><th className="pb-2">Accepted headers</th><th className="pb-2">Type</th></tr></thead>
              <tbody className="divide-y divide-line">
                {Object.entries(schema.columns).map(([k, c]) => (
                  <tr key={k}>
                    <td className="py-1.5 font-mono text-xs">{k}{c.required && <span className="text-red-700"> *</span>}</td>
                    <td className="py-1.5 text-xs text-ink-soft">{c.aliases.join(", ")}</td>
                    <td className="py-1.5 text-xs text-ink-muted">{c.type ?? "text"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card className="mt-5" title="Import history">
        {q.data && q.data.imports.length === 0 && <p className="text-sm text-ink-muted">No imports yet.</p>}
        {!!q.data?.imports.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="pb-2">When</th><th className="pb-2">Dataset</th><th className="pb-2">File</th><th className="pb-2">Source</th><th className="pb-2">Status</th><th className="pb-2 text-right">Created / updated / skipped</th></tr></thead>
              <tbody className="divide-y divide-line">
                {q.data.imports.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 text-xs">{fmtDate(i.created_at)}</td>
                    <td className="py-2">{i.kind}</td>
                    <td className="py-2 font-mono text-xs">{i.filename}</td>
                    <td className="py-2"><Badge tone={i.data_source === "SYNTHETIC" ? "saffron" : "brand"}>{i.data_source}</Badge></td>
                    <td className="py-2">{i.status}</td>
                    <td className="py-2 text-right tabular-nums">{i.rows_created} / {i.rows_updated} / {i.rows_skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
