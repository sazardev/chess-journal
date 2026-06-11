import { useRef, useEffect, useState } from "react"
import TitleBar from "./components/TitleBar"
import Board from "./components/Board"
import BoardEditor from "./components/BoardEditor"
import EditorPanel from "./components/EditorPanel"
import MoveHistory from "./components/MoveHistory"
import ControlBar from "./components/ControlBar"
import GameReport from "./components/GameReport"
import MoveInput from "./components/MoveInput"
import Library from "./components/Library"
import SettingsPanel from "./components/SettingsPanel"
import ShortcutsOverlay from "./components/ShortcutsOverlay"
import AboutModal from "./components/AboutModal"
import OnboardingModal from "./components/OnboardingModal"
import MobileSettings from "./components/MobileSettings"
import PuzzlePanel from "./components/PuzzlePanel"
import { useUpdateStore } from "./stores/useUpdateStore"
import { useKeyboard } from "./hooks/useKeyboard"
import { useAutoplay } from "./hooks/useAutoplay"
import { useAutosave } from "./hooks/useAutosave"
import { useEngine } from "./hooks/useEngine"
import { useGameAnalyzer } from "./hooks/useGameAnalyzer"
import { useOpeningDetection } from "./hooks/useOpeningDetection"
import { useAnalysisCache } from "./hooks/useAnalysisCache"
import { useTouch } from "./hooks/useTouch"
import { useSound } from "./hooks/useSound"
import { useTheme } from "./hooks/useTheme"
import { useSwipe } from "./hooks/useSwipe"
import { useKeyboardOpen } from "./hooks/useKeyboardOpen"
import { usePlatform } from "./hooks/usePlatform"
import { useGameStore } from "./stores/useGameStore"
import { useBoardStore } from "./stores/useBoardStore"
import { useLibraryStore } from "./stores/useLibraryStore"
import { useMetaStore } from "./stores/useMetaStore"
import { useConfigStore } from "./stores/useConfigStore"
import { usePersistenceStore } from "./stores/usePersistenceStore"
import { usePuzzleStore } from "./stores/usePuzzleStore"
import { usePuzzleProgressStore } from "./stores/usePuzzleProgressStore"
import { useEditorStore } from "./stores/useEditorStore"
import { useAiStore } from "./stores/useAiStore"
import { useAiCacheStore } from "./stores/useAiCacheStore"
import { useAnalysisCacheStore } from "./stores/useAnalysisCacheStore"
import { initTauriGate } from "./lib/tauriGate"
import { newGame, saveNow, toggleCurrentFavorite } from "./lib/session"
import type { Square } from "chess.js"

