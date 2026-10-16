import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Wind, Bell, Pause, Play, Download, Check, CloudOff, Volume1, ShieldCheck } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { IosInstallSteps } from './InstallCard';
import { SOUND_MODES, useSoundscape } from './SoundscapeEngine';
import { DEFAULT_SETTINGS, purgeLocalData } from '../lib/settings';
import { playChime } from '../lib/chime';
import { haptic, supportsHaptics } from '../lib/haptics';
import { toast } from '../lib/toast';
import { MOD_KEY } from '../lib/platform';
import { getOfflineLibraryStatus } from '../pwa/registerServiceWorker';
import { useHasKeyboard } from '../hooks/useMediaQuery';

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
        <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
        />
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

const SHORTCUTS = [
    [[MOD_KEY, 'K'], 'Search anything'],
    [['/'], 'Wisdom Finder'],
    [['J'], 'Reflections journal'],
    [['C'], '18 Chapters'],
    [['Esc'], 'Close, or return home'],
    [['Space'], 'Pause the breathing ritual']
];

function Settings({ isOpen, onClose, settings, onUpdate, onResetBreathSession, install }) {
    const soundscape = useSoundscape();
    const hasKeyboard = useHasKeyboard();
    const [confirmPurge, setConfirmPurge] = useState(false);
    const [library, setLibrary] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setConfirmPurge(false);
        getOfflineLibraryStatus().then(setLibrary);
    }, [isOpen]);

    const set = (patch) => onUpdate({ ...settings, ...patch });
    const hapticsAvailable = supportsHaptics();

    const purge = () => {
        purgeLocalData();
        onUpdate({ ...DEFAULT_SETTINGS });
        setConfirmPurge(false);
        toast('Everything stored on this device has been released.', { icon: 'check' });
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label="Preferences" width={560} size="tall">
            <SheetHeader icon={SettingsIcon} eyebrow="Preferences" title="Your sanctuary" onClose={onClose} />

            <div className="sheet__body sheet__body--padded settings">
                <Group title="Wisdom">
                    <Row label="Language" description="Translations, guidance and voice" stacked>
                        <Segmented
                            label="Language"
                            value={settings.language}
                            onChange={(language) => set({ language })}
                            options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिंदी' }]}
                        />
                    </Row>
                    <Row label="Contemplative depth" description="How much the sanctuary says around each verse" stacked>
                        <Segmented
                            label="Depth"
                            value={settings.depth}
                            onChange={(depth) => set({ depth })}
                            options={[{ value: 'brief', label: 'Brief' }, { value: 'standard', label: 'Standard' }, { value: 'deep', label: 'Deep' }]}
                        />
                    </Row>
                    <Row label="Silent Presence" description="Verses only, without conversation">
                        <Switch label="Silent Presence" checked={settings.silentMode} onChange={(silentMode) => set({ silentMode })} />
                    </Row>
                </Group>

                <Group title="Sound & touch">
                    <Row label="Ambient soundscape" description="Synthesised live — nothing is downloaded" stacked>
                        <div className="settings-sound">
                            <Segmented
                                label="Soundscape"
                                value={settings.soundMode}
                                onChange={(soundMode) => set({ soundMode })}
                                options={SOUND_MODES.map((mode) => ({ value: mode.id, label: mode.id === 'om' ? 'Om' : mode.label }))}
                            />
                            <div className="settings-sound__row">
                                <button type="button" className={`icon-btn icon-btn--sm${soundscape.isPlaying ? ' is-on' : ''}`} onClick={soundscape.toggleSound} aria-label={soundscape.isPlaying ? 'Pause soundscape' : 'Play soundscape'}>
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
                                        aria-label="Soundscape volume"
                                    />
                                    <span>{Math.round(soundscape.volume * 100)}%</span>
                                </label>
                            </div>
                        </div>
                    </Row>
                    <Row label="Sacred chimes" description="A 432 Hz singing bowl marks breaths, saved lines and reflections">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => playChime('bowl', { force: true })}>
                            <Bell size={14} /> Hear it
                        </button>
                        <Switch label="Sacred chimes" checked={settings.chimes} onChange={(chimes) => set({ chimes })} />
                    </Row>
                    <Row
                        label="Touch haptics"
                        description={hapticsAvailable ? 'Gentle vibration on taps and breath transitions' : 'This device or browser has no vibration support'}
                    >
                        <Switch
                            label="Touch haptics"
                            checked={settings.haptics && hapticsAvailable}
                            disabled={!hapticsAvailable}
                            onChange={(haptics) => {
                                set({ haptics });
                                if (haptics) setTimeout(() => haptic('success'), 30);
                            }}
                        />
                    </Row>
                    <Row label="Breath companion" description="A 4-7-8 breathing orb beside each conversation">
                        <Switch label="Breath companion" checked={settings.breathMode} onChange={(breathMode) => set({ breathMode })} />
                    </Row>
                </Group>

                <Group title="Ritual">
                    <Row label="3-Breaths grounding" description="Return to the threshold and set a new intention">
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => { onClose(); onResetBreathSession?.(); }}>
                            <Wind size={14} /> Begin again
                        </button>
                    </Row>
                </Group>

                <Group title="App">
                    <Row
                        label="Install Living Gita"
                        description={install?.standalone
                            ? 'Installed — it opens like an app and works offline.'
                            : install?.canPrompt
                                ? 'Add the sanctuary to your home screen or dock.'
                                : install?.needsIosInstructions
                                    ? 'On iPhone and iPad, install from Safari’s Share menu.'
                                    : 'Open in Chrome, Edge or Safari to install.'}
                        stacked={Boolean(install?.needsIosInstructions)}
                    >
                        {install?.standalone && <span className="chip"><Check size={12} /> Installed</span>}
                        {install?.canPrompt && (
                            <button type="button" className="btn btn--gold btn--sm" onClick={install.install}>
                                <Download size={14} /> Install
                            </button>
                        )}
                        {install?.needsIosInstructions && <IosInstallSteps />}
                    </Row>
                    <Row
                        label="Offline wisdom"
                        description={!library || !library.supported
                            ? 'Available once the app is installed or served in production.'
                            : library.ready
                                ? 'All 18 chapters and 701 verses are kept on this device.'
                                : library.chapters
                                    ? `Gathering verses… ${library.chapters} of 18 chapters saved.`
                                    : 'Verses will be gathered for offline reading on your next visit.'}
                    >
                        {library?.ready ? <span className="chip"><Check size={12} /> Ready</span> : <CloudOff size={16} className="faint" />}
                    </Row>
                    {hasKeyboard && (
                        <div className="shortcut-list">
                            <span className="settings-row__label">Keyboard shortcuts</span>
                            <dl>
                                {SHORTCUTS.map(([keys, label]) => (
                                    <div key={label}>
                                        <dt className="kbd-group">{keys.map((key) => <span key={key} className="kbd">{key}</span>)}</dt>
                                        <dd>{label}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </Group>

                <Group title="Privacy & aparigraha">
                    <div className="privacy-note">
                        <ShieldCheck size={18} aria-hidden="true" />
                        <p>
                            No accounts, no analytics, no tracking. Reflections, saved lines, walks and preferences live only in
                            this browser’s storage. Conversations are answered by the sanctuary’s server and never stored.
                        </p>
                    </div>
                    {confirmPurge ? (
                        <div className="purge-confirm">
                            <span>Release every reflection, walk and preference on this device?</span>
                            <div>
                                <button type="button" className="btn btn--danger btn--sm" onClick={purge}>Release everything</button>
                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmPurge(false)}>Keep</button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmPurge(true)}>
                            Clear all data stored on this device
                        </button>
                    )}
                </Group>

                <p className="settings__signature">Living Gita · designed with restraint</p>
            </div>
        </Sheet>
    );
}

export default Settings;
