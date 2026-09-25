"use client";

import { useActionState, useMemo, useState } from "react";
import type { Currency, TransactionType } from "@prisma/client";
import { createTransactionAction } from "@/actions/transactions";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { SubmitButton } from "@/components/SubmitButton";
import { formatMoney } from "@/lib/format";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  TRANSACTION_TYPES,
  TYPE_SHORT_LABELS,
  usesCategory,
  usesSupplier,
  usesTwoAccounts,
} from "@/lib/transactions";

export type CashBoxOption = {
  id: string;
  ownerId: string;
  ownerName: string;
  currency: Currency;
  balance: number;
};

export type BankOption = {
  id: string;
  name: string;
  currency: Currency;
  /** null kur përdoruesi nuk ka të drejtë t'i shohë gjendjet e bankës. */
  balance: number | null;
};

export type ReceivableOption = {
  id: string;
  reference: string;
  description: string;
  currency: Currency;
  total: number;
};

type Props = {
  today: string;
  currentUserId: string;
  owners: { id: string; name: string }[];
  cashBoxes: CashBoxOption[];
  bankAccounts: BankOption[];
  categories: string[];
  suppliers: { id: string; name: string }[];
  receivables: ReceivableOption[];
};

export function QuickEntry({
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

  const [type, setType] = useState<TransactionType>("SHPENZIM");
  const [currency, setCurrency] = useState<Currency>("ALL");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [accountKind, setAccountKind] = useState<"ARKE" | "BANKE">("ARKE");
  const [direction, setDirection] = useState<"PLUS" | "MINUS">("MINUS");

  const canPickOwner = owners.length > 1;
  const twoAccounts = usesTwoAccounts(type);
  // Depozitimi niset gjithmonë nga arka e punonjësit.
  const sourceIsCashBox = type === "DEPOZITIM" || accountKind === "ARKE";

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
    // Transfertë: çdo llogari tjetër në të njëjtën monedhë.
    const boxes = cashBoxes
      .filter((b) => b.currency === currency && b.id !== cashBox?.id)
      .map((b) => ({
        id: b.id,
        name: `Arka e ${b.ownerName}`,
        balance: b.balance as number | null,
      }));
    return [...banksInCurrency, ...boxes];
  }, [type, banksInCurrency, cashBoxes, currency, cashBox?.id]);

  const openReceivables = useMemo(
    () => receivables.filter((r) => r.currency === currency),
    [receivables, currency],
  );

  const sourceLabel =
    type === "ARKETIM" ? "Hyn në" : type === "DIFERENCE" ? "Llogaria" : "Del nga";

  return (
    <form action={formAction} className="space-y-4 p-5">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input
        type="hidden"
        name="accountKind"
        value={sourceIsCashBox ? "ARKE" : "BANKE"}
      />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="stay" value="1" />

      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      {/* Lloji */}
      <div>
        <span className="label">Lloji *</span>
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                type === t
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {TYPE_SHORT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Monedha — përcakton vetë arkën që preket */}
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
          <label className="label" htmlFor="qe-owner">
            Punonjësi
          </label>
          <select
            id="qe-owner"
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

      <div>
        <label className="label" htmlFor="qe-date">
          Data *
        </label>
        <input
          id="qe-date"
          name="date"
          type="date"
          required
          defaultValue={today}
          className="input"
        />
        {state.fieldErrors?.date ? (
          <p className="field-error">{state.fieldErrors.date}</p>
        ) : null}
      </div>

      {usesCategory(type) ? (
        <div>
          <label className="label" htmlFor="qe-category">
            Kategoria
          </label>
          <input
            id="qe-category"
            name="categoryName"
            list="qe-category-list"
            className="input"
            placeholder="p.sh. Karburant, Qira, Utilitete"
          />
          <datalist id="qe-category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-500">
            Nëse kategoria nuk ekziston, krijohet vetë.
          </p>
        </div>
      ) : null}

      {usesSupplier(type) ? (
        <div>
          <label className="label" htmlFor="qe-supplier">
            Furnitori
          </label>
          <select id="qe-supplier" name="supplierId" className="input">
            <option value="">— Pa furnitor —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="qe-description">
          Përshkrimi *
        </label>
        <input
          id="qe-description"
          name="description"
          required
          className="input"
          placeholder="Për çfarë është kjo lëvizje"
        />
        {state.fieldErrors?.description ? (
          <p className="field-error">{state.fieldErrors.description}</p>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="qe-amount">
          Shuma *
        </label>
        <input
          id="qe-amount"
          name="amount"
          required
          inputMode="decimal"
          className="input text-right tabular-nums"
          placeholder="0.00"
        />
        {state.fieldErrors?.amount ? (
          <p className="field-error">{state.fieldErrors.amount}</p>
        ) : null}
      </div>

      {/* Burimi i parasë */}
      {type !== "E_DREJTE" ? (
        <div>
          <span className="label">{sourceLabel} *</span>
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
              <span className="text-slate-600">Gjendja e arkës</span>
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
              {banksInCurrency.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  Nuk ka llogari bankare në {CURRENCY_LABELS[currency]}.
                </p>
              ) : null}
              {state.fieldErrors?.bankAccountId ? (
                <p className="field-error">{state.fieldErrors.bankAccountId}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Destinacioni */}
      {twoAccounts ? (
        <div>
          <label className="label" htmlFor="qe-to">
            Shkon te *
          </label>
          <select id="qe-to" name="toAccountId" className="input" defaultValue="">
            <option value="">— Zgjidh llogarinë —</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.balance === null
                  ? d.name
                  : `${d.name} · ${formatMoney(d.balance, currency)}`}
              </option>
            ))}
          </select>
          {state.fieldErrors?.toAccountId ? (
            <p className="field-error">{state.fieldErrors.toAccountId}</p>
          ) : null}
        </div>
      ) : null}

      {/* Diferencë: tepricë apo mungesë */}
      {type === "DIFERENCE" ? (
        <div>
          <span className="label">Drejtimi *</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setDirection("MINUS")}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                direction === "MINUS"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Mungesë (−)
            </button>
            <button
              type="button"
              onClick={() => setDirection("PLUS")}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                direction === "PLUS"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tepricë (+)
            </button>
          </div>
        </div>
      ) : null}

      {/* Arkëtimi mund të mbyllë një të drejtë të hapur */}
      {type === "ARKETIM" && openReceivables.length > 0 ? (
        <div>
          <label className="label" htmlFor="qe-settles">
            Mbyll të drejtën
          </label>
          <select id="qe-settles" name="settlesId" className="input" defaultValue="">
            <option value="">— Asnjë —</option>
            {openReceivables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reference} · {r.description.slice(0, 40)} ·{" "}
                {formatMoney(r.total, r.currency)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {type === "SHPENZIM" ? (
        <label className="flex gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            name="vetemPash"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600"
          />
          <span>
            <strong className="text-slate-800">Vetëm për PASH</strong> — hyn te
            pasqyra e rezultatit, por nuk e ul gjendjen e arkës. Për kosto
            periudhash të shkuara, ku paraja ka dalë në një kohë tjetër.
          </span>
        </label>
      ) : null}

      <SubmitButton className="btn-primary w-full" pendingLabel="Po regjistrohet…">
        Shto lëvizjen
      </SubmitButton>
    </form>
  );
}
