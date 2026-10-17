import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { LetterGlyph } from './ui/Ornaments';
import { DELIVERIES, LETTERS_EVENT, arrivedLetters, daysBetween, isArrived, openLetter, readLetters, releaseLetter, sealLetter } from '../lib/letters';
import { addReflection } from '../lib/verse';
import { celebrate } from '../lib/celebrate';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';
import { localeFor, useI18n } from '../i18n';

const PROMPTS = ['hope', 'remember', 'kind'];

function useLetters() {
    const [letters, setLetters] = useState(readLetters);
    useEffect(() => {
        const update = () => setLetters(readLetters());
        window.addEventListener(LETTERS_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(LETTERS_EVENT, update);
            window.removeEventListener('storage', update);
        };
    }, []);
    return letters;
}

function OpenedLetter({ letter, onKeep }) {
    const { t, lang } = useI18n();
    const written = new Date(letter.writtenAt).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long', year: 'numeric' });
    return (
        <article className="letter-paper">
            <p className="letter-paper__from">{t('letters.from', { date: written })}</p>
            <p className="letter-paper__body">{letter.body}</p>
            {onKeep && (
                <button type="button" className="text-action" onClick={onKeep}>{t('letters.keep')}</button>
            )}
        </article>
    );
}

// On Home: "A letter has arrived."
export function LetterArrived() {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    useLetters();
    const [opened, setOpened] = useState(null);
    const waiting = arrivedLetters();
    const letter = opened || waiting[0];
    if (!letter) return null;

    const open = () => {
        openLetter(letter.id);
        setOpened({ ...letter, openedAt: new Date().toISOString() });
        playChime('ceremony');
        haptic('success');
        celebrate('gentle');
    };

    const keep = () => {
        addReflection({ citation: t('letters.citation'), verseText: '', note: letter.body, kind: 'letter' });
        toast(t('toast.reflectionKept'), { icon: 'journal', tone: 'gold' });
        setOpened(null);
    };

    return (
        <motion.section
            className="letter-arrived"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            aria-label={t('letters.arrivedTitle')}
        >
            {opened ? (
                <>
                    <OpenedLetter letter={opened} onKeep={keep} />
                    <button type="button" className="btn btn--link btn--sm" onClick={() => setOpened(null)}>{t('common.close')}</button>
                </>
            ) : (
                <>
                    <span className="letter-arrived__glyph"><LetterGlyph size={40} /></span>
                    <div className="letter-arrived__text">
                        <span className="eyebrow">{t('letters.arrivedEyebrow')}</span>
                        <strong>{t('letters.arrivedTitle')}</strong>
                        <span>{t('letters.arrivedBody', { count: daysBetween(letter.writtenAt) })}</span>
                    </div>
                    <button type="button" className="btn btn--gold btn--sm" onClick={open}>{t('letters.open')}</button>
                </>
            )}
        </motion.section>
    );
}

// The sheet: write, seal, and read what has arrived.
function Letters({ isOpen, onClose }) {
    const { t, lang } = useI18n();
    const letters = useLetters();
    const [body, setBody] = useState('');
    const [delivery, setDelivery] = useState('month');
    const [reading, setReading] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setReading(null);
        }
    }, [isOpen]);

    const seal = () => {
        if (!body.trim()) return;
        const days = DELIVERIES.find((item) => item.id === delivery)?.days || 30;
        sealLetter(body, days);
        setBody('');
        playChime('soft');
        haptic('success');
        celebrate('gentle');
        toast(t('letters.sealed', { when: t(`letters.delivery.${delivery}`).toLowerCase() }), { icon: 'heart', tone: 'gold' });
    };

    const date = (value) => new Date(value).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' });
    const sealed = letters.filter((letter) => !letter.openedAt && !isArrived(letter));
    const ready = letters.filter((letter) => isArrived(letter));
    const opened = letters.filter((letter) => letter.openedAt).reverse();

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('letters.title')} width={640} size="tall">
            <SheetHeader icon={LetterGlyph} eyebrow={t('letters.eyebrow')} title={t('letters.title')} subtitle={t('letters.subtitle')} onClose={onClose} />
            <div className="sheet__body sheet__body--padded letters">
                <section className="letters__write">
                    <div className="letters__prompts" role="group" aria-label={t('letters.promptsLabel')}>
                        {PROMPTS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                className="begin-chip"
                                onClick={() => setBody((current) => `${current}${current && !current.endsWith('\n') ? '\n\n' : ''}${t(`letters.prompt.${key}`)} `)}
                            >
                                {t(`letters.prompt.${key}`)}…
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="textarea textarea--paper letters__body"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder={t('letters.placeholder')}
                        rows={7}
                        maxLength={4000}
                        aria-label={t('letters.title')}
                    />
                    <div className="letters__seal">
                        <div className="segmented" role="group" aria-label={t('letters.deliverIn')}>
                            {DELIVERIES.map((item) => (
                                <button key={item.id} type="button" aria-pressed={delivery === item.id} onClick={() => setDelivery(item.id)}>
                                    {t(`letters.delivery.${item.id}`)}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="btn btn--gold" onClick={seal} disabled={!body.trim()}>
                            {t('letters.seal')}
                        </button>
                    </div>
                    <p className="letters__note"><Lock size={12} aria-hidden="true" /> {t('letters.note')}</p>
                </section>

                {(ready.length > 0 || sealed.length > 0) && (
                    <section className="letters__list">
                        <h3 className="eyebrow">{t('letters.waiting')}</h3>
                        <ul>
                            {ready.map((letter) => (
                                <li key={letter.id} className="letters__item is-ready">
                                    <LetterGlyph size={26} />
                                    <span>{t('letters.readyLine', { date: date(letter.writtenAt) })}</span>
                                    <button type="button" className="btn btn--gold btn--sm" onClick={() => {
                                        openLetter(letter.id);
                                        setReading({ ...letter, openedAt: new Date().toISOString() });
                                        playChime('ceremony');
                                        celebrate('gentle');
                                    }}>{t('letters.open')}</button>
                                </li>
                            ))}
                            {sealed.map((letter) => (
                                <li key={letter.id} className="letters__item">
                                    <LetterGlyph size={26} />
                                    <span>{t('letters.sealedLine', { date: date(`${letter.openOn}T12:00:00`) })}</span>
                                    <button type="button" className="btn btn--link btn--sm" onClick={() => releaseLetter(letter.id)}>{t('journal.letGo')}</button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <AnimatePresence>
                    {reading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <OpenedLetter letter={reading} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {opened.length > 0 && (
                    <section className="letters__list">
                        <h3 className="eyebrow">{t('letters.openedTitle')}</h3>
                        {opened.filter((letter) => letter.id !== reading?.id).map((letter) => <OpenedLetter key={letter.id} letter={letter} />)}
                    </section>
                )}
            </div>
        </Sheet>
    );
}

export default Letters;
