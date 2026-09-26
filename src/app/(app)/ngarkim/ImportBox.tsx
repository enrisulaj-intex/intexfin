"use client";

import { useActionState, useState } from "react";
import type { TransactionType } from "@prisma/client";
import {
  confirmImportAction,
  previewImportAction,
  type ImportState,
} from "@/actions/import";
import { Alert } from "@/components/Alert";
import { SubmitButton } from "@/components/SubmitButton";
import { FIELD_LABELS, REQUIRED_FIELDS, templateColumns } from "@/lib/import-parse";

export function ImportBox({ type }: { type: TransactionType }) {
  const [preview, previewAction] = useActionState(
    previewImportAction,
    {} as ImportState,
  );
  const [confirmed, confirmAction] = useActionState(
    confirmImportAction,
    {} as ImportState,
  );
  const [dismissed, setDismissed] = useState(false);

  const data = preview.preview;
  const showPreview = data && !dismissed && !confirmed.success;
  const required = new Set(REQUIRED_FIELDS[type]);

  return (
    <div className="space-y-5 p-5">
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        <p>
          Ngarko një skedar <strong>.xlsx</strong> ose <strong>.csv</strong>.
          Skedari lexohet i pari dhe <strong>nuk shkruhet asgjë</strong> derisa
          ta konfirmosh.
        </p>
        <p className="mt-2">
          Kolonat e njohura për këtë lloj (me{" "}
          <span className="text-rose-600">*</span> janë të detyrueshme):
        </p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {templateColumns(type).map((field) => (
            <span
              key={field}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700"
            >
              {FIELD_LABELS[field]}
              {required.has(field) ? <span className="text-rose-600">*</span> : null}
            </span>
          ))}
        </p>
        <p className="mt-3">
          <a
            href={`/api/ngarkim/shabllon?lloji=${type}`}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Shkarko shabllonin për këtë lloj →
          </a>
        </p>
      </div>

      {confirmed.success ? (
        <Alert kind="success">{confirmed.success}</Alert>
      ) : null}
      {confirmed.error ? <Alert kind="error">{confirmed.error}</Alert> : null}
      {preview.error ? <Alert kind="error">{preview.error}</Alert> : null}

      <form action={previewAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <div className="min-w-[16rem] flex-1">
          <label className="label" htmlFor={`file-${type}`}>
            Skedari
          </label>
          <input
            id={`file-${type}`}
            name="file"
            type="file"
            accept=".xlsx,.xlsm,.csv,.txt"
            required
            onChange={() => setDismissed(false)}
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
          />
        </div>
        <SubmitButton className="btn-secondary" pendingLabel="Po lexohet…">
          Lexo skedarin
        </SubmitButton>
      </form>

      {showPreview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <span className="text-sm font-medium text-slate-800">
              {data.fileName}
            </span>
            <span className="badge bg-emerald-50 text-emerald-800 ring-emerald-200">
              {data.validCount} gati
            </span>
            {data.errorCount > 0 ? (
              <span className="badge bg-rose-50 text-rose-800 ring-rose-200">
                {data.errorCount} me gabime
              </span>
            ) : null}
            {data.warningCount > 0 ? (
              <span className="badge bg-amber-50 text-amber-900 ring-amber-200">
                {data.warningCount} dyfishime të mundshme
              </span>
            ) : null}
          </div>

          {data.unknownHeaders.length > 0 ? (
            <Alert kind="warning">
              Këto kolona nuk u njohën dhe nuk do të lexohen:{" "}
              <strong>{data.unknownHeaders.join(", ")}</strong>
            </Alert>
          ) : null}

          <div className="table-wrap max-h-96 overflow-y-auto rounded-lg border border-slate-200">
            <table className="table">
              <thead className="sticky top-0">
                <tr>
                  <th>Rreshti</th>
                  <th>Data</th>
                  <th>Përshkrimi</th>
                  <th>Monedha</th>
                  <th className="text-right">Totali</th>
                  <th>Punonjësi</th>
                  <th>Llogaria</th>
                  <th>Gjendja</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.line}
                    className={row.errors.length > 0 ? "bg-rose-50/60" : undefined}
                  >
                    <td className="tabular-nums text-slate-500">{row.line}</td>
                    <td className="whitespace-nowrap">{row.display.data}</td>
                    <td className="max-w-[16rem] truncate">{row.display.pershkrimi}</td>
                    <td>{row.display.monedha}</td>
                    <td className="text-right tabular-nums">{row.display.shuma}</td>
                    <td className="whitespace-nowrap">{row.display.punonjesi}</td>
                    <td className="whitespace-nowrap text-xs">{row.display.llogaria}</td>
                    <td className="text-xs">
                      {row.errors.length > 0 ? (
                        <span className="text-rose-700">{row.errors.join("; ")}</span>
                      ) : row.warnings.length > 0 ? (
                        <span className="text-amber-700">{row.warnings.join("; ")}</span>
                      ) : (
                        <span className="text-emerald-700">Gati</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={confirmAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="payload" value={data.payload} />
            {data.validCount > 0 ? (
              <SubmitButton className="btn-primary" pendingLabel="Po ngarkohet…">
                {data.errorCount > 0
                  ? `Ngarko vetëm ${data.validCount} rreshtat e vlefshëm`
                  : `Konfirmo ngarkimin e ${data.validCount} rreshtave`}
              </SubmitButton>
            ) : (
              <p className="text-sm text-rose-700">
                Asnjë rresht nuk është i vlefshëm — ndreq skedarin dhe provo sërish.
              </p>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDismissed(true)}
            >
              Anulo
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
