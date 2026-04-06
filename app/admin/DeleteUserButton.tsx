'use client';

import { deleteUser } from './actions';

export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        if (!confirm(`Delete ${email}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="text-[10px] font-bold px-3 py-2 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        Delete
      </button>
    </form>
  );
}
