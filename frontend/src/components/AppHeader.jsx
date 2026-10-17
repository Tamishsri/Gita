import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Search, Settings as SettingsIcon, Volume2, Waves } from 'lucide-react';
import SakhaMark from './ui/SakhaMark';
import { moodById } from './MoodSelector';
import { useSoundscape } from './SoundscapeEngine';
import { MOD_KEY } from '../lib/platform';
import { verseRef } from '../lib/verse';
import { useI18n } from '../i18n';

const NAV = ['practice', 'chapters', 'journal', 'path'];

function AppHeader({ view, mood, verse, activePanel, journalCount, isMobile, install, onHome, openPanel, openPalette, onOpenSound }) {
    const { t } = useI18n();
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

    let title = t('sanctuary.eyebrow');
    let subtitle = t('sanctuary.headerSub');
    if (verse) {
        title = `${t('verse.bg')} ${verseRef(verse)}`;
        subtitle = t('sanctuary.withVerse');
    } else if (moodInfo) {
        title = t(`mood.${moodInfo.id}.word`);
        subtitle = t('sanctuary.headerSub');
    }

    return (
        <header className={`app-header${scrolled || inSanctuary ? ' is-scrolled' : ''}`}>
            <div className="app-header__inner">
                {inSanctuary ? (
                    <div className="header-context">
                        <button type="button" className="icon-btn" onClick={onHome} aria-label={t('header.home')} title={t('header.homeEsc')}>
                            <ArrowLeft size={19} />
                        </button>
                        <div className="header-context__title">
                            <strong>{title}</strong>
                            <span>{subtitle}</span>
                        </div>
                    </div>
                ) : (
                    <button type="button" className="brand" onClick={onHome} aria-label={t('header.brandHome')}>
                        <SakhaMark size={38} className="brand__mark" />
                        <span className="brand__text">
                            <span className="brand__name">{t('brand.name')}</span>
                            <span className="brand__tagline">{t('header.tagline')}</span>
                        </span>
                    </button>
                )}

                {!isMobile && !inSanctuary && (
                    <nav className="header-nav" aria-label={t('header.nav')}>
                        {NAV.map((id) => (
                            <button
                                key={id}
                                type="button"
                                className="header-nav__link"
                                aria-current={activePanel === id ? 'true' : undefined}
                                onClick={() => openPanel(id)}
                            >
                                {t(`nav.${id}`)}
                                {id === 'journal' && journalCount > 0 && <span className="badge">{journalCount > 99 ? '99+' : journalCount}</span>}
                            </button>
                        ))}
                    </nav>
                )}

                <div className="header-actions">
                    {!isMobile && install?.available && install.canPrompt && (
                        <button type="button" className="install-chip" onClick={install.install}>
                            <Download size={13} /> {t('install.short')}
                        </button>
                    )}
                    {isMobile ? (
                        <>
                            <button type="button" className="icon-btn" onClick={() => openPanel('search')} aria-label={t('nav.search')}>
                                <Search size={19} />
                            </button>
                            <button type="button" className={`icon-btn${isPlaying ? ' is-on' : ''}`} onClick={onOpenSound} aria-label={t('sound.title')}>
                                {isPlaying ? <Waves size={19} /> : <Volume2 size={19} />}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="search-trigger" onClick={openPalette} aria-label={t('header.searchAll')} aria-keyshortcuts="Control+K Meta+K">
                            <Search size={15} />
                            <span className="kbd-group"><span className="kbd">{MOD_KEY}</span><span className="kbd">K</span></span>
                        </button>
                    )}
                    <button type="button" className="icon-btn" onClick={() => openPanel('settings')} aria-label={t('nav.settings')} title={t('nav.settings')}>
                        <SettingsIcon size={19} />
                    </button>
                </div>
            </div>
        </header>
    );
}

export default AppHeader;
