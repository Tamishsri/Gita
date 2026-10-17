import React from 'react';
import { HeartHandshake, LifeBuoy, Phone, Globe, Sparkles, Shield, Sprout } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { Diya, KolamRule } from './ui/Ornaments';
import { useI18n } from '../i18n';

const HELPLINES = [
    { id: 'telemanas', numbers: ['14416', '1800-891-4416'] },
    { id: 'vandrevala', numbers: ['+91 9999 666 555'] },
    { id: 'lifeline', numbers: ['988'] }
];

// The principles behind every design choice, each from the Gita.
const PRINCIPLES = [
    { id: 'samvada', sa: 'संवाद', ref: '18.70' },
    { id: 'dipa', sa: 'दीप', ref: '6.19' },
    { id: 'nishkama', sa: 'निष्काम', ref: '2.47' },
    { id: 'samatva', sa: 'समत्व', ref: '2.48' },
    { id: 'aparigraha', sa: 'अपरिग्रह', ref: '6.10' },
    { id: 'svadharma', sa: 'स्वधर्म', ref: '3.35' }
];

function Disclaimer({ isOpen, onClose }) {
    const { t } = useI18n();
    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('about.title')} width={640} size="tall">
            <SheetHeader
                leading={<span className="sheet__icon sheet__icon--lamp"><Diya size={34} steady /></span>}
                eyebrow={t('about.eyebrow')}
                title={t('about.title')}
                onClose={onClose}
            />

            <div className="sheet__body sheet__body--padded about">
                <p className="about__lede">{t('about.lede')}</p>

                <section className="about__name">
                    <span className="about__name-sa" lang="sa">सखा</span>
                    <div>
                        <h3>{t('about.name')}</h3>
                        <p>{t('about.nameBody')}</p>
                    </div>
                </section>

                <section className="support-card" aria-labelledby="crisis-heading">
                    <div className="support-card__head">
                        <LifeBuoy size={18} aria-hidden="true" />
                        <h3 id="crisis-heading" className="eyebrow">{t('about.crisis')}</h3>
                    </div>
                    <p>{t('about.crisisBody')}</p>
                    <ul className="helplines">
                        {HELPLINES.map((line) => (
                            <li key={line.id}>
                                <div>
                                    <strong>{t(`about.help.${line.id}.name`)}</strong>
                                    <span>{t(`about.help.${line.id}.detail`)}</span>
                                </div>
                                <div className="helplines__numbers">
                                    {line.numbers.map((number) => (
                                        <a key={number} className="btn btn--outline btn--sm" href={`tel:${number.replace(/[\s-]/g, '')}`}>
                                            <Phone size={13} /> {number}
                                        </a>
                                    ))}
                                </div>
                            </li>
                        ))}
                        <li>
                            <div>
                                <strong>{t('about.help.world.name')}</strong>
                                <span>{t('about.help.world.detail')}</span>
                            </div>
                            <div className="helplines__numbers">
                                <a className="btn btn--outline btn--sm" href="https://findahelpline.com" target="_blank" rel="noreferrer">
                                    <Globe size={13} /> findahelpline.com
                                </a>
                            </div>
                        </li>
                    </ul>
                </section>

                <section className="about__section">
                    <h3>{t('about.shaped')}</h3>
                    <p>{t('about.shapedLede')}</p>
                    <ul className="principles">
                        {PRINCIPLES.map((principle) => (
                            <li key={principle.id} className="principle">
                                <span className="principle__sa" lang="sa">{principle.sa}</span>
                                <div>
                                    <strong>{t(`about.p.${principle.id}.title`)} <span className="faint">· {principle.ref}</span></strong>
                                    <p>{t(`about.p.${principle.id}.body`)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <KolamRule />

                <section className="about__section">
                    <h3>{t('about.not')}</h3>
                    <ul className="about__list">
                        <li><Shield size={15} aria-hidden="true" /> {t('about.not1')}</li>
                        <li><Shield size={15} aria-hidden="true" /> {t('about.not2')}</li>
                        <li><Shield size={15} aria-hidden="true" /> {t('about.not3')}</li>
                    </ul>
                </section>

                <section className="about__section">
                    <h3>{t('about.approach')}</h3>
                    <ul className="about__list">
                        <li><Sparkles size={15} aria-hidden="true" /> {t('about.approach1')}</li>
                        <li><HeartHandshake size={15} aria-hidden="true" /> {t('about.approach2')}</li>
                        <li><Sprout size={15} aria-hidden="true" /> {t('about.approach3')}</li>
                    </ul>
                </section>

                <section className="about__section">
                    <h3>{t('about.privacy')}</h3>
                    <p>{t('about.privacyBody')}</p>
                </section>

                <section className="about__section">
                    <h3>{t('about.source')}</h3>
                    <p>{t('about.sourceBody')}</p>
                </section>

                <footer className="about__footer">
                    <Diya size={40} steady />
                    <p>{t('about.footer1')}<br />{t('about.footer2')}</p>
                </footer>
            </div>
        </Sheet>
    );
}

export default Disclaimer;
