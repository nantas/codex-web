"use client";

import { FormEvent, useState } from "react";

type SessionTurnComposerProps = {
  disabled?: boolean;
  onSubmit: (text: string) => Promise<void>;
};

export default function SessionTurnComposer({ disabled = false, onSubmit }: SessionTurnComposerProps) {
  const [text, setText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) {
      return;
    }

    await onSubmit(trimmed);
    setText("");
  }

  return (
    <section className="space-y-2 rounded border border-black/10 p-3">
      <h2 className="text-lg font-semibold">Send Turn</h2>
      <form className="space-y-2" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-xs text-black/70">
          <span>Turn Message</span>
          <textarea
            aria-label="Turn Message"
            className="min-h-24 w-full rounded border border-black/20 px-2 py-1 text-sm"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={disabled}
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50"
            disabled={disabled || text.trim().length === 0}
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
