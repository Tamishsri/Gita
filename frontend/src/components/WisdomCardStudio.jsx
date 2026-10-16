import React, { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Download, Image as ImageIcon, Share2 } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { CARD_FORMATS, canvasToBlob, cardFileName, renderWisdomCard } from '../lib/wisdomCard';
import { verseRef } from '../lib/verse';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';

const canCopyImages = typeof window !== 'undefined' && typeof window.ClipboardItem === 'function' && Boolean(navigator.clipboard?.write);

function canShareFiles(file) {
    try {
        return Boolean(navigator.canShare?.({ files: [file] }));
    } catch {
        return false;
    }
}

// Turns any verse into a shareable image, rendered entirely on this device.
function WisdomCardStudio({ request, onClose, defaultLanguage = 'en' }) {
    const verse = request?.verse || null;
    const [format, setFormat] = useState('portrait');
    const [language, setLanguage] = useState(defaultLanguage);
    const [includeSanskrit, setIncludeSanskrit] = useState(true);
    const [preview, setPreview] = useState({ status: 'idle', url: null, blob: null });
    const [saved, setSaved] = useState(false);
    const urlRef = useRef(null);

    useEffect(() => {
        if (!request) return;
        setLanguage(request.language || defaultLanguage);
        setSaved(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request?.nonce]);

    useEffect(() => {
        if (!verse) return undefined;
        let cancelled = false;
        setPreview((current) => ({ ...current, status: 'rendering' }));

        renderWisdomCard(verse, { format, language, includeSanskrit })
            .then(canvasToBlob)
            .then((blob) => {
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = url;
                setPreview({ status: 'ready', url, blob });
            })
            .catch(() => !cancelled && setPreview({ status: 'error', url: null, blob: null }));

        return () => {
            cancelled = true;
        };
    }, [verse, format, language, includeSanskrit]);

    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    const fileName = verse ? cardFileName(verse, format) : 'Living-Gita.png';
    const file = preview.blob ? new File([preview.blob], fileName, { type: 'image/png' }) : null;
    const shareable = file && canShareFiles(file);
    const hasHindi = Boolean(verse?.meaning_hi);
    const { width, height } = CARD_FORMATS[format];
    const ready = preview.status === 'ready';

    const download = () => {
        if (!preview.url) return;
        const link = document.createElement('a');
        link.href = preview.url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setSaved(true);
        playChime('soft');
        haptic('success');
        toast('Wisdom card saved to your downloads.', { icon: 'check', tone: 'gold' });
    };

    const share = async () => {
        try {
            await navigator.share({ files: [file], title: 'Living Gita', text: `Bhagavad Gita ${verseRef(verse)} — Living Gita` });
            haptic('success');
        } catch (error) {
            if (error?.name !== 'AbortError') toast('Sharing is not available here — save the image instead.');
        }
    };

    const copyImage = async () => {
        try {
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': preview.blob })]);
            toast('Image copied — paste it anywhere.', { icon: 'check' });
        } catch {
            toast('Your browser blocked copying images.');
        }
    };

    return (
        <Sheet isOpen={Boolean(verse)} onClose={onClose} label="Wisdom card" width={900} size="tall" blocksHotkeys className="studio-sheet">
            <SheetHeader
                icon={ImageIcon}
                eyebrow="Wisdom card"
                title={verse ? `Bhagavad Gita ${verseRef(verse)}` : 'Wisdom card'}
                subtitle="An image for your status, stories or wallpaper — made on this device"
                onClose={onClose}
            />

            <div className="sheet__body studio">
                <div className="studio__preview" style={{ '--ratio': `${width} / ${height}` }}>
                    <div className={`studio__frame${ready ? '' : ' is-rendering'}`}>
                        {preview.url && <img src={preview.url} alt={`Wisdom card for Bhagavad Gita ${verse ? verseRef(verse) : ''}`} />}
                        {!ready && preview.status !== 'error' && (
                            <span className="studio__rendering"><span className="breathing-dots"><span /><span /><span /></span></span>
                        )}
                        {preview.status === 'error' && <span className="studio__rendering">The card could not be drawn.</span>}
                    </div>
                </div>

                <div className="studio__controls">
                    <div className="studio__group">
                        <span className="eyebrow eyebrow--muted">Format</span>
                        <div className="format-picker" role="group" aria-label="Card format">
                            {Object.entries(CARD_FORMATS).map(([id, spec]) => (
                                <button key={id} type="button" className="format-option" aria-pressed={format === id} onClick={() => setFormat(id)}>
                                    <span className="format-option__glyph" style={{ aspectRatio: `${spec.width} / ${spec.height}` }} aria-hidden="true" />
                                    <span className="format-option__label">{spec.label}</span>
                                    <span className="format-option__hint">{spec.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {hasHindi && (
                        <div className="studio__group">
                            <span className="eyebrow eyebrow--muted">Translation</span>
                            <div className="segmented" role="group" aria-label="Translation language">
                                <button type="button" aria-pressed={language !== 'hi'} onClick={() => setLanguage('en')}>English</button>
                                <button type="button" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>हिंदी</button>
                            </div>
                        </div>
                    )}

                    {verse?.sanskrit && (
                        <div className="settings-row">
                            <div className="settings-row__text">
                                <span className="settings-row__label">Sanskrit verse</span>
                                <span className="settings-row__description">Devanagari above the translation</span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                className="switch"
                                aria-checked={includeSanskrit}
                                aria-label="Include Sanskrit"
                                onClick={() => setIncludeSanskrit((value) => !value)}
                            />
                        </div>
                    )}

                    <div className="studio__actions">
                        <button type="button" className="btn btn--gold btn--lg btn--block" onClick={download} disabled={!ready}>
                            {saved ? <Check size={17} /> : <Download size={17} />}
                            {saved ? 'Saved — save again' : 'Save card image (.png)'}
                        </button>
                        <div className="studio__secondary">
                            {shareable && (
                                <button type="button" className="btn btn--outline" onClick={share} disabled={!ready}>
                                    <Share2 size={15} /> Share
                                </button>
                            )}
                            {canCopyImages && (
                                <button type="button" className="btn btn--soft" onClick={copyImage} disabled={!ready}>
                                    <Clipboard size={15} /> Copy image
                                </button>
                            )}
                        </div>
                        <p className="studio__note faint">{width} × {height} px · PNG · nothing is uploaded</p>
                    </div>
                </div>
            </div>
        </Sheet>
    );
}

export default WisdomCardStudio;
