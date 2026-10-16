import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Download, Feather, Info, Search, Settings as SettingsIcon, Volume2, Waves } from 'lucide-react';
import LotusMark from './ui/LotusMark';
import { moodById } from './MoodSelector';
import { useSoundscape } from './SoundscapeEngine';
import { MOD_KEY } from '../lib/platform';
import { verseRef } from '../lib/verse';

function AppHeader({ view, mood, verse, journalCount, isMobile, install, onHome, openPanel, openPalette, onOpenSound }) {
    const [scrolled, setScrolled] = useState(false);
    const { isPlaying } = useSoundscape();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const moodInfo = moodById(mood);
    const inSanctuary = view === 'sanctuary';

    return (
        <header className={`app-header${scrolled || inSanctuary ? ' is-scrolled' : ''}`}>
            <div className="app-header__inner">
                {inSanctuary ? (
                    <div className="header-context">
                        <button type="button" className="icon-btn" onClick={onHome} aria-label="Return to sanctuary home" title="Home (Esc)">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="header-context__title">
                            {verse ? (
                                <>
                                    <strong>Bhagavad Gita {verseRef(verse)}</strong>
                                    <span>Sitting with a verse</span>
                                </>
                            ) : (
                                <>
                                    <strong>{moodInfo ? moodInfo.label : mood ? mood.charAt(0).toUpperCase() + mood.slice(1) : 'Sanctuary'}</strong>
                                    <span>{moodInfo ? <span lang="hi">{moodInfo.hindi}</span> : 'Sitting with the Gita'}</span>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <button type="button" className="brand" onClick={onHome} aria-label="Living Gita — home">
                        <LotusMark size={30} className="brand__mark" />
                        <span className="brand__text">
                            <span className="brand__name">Living Gita</span>
                            <span className="brand__tagline">A quiet sanctuary</span>
                        </span>
                    </button>
                )}

                <nav className="header-actions" aria-label="Sanctuary">
                    {isMobile ? (
                        <>
                            <button type="button" className={`icon-btn${isPlaying ? ' is-on' : ''}`} onClick={onOpenSound} aria-label="Soundscape">
                                {isPlaying ? <Waves size={18} /> : <Volume2 size={18} />}
                            </button>
                            <button type="button" className="icon-btn" onClick={() => openPanel('about')} aria-label="About and safety">
                                <Info size={18} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="search-trigger" onClick={openPalette} aria-label="Search verses, chapters and moods" aria-keyshortcuts="Control+K Meta+K">
                                <Search size={15} />
                                <span>Search verses, chapters, moods…</span>
                                <span className="kbd-group"><span className="kbd">{MOD_KEY}</span><span className="kbd">K</span></span>
                            </button>
                            {install?.available && install.canPrompt && (
                                <button type="button" className="install-chip" onClick={install.install}>
                                    <Download size={13} /> Install app
                                </button>
                            )}
                            <button type="button" className="icon-btn" onClick={() => openPanel('chapters')} aria-label="18 Chapters" title="18 Chapters (C)">
                                <BookOpen size={17} />
                            </button>
                            <button type="button" className="icon-btn" onClick={() => openPanel('journal')} aria-label="Reflections journal" title="Reflections journal (J)">
                                <Feather size={17} />
                                {journalCount > 0 && <span className="badge">{journalCount > 99 ? '99+' : journalCount}</span>}
                            </button>
                            <button type="button" className="icon-btn" onClick={() => openPanel('about')} aria-label="About and safety" title="About & safety">
                                <Info size={17} />
                            </button>
                            <button type="button" className="icon-btn" onClick={() => openPanel('settings')} aria-label="Preferences" title="Preferences">
                                <SettingsIcon size={17} />
                            </button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}

export default AppHeader;
