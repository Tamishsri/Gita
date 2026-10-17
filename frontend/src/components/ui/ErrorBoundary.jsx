import React from 'react';
import SakhaMark from './SakhaMark';
import { t } from '../../i18n';

// If anything breaks, show a calm page with a way back — never a blank
// screen. Reflections and settings live on the device, so a reload loses
// nothing. (This sits outside the language provider, so it reads the
// current language directly.)
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[Sakha] Unexpected error:', error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="threshold" role="alert">
                <section className="threshold__panel">
                    <span className="threshold__mark"><SakhaMark size={72} tile /></span>
                    <span className="eyebrow">{t('error.eyebrow')}</span>
                    <h1 className="threshold__title">{t('error.title')}</h1>
                    <p className="threshold__lede">{t('error.body')}</p>
                    <button type="button" className="btn btn--gold btn--lg" onClick={() => window.location.reload()}>
                        {t('error.return')}
                    </button>
                </section>
            </div>
        );
    }
}

export default ErrorBoundary;
