import React, { useEffect, useState } from 'react';
import { Wind, Bell, Pause, Play, Download, Check, CloudOff, Volume1, ShieldCheck, Settings as SettingsIcon, ArrowRight } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { IosInstallSteps } from './InstallCard';
import { SOUND_MODES, useSoundscape } from './SoundscapeEngine';
import { DEFAULT_SETTINGS, purgeLocalData } from '../lib/settings';
import { playChime } from '../lib/chime';
import { haptic, supportsHaptics } from '../lib/haptics';
import { toast } from '../lib/toast';
import { MOD_KEY } from '../lib/platform';
import { SCRIPTS, ensureScriptFont, scriptFontFamily, transliterate } from '../lib/script';
import { getOfflineLibraryStatus } from '../pwa/registerServiceWorker';
import { useHasKeyboard } from '../hooks/useMediaQuery';
import { LANGUAGES, useI18n } from '../i18n';

// One short word — dharma — shown in each script, so every tile reads at a glance.
const SAMPLE = 'धर्म';

function Group({ title, children }) {
    return (
        <section className="settings-group">
            <h3 className="eyebrow">{title}</h3>
            <div className="settings-group__rows">{children}</div>
        </section>
    );
}

function Row({ label, description, children, stacked = false }) {
    return (
        <div className={`settings-row${stacked ? ' settings-row--stacked' : ''}`}>
            <div className="settings-row__text">
                <span className="settings-row__label">{label}</span>
                {description && <span className="settings-row__description">{description}</span>}
            </div>
            <div className="settings-row__control">{children}</div>
        </div>
    );
}

function Switch({ checked, onChange, label, disabled }) {
    return (
        <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />
    );
}

