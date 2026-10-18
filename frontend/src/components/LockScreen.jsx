import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Delete, Lock } from 'lucide-react';
import SakhaMark from './ui/SakhaMark';
import { cooldownRemaining, passcodeLength, verifyPasscode } from '../lib/lock';
import { purgeLocalData } from '../lib/settings';
import { haptic } from '../lib/haptics';
import { useI18n } from '../i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'back'];

// Sakha, closed. Nothing of the person's is rendered behind this screen —
// the app itself only mounts once the passcode is right.
function LockScreen({ name, onUnlock, onErased }) {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const length = passcodeLength();
    const [code, setCode] = useState('');
    const [status, setStatus] = useState('idle'); // idle | checking | wrong
    const [wait, setWait] = useState(() => cooldownRemaining());
    const [forgot, setForgot] = useState(false);
    const [shake, setShake] = useState(0);

    const check = useCallback(async (value) => {
        setStatus('checking');
        const result = await verifyPasscode(value);
        if (result.ok) {
            haptic('success');
            onUnlock();
            return;
        }
        haptic('error');
        setCode('');
        setStatus('wrong');
        setShake((count) => count + 1);
        if (result.waitMs) setWait(result.waitMs);
    }, [onUnlock]);

    const press = useCallback((key) => {
        if (status === 'checking' || wait > 0) return;
        if (key === 'back') {
            setCode((current) => current.slice(0, -1));
            return;
        }
        if (code.length >= length) return;
        const next = `${code}${key}`;
        setStatus('idle');
        setCode(next);
        if (next.length === length) check(next);
    }, [check, code, length, status, wait]);

    // A keyboard works too.
    useEffect(() => {
        if (forgot) return undefined;
        const onKey = (event) => {
            if (/^\d$/.test(event.key)) press(event.key);
            else if (event.key === 'Backspace') press('back');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [forgot, press]);

    useEffect(() => {
        if (wait <= 0) return undefined;
        const timer = setInterval(() => setWait(cooldownRemaining()), 500);
        return () => clearInterval(timer);
    }, [wait]);

    const erase = () => {
        purgeLocalData();
        onErased?.();
    };

    const message = wait > 0
        ? t('lock.wait', { seconds: Math.ceil(wait / 1000) })
        : status === 'wrong' ? t('lock.wrong') : t('lock.prompt');

    return (
        <main className="threshold lock" id="main">
            <div className="lock__panel">
                <SakhaMark size={68} alive className="lock__mark" />
                <span className="eyebrow"><Lock size={11} aria-hidden="true" /> {t('lock.eyebrow')}</span>
                <h1 className="lock__title">{name ? t('lock.titleNamed', { name }) : t('lock.title')}</h1>

                {forgot ? (
                    <div className="lock__forgot">
                        <p>{t('lock.forgotBody')}</p>
                        <div className="lock__forgot-actions">
                            <button type="button" className="btn btn--danger" onClick={erase}>{t('lock.erase')}</button>
                            <button type="button" className="btn btn--ghost" onClick={() => setForgot(false)}>{t('lock.back')}</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className={`lock__message${status === 'wrong' || wait ? ' is-alert' : ''}`} role="status" aria-live="polite">{message}</p>
                        <motion.div
                            key={shake}
                            className="lock__dots"
                            aria-label={t('lock.entered', { count: code.length, total: length })}
                            animate={shake && !reduceMotion ? { x: [0, -10, 10, -7, 7, -3, 0] } : { x: 0 }}
                            transition={{ duration: 0.42 }}
                        >
                            {Array.from({ length }, (_, index) => (
                                <span key={index} className={index < code.length ? 'is-filled' : ''} />
                            ))}
                        </motion.div>
                        <div className="lock__pad" role="group" aria-label={t('lock.keypad')}>
                            {KEYS.map((key, index) => (key === null ? <span key={`gap-${index}`} aria-hidden="true" /> : (
                                <button
                                    key={key}
                                    type="button"
                                    className={`lock__key${key === 'back' ? ' lock__key--back' : ''}`}
                                    onClick={() => press(key)}
                                    disabled={wait > 0 || status === 'checking' || (key === 'back' && !code)}
                                    aria-label={key === 'back' ? t('lock.delete') : key}
                                >
                                    {key === 'back' ? <Delete size={20} /> : key}
                                </button>
                            )))}
                        </div>
                        <button type="button" className="btn btn--link btn--sm lock__forgot-link" onClick={() => setForgot(true)}>{t('lock.forgot')}</button>
                    </>
                )}
                <p className="lock__note">{t('lock.note')}</p>
            </div>
        </main>
    );
}

export default LockScreen;
