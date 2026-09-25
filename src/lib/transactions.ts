import type { AccountKind, Currency, TransactionType } from "@prisma/client";

export const TYPE_LABELS: Record<TransactionType, string> = {
  SHPENZIM: "Shpenzim",
  ARKETIM: "Arkëtim",
  DEPOZITIM: "Depozitim",
  E_DREJTE: "E drejtë për arkëtim",
  DIFERENCE: "Diferencë",
  TRANSFERTE: "Transfertë",
};

/** Etiketa të shkurtra për butonat e panelit të shpejtë. */
export const TYPE_SHORT_LABELS: Record<TransactionType, string> = {
  SHPENZIM: "Shpenzim",
  ARKETIM: "Arkëtim",
  DEPOZITIM: "Depozitim",
  E_DREJTE: "E drejtë",
  DIFERENCE: "Diferencë",
  TRANSFERTE: "Transfertë",
};

export const TYPE_STYLES: Record<TransactionType, string> = {
  SHPENZIM: "bg-rose-50 text-rose-800 ring-rose-200",
  ARKETIM: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  DEPOZITIM: "bg-sky-50 text-sky-800 ring-sky-200",
  E_DREJTE: "bg-amber-50 text-amber-900 ring-amber-200",
  DIFERENCE: "bg-violet-50 text-violet-800 ring-violet-200",
  TRANSFERTE: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const TYPE_PREFIX: Record<TransactionType, string> = {
  SHPENZIM: "SHP",
  ARKETIM: "ARK",
  DEPOZITIM: "DEP",
  E_DREJTE: "DRJ",
  DIFERENCE: "DIF",
  TRANSFERTE: "TRF",
};

/** Renditja si shfaqen në panelin e shpejtë dhe në filtra. */
export const TRANSACTION_TYPES: TransactionType[] = [
  "SHPENZIM",
  "ARKETIM",
  "E_DREJTE",
  "DEPOZITIM",
  "TRANSFERTE",
  "DIFERENCE",
];

export const CURRENCIES: Currency[] = ["ALL", "EUR", "USD"];

export const CURRENCY_LABELS: Record<Currency, string> = {
  ALL: "Lekë",
  EUR: "Euro",
  USD: "Dollarë",
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ALL: "L",
  EUR: "€",
  USD: "$",
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  ARKE: "Arkë",
  BANKE: "Bankë",
};

/** A ka kuptim kategoria për këtë lloj? */
export function usesCategory(type: TransactionType): boolean {
  return type === "SHPENZIM" || type === "ARKETIM" || type === "E_DREJTE";
}

/** A ka kuptim furnitori për këtë lloj? */
export function usesSupplier(type: TransactionType): boolean {
  return type === "SHPENZIM";
}

/** A lëviz paraja midis dy llogarive? */
export function usesTwoAccounts(type: TransactionType): boolean {
  return type === "DEPOZITIM" || type === "TRANSFERTE";
}

/** A prek fare ndonjë llogari? (E drejta nuk prek.) */
export function usesAccount(type: TransactionType): boolean {
  return type !== "E_DREJTE";
}

export type EffectInput = {
  type: TransactionType;
  total: number;
  affectsBalance?: boolean;
  /** Vetëm për DIFERENCE: true = tepricë (+), false = mungesë (−) */
  surplus?: boolean;
};

export type Effects = { accountEffect: number; toAccountEffect: number };

/**
 * Efekti i një lëvizjeje mbi llogarinë burim dhe atë destinacion, me shenjë.
 * Llogaritet një herë kur ruhet lëvizja dhe ruhet në bazë, që gjendjet
 * të jenë thjesht mbledhje e kolonave — pa logjikë të përsëritur në query.
 */
export function computeEffects(input: EffectInput): Effects {
  const total = Math.round(input.total * 100) / 100;
  const none = { accountEffect: 0, toAccountEffect: 0 };

  switch (input.type) {
    // E drejta regjistrohet, por paraja nuk ka lëvizur ende.
    case "E_DREJTE":
      return none;

    case "SHPENZIM":
      return input.affectsBalance === false
        ? none
        : { accountEffect: -total, toAccountEffect: 0 };

    case "ARKETIM":
      return { accountEffect: total, toAccountEffect: 0 };

    case "DEPOZITIM":
    case "TRANSFERTE":
      return { accountEffect: -total, toAccountEffect: total };

    case "DIFERENCE":
      return {
        accountEffect: input.surplus ? total : -total,
        toAccountEffect: 0,
      };

    default:
      return none;
  }
}
