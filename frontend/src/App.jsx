import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import Home from './components/Home';
import Sanctuary from './components/Sanctuary';
import ThreeBreaths from './components/ThreeBreaths';
import Settings from './components/Settings';
import Disclaimer from './components/Disclaimer';
import ChapterExplorer from './components/ChapterExplorer';
import WisdomSearch from './components/WisdomSearch';
import ReflectionJournal from './components/ReflectionJournal';
import CommandPalette from './components/CommandPalette';
import WisdomCardStudio from './components/WisdomCardStudio';
import SoundDock, { SoundPanel } from './components/SoundDock';
import { SOUND_MODES, SoundscapeProvider, useSoundscape } from './components/SoundscapeEngine';
import Sheet, { SheetHeader } from './components/ui/Sheet';
import ToastHost from './components/ui/ToastHost';
import ErrorBoundary from './components/ui/ErrorBoundary';

import { AdaptiveThemeProvider } from './contexts/AdaptiveThemeContext';
import { useUserAura } from './hooks/useUserAura';
import { useIsMobile } from './hooks/useMediaQuery';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInstallPrompt } from './hooks/useInstallPrompt';

import { loadSettings, saveSettings } from './lib/settings';
import { setChimesEnabled } from './lib/chime';
import { setHapticsEnabled, installTapHaptics } from './lib/haptics';
import { hotkeysBlocked, topLayer } from './lib/layers';
import { isTypingTarget } from './lib/platform';
import { toast } from './lib/toast';
import { REFLECTIONS_EVENT, WISDOM_CARD_EVENT, readReflections, verseRef } from './lib/verse';
import { moodById } from './components/MoodSelector';

const PANELS = ['settings', 'about', 'chapters', 'search', 'journal'];

function hasActiveBreathSession() {
    try {
        const session = JSON.parse(localStorage.getItem('breathSession') || 'null');
        if (session && new Date() < new Date(session.expiresAt)) return session.intent;
    } catch {
        // fall through
    }
    localStorage.removeItem('breathSession');
    return null;
}

