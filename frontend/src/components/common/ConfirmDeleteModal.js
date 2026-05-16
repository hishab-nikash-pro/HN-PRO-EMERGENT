export default function ConfirmDeleteModal({ open, title = 'Confirm Delete', message = 'This action cannot be undone. Are you sure?', onCancel, onConfirm, loading = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,45,92,0.18)]">
        <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: '#475467' }}>
          {message}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ color: '#475467' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: '#B42318', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
