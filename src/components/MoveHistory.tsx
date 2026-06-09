import { useRef, useEffect, useState } from "react"
import { useGameStore } from "../stores/useGameStore"

export default function MoveHistory() {
  const history = useGameStore((s) => s.history)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const goToMove = useGameStore((s) => s.goToMove)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)
  const isPlaying = useGameStore((s) => s.isPlaying)
  const togglePlay = useGameStore((s) => s.togglePlay)
  const playSpeed = useGameStore((s) => s.playSpeed)
  const setPlaySpeed = useGameStore((s) => s.setPlaySpeed)
  const bookmarks = useGameStore((s) => s.bookmarks)
  const toggleBookmark = useGameStore((s) => s.toggleBookmark)
  const comments = useGameStore((s) => s.comments)
  const setComment = useGameStore((s) => s.setComment)

  const [editingComment, setEditingComment] = useState<number | null>(null)
  const [commentValue, setCommentValue] = useState("")

  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [history.length])

  const pairs: { white?: (typeof history)[0]; black?: (typeof history)[0] }[] = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      white: history[i],
      black: history[i + 1],
    })
  }

  const handleSaveComment = (idx: number) => {
    setComment(idx, commentValue)
    setEditingComment(null)
    setCommentValue("")
  }

  const handleStartComment = (idx: number) => {
    setEditingComment(idx)
    setCommentValue(comments[idx] ?? "")
  }

  const atEnd = historyIndex >= history.length

  return (
    <div className="flex flex-col max-h-40 md:h-full md:max-h-none">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-gray-400">
          History
        </span>
        <div className="flex items-center gap-0.5 md:gap-1">
          <button
            onClick={goToStart}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            |&#x25C1;
          </button>
          <button
            onClick={goBack}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            &#x25C1;
          </button>
          <button
            onClick={togglePlay}
            disabled={atEnd}
            className={`px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] transition-colors disabled:opacity-30 ${
              isPlaying ? "text-black" : "text-gray-400 hover:text-black"
            }`}
          >
            {isPlaying ? "&#x25A0;" : "&#x25B6;"}
          </button>
          <button
            onClick={goForward}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            &#x25B7;
          </button>
          <button
            onClick={goToEnd}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            &#x25B7;|
          </button>
        </div>
      </div>

      {isPlaying && (
        <div className="flex items-center gap-1.5 px-3 pb-1.5">
          <button
            onClick={() => setPlaySpeed(1500)}
            className={`font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 transition-colors ${
              playSpeed === 1500 ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Slow
          </button>
          <button
            onClick={() => setPlaySpeed(500)}
            className={`font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 transition-colors ${
              playSpeed === 500 ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Med
          </button>
          <button
            onClick={() => setPlaySpeed(100)}
            className={`font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 transition-colors ${
              playSpeed === 100 ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Fast
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-1">
        {pairs.length === 0 && (
          <p className="py-2 md:py-4 text-center font-mono text-[10px] text-gray-300">
            No moves yet
          </p>
        )}

        {pairs.map((pair, i) => {
          const moveNum = i + 1
          const whiteIdx = i * 2
          const blackIdx = whiteIdx + 1

          const whiteBookmarked = bookmarks.includes(whiteIdx)
          const blackBookmarked = pair.black && bookmarks.includes(blackIdx)

          const whiteComment = comments[whiteIdx]
          const blackComment = pair.black ? comments[blackIdx] : undefined

          return (
            <div key={moveNum}>
              <div className="flex items-center font-mono text-[11px] md:text-xs leading-relaxed">
                <span className="w-5 md:w-6 text-right text-gray-400 tabular-nums">
                  {moveNum}.
                </span>

                <button
                  onClick={() => toggleBookmark(whiteIdx)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleStartComment(whiteIdx)
                  }}
                  className={`ml-0.5 w-3 md:w-3.5 text-center text-[9px] md:text-[10px] transition-colors ${
                    whiteBookmarked
                      ? "text-black"
                      : "text-gray-300 hover:text-black"
                  }`}
                >
                  {whiteBookmarked ? "\u2605" : "\u2606"}
                </button>

                <button
                  onClick={() => goToMove(whiteIdx + 1)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleStartComment(whiteIdx)
                  }}
                  className={`ml-0.5 px-1.5 md:px-1 py-0.5 tabular-nums transition-colors hover:bg-gray-100 ${
                    historyIndex === whiteIdx + 1
                      ? "bg-black text-white"
                      : "text-black"
                  }`}
                >
                  {pair.white!.san}
                </button>

                {pair.black && (
                  <>
                    <button
                      onClick={() => toggleBookmark(blackIdx)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        handleStartComment(blackIdx)
                      }}
                      className={`ml-0.5 w-3 md:w-3.5 text-center text-[9px] md:text-[10px] transition-colors ${
                        blackBookmarked
                          ? "text-black"
                          : "text-gray-300 hover:text-black"
                      }`}
                    >
                      {blackBookmarked ? "\u2605" : "\u2606"}
                    </button>

                    <button
                      onClick={() => goToMove(blackIdx + 1)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        handleStartComment(blackIdx)
                      }}
                      className={`ml-0.5 px-1.5 md:px-1 py-0.5 tabular-nums transition-colors hover:bg-gray-100 ${
                        historyIndex === blackIdx + 1
                          ? "bg-black text-white"
                          : "text-black"
                      }`}
                    >
                      {pair.black.san}
                    </button>
                  </>
                )}

                {whiteComment && (
                  <span className="ml-1 text-[9px] text-gray-400 truncate max-w-[80px]">
                    {whiteComment}
                  </span>
                )}
              </div>

              {editingComment === whiteIdx && (
                <div className="flex items-center gap-1 pl-7 md:pl-8 pr-3 py-1">
                  <input
                    autoFocus
                    value={commentValue}
                    onChange={(e) => setCommentValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSaveComment(whiteIdx)
                      }
                      if (e.key === "Escape") {
                        setEditingComment(null)
                        setCommentValue("")
                      }
                    }}
                    placeholder="Comment..."
                    className="flex-1 bg-transparent font-mono text-[10px] outline-none placeholder:text-gray-300 text-black"
                  />
                  <button
                    onClick={() => handleSaveComment(whiteIdx)}
                    className="font-mono text-[9px] uppercase text-gray-400 hover:text-black"
                  >
                    Save
                  </button>
                </div>
              )}

              {pair.black && editingComment === blackIdx && (
                <div className="flex items-center gap-1 pl-7 md:pl-8 pr-3 py-1">
                  <input
                    autoFocus
                    value={commentValue}
                    onChange={(e) => setCommentValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSaveComment(blackIdx)
                      }
                      if (e.key === "Escape") {
                        setEditingComment(null)
                        setCommentValue("")
                      }
                    }}
                    placeholder="Comment..."
                    className="flex-1 bg-transparent font-mono text-[10px] outline-none placeholder:text-gray-300 text-black"
                  />
                  <button
                    onClick={() => handleSaveComment(blackIdx)}
                    className="font-mono text-[9px] uppercase text-gray-400 hover:text-black"
                  >
                    Save
                  </button>
                </div>
              )}

              {blackComment && editingComment !== blackIdx && (
                <div className="pl-7 md:pl-8 pr-3">
                  <span className="text-[9px] text-gray-400 truncate block leading-snug">
                    {blackComment}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
