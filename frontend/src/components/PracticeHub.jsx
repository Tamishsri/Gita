import React from 'react';
import { ArrowRight } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { Diya } from './ui/Ornaments';
import { PRACTICES, practiceForNow } from '../lib/practices';
import { readDay } from '../lib/day';
import { readJourney } from '../lib/journey';
import { useI18n } from '../i18n';

// The practices, gathered by the paths the Gita teaches. Each names the
// verse it comes from, so nothing here is decoration.
function PracticeHub({ isOpen, onClose, onOpen }) {
    const { t } = useI18n();
    const suggested = practiceForNow();
    const day = readDay();
    const journey = readJourney();

    const status = (id) => {
        if (id === 'sankalpa' && day.sankalpa) return t('practiceHub.setToday');
        if (id === 'sandhya' && day.sandhya) return t('practiceHub.doneToday');
        if (id === 'walk' && journey) return t('practiceHub.walking');
        return null;
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('practiceHub.title')} width={640} size="tall">
            <SheetHeader
                leading={<span className="sheet__icon sheet__icon--lamp"><Diya size={34} steady /></span>}
                eyebrow={t('practiceHub.eyebrow')}
                title={t('practiceHub.title')}
                subtitle={t('practiceHub.subtitle')}
                onClose={onClose}
            />
            <div className="sheet__body sheet__body--padded">
                <ul className="practice-list">
                    {PRACTICES.map((practice) => {
                        const Glyph = practice.glyph;
                        const note = status(practice.id);
                        return (
                            <li key={practice.id}>
                                <button type="button" className={`practice-item${practice.id === suggested ? ' is-suggested' : ''}`} onClick={() => onOpen(practice.id)}>
                                    <span className="practice-item__glyph"><Glyph size={30} /></span>
                                    <span className="practice-item__text">
                                        <span className="practice-item__yoga">
                                            {t(`practice.${practice.id}.yoga`)}
                                            {practice.id === suggested && <em> · {t('practiceHub.forNow')}</em>}
                                        </span>
                                        <strong>{t(`practice.${practice.id}.title`)}</strong>
                                        <span className="practice-item__desc">{t(`practice.${practice.id}.desc`)}</span>
                                        <span className="practice-item__quote">“{t(`practice.${practice.id}.quote`)}” — {practice.ref}</span>
                                    </span>
                                    <span className="practice-item__meta">
                                        {note ? <span className="chip">{note}</span> : <span className="faint">{t('practiceHub.minutes', { count: practice.minutes })}</span>}
                                        <ArrowRight size={16} className="faint" />
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <p className="practice-hub__note">{t('practiceHub.note')}</p>
            </div>
        </Sheet>
    );
}

export default PracticeHub;
