import React from 'react';
import { HeartHandshake, LifeBuoy, Phone, Globe, Sparkles, Shield, Sprout } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import LotusMark from './ui/LotusMark';

const HELPLINES = [
    { name: 'Tele-MANAS (India)', detail: '24/7, free & confidential', numbers: ['14416', '1800-891-4416'] },
    { name: 'Vandrevala Foundation (India)', detail: '24/7 call or WhatsApp', numbers: ['+91 9999 666 555'] },
    { name: '988 Suicide & Crisis Lifeline', detail: 'US & Canada — call or text', numbers: ['988'] }
];

function Disclaimer({ isOpen, onClose }) {
    return (
        <Sheet isOpen={isOpen} onClose={onClose} label="About Living Gita and safety" width={600} size="tall">
            <SheetHeader
                leading={<span className="sheet__icon sheet__icon--lotus"><LotusMark size={22} /></span>}
                eyebrow="About & safety"
                title="A quiet space, built with restraint"
                onClose={onClose}
            />

            <div className="sheet__body sheet__body--padded about">
                <p className="about__lede">
                    Living Gita is a place to meet the Bhagavad Gita through what you are feeling right now — all 701 verses,
                    offered gently, one at a time.
                </p>

                <section className="support-card" aria-labelledby="crisis-heading">
                    <div className="support-card__head">
                        <LifeBuoy size={18} aria-hidden="true" />
                        <h3 id="crisis-heading" className="eyebrow">If you are in crisis</h3>
                    </div>
                    <p>Please reach out to a person right now. You do not have to carry this alone.</p>
                    <ul className="helplines">
                        {HELPLINES.map((line) => (
                            <li key={line.name}>
                                <div>
                                    <strong>{line.name}</strong>
                                    <span>{line.detail}</span>
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
                                <strong>Anywhere in the world</strong>
                                <span>Find a free helpline near you</span>
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
                    <h3>What this is not</h3>
                    <ul className="about__list">
                        <li><Shield size={15} aria-hidden="true" /> Not therapy, diagnosis or mental-health treatment</li>
                        <li><Shield size={15} aria-hidden="true" /> Not a replacement for professional or medical care</li>
                        <li><Shield size={15} aria-hidden="true" /> Not religious instruction, and never conversion</li>
                    </ul>
                </section>

                <section className="about__section">
                    <h3>Our approach</h3>
                    <ul className="about__list">
                        <li><Sparkles size={15} aria-hidden="true" /> Your agency to choose silence or engagement — “Not today” is always an answer</li>
                        <li><HeartHandshake size={15} aria-hidden="true" /> Emotional safety before spiritual teaching</li>
                        <li><Sprout size={15} aria-hidden="true" /> Non-attachment — even to this app. Everything can be released.</li>
                    </ul>
                </section>

                <section className="about__section">
                    <h3>Privacy</h3>
                    <p>
                        No accounts and no analytics. Your reflections, saved lines and walks are stored only in this browser.
                        Conversations are answered by the sanctuary’s own server and are never stored or shared.
                    </p>
                </section>

                <footer className="about__footer">
                    <LotusMark size={26} />
                    <p>This app is designed with restraint.<br />Peace is our only metric.</p>
                </footer>
            </div>
        </Sheet>
    );
}

export default Disclaimer;
