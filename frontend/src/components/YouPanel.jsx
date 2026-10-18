import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, EyeOff, KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import SakhaMark from './ui/SakhaMark';
import PathLotus, { PATH_COLOURS } from './ui/PathLotus';
import { Group, Row, Switch } from './Settings';
import { usePreferences } from '../contexts/PreferencesContext';
import {
    CONTEXT_LIMIT, PATH_IDS, PROFILE_EVENT, VOICES, choosePath, forgetConversations, forgetWord, leaningPath, learnedWords, portraitOf,
    readProfile, summariseMemory, updateProfile
} from '../lib/person';
import { PATH_EVENT } from '../lib/path';
import { LOCK_EVENT, clearPasscode, isLockEnabled, isValidPasscode, lockSupported, setPasscode, verifyPasscode } from '../lib/lock';
import { describeStorage, exportData } from '../lib/privacy';
import { DEFAULT_SETTINGS, purgeLocalData } from '../lib/settings';
import { toast } from '../lib/toast';
import { useI18n } from '../i18n';

function PasscodeForm({ mode, onDone, onCancel }) {
    const { t } = useI18n();
    const [current, setCurrent] = useState('');
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const needsCurrent = mode !== 'set';
    const needsNew = mode !== 'remove';

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (needsNew && !isValidPasscode(first)) return setError(t('you.lock.digits'));
        if (needsNew && first !== second) return setError(t('you.lock.mismatch'));
        setBusy(true);
        try {
            if (needsCurrent) {
                const result = await verifyPasscode(current);
                if (!result.ok) {
                    setBusy(false);
                    return setError(result.waitMs ? t('lock.wait', { seconds: Math.ceil(result.waitMs / 1000) }) : t('lock.wrong'));
                }
            }
            if (mode === 'remove') clearPasscode();
            else await setPasscode(first);
            onDone(mode);
        } catch {
            setError(t('you.lock.failed'));
        }
        return setBusy(false);
    };

    const field = (value, setValue, label, autoFocus) => (
        <label className="passcode-field">
            <span>{label}</span>
            <input
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="\d*"
                maxLength={6}
                value={value}
                autoFocus={autoFocus}
                onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
        </label>
    );

    return (
        <form className="passcode-form" onSubmit={submit}>
            {needsCurrent && field(current, setCurrent, t('you.lock.current'), true)}
            {needsNew && field(first, setFirst, t('you.lock.new'), !needsCurrent)}
            {needsNew && field(second, setSecond, t('you.lock.again'), false)}
            {error && <p className="passcode-form__error" role="alert">{error}</p>}
            <div className="passcode-form__actions">
                <button type="submit" className={`btn btn--sm ${mode === 'remove' ? 'btn--danger' : 'btn--gold'}`} disabled={busy}>
                    {t(`you.lock.submit.${mode}`)}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
        </form>
    );
}

