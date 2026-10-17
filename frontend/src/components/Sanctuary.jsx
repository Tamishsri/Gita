import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, LifeBuoy, RotateCcw, WifiOff, Feather, ArrowRight, Sparkles } from 'lucide-react';
import VoiceInput from './VoiceInput';
import BreathCircle from './BreathCircle';
import VerseDisplay from './VerseDisplay';
import { Diya, SunGlyph } from './ui/Ornaments';
import { askSakha } from '../lib/localSakha';
import { buildPerson, rememberConversation } from '../lib/person';
import { addReflection, verseRef } from '../lib/verse';
import { recentVerseIds, recordPath } from '../lib/path';
import { openPractice } from '../lib/bus';
import { practiceById } from '../lib/practices';
import { toast } from '../lib/toast';
import { useHasKeyboard } from '../hooks/useMediaQuery';
import { hasTranslation, useI18n } from '../i18n';

let messageSeq = 0;
const nextId = () => `m${Date.now().toString(36)}${(messageSeq += 1)}`;

const isQuote = (paragraph) => /^["“].*["”]$/s.test(paragraph.trim());

// Proper quotation marks and apostrophes for anything the engine says.
const typeset = (text = '') => String(text)
    .replace(/(^|[\s(—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(\w)'(\w)/g, '$1’$2');

// Split a reply around the quoted verse so the folio can sit in its place:
// [words before] → [verse] → [words after].
function splitMessage(content = '', hasVerse) {
    const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (!hasVerse) return { lead: paragraphs, trail: [] };
    const quoteIndex = paragraphs.findIndex(isQuote);
    if (quoteIndex === -1) return { lead: paragraphs, trail: [] };
    return { lead: paragraphs.slice(0, quoteIndex), trail: paragraphs.slice(quoteIndex + 1) };
}

const PHONE = /(\+?\d[\d\s-]{1,14}\d)/g;
const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

function linkify(line) {
    const parts = [];
    let cursor = 0;
    [...line.matchAll(new RegExp(`${URL_PATTERN.source}|${PHONE.source}`, 'g'))].forEach((match) => {
        const [text] = match;
        if (match.index > cursor) parts.push(line.slice(cursor, match.index));
        const href = text.startsWith('http') ? text : `tel:${text.replace(/[\s-]/g, '')}`;
        parts.push(
            <a key={`${match.index}-${text}`} href={href} target={text.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{text}</a>
        );
        cursor = match.index + text.length;
    });
    if (cursor < line.length) parts.push(line.slice(cursor));
    return parts;
}

function SupportMessage({ content }) {
    const { t } = useI18n();
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    const intro = lines.filter((line) => !line.startsWith('•') && !line.endsWith(':'));
    const heading = lines.find((line) => line.endsWith(':'));
    const helplines = lines.filter((line) => line.startsWith('•')).map((line) => line.replace(/^•\s*/, ''));
    return (
        <div className="support-card" role="alert">
            <div className="support-card__head">
                <LifeBuoy size={18} aria-hidden="true" />
                <span className="eyebrow">{t('support.notAlone')}</span>
            </div>
            {intro.map((line) => <p key={line}>{line}</p>)}
            {heading && <p className="support-card__subhead">{heading.replace(/:$/, '')}</p>}
            <ul>{helplines.map((line) => <li key={line}>{linkify(line)}</li>)}</ul>
        </div>
    );
}

// Ways to begin, for when it is hard to know how to start.
const STARTER_KEYS = ['lately', 'worried', 'cantStop', 'today', 'good'];

function Starters({ onPick }) {
    const { t } = useI18n();
    return (
        <div className="begin-chips" role="group" aria-label={t('sanctuary.startersLabel')}>
            {STARTER_KEYS.map((key) => {
                const text = t(`sanctuary.starter.${key}`);
                return (
                    <button key={key} type="button" className="begin-chip" onClick={() => onPick(`${text} `)}>
                        {text}…
                    </button>
                );
            })}
        </div>
    );
}

// The verse carried into plain words and one small step.
function Guidance({ guidance, verse, language }) {
    const { t } = useI18n();
    const [writing, setWriting] = useState(false);
    const [note, setNote] = useState('');
    if (!guidance || (!guidance.bridge && !guidance.step && !guidance.blessing)) return null;

    const practice = guidance.practice && guidance.practice !== 'journal' ? practiceById(guidance.practice) : null;

    const keep = () => {
        if (!note.trim()) return;
        addReflection({
            verse,
            citation: verse ? `${t('guidance.stepCitation')} — ${t('verse.bg')} ${verseRef(verse)}` : t('guidance.stepCitation'),
            verseText: guidance.step,
            note,
            kind: 'step'
        });
        recordPath('reflection', { verseId: verse?.id || null, kind: 'step' });
        toast(t('toast.reflectionKept'), { icon: 'journal', tone: 'gold' });
        setNote('');
        setWriting(false);
    };

    return (
        <motion.section
            className="guidance"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            aria-label={t('guidance.label')}
        >
            {guidance.bridge && (
                <div className="guidance__block">
                    <span className="eyebrow">{t('guidance.forYou')}</span>
                    <p className="guidance__bridge">{typeset(guidance.bridge)}</p>
                </div>
            )}
            {guidance.step && (
                <div className="guidance__block guidance__block--step">
                    <span className="eyebrow">{t('guidance.step')}</span>
                    <p className="guidance__step">{typeset(guidance.step)}</p>
                    <div className="text-actions text-actions--start">
                        {practice && (
                            <button type="button" className="text-action" onClick={() => openPractice(practice.id, { minutes: 5 })}>
                                <Sparkles size={15} /> {t(`practice.${practice.id}.cta`)}
                            </button>
                        )}
                        <button type="button" className={`text-action${writing ? ' is-on' : ''}`} onClick={() => setWriting((value) => !value)} aria-expanded={writing}>
                            <Feather size={15} /> {t('guidance.writeIt')}
                        </button>
                    </div>
                    <AnimatePresence initial={false}>
                        {writing && (
                            <motion.div
                                className="guidance__write"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <textarea
                                    className="textarea textarea--paper"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder={t('guidance.writePlaceholder')}
                                    rows={4}
                                    autoFocus
                                />
                                <div className="verse-card__journal-actions">
                                    <span className="faint">{t('guidance.goesToJournal')}</span>
                                    <button type="button" className="btn btn--gold btn--sm" onClick={keep} disabled={!note.trim()}>
                                        {t('guidance.keep')}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
            {guidance.blessing && (
                <div className="guidance__blessing">
                    <SunGlyph size={26} className="guidance__blessing-glyph" />
                    <div>
                        <span className="eyebrow">{t('guidance.blessing')}</span>
                        <p className={language === 'hi' ? 'is-hi' : ''}>{typeset(guidance.blessing)}</p>
                    </div>
                </div>
            )}
        </motion.section>
    );
}

function Sanctuary({ mood, initialVerse, initialText, settings = {}, onBack }) {
    const { t } = useI18n();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [reveal, setReveal] = useState(null); // { id, text, done }
    const [lastRequest, setLastRequest] = useState(null);

    const reduceMotion = useReducedMotion();
    const hasKeyboard = useHasKeyboard();
    const endRef = useRef(null);
    const conversationRef = useRef(null);
    const textareaRef = useRef(null);
    const revealTimer = useRef(null);
    const started = useRef(false);
    const shownIds = useRef([]);
    const history = useRef([]);
    const lastVerseId = useRef(initialVerse?.id || null);
    // One conversation, so Sakha can tell "this visit" from "before".
    const session = useRef(`s${Date.now().toString(36)}`);
    const language = settings.language === 'hi' ? 'hi' : 'en';

    const scrollToMessage = useCallback((id) => {
        requestAnimationFrame(() => {
            conversationRef.current?.querySelector(`[data-msg="${id}"]`)?.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        });
    }, [reduceMotion]);

    const scrollToEnd = useCallback(() => {
        endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
    }, [reduceMotion]);

    // Contemplative reveal: pause at punctuation the way a voice would.
    const startReveal = useCallback((id, text) => {
        clearTimeout(revealTimer.current);
        if (!text || reduceMotion) {
            setReveal({ id, text, done: true });
            return;
        }
        let cursor = 0;
        setReveal({ id, text: '', done: false });
        const step = () => {
            cursor += 1;
            const char = text[cursor - 1];
            setReveal({ id, text: text.slice(0, cursor), done: cursor >= text.length });
            if (cursor >= text.length) return;
            const delay = '.?!।'.includes(char) ? 360 : ',;:—'.includes(char) ? 180 : 22;
            revealTimer.current = setTimeout(step, delay);
        };
        step();
    }, [reduceMotion]);

    const finishReveal = useCallback(() => {
        clearTimeout(revealTimer.current);
        setReveal((current) => {
            if (!current || current.done) return current;
            const message = messages.find((item) => item.id === current.id);
            const { lead } = splitMessage(message?.content, Boolean(message?.verse));
            return { ...current, text: lead.join('\n\n'), done: true };
        });
    }, [messages]);

    useEffect(() => () => clearTimeout(revealTimer.current), []);

    const send = useCallback(async (text, moodContext, { retry = false, another = false } = {}) => {
        if (!text && !moodContext) return;
        const request = { text: text || null, mood: moodContext || mood, another };
        setLastRequest(request);

        if (text && !retry) {
            const id = nextId();
            setMessages((list) => [...list, { id, role: 'user', content: text }]);
            requestAnimationFrame(scrollToEnd);
        }
        setInputText('');
        setLoading(true);

        try {
            const exclude = [...new Set([...recentVerseIds(30), ...shownIds.current])].slice(-40);
            const person = buildPerson(settings, { session: session.current });
            const data = await askSakha({
                ...request,
                settings,
                history: history.current.slice(-3),
                exclude,
                lastVerseId: lastVerseId.current,
                person
            });
            if (text) history.current.push(text);
            rememberConversation(session.current, data.context);
            const content = data.message || data.response || '';
            const id = nextId();
            if (data.verse) {
                shownIds.current.push(data.verse.id);
                lastVerseId.current = data.verse.id;
                recordPath('verse', { verseId: data.verse.id, emotion: data.context?.emotion || null, mood: moodContext || mood || null });
            }
            setMessages((list) => [...list, { id, role: 'assistant', content, verse: data.verse, guidance: data.guidance, context: data.context || {} }]);
            startReveal(id, splitMessage(content, Boolean(data.verse)).lead.join('\n\n'));
            scrollToMessage(id);
        } catch {
            const id = nextId();
            setMessages((list) => [...list, { id, role: 'assistant', content: t('sanctuary.faint'), failed: true }]);
            scrollToMessage(id);
        } finally {
            setLoading(false);
        }
    }, [mood, settings, startReveal, scrollToEnd, scrollToMessage, t]);

    // Opening: a chosen verse, a question asked from home, or a mood.
    useEffect(() => {
        if (started.current) return;
        started.current = true;
        if (initialVerse) {
            const welcome = t('sanctuary.welcomeVerse', { ref: verseRef(initialVerse) });
            const id = nextId();
            shownIds.current.push(initialVerse.id);
            setMessages([{ id, role: 'assistant', content: welcome, verse: initialVerse, context: {} }]);
            setReveal({ id, text: welcome, done: true });
        } else if (initialText) {
            send(initialText, null);
        } else if (mood) {
            send(null, mood);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Once the first answer has arrived, a keyboard user can simply type.
    useEffect(() => {
        if (hasKeyboard && reveal?.done && messages.length === 1 && !settings.silentMode) {
            textareaRef.current?.focus({ preventScroll: true });
        }
    }, [hasKeyboard, reveal?.done, messages.length, settings.silentMode]);

    useLayoutEffect(() => {
        const area = textareaRef.current;
        if (!area) return;
        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
    }, [inputText]);

    const submit = () => {
        const text = inputText.trim();
        if (text && !loading) send(text);
    };

    const another = () => send(null, lastRequest?.mood || mood || 'peace', { another: true });

    const hasGuidance = messages.some((message) => message.role === 'assistant' && !message.failed);
    const placeholder = hasTranslation(`sanctuary.placeholder.${mood}`)
        ? t(`sanctuary.placeholder.${mood}`)
        : t('sanctuary.placeholder.default');

    return (
        <div className="sanctuary">
            <BreathCircle isActive={settings.breathMode} />

            <div className="samvada-intro">
                <span className="eyebrow">{t('sanctuary.eyebrow')}</span>
                <p>{t('sanctuary.intro')}</p>
            </div>

            <div className="conversation" ref={conversationRef} aria-live="polite">
                <AnimatePresence initial={false}>
                    {messages.map((message, index) => {
                        if (message.role === 'user') {
                            return (
                                <motion.div
                                    key={message.id}
                                    data-msg={message.id}
                                    className="msg msg--user"
                                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    {message.content}
                                </motion.div>
                            );
                        }

                        const crisis = message.context?.crisis_detected;
                        const { lead, trail } = splitMessage(message.content, Boolean(message.verse));
                        const isCurrent = reveal?.id === message.id;
                        const isRevealing = isCurrent && !reveal.done;
                        const leadText = isCurrent ? reveal.text : lead.join('\n\n');

                        return (
                            <motion.div
                                key={message.id}
                                data-msg={message.id}
                                className={`msg msg--guide${message.failed ? ' msg--failed' : ''}`}
                                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <div className="msg__body">
                                    {crisis ? (
                                        <SupportMessage content={message.content} />
                                    ) : (
                                        leadText && (
                                            <div
                                                className={`msg__text${isRevealing ? ' is-revealing' : ''}`}
                                                onClick={isRevealing ? finishReveal : undefined}
                                                title={isRevealing ? t('sanctuary.tapToReveal') : undefined}
                                            >
                                                {leadText.split(/\n{2,}/).map((paragraph, p) => <p key={p}>{typeset(paragraph)}</p>)}
                                            </div>
                                        )
                                    )}

                                    {message.context?.offline && !isRevealing && (
                                        <span className="chip chip--muted msg__offline">
                                            <WifiOff size={12} /> {t('sanctuary.offline')}
                                        </span>
                                    )}

                                    {message.verse && !isRevealing && <VerseDisplay verse={message.verse} language={language} />}

                                    {message.guidance && !isRevealing && (message.verse || message.guidance.blessing) && (
                                        <Guidance guidance={message.guidance} verse={message.verse} language={language} />
                                    )}

                                    {message.context?.invite && !isRevealing && index === messages.length - 1 && !settings.silentMode && (
                                        <Starters onPick={(starter) => {
                                            setInputText(starter);
                                            requestAnimationFrame(() => {
                                                const area = textareaRef.current;
                                                area?.focus();
                                                area?.setSelectionRange(starter.length, starter.length);
                                            });
                                        }} />
                                    )}

                                    {trail.length > 0 && !isRevealing && (
                                        <motion.div
                                            className="msg__text msg__text--trail"
                                            initial={reduceMotion ? false : { opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.8, duration: 0.9 }}
                                        >
                                            {trail.map((paragraph, p) => <p key={p}>{typeset(paragraph)}</p>)}
                                        </motion.div>
                                    )}

                                    {message.failed && lastRequest && index === messages.length - 1 && (
                                        <button type="button" className="btn btn--outline btn--sm" onClick={() => {
                                            setMessages((list) => list.filter((item) => item.id !== message.id));
                                            send(lastRequest.text, lastRequest.text ? null : lastRequest.mood, { retry: true, another: lastRequest.another });
                                        }}>
                                            <RotateCcw size={14} /> {t('common.tryAgain')}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {loading && (
                    <div className="msg msg--guide msg--pending" aria-label={t('sanctuary.listening')}>
                        <div className="msg__pending">
                            <Diya size={30} steady />
                            <span>{t('sanctuary.listening')}</span>
                        </div>
                    </div>
                )}

                {hasGuidance && !loading && reveal?.done !== false && (
                    <motion.div
                        className="conversation__close"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.9 }}
                    >
                        <div className="text-actions">
                            <button type="button" className="text-action" onClick={another}>
                                {t('sanctuary.another')} <ArrowRight size={14} />
                            </button>
                            <button type="button" className="text-action" onClick={onBack}>
                                {t('sanctuary.silence')}
                            </button>
                        </div>
                    </motion.div>
                )}

                <div ref={endRef} className="conversation__end" />
            </div>

            {!settings.silentMode && (
                <div className="composer-dock">
                    <form
                        className="composer"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit();
                        }}
                    >
                        <textarea
                            ref={textareaRef}
                            className="composer__input"
                            value={inputText}
                            onChange={(event) => setInputText(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    submit();
                                }
                            }}
                            placeholder={placeholder}
                            rows={1}
                            maxLength={2000}
                            aria-label={t('sanctuary.composerLabel')}
                            enterKeyHint="send"
                        />
                        <VoiceInput
                            language={language}
                            disabled={loading}
                            onTranscript={(text) => setInputText((current) => (current ? `${current} ${text}` : text))}
                        />
                        <button type="submit" className="composer__send" disabled={!inputText.trim() || loading} aria-label={t('sanctuary.send')}>
                            <ArrowUp size={18} strokeWidth={2} />
                        </button>
                    </form>
                    <p className="composer__note">{t('sanctuary.note')}</p>
                </div>
            )}
        </div>
    );
}

export default Sanctuary;
