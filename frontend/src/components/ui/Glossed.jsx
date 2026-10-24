import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findTerms } from '../../lib/glossary';
import { haptic } from '../../lib/haptics';

// Words of the Gita, explained where they stand. A mouse hovers; a finger
// taps. Only one meaning is open at a time, and it closes on Escape, a tap
// elsewhere, or a scroll.

let closeOpen = null;

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

function GlossTerm({ text, entry, language }) {
    const [open, setOpen] = useState(false);
    const [place, setPlace] = useState(null);
    const anchor = useRef(null);
    const pop = useRef(null);
    const hoverTimer = useRef(null);
    const popId = useId();
    const lang = language === 'hi' ? 'hi' : 'en';

    const close = useCallback(() => {
        clearTimeout(hoverTimer.current);
        setOpen(false);
    }, []);

    const show = useCallback(() => {
        if (closeOpen && closeOpen !== close) closeOpen();
        closeOpen = close;
        setOpen(true);
    }, [close]);

    // Where the meaning sits: above the word if there is room, else below; never off-screen.
    useLayoutEffect(() => {
        if (!open || !anchor.current || !pop.current) return;
        const word = anchor.current.getBoundingClientRect();
        const card = pop.current.getBoundingClientRect();
        const margin = 12;
        const width = window.innerWidth;
        const left = Math.min(Math.max(margin, word.left + word.width / 2 - card.width / 2), width - card.width - margin);
        const above = word.top - card.height - 10 >= margin;
        const top = above ? word.top - card.height - 10 : word.bottom + 10;
        const arrow = Math.min(Math.max(16, word.left + word.width / 2 - left), card.width - 16);
        setPlace({ left, top, above, arrow });
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => { if (event.key === 'Escape') close(); };
        const onDown = (event) => {
            if (anchor.current?.contains(event.target) || pop.current?.contains(event.target)) return;
            close();
        };
        const onScroll = () => close();
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
            if (closeOpen === close) closeOpen = null;
        };
    }, [open, close]);

    useEffect(() => () => clearTimeout(hoverTimer.current), []);

    return (
        <>
            <button
                ref={anchor}
                type="button"
                className={`gloss${open ? ' is-open' : ''}`}
                aria-expanded={open}
                aria-describedby={open ? popId : undefined}
                onClick={(event) => {
                    event.stopPropagation();
                    if (open && !canHover()) close();
                    else {
                        haptic('soft');
                        show();
                    }
                }}
                onMouseEnter={() => {
                    if (!canHover()) return;
                    clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(show, 160);
                }}
                onMouseLeave={() => {
                    if (!canHover()) return;
                    clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => {
                        if (!pop.current?.matches(':hover')) close();
                    }, 180);
                }}
                onFocus={() => { if (canHover()) show(); }}
                onBlur={(event) => { if (!pop.current?.contains(event.relatedTarget)) close(); }}
            >
                {text}
            </button>
            {open && createPortal(
                <div
                    ref={pop}
                    id={popId}
                    role="tooltip"
                    className={`gloss-pop${place?.above === false ? ' gloss-pop--below' : ''}${place ? ' is-placed' : ''}`}
                    style={place ? { left: place.left, top: place.top, '--arrow': `${place.arrow}px` } : { left: -9999, top: 0 }}
                    onMouseLeave={() => { if (canHover()) close(); }}
                    lang={lang}
                >
                    <span className="gloss-pop__term">{entry.term[lang] || entry.term.en}</span>
                    <span className={`gloss-pop__meaning${lang === 'hi' ? ' is-hi' : ''}`}>{entry.meaning[lang] || entry.meaning.en}</span>
                </div>,
                document.body
            )}
        </>
    );
}

/**
 * Text with the Gita's own words made explainable. Pass a string; strings
 * without such words come back as they were.
 */
function Glossed({ text, language = 'en' }) {
    const parts = useMemo(() => {
        const source = String(text ?? '');
        const terms = findTerms(source, language);
        if (!terms.length) return [source];
        const out = [];
        let at = 0;
        terms.forEach((term) => {
            if (term.start > at) out.push(source.slice(at, term.start));
            out.push(term);
            at = term.end;
        });
        if (at < source.length) out.push(source.slice(at));
        return out;
    }, [text, language]);

    return parts.map((part, index) => (typeof part === 'string'
        ? <React.Fragment key={index}>{part}</React.Fragment>
        : <GlossTerm key={index} text={part.text} entry={part.entry} language={language} />));
}

export default Glossed;
