import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { haptic } from '../lib/haptics';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// Speak instead of type. The recogniser is created once per language; the
// latest onTranscript is read from a ref so re-renders never restart it.
function VoiceInput({ onTranscript, disabled, language = 'en' }) {
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState('');
    const recognitionRef = useRef(null);
    const onTranscriptRef = useRef(onTranscript);
    onTranscriptRef.current = onTranscript;

    useEffect(() => {
        if (!Recognition) return undefined;

        const recognition = new Recognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';

        recognition.onresult = (event) => {
            let finalText = '';
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const piece = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalText += piece;
                else interimText += piece;
            }
            setInterim(interimText);
            if (finalText) {
                onTranscriptRef.current?.(finalText.trim());
                setInterim('');
            }
        };
        recognition.onerror = () => {
            setListening(false);
            setInterim('');
        };
        recognition.onend = () => {
            setListening(false);
            setInterim('');
        };

        recognitionRef.current = recognition;
        return () => {
            recognition.onresult = null;
            recognition.onend = null;
            recognition.onerror = null;
            try {
                recognition.abort();
            } catch {
                // not started
            }
        };
    }, [language]);

    if (!Recognition) return null;

    const toggle = () => {
        const recognition = recognitionRef.current;
        if (!recognition) return;
        if (listening) {
            recognition.stop();
            setListening(false);
            return;
        }
        try {
            recognition.start();
            setListening(true);
            haptic('soft');
        } catch {
            setListening(false);
        }
    };

    return (
        <div className="voice-input">
            <AnimatePresence>
                {listening && (
                    <motion.div
                        className="voice-input__bubble"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                    >
                        <span className="breathing-dots" aria-hidden="true"><span /><span /><span /></span>
                        <span>{interim || (language === 'hi' ? 'सुन रहे हैं…' : 'Listening…')}</span>
                    </motion.div>
                )}
            </AnimatePresence>
            <button
                type="button"
                className={`composer__icon${listening ? ' is-listening' : ''}`}
                onClick={toggle}
                disabled={disabled}
                aria-pressed={listening}
                aria-label={listening ? 'Stop listening' : 'Speak instead of typing'}
                title={listening ? 'Stop listening' : 'Speak your thought'}
            >
                {listening ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
            </button>
        </div>
    );
}

export default VoiceInput;
