import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, LifeBuoy, RotateCcw, WifiOff } from 'lucide-react';
import VoiceInput from './VoiceInput';
import BreathCircle from './BreathCircle';
import VerseDisplay from './VerseDisplay';
import LotusMark from './ui/LotusMark';
import { askSanctuary } from '../lib/gitaApi';
import { verseRef } from '../lib/verse';

const PLACEHOLDERS = {
    anxious: 'What is troubling your mind?',
    stressed: 'Where is the weight resting today?',
    angry: 'What stirs the storm within?',
    confused: 'What clarity do you seek?',
    peace: 'What brings stillness to your heart?',
    happy: 'What fills you with gratitude?'
};

let messageSeq = 0;
const nextId = () => `m${Date.now().toString(36)}${(messageSeq += 1)}`;

const isQuote = (paragraph) => /^["“].*["”]$/s.test(paragraph.trim());

// Split a guide message around the quoted verse so the verse card can sit in
// its place: [lead words] → [verse card] → [grounding words].
function splitMessage(content = '', hasVerse) {
    const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (!hasVerse) return { lead: paragraphs, trail: [] };
    const quoteIndex = paragraphs.findIndex(isQuote);
    if (quoteIndex === -1) return { lead: paragraphs, trail: [] };
    return { lead: paragraphs.slice(0, quoteIndex), trail: paragraphs.slice(quoteIndex + 1) };
}

const PHONE = /(\+?\d[\d\s-]{1,14}\d)/g;
const URL = /(https?:\/\/[^\s)]+)/g;

