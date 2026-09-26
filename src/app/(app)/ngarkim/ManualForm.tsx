"use client";

import { useActionState, useMemo, useState } from "react";
import type { Currency, TransactionType } from "@prisma/client";
import { createTransactionAction } from "@/actions/transactions";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { formatMoney } from "@/lib/format";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  usesCategory,
  usesSupplier,
  usesTwoAccounts,
} from "@/lib/transactions";
import type {
  BankOption,
  CashBoxOption,
  ReceivableOption,
} from "@/components/QuickEntry";

type Props = {
  type: TransactionType;
  today: string;
  currentUserId: string;
  owners: { id: string; name: string }[];
  cashBoxes: CashBoxOption[];
  bankAccounts: BankOption[];
  categories: string[];
  suppliers: { id: string; name: string }[];
  receivables: ReceivableOption[];
};

function parseLocaleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return 0;
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function ManualForm({
  type,
  today,
  currentUserId,
  owners,
  cashBoxes,
  bankAccounts,
  categories,
  suppliers,
  receivables,
}: Props) {
  const [state, formAction] = useActionState(
    createTransactionAction,
    {} as FormState,
  );

  const [currency, setCurrency] = useState<Currency>("ALL");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [accountKind, setAccountKind] = useState<"ARKE" | "BANKE">("ARKE");
  const [amount, setAmount] = useState("");
  const [vatRate, setVatRate] = useState("0");

  const canPickOwner = owners.length > 1;
  const twoAccounts = usesTwoAccounts(type);
  const sourceIsCashBox = type === "DEPOZITIM" || accountKind === "ARKE";
  const showVat = type === "SHPENZIM" || type === "E_DREJTE";

  const cashBox = useMemo(
    () => cashBoxes.find((b) => b.ownerId === ownerId && b.currency === currency),
    [cashBoxes, ownerId, currency],
  );
  const banksInCurrency = useMemo(
    () => bankAccounts.filter((b) => b.currency === currency),
    [bankAccounts, currency],
  );
  const destinations = useMemo(() => {
    if (type === "DEPOZITIM") return banksInCurrency;
    const boxes = cashBoxes
      .filter((b) => b.currency === currency && b.id !== cashBox?.id)
      .map((b) => ({
        id: b.id,
        name: `Arka e ${b.ownerName}`,
        balance: b.balance as number | null,
      }));
    return [...banksInCurrency, ...boxes];
  }, [type, banksInCurrency, cashBoxes, currency, cashBox?.id]);

  const totals = useMemo(() => {
    const net = parseLocaleNumber(amount);
    const rate = showVat ? parseLocaleNumber(vatRate) : 0;
    const vat = Math.round(((net * rate) / 100) * 100) / 100;
    return { net, vat, total: Math.round((net + vat) * 100) / 100 };
  }, [amount, vatRate, showVat]);

  const openReceivables = receivables.filter((r) => r.currency === currency);

  return (
    <form action={formAction} className="space-y-5 p-5">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input
        type="hidden"
        name="accountKind"
        value={sourceIsCashBox ? "ARKE" : "BANKE"}
      />

      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Data" htmlFor={`m-date-${type}`} required error={state.fieldErrors?.date}>
          <input
            id={`m-date-${type}`}
            name="date"
            type="date"
            required
            defaultValue={today}
            className="input"
          />
        </Field>

        <div>
          <span className="label">Monedha *</span>
          <div className="grid grid-cols-3 gap-1.5">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  currency === c
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {CURRENCY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {canPickOwner ? (
          <div>
            <label className="label" htmlFor={`m-owner-${type}`}>Punonjësi</label>
            <select
              id={`m-owner-${type}`}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="input"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id === currentUserId ? `${o.name} (unë)` : o.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Field
          label="Përshkrimi"
          htmlFor={`m-desc-${type}`}
          required
          className="sm:col-span-2"
          error={state.fieldErrors?.description}
        >
          <input
            id={`m-desc-${type}`}
            name="description"
            required
            className="input"
            placeholder="Për çfarë është kjo lëvizje"
          />
        </Field>

        <Field label="Nr. dokumenti" htmlFor={`m-doc-${type}`} error={state.fieldErrors?.documentNumber}>
          <input
            id={`m-doc-${type}`}
            name="documentNumber"
            className="input"
            placeholder="p.sh. 2026/145"
          />
        </Field>

        {usesCategory(type) ? (
          <Field label="Kategoria" htmlFor={`m-cat-${type}`} hint="Krijohet vetë nëse nuk ekziston.">
            <input
              id={`m-cat-${type}`}
              name="categoryName"
              list={`m-cat-list-${type}`}
              className="input"
              placeholder="p.sh. Karburant"
            />
            <datalist id={`m-cat-list-${type}`}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        ) : null}

        {usesSupplier(type) ? (
          <Field label="Furnitori" htmlFor={`m-sup-${type}`}>
            <select id={`m-sup-${type}`} name="supplierId" className="input">
              <option value="">— Pa furnitor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        ) : null}

        {type === "ARKETIM" || type === "E_DREJTE" ? (
          <Field label="Pala" htmlFor={`m-party-${type}`} hint="Klienti ose kush paguan.">
            <input
              id={`m-party-${type}`}
              name="counterparty"
              className="input"
              placeholder="p.sh. Alba Logistics shpk"
            />
          </Field>
        ) : null}
      </div>

      <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label={showVat ? "Shuma pa TVSH" : "Shuma"}
          htmlFor={`m-amount-${type}`}
          required
          error={state.fieldErrors?.amount}
        >
          <input
            id={`m-amount-${type}`}
            name="amount"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input text-right tabular-nums"
            placeholder="0.00"
          />
        </Field>

        {showVat ? (
          <Field label="TVSH %" htmlFor={`m-vat-${type}`} error={state.fieldErrors?.vatRate}>
            <select
              id={`m-vat-${type}`}
              name="vatRate"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="input"
            >
              <option value="0">0% (pa TVSH)</option>
              <option value="6">6%</option>
              <option value="10">10%</option>
              <option value="20">20%</option>
            </select>
          </Field>
        ) : (
          <input type="hidden" name="vatRate" value="0" />
        )}

        <div className="flex flex-col justify-end sm:col-span-2">
          <div className="flex flex-wrap items-baseline justify-end gap-5 text-sm">
            {showVat ? (
              <span className="text-slate-600">
                TVSH:{" "}
                <strong className="tabular-nums text-slate-900">
                  {formatMoney(totals.vat, currency)}
                </strong>
              </span>
            ) : null}
            <span className="text-slate-600">
              Totali:{" "}
              <strong className="text-base tabular-nums text-brand-700">
                {formatMoney(totals.total, currency)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {type !== "E_DREJTE" ? (
          <div>
            <span className="label">
              {type === "ARKETIM" ? "Hyn në *" : type === "DIFERENCE" ? "Llogaria *" : "Del nga *"}
            </span>
            {type === "DEPOZITIM" ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Arka e punonjësit ({CURRENCY_LABELS[currency]})
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAccountKind("ARKE")}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                    accountKind === "ARKE"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Arka
                </button>
                <button
                  type="button"
                  onClick={() => setAccountKind("BANKE")}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                    accountKind === "BANKE"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Banka
                </button>
              </div>
            )}
            {sourceIsCashBox ? (
              <p className="mt-2 flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-600">Gjendja</span>
                <span
                  className={`font-semibold tabular-nums ${
                    (cashBox?.balance ?? 0) < 0 ? "text-rose-600" : "text-slate-900"
                  }`}
                >
                  {formatMoney(cashBox?.balance ?? 0, currency)}
                </span>
              </p>
            ) : (
              <>
                <select name="bankAccountId" className="input mt-2" defaultValue="">
                  <option value="">— Zgjidh llogarinë bankare —</option>
                  {banksInCurrency.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.balance === null
                        ? b.name
                        : `${b.name} · ${formatMoney(b.balance, b.currency)}`}
                    </option>
                  ))}
                </select>
                {state.fieldErrors?.bankAccountId ? (
                  <p className="field-error">{state.fieldErrors.bankAccountId}</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {twoAccounts ? (
          <Field
            label="Shkon te"
            htmlFor={`m-to-${type}`}
            required
            error={state.fieldErrors?.toAccountId}
          >
            <select id={`m-to-${type}`} name="toAccountId" className="input" defaultValue="">
              <option value="">— Zgjidh llogarinë —</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.balance === null
                    ? d.name
                    : `${d.name} · ${formatMoney(d.balance, currency)}`}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {type === "DIFERENCE" ? (
          <Field label="Drejtimi" htmlFor={`m-dir-${type}`} required>
            <select id={`m-dir-${type}`} name="direction" className="input" defaultValue="MINUS">
              <option value="MINUS">Mungesë (−)</option>
              <option value="PLUS">Tepricë (+)</option>
            </select>
          </Field>
        ) : null}

        {type === "ARKETIM" && openReceivables.length > 0 ? (
          <Field
            label="Mbyll të drejtën"
            htmlFor={`m-settles-${type}`}
            hint="Opsionale — shënon një të drejtë si të arkëtuar."
          >
            <select id={`m-settles-${type}`} name="settlesId" className="input" defaultValue="">
              <option value="">— Asnjë —</option>
              {openReceivables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reference} · {r.description.slice(0, 40)} ·{" "}
                  {formatMoney(r.total, r.currency)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Dokumente"
          htmlFor={`m-files-${type}`}
          hint="PDF, JPG, PNG ose WEBP — maks. 8 MB secili."
        >
          <input
            id={`m-files-${type}`}
            name="attachments"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
          />
        </Field>

        <Field label="Shënime" htmlFor={`m-notes-${type}`} error={state.fieldErrors?.notes}>
          <textarea
            id={`m-notes-${type}`}
            name="notes"
            rows={2}
            className="input resize-y"
          />
        </Field>
      </div>

      {type === "SHPENZIM" ? (
        <label className="flex gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="vetemPash"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600"
          />
          <span>
            <strong className="text-slate-800">Vetëm për PASH</strong> — hyn te
            pasqyra e rezultatit, por nuk e ul gjendjen e arkës.
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton className="btn-primary" pendingLabel="Po regjistrohet…">
          Regjistro lëvizjen
        </SubmitButton>
        <SubmitButton
          name="stay"
          value="1"
          className="btn-secondary"
          pendingLabel="Po regjistrohet…"
        >
          Regjistro dhe rri këtu
        </SubmitButton>
      </div>
    </form>
  );
}
