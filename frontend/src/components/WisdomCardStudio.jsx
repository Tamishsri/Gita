import React, { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Download, Image as ImageIcon, Share2 } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { CARD_FORMATS, canvasToBlob, cardFileName, renderWisdomCard } from '../lib/wisdomCard';
import { verseNumber, verseRef } from '../lib/verse';
import { scriptById } from '../lib/script';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';
import { translate, useI18n } from '../i18n';
import { usePreferences } from '../contexts/PreferencesContext';
import { BRAND, appName } from '../lib/brand';

const canCopyImages = typeof window !== 'undefined' && typeof window.ClipboardItem === 'function' && Boolean(navigator.clipboard?.write);

function canShareFiles(file) {
    try {
        return Boolean(navigator.canShare?.({ files: [file] }));
    } catch {
        return false;
    }
}

function Toggle({ label, description, checked, onChange }) {
    return (
        <div className="settings-row">
            <div className="settings-row__text">
                <span className="settings-row__label">{label}</span>
                {description && <span className="settings-row__description">{description}</span>}
            </div>
            <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
        </div>
    );
}

// Turns any verse into an image, drawn entirely on this device.
function WisdomCardStudio({ request, onClose, defaultLanguage = 'en' }) {
    const { t } = useI18n();
    const { script } = usePreferences();
    const verse = request?.verse || null;
    const [format, setFormat] = useState('portrait');
    const [language, setLanguage] = useState(defaultLanguage);
    const [includeSanskrit, setIncludeSanskrit] = useState(true);
    const [includeEssence, setIncludeEssence] = useState(true);
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

        // The card speaks the language of its meaning, not of the interface.
        const lang = language === 'hi' && verse.meaning_hi ? 'hi' : 'en';
        const labels = {
            chapterLine: translate('card.chapterLine', { chapter: verse.chapter, verse: verseNumber(verse) }, lang),
            tagline: translate('card.tagline', null, lang),
            citation: translate('card.citation', { ref: verseRef(verse) }, lang),
            brand: lang === 'hi' ? appName('hi') : appName('en').toUpperCase()
        };

        renderWisdomCard(verse, { format, language: lang, includeSanskrit, includeEssence, script, labels })
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
    }, [verse, format, language, includeSanskrit, includeEssence, script]);

    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    const fileName = verse ? cardFileName(verse, format) : `${BRAND.slug}.png`;
    const file = preview.blob ? new File([preview.blob], fileName, { type: 'image/png' }) : null;
    const shareable = file && canShareFiles(file);
    const hasHindi = Boolean(verse?.meaning_hi);
    const hasEssence = Boolean(verse?.notification_short);
    const { width, height } = CARD_FORMATS[format];
    const ready = preview.status === 'ready';
    const ref = verse ? `${t('verse.bg')} ${verseRef(verse)}` : '';
    const scriptName = scriptById(script).native;

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
        toast(t('card.saved'), { icon: 'check', tone: 'gold' });
    };

    const share = async () => {
        try {
            await navigator.share({ files: [file], title: t('brand.name'), text: `${ref} — ${t('brand.name')}` });
            haptic('success');
        } catch (error) {
            if (error?.name !== 'AbortError') toast(t('card.shareFailed'));
        }
    };

    const copyImage = async () => {
        try {
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': preview.blob })]);
            toast(t('card.copied'), { icon: 'check' });
        } catch {
            toast(t('card.copyBlocked'));
        }
    };

    return (
        <Sheet isOpen={Boolean(verse)} onClose={onClose} label={t('card.title')} width={900} size="tall" blocksHotkeys className="studio-sheet">
            <SheetHeader
                icon={ImageIcon}
                eyebrow={t('card.eyebrow')}
                title={ref || t('card.title')}
                subtitle={t('card.subtitle')}
                onClose={onClose}
            />

            <div className="sheet__body studio">
                <div className="studio__preview" style={{ '--ratio': `${width} / ${height}` }}>
                    <div className={`studio__frame${ready ? '' : ' is-rendering'}`}>
                        {preview.url && <img src={preview.url} alt={t('card.preview', { ref })} />}
                        {!ready && preview.status !== 'error' && (
                            <span className="studio__rendering" role="status">
                                <span className="breathing-dots" aria-hidden="true"><span /><span /><span /></span>
                                <span className="sr-only">{t('card.rendering')}</span>
                            </span>
                        )}
                        {preview.status === 'error' && <span className="studio__rendering">{t('card.failed')}</span>}
                    </div>
                </div>

                <div className="studio__controls">
                    <div className="studio__group">
                        <span className="eyebrow eyebrow--muted">{t('card.format')}</span>
                        <div className="format-picker" role="group" aria-label={t('card.format')}>
                            {Object.entries(CARD_FORMATS).map(([id, spec]) => (
                                <button key={id} type="button" className="format-option" aria-pressed={format === id} onClick={() => setFormat(id)}>
                                    <span className="format-option__glyph" style={{ aspectRatio: `${spec.width} / ${spec.height}` }} aria-hidden="true" />
                                    <span className="format-option__label">{t(`card.format.${id}`)}</span>
                                    <span className="format-option__hint">{spec.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {hasHindi && (
                        <div className="studio__group">
                            <span className="eyebrow eyebrow--muted">{t('card.language')}</span>
                            <div className="segmented" role="group" aria-label={t('card.language')}>
                                <button type="button" aria-pressed={language !== 'hi'} onClick={() => setLanguage('en')}>English</button>
                                <button type="button" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')} lang="hi">हिन्दी</button>
                            </div>
                        </div>
                    )}

                    {verse?.sanskrit && (
                        <Toggle
                            label={t('card.sanskrit')}
                            description={t('card.sanskritDesc', { script: scriptName })}
                            checked={includeSanskrit}
                            onChange={setIncludeSanskrit}
                        />
                    )}
                    {hasEssence && (
                        <Toggle label={t('card.essence')} description={t('card.essenceDesc')} checked={includeEssence} onChange={setIncludeEssence} />
                    )}

                    <div className="studio__actions">
                        <button type="button" className="btn btn--gold btn--lg btn--block" onClick={download} disabled={!ready}>
                            {saved ? <Check size={17} /> : <Download size={17} />}
                            {saved ? t('card.savedAgain') : t('card.download')}
                        </button>
                        <div className="studio__secondary">
                            {shareable && (
                                <button type="button" className="btn btn--outline" onClick={share} disabled={!ready}>
                                    <Share2 size={15} /> {t('card.share')}
                                </button>
                            )}
                            {canCopyImages && (
                                <button type="button" className="btn btn--soft" onClick={copyImage} disabled={!ready}>
                                    <Clipboard size={15} /> {t('card.copy')}
                                </button>
                            )}
                        </div>
                        <p className="studio__note faint">{t('card.note', { width, height })}</p>
                    </div>
                </div>
            </div>
        </Sheet>
    );
}

export default WisdomCardStudio;
