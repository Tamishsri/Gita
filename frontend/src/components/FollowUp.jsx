import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, X } from 'lucide-react';
import SakhaMark from './ui/SakhaMark';
import { answerFollowUp, pendingFollowUp } from '../lib/followup';
import { PATH_EVENT } from '../lib/path';
import { celebrate } from '../lib/celebrate';
import { haptic } from '../lib/haptics';
import { useI18n } from '../i18n';

// "Last time, you told me about your studies. How is it now?"
function FollowUp({ name, onAsk }) {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const [item, setItem] = useState(pendingFollowUp);
    const [stage, setStage] = useState('ask'); // ask | lighter | same | harder
    const [text, setText] = useState('');
    // Once answered, the card stays to finish the exchange, whatever the path log says.
    const answered = useRef(false);

    useEffect(() => {
        const update = () => {
            if (!answered.current) setItem(pendingFollowUp());
        };
        window.addEventListener(PATH_EVENT, update);
        return () => window.removeEventListener(PATH_EVENT, update);
    }, []);

    if (!item) return null;

    const topic = item.topic ? t(`followup.topic.${item.topic}`) : null;
    const event = item.event || null;
    const about = event
        ? t(`followup.event.${event}`)
        : topic
            ? t('followup.about', { topic })
            : t('followup.carrying', { feeling: t(`feeling.${item.emotion}`).toLowerCase() });

    const answer = (value) => {
        answered.current = true;
        answerFollowUp(item, value);
        haptic('tap');
        setStage(value);
        if (value === 'lighter') {
            celebrate('gentle');
            setTimeout(() => setItem(null), 5200);
        } else if (event && value === 'same') {
            setTimeout(() => setItem(null), 6000);
        } else {
            setText(event ? t(`followup.event.${event}.prefill`) : topic ? t('followup.prefill', { topic }) : t('followup.prefillFeeling'));
        }
    };

    const dismiss = () => {
        answered.current = true;
        answerFollowUp(item, 'dismissed');
        setItem(null);
    };

    const send = (event) => {
        event.preventDefault();
        if (text.trim()) onAsk(text.trim());
    };

    return (
        <AnimatePresence>
            <motion.section
                className="followup"
                aria-label={t('followup.label')}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
                <header className="followup__head">
                    <SakhaMark size={26} />
                    <span className="eyebrow">{t('followup.label')}</span>
                    {stage === 'ask' && (
                        <button type="button" className="icon-btn icon-btn--xs followup__close" onClick={dismiss} aria-label={t('common.notNow')}>
                            <X size={14} />
                        </button>
                    )}
                </header>

                {stage === 'ask' && (
                    <>
                        <p className="followup__line">
                            {name ? `${name}, ` : ''}{name ? about.charAt(0).toLowerCase() + about.slice(1) : about}{event ? '' : ` ${t('followup.howNow')}`}
                        </p>
                        <div className="followup__choices" role="group" aria-label={event ? about : t('followup.howNow')}>
                            <button type="button" className="followup__choice is-lighter" onClick={() => answer('lighter')}>{t(event ? 'followup.event.well' : 'followup.lighter')}</button>
                            <button type="button" className="followup__choice" onClick={() => answer('same')}>{t(event ? 'followup.event.waiting' : 'followup.same')}</button>
                            <button type="button" className="followup__choice is-harder" onClick={() => answer('harder')}>{t(event ? 'followup.event.notWell' : 'followup.harder')}</button>
                        </div>
                    </>
                )}

                {stage === 'lighter' && <p className="followup__line">{t(event ? 'followup.event.gladLine' : 'followup.gladLine')}</p>}

                {event && stage === 'same' && <p className="followup__line">{t('followup.event.waitingLine')}</p>}

                {((stage === 'same' && !event) || stage === 'harder') && (
                    <>
                        <p className="followup__line">{t(stage === 'same' ? 'followup.sameLine' : event ? 'followup.event.harderLine' : 'followup.harderLine')}</p>
                        <form className="ask followup__ask" onSubmit={send}>
                            <textarea
                                className="ask__input"
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                rows={2}
                                maxLength={2000}
                                aria-label={t('followup.send')}
                                autoFocus
                                onFocus={(event) => {
                                    const end = event.target.value.length;
                                    event.target.setSelectionRange(end, end);
                                }}
                            />
                            <button type="submit" className="ask__send" disabled={!text.trim()} aria-label={t('followup.send')}>
                                <ArrowUp size={18} />
                            </button>
                        </form>
                    </>
                )}
            </motion.section>
        </AnimatePresence>
    );
}

export default FollowUp;