function AppContent({ settings, setSettings }) {
    const [sessionIntent, setSessionIntent] = useState(hasActiveBreathSession);
    const [needsBreathCheck, setNeedsBreathCheck] = useState(() => !sessionIntent);

    const [selectedMood, setSelectedMood] = useState(null);
    const [initialVerse, setInitialVerse] = useState(null);
    const [sanctuaryKey, setSanctuaryKey] = useState(0);

    const [activePanel, setActivePanel] = useState(null);
    const pendingPanel = useRef(null);
    const [chapterTarget, setChapterTarget] = useState(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [soundSheetOpen, setSoundSheetOpen] = useState(false);
    const [cardRequest, setCardRequest] = useState(null);
    const [journalCount, setJournalCount] = useState(() => readReflections().length);

    const { trackMood, clearMood } = useUserAura();
    const soundscape = useSoundscape();
    const isMobile = useIsMobile();
    const online = useOnlineStatus();
    const install = useInstallPrompt();

    const view = selectedMood ? 'sanctuary' : 'home';

    // ----- navigation -------------------------------------------------------

    const goHome = useCallback(() => {
        setSelectedMood(null);
        setInitialVerse(null);
        clearMood();
        window.scrollTo({ top: 0 });
    }, [clearMood]);

    const closePanel = useCallback(() => {
        setActivePanel(null);
        setChapterTarget(null);
    }, []);

    const openPanel = useCallback((panel) => {
        setPaletteOpen(false);
        setSoundSheetOpen(false);
        if (panel !== 'chapters') setChapterTarget(null);
        setActivePanel(PANELS.includes(panel) ? panel : null);
    }, []);

    const openChapter = useCallback((chapter) => {
        setPaletteOpen(false);
        setChapterTarget({ chapter, nonce: Date.now() });
        setActivePanel('chapters');
    }, []);

    const enterSanctuary = useCallback((mood, verse = null) => {
        setActivePanel(null);
        setPaletteOpen(false);
        setInitialVerse(verse);
        setSelectedMood(mood);
        setSanctuaryKey((key) => key + 1);
        trackMood(mood);
        window.scrollTo({ top: 0 });
    }, [trackMood]);

    const selectMood = useCallback((mood) => enterSanctuary(mood), [enterSanctuary]);

    const selectVerse = useCallback((verse) => {
        const theme = verse.core_theme?.[0]?.toLowerCase() || 'peace';
        enterSanctuary(theme, verse);
    }, [enterSanctuary]);

    const beginBreaths = useCallback(() => {
        localStorage.removeItem('breathSession');
        setActivePanel(null);
        setPaletteOpen(false);
        setNeedsBreathCheck(true);
    }, []);

    const handleBreathComplete = useCallback((intent) => {
        setSessionIntent(intent);
        setNeedsBreathCheck(false);
        // A shortcut that arrived during the ritual opens once it is complete.
        if (pendingPanel.current) {
            setActivePanel(pendingPanel.current);
            pendingPanel.current = null;
        }
    }, []);

    // ----- settings shortcuts ----------------------------------------------

    const updateSettings = useCallback((patch) => setSettings((current) => ({ ...current, ...patch })), [setSettings]);

    const playSound = useCallback((mode) => {
        updateSettings({ soundMode: mode });
        soundscape.play(mode);
        const label = SOUND_MODES.find((item) => item.id === mode)?.label || 'Soundscape';
        toast(mode === 'auto' ? 'Soundscape follows your mood' : `${label} soundscape`, { icon: 'sound' });
    }, [soundscape, updateSettings]);

    const actions = useMemo(() => ({
        openPanel,
        openChapter,
        goHome,
        selectMood,
        selectVerse,
        beginBreaths,
        playSound,
        muteSound: soundscape.stop,
        toggleLanguage: () => {
            const language = settings.language === 'hi' ? 'en' : 'hi';
            updateSettings({ language });
            toast(language === 'hi' ? 'ज्ञान अब हिंदी में' : 'Wisdom now in English');
        },
        toggleSilent: () => {
            updateSettings({ silentMode: !settings.silentMode });
            toast(settings.silentMode ? 'Silent Presence off' : 'Silent Presence on — verses only');
        },
        install: install.install
    }), [openPanel, openChapter, goHome, selectMood, selectVerse, beginBreaths, playSound, soundscape.stop, settings.language, settings.silentMode, updateSettings, install.install]);

    // ----- global effects ---------------------------------------------------

    useEffect(() => installTapHaptics(), []);

    useEffect(() => soundscape.setMood(selectedMood), [selectedMood, soundscape]);

    useEffect(() => {
        const update = () => setJournalCount(readReflections().length);
        window.addEventListener(REFLECTIONS_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(REFLECTIONS_EVENT, update);
            window.removeEventListener('storage', update);
        };
    }, []);

    useEffect(() => {
        const onCard = (event) => {
            setPaletteOpen(false);
            setCardRequest({ ...event.detail, nonce: Date.now() });
        };
        window.addEventListener(WISDOM_CARD_EVENT, onCard);
        return () => window.removeEventListener(WISDOM_CARD_EVENT, onCard);
    }, []);

    // Deep links from manifest shortcuts: /?open=search|journal|chapters
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const panel = params.get('open');
        if (panel && PANELS.includes(panel)) {
            if (needsBreathCheck) pendingPanel.current = panel;
            else setActivePanel(panel);
        }
        if (params.has('open') || params.has('source')) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        // Runs once, against the state the app launched with.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const mood = moodById(selectedMood);
        if (!selectedMood) document.title = 'Living Gita — A Quiet Sanctuary';
        else if (initialVerse) document.title = `Bhagavad Gita ${verseRef(initialVerse)} · Living Gita`;
        else document.title = `${mood ? mood.label : selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)} · Living Gita`;
    }, [selectedMood, initialVerse]);

    // ----- keyboard ---------------------------------------------------------

    useEffect(() => {
        if (needsBreathCheck) return undefined;

        const onKeyDown = (event) => {
            const key = event.key;
            const mod = event.metaKey || event.ctrlKey;

            if (mod && !event.altKey && !event.shiftKey && key.toLowerCase() === 'k') {
                event.preventDefault();
                setPaletteOpen((open) => !open);
                return;
            }

            if (key === 'Escape') {
                const layer = topLayer();
                if (layer) {
                    event.preventDefault();
                    layer.onEscape?.();
                    return;
                }
                if (isTypingTarget(event.target)) {
                    event.target.blur();
                    return;
                }
                if (selectedMood) goHome();
                return;
            }

            if (mod || event.altKey || event.defaultPrevented || event.repeat) return;
            if (isTypingTarget(event.target) || hotkeysBlocked()) return;

            switch (key) {
                case 'j':
                case 'J':
                    event.preventDefault();
                    openPanel('journal');
                    break;
                case 'c':
                case 'C':
                    event.preventDefault();
                    openPanel('chapters');
                    break;
                case '/':
                case 's':
                case 'S':
                    event.preventDefault();
                    openPanel('search');
                    break;
                case '?':
                    event.preventDefault();
                    setPaletteOpen(true);
                    break;
                default:
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [needsBreathCheck, selectedMood, goHome, openPanel]);

    // ----- render -----------------------------------------------------------

    const sessionSettings = useMemo(() => ({ ...settings, sessionIntent }), [settings, sessionIntent]);

    return (
        <>
            <div className="atmosphere" aria-hidden="true" />

            {needsBreathCheck ? (
                <ThreeBreaths onComplete={handleBreathComplete} />
            ) : (
                <div className={`app-shell${view === 'sanctuary' ? ' is-sanctuary' : ''}`}>
                    <a className="skip-link" href="#main">Skip to content</a>
                    <AppHeader
                        view={view}
                        mood={selectedMood}
                        verse={initialVerse}
                        journalCount={journalCount}
                        isMobile={isMobile}
                        install={install}
                        onHome={goHome}
                        openPanel={openPanel}
                        openPalette={() => setPaletteOpen(true)}
                        onOpenSound={() => setSoundSheetOpen(true)}
                    />

                    <main id="main" className="app-main">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={view === 'home' ? 'home' : `sanctuary-${sanctuaryKey}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.35 }}
                            >
                                {view === 'home' ? (
                                    <Home
                                        settings={settings}
                                        onSelectMood={selectMood}
                                        onSelectVerse={selectVerse}
                                        openPanel={openPanel}
                                        journalCount={journalCount}
                                    />
                                ) : (
                                    <Sanctuary
                                        mood={selectedMood}
                                        initialVerse={initialVerse}
                                        settings={sessionSettings}
                                        onBack={goHome}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>

                    {isMobile && view === 'home' && (
                        <TabBar
                            active={activePanel || 'home'}
                            journalCount={journalCount}
                            onNavigate={(id) => (id === 'home' ? closePanel() : openPanel(id))}
                        />
                    )}
                </div>
            )}

            {!isMobile && !needsBreathCheck && (
                <SoundDock onModeChange={(mode) => updateSettings({ soundMode: mode })} />
            )}

            <Sheet isOpen={soundSheetOpen} onClose={() => setSoundSheetOpen(false)} label="Soundscape" width={420}>
                <div className="sheet__body sheet__body--padded">
                    <SoundPanel onModeChange={(mode) => updateSettings({ soundMode: mode })} />
                </div>
            </Sheet>

            <Settings
                isOpen={activePanel === 'settings'}
                onClose={closePanel}
                settings={settings}
                onUpdate={setSettings}
                onResetBreathSession={beginBreaths}
                install={install}
            />
            <Disclaimer isOpen={activePanel === 'about'} onClose={closePanel} />
            <ChapterExplorer
                isOpen={activePanel === 'chapters'}
                onClose={closePanel}
                language={settings.language}
                initialChapter={chapterTarget}
                onSelectChapter={(chapter) => selectMood(chapter.helps_with?.[0]?.toLowerCase() || 'peace')}
                onSelectVerse={selectVerse}
            />
            <WisdomSearch
                isOpen={activePanel === 'search'}
                onClose={closePanel}
                language={settings.language}
                onSelectVerse={selectVerse}
            />
            <ReflectionJournal
                isOpen={activePanel === 'journal'}
                onClose={closePanel}
                onSelectVerse={selectVerse}
            />

            <CommandPalette
                isOpen={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                actions={actions}
                settings={settings}
                view={view}
                journalCount={journalCount}
                install={install}
            />

            <WisdomCardStudio request={cardRequest} onClose={() => setCardRequest(null)} defaultLanguage={settings.language} />

            <AnimatePresence>
                {!online && (
                    <motion.div
                        className="offline-pill"
                        role="status"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                    >
                        <WifiOff size={13} /> Offline · wisdom kept on this device
                    </motion.div>
                )}
            </AnimatePresence>

            <ToastHost />
        </>
    );
}

function App() {
    const [settings, setSettings] = useState(() => {
        const loaded = loadSettings();
        setChimesEnabled(loaded.chimes);
        setHapticsEnabled(loaded.haptics);
        return loaded;
    });

    useEffect(() => {
        saveSettings(settings);
        setChimesEnabled(settings.chimes);
        setHapticsEnabled(settings.haptics);
    }, [settings]);

    return (
        <ErrorBoundary>
            <AdaptiveThemeProvider>
                <SoundscapeProvider initialSoundMode={settings.soundMode}>
                    <AppContent settings={settings} setSettings={setSettings} />
                </SoundscapeProvider>
            </AdaptiveThemeProvider>
        </ErrorBoundary>
    );
}

export default App;