function linkifySupportLine(line) {
    const parts = [];
    let cursor = 0;
    const tokens = [...line.matchAll(new RegExp(`${URL.source}|${PHONE.source}`, 'g'))];
    tokens.forEach((match) => {
        const [text] = match;
        if (match.index > cursor) parts.push(line.slice(cursor, match.index));
        const href = text.startsWith('http') ? text : `tel:${text.replace(/[\s-]/g, '')}`;
        parts.push(
            <a key={`${match.index}-${text}`} href={href} target={text.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                {text}
            </a>
        );
        cursor = match.index + text.length;
    });
    if (cursor < line.length) parts.push(line.slice(cursor));
    return parts;
}

function SupportMessage({ content }) {
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    const intro = lines.filter((line) => !line.startsWith('•') && !line.endsWith(':'));
    const heading = lines.find((line) => line.endsWith(':'));
    const helplines = lines.filter((line) => line.startsWith('•')).map((line) => line.replace(/^•\s*/, ''));

    return (
        <div className="support-card" role="alert">
            <div className="support-card__head">
                <LifeBuoy size={18} aria-hidden="true" />
                <span className="eyebrow">You are not alone</span>
            </div>
            {intro.map((line) => <p key={line}>{line}</p>)}
            {heading && <p className="support-card__subhead">{heading.replace(/:$/, '')}</p>}
            <ul>
                {helplines.map((line) => <li key={line}>{linkifySupportLine(line)}</li>)}
            </ul>
        </div>
    );
}

function Sanctuary({ mood, initialVerse, settings = {}, onBack }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [reveal, setReveal] = useState(null); // { id, text, done }
    const [lastRequest, setLastRequest] = useState(null);

    const reduceMotion = useReducedMotion();
    const endRef = useRef(null);
    const textareaRef = useRef(null);
    const revealTimer = useRef(null);
    const started = useRef(false);
    const language = settings.language === 'hi' ? 'hi' : 'en';

    const scrollToEnd = useCallback((behavior = 'smooth') => {
        endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : behavior, block: 'end' });
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
            const delay = '.?!'.includes(char) ? 340 : ',;:—'.includes(char) ? 170 : 22;
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

    const send = useCallback(async (text, moodContext, { retry = false } = {}) => {
        if (!text && !moodContext) return;
        const request = { text: text || null, mood: moodContext || mood };
        setLastRequest(request);

        if (text && !retry) setMessages((list) => [...list, { id: nextId(), role: 'user', content: text }]);
        setInputText('');
        setLoading(true);

        try {
            const data = await askSanctuary({ ...request, settings });
            const content = data.message || data.response || '';
            const id = nextId();
            setMessages((list) => [...list, { id, role: 'assistant', content, verse: data.verse, context: data.context || {} }]);
            startReveal(id, splitMessage(content, Boolean(data.verse)).lead.join('\n\n'));
        } catch {
            setMessages((list) => [...list, {
                id: nextId(),
                role: 'assistant',
                content: language === 'hi'
                    ? 'संपर्क क्षीण है… कृपया एक सांस लें और फिर से प्रयास करें।'
                    : 'The connection is faint… take a breath and try again.',
                failed: true
            }]);
        } finally {
            setLoading(false);
        }
    }, [language, mood, settings, startReveal]);

    // Opening: sit with a chosen verse, or ask for one that meets the mood.
    useEffect(() => {
        if (started.current) return;
        started.current = true;
        if (initialVerse) {
            const welcome = language === 'hi'
                ? `अध्याय ${initialVerse.chapter}, श्लोक ${initialVerse.verse || initialVerse.verse_number}। इस श्लोक की शांति को अपने हृदय में उतरने दें।`
                : `You have arrived to sit with Bhagavad Gita ${verseRef(initialVerse)}. Let this timeless guidance breathe stillness into your thoughts.`;
            const id = nextId();
            setMessages([{ id, role: 'assistant', content: welcome, verse: initialVerse, context: {} }]);
            setReveal({ id, text: welcome, done: true });
        } else if (mood) {
            send(null, mood);
        }
    }, [initialVerse, language, mood, send]);

    useEffect(() => {
        scrollToEnd();
    }, [messages.length, loading, scrollToEnd]);

    useEffect(() => {
        if (reveal?.done) scrollToEnd();
    }, [reveal?.done, scrollToEnd]);

    // Auto-grow the composer up to ~5 lines.
    useLayoutEffect(() => {
        const area = textareaRef.current;
        if (!area) return;
        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight, 148)}px`;
    }, [inputText]);

    const submit = () => {
        const text = inputText.trim();
        if (text && !loading) send(text);
    };

    const hasGuidance = messages.some((message) => message.role === 'assistant' && !message.failed);
    const placeholder = language === 'hi' ? 'अपने मन की बात यहाँ लिखें…' : PLACEHOLDERS[mood] || 'Share what is in your heart…';

    return (
        <div className="sanctuary">
            <BreathCircle isActive={settings.breathMode} />

            <div className="conversation" aria-live="polite">
                <AnimatePresence initial={false}>
                    {messages.map((message, index) => {
                        if (message.role === 'user') {
                            return (
                                <motion.div
                                    key={message.id}
                                    className="msg msg--user"
                                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.35 }}
                                >
                                    {message.content}
                                </motion.div>
                            );
                        }

                        const crisis = message.context?.crisis_detected;
                        const { lead, trail } = splitMessage(message.content, Boolean(message.verse));
                        const isCurrent = reveal?.id === message.id;
                        const isRevealing = isCurrent && !reveal.done;
                        const settled = !isRevealing;
                        const leadText = isCurrent ? reveal.text : lead.join('\n\n');

                        return (
                            <motion.div
                                key={message.id}
                                className={`msg msg--guide${message.failed ? ' msg--failed' : ''}`}
                                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45 }}
                            >
                                <span className="msg__avatar" aria-hidden="true">
                                    <LotusMark size={18} />
                                </span>
                                <div className="msg__body">
                                    {crisis ? (
                                        <SupportMessage content={message.content} />
                                    ) : (
                                        leadText && (
                                            <div
                                                className={`msg__text${isRevealing ? ' is-revealing' : ''}`}
                                                onClick={isRevealing ? finishReveal : undefined}
                                                title={isRevealing ? 'Tap to reveal all' : undefined}
                                            >
                                                {leadText.split(/\n{2,}/).map((paragraph, p) => <p key={p}>{paragraph}</p>)}
                                            </div>
                                        )
                                    )}

                                    {message.context?.offline && settled && (
                                        <span className="chip chip--muted msg__offline">
                                            <WifiOff size={12} /> Offline · from wisdom kept on this device
                                        </span>
                                    )}

                                    {message.verse && settled && (
                                        <VerseDisplay verse={message.verse} language={language} />
                                    )}

                                    {trail.length > 0 && settled && (
                                        <motion.div
                                            className="msg__text msg__text--trail"
                                            initial={reduceMotion ? false : { opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5, duration: 0.8 }}
                                        >
                                            {trail.map((paragraph, p) => <p key={p}>{paragraph}</p>)}
                                        </motion.div>
                                    )}

                                    {message.failed && lastRequest && index === messages.length - 1 && (
                                        <button type="button" className="btn btn--outline btn--sm" onClick={() => {
                                            setMessages((list) => list.filter((item) => item.id !== message.id));
                                            send(lastRequest.text, lastRequest.text ? null : lastRequest.mood, { retry: true });
                                        }}>
                                            <RotateCcw size={14} /> Try again
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {loading && (
                    <div className="msg msg--guide msg--pending" aria-label="Listening for wisdom">
                        <span className="msg__avatar" aria-hidden="true"><LotusMark size={18} /></span>
                        <div className="msg__pending">
                            <span className="breathing-dots"><span /><span /><span /></span>
                            <span>{language === 'hi' ? 'ज्ञान की प्रतीक्षा…' : 'Listening for wisdom…'}</span>
                        </div>
                    </div>
                )}

                {hasGuidance && !loading && reveal?.done !== false && (
                    <motion.div
                        className="conversation__close"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.8 }}
                    >
                        <div className="ornament" aria-hidden="true"><span className="ornament__gem" /></div>
                        <button type="button" className="btn btn--ghost" onClick={onBack}>
                            Sit in silence and reflect
                        </button>
                    </motion.div>
                )}

                <div ref={endRef} className="conversation__end" />
            </div>

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
                        aria-label="Share what is in your heart"
                        enterKeyHint="send"
                    />
                    <VoiceInput
                        language={language}
                        disabled={loading}
                        onTranscript={(text) => setInputText((current) => (current ? `${current} ${text}` : text))}
                    />
                    <button
                        type="submit"
                        className="composer__send"
                        disabled={!inputText.trim() || loading}
                        aria-label="Send"
                    >
                        <ArrowUp size={18} strokeWidth={2.2} />
                    </button>
                </form>
                <p className="composer__note">Not a substitute for professional care · conversations are never stored</p>
            </div>
        </div>
    );
}

export default Sanctuary;
