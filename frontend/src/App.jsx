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
import PracticeHub from './components/PracticeHub';
import PathView from './components/PathView';
import Japa from './components/practices/Japa';
import Dhyana from './components/practices/Dhyana';
import Sankalpa from './components/practices/Sankalpa';
import Sandhya from './components/practices/Sandhya';
import Svadhyaya from './components/practices/Svadhyaya';
import SoundDock, { SoundPanel } from './components/SoundDock';
import { SOUND_MODES, SoundscapeProvider, useSoundscape } from './components/SoundscapeEngine';
import Sheet from './components/ui/Sheet';
import ToastHost from './components/ui/ToastHost';
import PetalShower from './components/ui/PetalShower';
import ErrorBoundary from './components/ui/ErrorBoundary';

import { AdaptiveThemeProvider } from './contexts/AdaptiveThemeContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { useUserAura } from './hooks/useUserAura';
import { useIsMobile } from './hooks/useMediaQuery';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useI18n } from './i18n';

import { loadSettings, saveSettings } from './lib/settings';
import { setChimesEnabled } from './lib/chime';
import { setHapticsEnabled, installTapHaptics } from './lib/haptics';
import { hotkeysBlocked, topLayer } from './lib/layers';
import { isTypingTarget } from './lib/platform';
import { toast } from './lib/toast';
import { REFLECTIONS_EVENT, WISDOM_CARD_EVENT, readReflections, verseRef } from './lib/verse';
import { PRACTICE_EVENT, VERSE_EVENT } from './lib/bus';
import { recordPath } from './lib/path';
import { fetchDaily, fetchVerse } from './lib/gitaApi';
import { prepareSakha } from './lib/localSakha';
import { readJourney, startJourney } from './lib/journey';
import { moodById } from './components/MoodSelector';

