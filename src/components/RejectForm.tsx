"use client";

import { useState } from "react";
import { changeExpenseStatusAction } from "@/actions/expenses";
import { SubmitButton } from "@/components/SubmitButton";

export function RejectForm({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        Refuzo
      </button>
    );
  }

  return (
    <form
      action={changeExpenseStatusAction}
      className="w-full rounded-lg border border-rose-200 bg-rose-50 p-4"
    >
      <input type="hidden" name="id" value={expenseId} />
      <input type="hidden" name="action" value="reject" />
      <label className="label text-rose-900" htmlFor="rejectReason">
        Arsyeja e refuzimit <span className="text-rose-500">*</span>
      </label>
      <textarea
        id="rejectReason"
        name="rejectReason"
        rows={2}
        required
        className="input"
        placeholder="p.sh. Mungon fatura origjinale"
      />
      <div className="mt-3 flex gap-2">
        <SubmitButton className="btn-danger" pendingLabel="Po refuzohet…">
          Konfirmo refuzimin
        </SubmitButton>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
        >
          Anulo
        </button>
      </div>
    </form>
  );
}