export default function App() {
  const undo = useGameStore((s) => s.undo)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const togglePlay = useGameStore((s) => s.togglePlay)
  const toggleBookmark = useGameStore((s) => s.toggleBookmark)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const goToPrevBookmark = useGameStore((s) => s.goToPrevBookmark)
  const goToNextBookmark = useGameStore((s) => s.goToNextBookmark)
  const restoreState = useGameStore((s) => s.restoreState)

  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const clearAll = useBoardStore((s) => s.clearAll)

  const configInit = useConfigStore((s) => s.init)
  const configLoaded = useConfigStore((s) => s.loaded)
  const configSetOrientation = useConfigStore((s) => s.setOrientation)
  const configSetPlaySpeed = useConfigStore((s) => s.setPlaySpeed)
  const configSetLastSeenVersion = useConfigStore((s) => s.setLastSeenVersion)
  const openingAnalyzer = useConfigStore((s) => s.openingAnalyzer)
  const aiCommentary = useConfigStore((s) => s.aiCommentary)

  const persistenceInit = usePersistenceStore((s) => s.init)
  const persistenceReady = usePersistenceStore((s) => s.ready)
  const readAutosave = usePersistenceStore((s) => s.readAutosave)

  const loadLibrary = useLibraryStore((s) => s.loadFromStorage)
  const loadPuzzleProgress = usePuzzleProgressStore((s) => s.load)
  const puzzleActive = usePuzzleStore((s) => s.active)
  const editorActive = useEditorStore((s) => s.active)

  const engine = useEngine()
  const analyzer = useGameAnalyzer()

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<"moves" | "analysis">("moves")
  // Mobile-only full-screen Settings page (bottom nav). Desktop uses modals.
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const [restored, setRestored] = useState(false)

  const moveInputRef = useRef<HTMLInputElement>(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    initTauriGate().then(() => {
      configInit().catch(() => {})
      persistenceInit().catch(() => {})
      useAiStore.getState().init().catch(() => {})
      useAiCacheStore.getState().init().catch(() => {})
      useAnalysisCacheStore.getState().init().catch(() => {})
      // Silent check on launch — surfaces a dot on the version chip if newer.
      useUpdateStore.getState().check(true).catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!persistenceReady) return
    loadLibrary()
    loadPuzzleProgress()
  }, [persistenceReady])

  useEffect(() => {
    if (!configLoaded || !persistenceReady) return
    if (restoredRef.current) return
    restoredRef.current = true

    const run = async () => {
      // Apply persisted preferences first; a restored game overrides them.
      const { orientation, playSpeed } = useConfigStore.getState()
      useGameStore.setState({ orientation, playSpeed })

      try {
        const data = await readAutosave()
        if (data?.game?.fullHistory?.length) {
          restoreState(data.game)
          useMetaStore.getState().load(data.meta)

          const b = useBoardStore.getState()
          for (const a of data.board?.arrows ?? []) {
            b.addArrow(a.from as Square, a.to as Square)
          }
          for (const [sq, color] of Object.entries(data.board?.highlights ?? {})) {
            b.highlightSquare(sq as Square, color)
          }
        }
      } catch {
        /* ignore — restore is best-effort */
      }

      setRestored(true)

      // First run (or first run after an update) → show the in-app onboarding.
      if (useConfigStore.getState().lastSeenVersion !== __APP_VERSION__) {
        setOnboardingOpen(true)
      }
    }

    run()

    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.orientation !== prevState.orientation) {
        configSetOrientation(state.orientation)
      }
      if (state.playSpeed !== prevState.playSpeed) {
        configSetPlaySpeed(state.playSpeed)
      }
    })
    return unsub
  }, [configLoaded, persistenceReady])

  useAutosave(restored && persistenceReady)
  useOpeningDetection(configLoaded && openingAnalyzer)
  useAnalysisCache()

  // AI commentary is a single switch: when on, set it up and start it
  // automatically (no manual "start"); when off, stop the engine.
  useEffect(() => {
    if (!configLoaded) return
    if (aiCommentary) useAiStore.getState().enable()
    else useAiStore.getState().disable()
  }, [configLoaded, aiCommentary])

  const closeOnboarding = () => {
    setOnboardingOpen(false)
    configSetLastSeenVersion(__APP_VERSION__)
  }

  useKeyboard(
    {
      ArrowLeft: () => {
        if (!puzzleActive) goBack()
      },
      ArrowRight: () => {
        if (!puzzleActive) goForward()
      },
      "Ctrl+Home": () => goToStart(),
      "Ctrl+End": () => goToEnd(),
      "Ctrl+z": () => undo(),
      "Ctrl+b": () => flipBoard(),
      "Ctrl+n": () => newGame(),
      "Ctrl+s": () => saveNow(),
      "Ctrl+d": () => toggleCurrentFavorite(),
      " ": () => {
        if (!puzzleActive) togglePlay()
      },
      "Ctrl+a": () => toggleAnnotationMode("arrow"),
      "Ctrl+m": () => toggleAnnotationMode("highlight"),
      "Ctrl+x": () => clearAll(),
      "Ctrl+i": () => moveInputRef.current?.focus(),
      "Ctrl+l": () => setLibraryOpen((v) => !v),
      "Ctrl+f": () => setLibraryOpen(true),
      "Ctrl+,": () => setSettingsOpen((v) => !v),
      "Ctrl+/": () => setShortcutsOpen((v) => !v),
      "Shift+?": () => setShortcutsOpen((v) => !v),
      "?": () => setShortcutsOpen((v) => !v),
      "Ctrl+Shift+b": () => toggleBookmark(historyIndex),
      "Ctrl+Shift+ArrowLeft": () => goToPrevBookmark(),
      "Ctrl+Shift+ArrowRight": () => goToNextBookmark(),
      "Escape": () => {
        if (onboardingOpen) return closeOnboarding()
        if (aboutOpen) return setAboutOpen(false)
        if (reportOpen) return setReportOpen(false)
        if (settingsOpen) return setSettingsOpen(false)
        if (shortcutsOpen) return setShortcutsOpen(false)
        if (mobileSettingsOpen) return setMobileSettingsOpen(false)
        if (libraryOpen) return setLibraryOpen(false)
        if (useEditorStore.getState().active) return useEditorStore.getState().exit()
        if (puzzleActive) return usePuzzleStore.getState().exit()
        useBoardStore.setState({ selectedSquare: null })
      },
    },
    [],
  )

  useAutoplay()
  useSound()
  useTheme()

  const touch = useTouch()
  const boardSwipe = useSwipe(goForward, goBack)
  const keyboardOpen = useKeyboardOpen()
  const platform = usePlatform()
  const overlayOpenMobile = libraryOpen || mobileSettingsOpen

  // On Android, `env(safe-area-inset-*)` CSS variables may be 0.
  // Fall back to fixed values so system bars don't clip the UI.
  // The bottom safe area (~48dp for 3-button nav) is handled as root padding
  // so the entire flex layout shifts up, not just the bottom nav.
  const rootPb = platform === "android" ? "pb-[3.5rem]" : ""
  const titleBarH =
    platform === "android" ? "calc(2.25rem + 2rem)" : "calc(2.25rem + env(safe-area-inset-top))"
  const contentPadTop =
    platform === "android"
      ? "pt-[calc(2.25rem+2rem)]"
      : "pt-[calc(2.25rem+env(safe-area-inset-top))]"
  const backdropTop =
    platform === "android"
      ? "top-[calc(2.25rem+2rem)]"
      : "top-[calc(2.25rem+env(safe-area-inset-top))]"
  // Android board gets more vertical space for an immersive feel
  const boardMobile =
    platform === "android" ? "h-[56vh] h-[56dvh]" : "h-[52vh] h-[52dvh]"
  // Bottom nav only needs safe-area padding on iOS (Android handled by rootPb)
  const navPadBottom =
    platform === "android" ? "" : "pb-[env(safe-area-inset-bottom)]"
  // Android: taller touch targets; iOS/desktop: compact
  const navBtn = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-1 ${
      platform === "android" ? "py-3 min-h-[3.5rem]" : "py-2.5"
    } font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
      active ? "text-black" : "text-gray-400"
    }`

  return (
    <div className={`flex h-screen h-dvh flex-col bg-white text-black ${rootPb}`}>
      <TitleBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        mobileSection={libraryOpen ? "library" : mobileSettingsOpen ? "settings" : null}
        onMobileBack={() => {
          setLibraryOpen(false)
          setMobileSettingsOpen(false)
        }}
      />

      {/* Mobile full-screen Settings — fixed overlay so it always fills the
          viewport regardless of any parent's positioning context. TitleBar
          (z-50) renders on top; its back arrow is the only close affordance. */}
      {touch && mobileSettingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-white"
          style={{ paddingTop: titleBarH }}
        >
          <MobileSettings
            onErased={() => {
              setMobileSettingsOpen(false)
              setPanelTab("moves")
            }}
          />
        </div>
      )}

      <div className={`relative flex flex-1 min-h-0 ${contentPadTop}`}>
        <Library open={libraryOpen} onToggle={() => setLibraryOpen((v) => !v)} topInset={titleBarH} />

        {libraryOpen && (
          <div
            className={`fixed inset-x-0 bottom-0 ${backdropTop} z-30 bg-[#00000033] lg:hidden`}
            onClick={() => setLibraryOpen(false)}
          />
        )}

        <div className="flex flex-1 flex-col min-h-0 min-w-0">
          <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0 min-w-0">
          {/* Board (swipe left/right to step through moves on touch) */}
          <div
            className={`flex ${boardMobile} shrink-0 items-center justify-center p-2 md:h-auto md:min-h-0 md:flex-[2] md:p-4`}
            {...(touch && !puzzleActive && !editorActive ? boardSwipe : {})}
          >
            {editorActive ? <BoardEditor /> : <Board engine={engine} />}
          </div>

          {/* Desktop side panel — swapped out for the editor / puzzle panels */}
          <div className="hidden min-h-0 shrink-0 flex-col border-l border-gray-100 md:flex md:w-56 lg:w-64">
            {editorActive ? (
              <EditorPanel />
            ) : puzzleActive ? (
              <PuzzlePanel />
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <MoveHistory />
                </div>
                <div className="shrink-0 border-t border-gray-100">
                  <ControlBar engine={engine} analyzer={analyzer} onOpenReport={() => setReportOpen(true)} />
                </div>
              </>
            )}
          </div>

          {/* Mobile panel — switched by the bottom nav (editor / puzzle take over) */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100 md:hidden">
            {editorActive ? (
              <EditorPanel />
            ) : puzzleActive ? (
              <PuzzlePanel />
            ) : panelTab === "moves" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <MoveHistory />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ControlBar engine={engine} analyzer={analyzer} onOpenReport={() => setReportOpen(true)} />
              </div>
            )}
          </div>
        </div>

        {/* Move input — hidden on mobile while a full-screen overlay is open, and
            entirely while solving a puzzle or editing a position (no move list there) */}
        {!puzzleActive && !editorActive && (
          <div className={overlayOpenMobile ? "hidden md:block" : ""}>
            <MoveInput inputRef={moveInputRef} engine={engine} />
          </div>
        )}

        {/* Mobile bottom navigation — hidden while the keyboard is open (docks the
            move input above it) */}
        <nav className={`${keyboardOpen ? "hidden" : "flex"} shrink-0 border-t border-gray-100 ${navPadBottom} md:hidden`}>
        <button
          onClick={() => {
            setLibraryOpen(false)
            setMobileSettingsOpen(false)
            setPanelTab("moves")
          }}
          className={navBtn(!overlayOpenMobile && panelTab === "moves")}
        >
          <svg width={platform === "android" ? 20 : 18} height={platform === "android" ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="4" cy="6" r="0.8" /><circle cx="4" cy="12" r="0.8" /><circle cx="4" cy="18" r="0.8" />
            <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
          </svg>
          Moves
        </button>
        <button
          onClick={() => {
            setLibraryOpen(false)
            setMobileSettingsOpen(false)
            setPanelTab("analysis")
          }}
          className={navBtn(!overlayOpenMobile && panelTab === "analysis")}
        >
          <svg width={platform === "android" ? 20 : 18} height={platform === "android" ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />
          </svg>
          Analysis
        </button>
        <button
          onClick={() => {
            setMobileSettingsOpen(false)
            setLibraryOpen((v) => !v)
          }}
          className={navBtn(libraryOpen)}
        >
          <svg width={platform === "android" ? 20 : 18} height={platform === "android" ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="M3 13l9 5 9-5" />
          </svg>
          Library
        </button>
        <button
          onClick={() => {
            setLibraryOpen(false)
            setMobileSettingsOpen((v) => !v)
          }}
          className={navBtn(mobileSettingsOpen)}
        >
          <svg width={platform === "android" ? 20 : 18} height={platform === "android" ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </nav>

        </div>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {reportOpen && <GameReport onClose={() => setReportOpen(false)} />}
      {onboardingOpen && <OnboardingModal onClose={closeOnboarding} />}
    </div>
  )
}