function Segmented({ value, options, onChange, label }) {
    return (
        <div className="segmented" role="group" aria-label={label}>
            {options.map((option) => (
                <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function Settings({ isOpen, onClose, settings, onUpdate, onResetBreathSession, openPanel, install }) {
    const { t } = useI18n();
    const soundscape = useSoundscape();
    const hasKeyboard = useHasKeyboard();
    const [confirmPurge, setConfirmPurge] = useState(false);
    const [library, setLibrary] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setConfirmPurge(false);
        getOfflineLibraryStatus().then(setLibrary);
        // Preview every script in its own font.
        SCRIPTS.forEach((script) => ensureScriptFont(script.id));
    }, [isOpen]);

    const set = (patch) => onUpdate({ ...settings, ...patch });
    const hapticsAvailable = supportsHaptics();

    const purge = () => {
        purgeLocalData();
        onUpdate({ ...DEFAULT_SETTINGS });
        setConfirmPurge(false);
        toast(t('settings.purged'), { icon: 'check' });
    };

    const shortcuts = [
        [[MOD_KEY, 'K'], t('keys.search')],
        [['P'], t('keys.practice')],
        [['J'], t('keys.journal')],
        [['C'], t('keys.chapters')],
        [['/'], t('keys.finder')],
        [['Esc'], t('keys.escape')],
        [['Space'], t('keys.space')]
    ];

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('settings.title')} width={600} size="tall">
            <SheetHeader icon={SettingsIcon} eyebrow={t('settings.eyebrow')} title={t('settings.title')} onClose={onClose} />

            <div className="sheet__body sheet__body--padded settings">
                <Group title={t('settings.group.you')}>
                    <Row label={t('settings.name')} description={t('settings.nameDesc')} stacked>
                        <input
                            className="input settings-name"
                            value={settings.name || ''}
                            onChange={(event) => set({ name: event.target.value.slice(0, 24) })}
                            onBlur={(event) => set({ name: event.target.value.trim() })}
                            placeholder={t('home.name.placeholder')}
                            aria-label={t('settings.name')}
                            autoComplete="given-name"
                            maxLength={24}
                        />
                    </Row>
                </Group>

                <Group title={t('settings.group.light')}>
                    <Row label={t('settings.theme')} description={t('settings.themeDesc')} stacked>
                        <div className="theme-grid" role="radiogroup" aria-label={t('settings.theme')}>
                            {['dawn', 'night', 'auto'].map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="radio"
                                    aria-checked={(settings.theme || 'dawn') === id}
                                    className={`theme-option theme-option--${id}`}
                                    onClick={() => set({ theme: id })}
                                >
                                    <span className="theme-option__swatch" aria-hidden="true" />
                                    <span className="theme-option__name">{t(`settings.theme.${id}`)}</span>
                                    <span className="theme-option__hint">{t(`settings.theme.${id}.hint`)}</span>
                                </button>
                            ))}
                        </div>
                    </Row>
                </Group>

                <Group title={t('settings.group.language')}>
                    <Row label={t('settings.language')} description={t('settings.languageDesc')} stacked>
                        <Segmented
                            label={t('settings.language')}
                            value={settings.language}
                            onChange={(language) => set({ language })}
                            options={LANGUAGES.map((language) => ({ value: language.id, label: language.native }))}
                        />
                    </Row>
                    <Row label={t('settings.script')} description={t('settings.scriptDesc')} stacked>
                        <div className="script-grid" role="radiogroup" aria-label={t('settings.script')}>
                            {SCRIPTS.map((script) => (
                                <button
                                    key={script.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={(settings.script || 'deva') === script.id}
                                    className="script-option"
                                    onClick={() => set({ script: script.id })}
                                >
                                    <span className="script-option__sample" style={{ fontFamily: scriptFontFamily(script.id) }}>
                                        {script.id === 'iast' ? 'dharma' : transliterate(SAMPLE, script.id)}
                                    </span>
                                    <span className="script-option__name">{script.native}</span>
                                </button>
                            ))}
                        </div>
                    </Row>
                </Group>

                <Group title={t('settings.group.wisdom')}>
                    <Row label={t('settings.depth')} description={t('settings.depthDesc')} stacked>
                        <Segmented
                            label={t('settings.depth')}
                            value={settings.depth}
                            onChange={(depth) => set({ depth })}
                            options={[
                                { value: 'brief', label: t('settings.depth.brief') },
                                { value: 'standard', label: t('settings.depth.standard') },
                                { value: 'deep', label: t('settings.depth.deep') }
                            ]}
                        />
                    </Row>
                    <Row label={t('settings.silent')} description={t('settings.silentDesc')}>
                        <Switch label={t('settings.silent')} checked={settings.silentMode} onChange={(silentMode) => set({ silentMode })} />
                    </Row>
                </Group>

                <Group title={t('settings.group.sound')}>
                    <Row label={t('sound.title')} description={t('settings.soundDesc')} stacked>
                        <div className="settings-sound">
                            <Segmented
                                label={t('sound.title')}
                                value={settings.soundMode}
                                onChange={(soundMode) => set({ soundMode })}
                                options={SOUND_MODES.map((mode) => ({ value: mode.id, label: t(`sound.${mode.id}.short`) }))}
                            />
                            <div className="settings-sound__row">
                                <button type="button" className={`icon-btn icon-btn--sm icon-btn--ring${soundscape.isPlaying ? ' is-on' : ''}`} onClick={soundscape.toggleSound} aria-label={soundscape.isPlaying ? t('sound.pause') : t('sound.play')}>
                                    {soundscape.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                </button>
                                <label className="volume-row">
                                    <Volume1 size={15} aria-hidden="true" />
                                    <input
                                        className="range"
                                        type="range"
                                        min="0.02"
                                        max="1"
                                        step="0.01"
                                        value={soundscape.volume}
                                        onChange={(event) => soundscape.setVolume(Number(event.target.value))}
                                        style={{ '--fill': `${Math.round(soundscape.volume * 100)}%` }}
                                        aria-label={t('sound.volume')}
                                    />
                                    <span>{Math.round(soundscape.volume * 100)}%</span>
                                </label>
                            </div>
                        </div>
                    </Row>
                    <Row label={t('settings.chimes')} description={t('settings.chimesDesc')}>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => playChime('bowl', { force: true })}>
                            <Bell size={14} /> {t('settings.hear')}
                        </button>
                        <Switch label={t('settings.chimes')} checked={settings.chimes} onChange={(chimes) => set({ chimes })} />
                    </Row>
                    <Row label={t('settings.haptics')} description={hapticsAvailable ? t('settings.hapticsDesc') : t('settings.hapticsNone')}>
                        <Switch
                            label={t('settings.haptics')}
                            checked={settings.haptics && hapticsAvailable}
                            disabled={!hapticsAvailable}
                            onChange={(haptics) => {
                                set({ haptics });
                                if (haptics) setTimeout(() => haptic('success'), 30);
                            }}
                        />
                    </Row>
                    <Row label={t('breaths.companion')} description={t('settings.companionDesc')}>
                        <Switch label={t('breaths.companion')} checked={settings.breathMode} onChange={(breathMode) => set({ breathMode })} />
                    </Row>
                </Group>

                <Group title={t('settings.group.ritual')}>
                    <Row label={t('settings.breaths')} description={t('settings.breathsDesc')}>
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => { onClose(); onResetBreathSession?.(); }}>
                            <Wind size={14} /> {t('settings.beginAgain')}
                        </button>
                    </Row>
                </Group>

                <Group title={t('settings.group.app')}>
                    <Row
                        label={t('install.title')}
                        description={install?.standalone
                            ? t('install.installed')
                            : install?.canPrompt
                                ? t('install.canPrompt')
                                : install?.needsIosInstructions ? t('install.ios') : t('install.unsupported')}
                        stacked={Boolean(install?.needsIosInstructions)}
                    >
                        {install?.standalone && <span className="chip"><Check size={12} /> {t('install.installedChip')}</span>}
                        {install?.canPrompt && (
                            <button type="button" className="btn btn--gold btn--sm" onClick={install.install}>
                                <Download size={14} /> {t('install.short')}
                            </button>
                        )}
                        {install?.needsIosInstructions && <IosInstallSteps />}
                    </Row>
                    <Row
                        label={t('settings.offline')}
                        description={!library || !library.supported
                            ? t('settings.offline.unsupported')
                            : library.ready
                                ? t('settings.offline.ready')
                                : library.chapters ? t('settings.offline.gathering', { count: library.chapters }) : t('settings.offline.later')}
                    >
                        {library?.ready ? <span className="chip"><Check size={12} /> {t('settings.offline.readyChip')}</span> : <CloudOff size={16} className="faint" />}
                    </Row>
                    {hasKeyboard && (
                        <div className="shortcut-list">
                            <span className="settings-row__label">{t('settings.shortcuts')}</span>
                            <dl>
                                {shortcuts.map(([keys, label]) => (
                                    <div key={label}>
                                        <dt className="kbd-group">{keys.map((key) => <span key={key} className="kbd">{key}</span>)}</dt>
                                        <dd>{label}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                    <button type="button" className="settings-link" onClick={() => openPanel?.('about')}>
                        <span>
                            <strong>{t('about.short')}</strong>
                            <span>{t('about.shortDesc')}</span>
                        </span>
                        <ArrowRight size={16} />
                    </button>
                </Group>

                <Group title={t('settings.group.privacy')}>
                    <div className="privacy-note">
                        <ShieldCheck size={18} aria-hidden="true" />
                        <p>{t('settings.privacy')}</p>
                    </div>
                    {confirmPurge ? (
                        <div className="purge-confirm">
                            <span>{t('settings.purgeConfirm')}</span>
                            <div>
                                <button type="button" className="btn btn--danger btn--sm" onClick={purge}>{t('settings.purgeYes')}</button>
                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmPurge(false)}>{t('common.keep')}</button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" className="settings-danger" onClick={() => setConfirmPurge(true)}>{t('settings.purge')}</button>
                    )}
                </Group>

                <p className="settings__signature">{t('settings.signature')}</p>
            </div>
        </Sheet>
    );
}

export default Settings;