// What Sakha knows about this person — shown openly, changed or erased in
// one place, and none of it ever leaving the device.
function YouPanel({ isOpen, onClose, onLockNow }) {
    const { t } = useI18n();
    const { settings, updateSettings } = usePreferences();
    const [profile, setProfile] = useState(readProfile);
    const [note, setNote] = useState(() => readProfile().context || '');
    const [tick, setTick] = useState(0);
    const [locked, setLocked] = useState(isLockEnabled);
    const [passcodeMode, setPasscodeMode] = useState(null); // set | change | remove
    const [confirmForget, setConfirmForget] = useState(false);
    const [confirmErase, setConfirmErase] = useState(false);

    useEffect(() => {
        const update = () => {
            setProfile(readProfile());
            setLocked(isLockEnabled());
            setTick((value) => value + 1);
        };
        [PROFILE_EVENT, PATH_EVENT, LOCK_EVENT].forEach((name) => window.addEventListener(name, update));
        return () => [PROFILE_EVENT, PATH_EVENT, LOCK_EVENT].forEach((name) => window.removeEventListener(name, update));
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const fresh = readProfile();
        setProfile(fresh);
        setNote(fresh.context || '');
        setLocked(isLockEnabled());
        setPasscodeMode(null);
        setConfirmForget(false);
        setConfirmErase(false);
    }, [isOpen]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memory = useMemo(() => summariseMemory(settings), [settings, tick, isOpen]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const storage = useMemo(() => (isOpen ? describeStorage() : null), [isOpen, tick]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const portrait = useMemo(() => portraitOf(settings), [settings, tick, isOpen, profile]);
    const words = learnedWords(profile);
    const leaning = leaningPath(profile);

    // A portrait line, with its labels said in the reader's language.
    const portraitLine = ({ key, vars = {} }) => {
        const line = t(key, {
            ...vars,
            a: vars.a ? t(`topic.${vars.a}`).toLowerCase() : undefined,
            b: vars.b ? t(`topic.${vars.b}`).toLowerCase() : undefined,
            feeling: vars.feeling ? t(`feeling.${vars.feeling}`).toLowerCase() : undefined,
            path: vars.path ? t(`path4.${vars.path}.name`) : undefined
        });
        return line.charAt(0).toUpperCase() + line.slice(1);
    };
    const chosen = profile.chosenPath;
    const noteChanged = note.trim() !== (profile.context || '').trim();

    const saveNote = () => {
        setProfile(updateProfile({ context: note.trim().slice(0, CONTEXT_LIMIT) }));
        toast(t('you.context.saved'), { icon: 'check' });
    };

    const erase = () => {
        purgeLocalData();
        updateSettings({ ...DEFAULT_SETTINGS });
        setConfirmErase(false);
        setNote('');
        toast(t('settings.purged'), { icon: 'check' });
    };

    const passcodeDone = (mode) => {
        setPasscodeMode(null);
        setLocked(isLockEnabled());
        toast(t(`you.lock.done.${mode}`), { icon: 'check' });
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('you.title')} width={640} size="tall">
            <SheetHeader icon={ShieldCheck} eyebrow={t('you.eyebrow')} title={t('you.title')} subtitle={t('you.subtitle')} onClose={onClose} />
            <div className="sheet__body sheet__body--padded you">
                <div className="you__hello">
                    <SakhaMark size={52} alive />
                    <p>{settings.name ? t('you.helloNamed', { name: settings.name }) : t('you.hello')}</p>
                </div>

                <section className="portrait" aria-label={t('you.portrait.title')}>
                    <h3 className="eyebrow">{t('you.portrait.title')}</h3>
                    <ul className="portrait__lines">
                        {portrait.lines.map((line) => (
                            <li key={`${line.key}-${JSON.stringify(line.vars || {})}`}>{portraitLine(line)}</li>
                        ))}
                    </ul>
                    <p className="portrait__note">{t('you.portrait.note')}</p>
                </section>

                <Group title={t('you.voice.title')}>
                    <div className="voice-options" role="radiogroup" aria-label={t('you.voice.title')}>
                        {VOICES.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={(profile.voice || 'gentle') === id}
                                className="voice-option"
                                onClick={() => setProfile(updateProfile({ voice: id }))}
                            >
                                <span className="voice-option__name">{t(`you.voice.${id}`)}</span>
                                <span className="voice-option__hint">{t(`you.voice.${id}.hint`)}</span>
                                <span className="voice-option__sample">“{t(`you.voice.${id}.sample`)}”</span>
                            </button>
                        ))}
                    </div>
                </Group>

                <Group title={t('you.paths.title')}>
                    <div className="you-paths">
                        <PathLotus paths={profile.paths} highlight={chosen || leaning} />
                        <div className="you-paths__text">
                            <p className="you-paths__lead">
                                {leaning && leaning === chosen && (profile.paths?.[leaning] || 0) < 5
                                    ? t('you.paths.chosen', { path: t(`path4.${leaning}.name`) })
                                    : leaning ? t('you.paths.leaning', { path: t(`path4.${leaning}.name`) }) : t('you.paths.learning')}
                            </p>
                            <p className="faint">{profile.feedback ? t('you.paths.learned', { count: profile.feedback }) : t('you.paths.how')}</p>
                        </div>
                    </div>
                    <div className="path-choices" role="radiogroup" aria-label={t('you.paths.choose')}>
                        {PATH_IDS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={chosen === id}
                                className="path-choice"
                                style={{ '--petal-rgb': PATH_COLOURS[id] }}
                                onClick={() => setProfile(choosePath(chosen === id ? null : id))}
                            >
                                <span className="path-choice__dot" aria-hidden="true" />
                                <span className="path-choice__name">{t(`path4.${id}.name`)} <span className="faint">· {t(`path4.${id}.sanskrit`)}</span></span>
                                <span className="path-choice__hint">{t(`path4.${id}.hint`)}</span>
                                {chosen === id && <Check size={15} className="path-choice__check" aria-hidden="true" />}
                            </button>
                        ))}
                    </div>
                    <p className="path__note">{t('you.paths.note')}</p>
                </Group>

                <Group title={t('you.context.title')}>
                    <div className="you-context">
                        <p className="settings-row__description">{t('you.context.desc')}</p>
                        <textarea
                            className="textarea textarea--paper"
                            rows={4}
                            maxLength={CONTEXT_LIMIT}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={t('you.context.placeholder')}
                            aria-label={t('you.context.title')}
                        />
                        <div className="you-context__actions">
                            <span className="faint"><Lock size={12} aria-hidden="true" /> {t('you.context.private')} · {note.length}/{CONTEXT_LIMIT}</span>
                            <button type="button" className="btn btn--gold btn--sm" onClick={saveNote} disabled={!noteChanged}>{t('you.context.save')}</button>
                        </div>
                    </div>
                </Group>

                <Group title={t('path.memory')}>
                    <div className="memory">
                        <p className="path__note">{t('path.memoryNote')}</p>
                        {words.length > 0 && (
                            <div className="memory__group">
                                <span className="memory__label">{t('you.words.title')}</span>
                                <ul className="chip-row">
                                    {words.map(([phrase, feeling]) => (
                                        <li key={phrase} className="chip chip--word">
                                            “{phrase}” <span className="faint">→ {t(`feeling.${feeling}`).toLowerCase()}</span>
                                            <button
                                                type="button"
                                                className="chip__remove"
                                                onClick={() => setProfile(forgetWord(phrase))}
                                                aria-label={t('you.words.forget', { word: phrase })}
                                            >
                                                <X size={12} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {memory.topics.length || memory.feelings.length ? (
                            <>
                                {memory.topics.length > 0 && (
                                    <div className="memory__group">
                                        <span className="memory__label">{t('path.memoryTopics')}</span>
                                        <ul className="chip-row">
                                            {memory.topics.slice(0, 8).map(([id, item]) => (
                                                <li key={id} className="chip">{t(`topic.${id}`)} <span className="faint">· {item.count}</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {memory.feelings.length > 0 && (
                                    <div className="memory__group">
                                        <span className="memory__label">{t('path.memoryFeelings')}</span>
                                        <ul className="chip-row">
                                            {memory.feelings.slice(0, 6).map(([id, count]) => (
                                                <li key={id} className="chip">{t(`feeling.${id}`)} <span className="faint">· {count}</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {confirmForget ? (
                                    <span className="journal-entry__confirm">
                                        {t('path.forgetConfirm')}
                                        <button type="button" className="btn btn--danger btn--sm" onClick={() => {
                                            forgetConversations();
                                            setConfirmForget(false);
                                            toast(t('path.forgotten'), { icon: 'check' });
                                        }}>{t('path.forget')}</button>
                                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmForget(false)}>{t('common.keep')}</button>
                                    </span>
                                ) : (
                                    <button type="button" className="btn btn--link btn--sm memory__forget" onClick={() => setConfirmForget(true)}>{t('path.forget')}</button>
                                )}
                            </>
                        ) : (
                            <p className="memory__empty">{t('path.memoryEmpty')}</p>
                        )}
                    </div>
                </Group>

                <Group title={t('you.privacy.title')}>
                    <div className="privacy-note">
                        <ShieldCheck size={18} aria-hidden="true" />
                        <p>{t('you.privacy.promise')}</p>
                    </div>

                    <Row label={t('you.lock.title')} description={lockSupported() ? (locked ? t('you.lock.on') : t('you.lock.off')) : t('you.lock.unsupported')} stacked={Boolean(passcodeMode)}>
                        {passcodeMode ? (
                            <PasscodeForm mode={passcodeMode} onDone={passcodeDone} onCancel={() => setPasscodeMode(null)} />
                        ) : locked ? (
                            <div className="you-lock__actions">
                                <button type="button" className="btn btn--gold btn--sm" onClick={() => { onClose(); onLockNow?.(); }}>
                                    <Lock size={14} /> {t('you.lock.now')}
                                </button>
                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPasscodeMode('change')}>{t('you.lock.change')}</button>
                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPasscodeMode('remove')}>{t('you.lock.remove')}</button>
                            </div>
                        ) : (
                            <button type="button" className="btn btn--outline btn--sm" onClick={() => setPasscodeMode('set')} disabled={!lockSupported()}>
                                <KeyRound size={14} /> {t('you.lock.set')}
                            </button>
                        )}
                    </Row>

                    <Row label={t('you.private.title')} description={t('you.private.desc')}>
                        <Switch
                            label={t('you.private.title')}
                            checked={Boolean(settings.privateByDefault)}
                            onChange={(privateByDefault) => updateSettings({ privateByDefault })}
                        />
                    </Row>

                    {storage && (
                        <Row label={t('you.data.title')} description={t('you.data.desc', {
                            journal: storage.counts.journal,
                            letters: storage.counts.letters,
                            conversations: storage.counts.conversations,
                            size: Math.max(1, Math.round(storage.bytes / 1024))
                        })} stacked>
                            <div className="you-data__actions">
                                <button type="button" className="btn btn--outline btn--sm" onClick={() => { exportData(); toast(t('you.data.exported'), { icon: 'check' }); }}>
                                    <Download size={14} /> {t('you.data.export')}
                                </button>
                                {confirmErase ? (
                                    <span className="journal-entry__confirm">
                                        {t('settings.purgeConfirm')}
                                        <button type="button" className="btn btn--danger btn--sm" onClick={erase}>{t('settings.purgeYes')}</button>
                                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmErase(false)}>{t('common.keep')}</button>
                                    </span>
                                ) : (
                                    <button type="button" className="settings-danger" onClick={() => setConfirmErase(true)}>{t('settings.purge')}</button>
                                )}
                            </div>
                        </Row>
                    )}

                    <p className="you__quiet"><EyeOff size={13} aria-hidden="true" /> {t('you.privacy.exit')}</p>
                </Group>
            </div>
        </Sheet>
    );
}

export default YouPanel;