const PANELS = ['settings', 'about', 'chapters', 'search', 'journal', 'practice', 'path'];
const ROOMS = ['japa', 'dhyana', 'sankalpa', 'sandhya', 'svadhyaya'];

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
    const { t } = useI18n();
    const [sessionIntent, setSessionIntent] = useState(hasActiveBreathSession);
    const [needsBreathCheck, setNeedsBreathCheck] = useState(() => !sessionIntent);

    // A conversation: begun from a mood, a verse, or a question.
    const [session, setSession] = useState(null); // { mood, verse, text, key }
    const [activePanel, setActivePanel] = useState(null);
    const [room, setRoom] = useState(null); // { id, ...payload }
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

    const view = session ? 'sanctuary' : 'home';

    // ----- navigation -------------------------------------------------------

    const goHome = useCallback(() => {
        setSession(null);
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

    const enter = useCallback(({ mood = null, verse = null, text = null }) => {
        setActivePanel(null);
        setPaletteOpen(false);
        setRoom(null);
        setSession({ mood, verse, text, key: Date.now() });
        if (mood) trackMood(mood);
        window.scrollTo({ top: 0 });
    }, [trackMood]);

    const selectMood = useCallback((mood) => {
        recordPath('mood', { mood });
        enter({ mood });
    }, [enter]);

    const selectVerse = useCallback((verse) => {
        const theme = verse.core_theme?.[0]?.toLowerCase() || 'peace';
        enter({ mood: theme, verse });
    }, [enter]);

    const ask = useCallback((text) => enter({ text }), [enter]);

    const beginBreaths = useCallback(() => {
        localStorage.removeItem('breathSession');
        setActivePanel(null);
        setPaletteOpen(false);
        setRoom(null);
        setNeedsBreathCheck(true);
    }, []);

    const openPractice = useCallback((id, payload = {}) => {
        setPaletteOpen(false);
        setActivePanel(null);
        if (id === 'breaths') {
            beginBreaths();
        } else if (id === 'walk') {
            const journey = readJourney();
            if (journey && !journey.completedAt) {
                goHome();
                toast(t('toast.walkActive', { ref: verseRef(journey.verse) }), { icon: 'walk' });
                return;
            }
            fetchDaily()
                .then(({ verse }) => {
                    const result = startJourney(verse);
                    if (result.ok) {
                        recordPath('walk', { verseId: verse.id, day: 0 });
                        toast(t('toast.walkBegins', { ref: verseRef(verse) }), { icon: 'walk', tone: 'gold' });
                    }
                    goHome();
                })
                .catch(() => toast(t('toast.offlineAction')));
        } else if (id === 'journal') {
            openPanel('journal');
        } else if (ROOMS.includes(id)) {
            setRoom({ id, ...payload });
        }
    }, [beginBreaths, goHome, openPanel, t]);

    const handleBreathComplete = useCallback((intent) => {
        setSessionIntent(intent);
        setNeedsBreathCheck(false);
        // The threshold can be scrolled on short screens; home starts at the lamp.
        window.scrollTo({ top: 0 });
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
        const label = SOUND_MODES.find((item) => item.id === mode);
        toast(mode === 'auto' ? t('toast.soundAuto') : t('toast.sound', { name: t(`sound.${label?.id || 'ocean'}.label`) }), { icon: 'sound' });
    }, [soundscape, updateSettings, t]);

    const actions = useMemo(() => ({
        openPanel,
        openChapter,
        openPractice,
        goHome,
        selectMood,
        selectVerse,
        ask,
        beginBreaths,
        playSound,
        muteSound: soundscape.stop,
        toggleLanguage: () => updateSettings({ language: settings.language === 'hi' ? 'en' : 'hi' }),
        toggleSilent: () => {
            updateSettings({ silentMode: !settings.silentMode });
            toast(settings.silentMode ? t('toast.silentOff') : t('toast.silentOn'));
        },
        install: install.install
    }), [openPanel, openChapter, openPractice, goHome, selectMood, selectVerse, ask, beginBreaths, playSound, soundscape.stop, settings.language, settings.silentMode, updateSettings, install.install, t]);

    // ----- global effects ---------------------------------------------------

    useEffect(() => installTapHaptics(), []);

    // Bring the engine and the verses onto the device once the page is calm,
    // so the first conversation answers without waiting.
    useEffect(() => {
        const timer = setTimeout(prepareSakha, 1200);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => soundscape.setMood(session?.mood || null), [session, soundscape]);

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
        const onPractice = (event) => {
            const { id, ...payload } = event.detail;
            openPractice(id, payload);
        };
        const onVerse = (event) => selectVerse(event.detail.verse);
        window.addEventListener(WISDOM_CARD_EVENT, onCard);
        window.addEventListener(PRACTICE_EVENT, onPractice);
        window.addEventListener(VERSE_EVENT, onVerse);
        return () => {
            window.removeEventListener(WISDOM_CARD_EVENT, onCard);
            window.removeEventListener(PRACTICE_EVENT, onPractice);
            window.removeEventListener(VERSE_EVENT, onVerse);
        };
    }, [openPractice, selectVerse]);

    // Deep links: /?open=search|journal|chapters|practice|path and /?verse=2_47
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const panel = params.get('open');
        if (panel && PANELS.includes(panel)) {
            if (needsBreathCheck) pendingPanel.current = panel;
            else setActivePanel(panel);
        }
        const verseId = params.get('verse');
        if (verseId && /^\d{1,2}_\d{1,3}$/.test(verseId)) {
            fetchVerse(verseId).then((verse) => {
                setNeedsBreathCheck(false);
                selectVerse(verse);
            }).catch(() => {});
        }
        if (params.has('open') || params.has('source') || params.has('verse')) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        // Runs once, against the state the app launched with.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const mood = session?.mood && moodById(session.mood);
        if (!session) document.title = t('meta.title');
        else if (session.verse) document.title = `${t('verse.bg')} ${verseRef(session.verse)} · ${t('brand.name')}`;
        else if (mood) document.title = `${t(`mood.${mood.id}.word`)} · ${t('brand.name')}`;
        else document.title = `${t('sanctuary.eyebrow')} · ${t('brand.name')}`;
    }, [session, t]);

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
                if (session) goHome();
                return;
            }

            if (mod || event.altKey || event.defaultPrevented || event.repeat) return;
            if (isTypingTarget(event.target) || hotkeysBlocked()) return;

            const shortcuts = { j: 'journal', c: 'chapters', s: 'search', '/': 'search', p: 'practice' };
            const panel = shortcuts[key.toLowerCase()];
            if (panel) {
                event.preventDefault();
                openPanel(panel);
            } else if (key === '?') {
                event.preventDefault();
                setPaletteOpen(true);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [needsBreathCheck, session, goHome, openPanel]);

    // ----- render -----------------------------------------------------------

    const sessionSettings = useMemo(() => ({ ...settings, sessionIntent }), [settings, sessionIntent]);
    const tab = activePanel || (view === 'home' ? 'home' : null);

    return (
        <>
            <div className="atmosphere" aria-hidden="true" />

            {needsBreathCheck ? (
                <ThreeBreaths onComplete={handleBreathComplete} />
            ) : (
                <div className={`app-shell${view === 'sanctuary' ? ' is-sanctuary' : ''}`}>
                    <a className="skip-link" href="#main">{t('common.skip')}</a>
                    <AppHeader
                        view={view}
                        mood={session?.mood}
                        verse={session?.verse}
                        activePanel={activePanel}
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
                                key={session ? `sanctuary-${session.key}` : 'home'}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.45 }}
                            >
                                {session ? (
                                    <Sanctuary
                                        mood={session.mood}
                                        initialVerse={session.verse}
                                        initialText={session.text}
                                        settings={sessionSettings}
                                        onBack={goHome}
                                    />
                                ) : (
                                    <Home
                                        settings={settings}
                                        onSelectMood={selectMood}
                                        onAsk={ask}
                                        onSelectVerse={selectVerse}
                                        openPractice={openPractice}
                                        openPanel={openPanel}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </main>

                    {isMobile && view === 'home' && (
                        <TabBar
                            active={tab}
                            journalCount={journalCount}
                            onNavigate={(id) => (id === 'home' ? closePanel() : openPanel(id))}
                        />
                    )}
                </div>
            )}

            {!isMobile && !needsBreathCheck && (
                <SoundDock onModeChange={(mode) => updateSettings({ soundMode: mode })} />
            )}

            <Sheet isOpen={soundSheetOpen} onClose={() => setSoundSheetOpen(false)} label={t('sound.title')} width={420}>
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
                openPanel={openPanel}
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
            <WisdomSearch isOpen={activePanel === 'search'} onClose={closePanel} language={settings.language} onSelectVerse={selectVerse} />
            <ReflectionJournal isOpen={activePanel === 'journal'} onClose={closePanel} onSelectVerse={selectVerse} />
            <PracticeHub isOpen={activePanel === 'practice'} onClose={closePanel} onOpen={openPractice} />
            <PathView isOpen={activePanel === 'path'} onClose={closePanel} onSelectVerse={selectVerse} />

            <Japa isOpen={room?.id === 'japa'} onClose={() => setRoom(null)} />
            <Dhyana isOpen={room?.id === 'dhyana'} onClose={() => setRoom(null)} minutes={room?.minutes} />
            <Sankalpa isOpen={room?.id === 'sankalpa'} onClose={() => setRoom(null)} />
            <Sandhya isOpen={room?.id === 'sandhya'} onClose={() => setRoom(null)} />
            <Svadhyaya isOpen={room?.id === 'svadhyaya'} onClose={() => setRoom(null)} verse={room?.verse} />

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
                        <WifiOff size={13} /> {t('offline.pill')}
                    </motion.div>
                )}
            </AnimatePresence>

            <ToastHost />
            <PetalShower />
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

    const updateSettings = useCallback((patch) => setSettings((current) => ({ ...current, ...patch })), []);

    return (
        <ErrorBoundary>
            <PreferencesProvider settings={settings} updateSettings={updateSettings}>
                <AdaptiveThemeProvider>
                    <SoundscapeProvider initialSoundMode={settings.soundMode}>
                        <AppContent settings={settings} setSettings={setSettings} />
                    </SoundscapeProvider>
                </AdaptiveThemeProvider>
            </PreferencesProvider>
        </ErrorBoundary>
    );
}

export default App;
