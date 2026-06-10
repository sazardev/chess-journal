import DataActions from "./DataActions"

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
            Data
          </span>
          <button
            onClick={onClose}
            className="font-mono text-sm text-gray-400 hover:text-black transition-colors leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-1">
          <DataActions onErased={onClose} />
        </div>
      </div>
    </div>
  )
}
