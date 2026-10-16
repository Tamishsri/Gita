import React from 'react';
import LotusMark from './LotusMark';

// If anything in the sanctuary breaks, show a calm page with a way back —
// never a blank screen. Reflections and settings live in localStorage, so a
// reload loses nothing.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[Living Gita] Unexpected error:', error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="threshold" role="alert">
                <section className="threshold__panel">
                    <span className="threshold__mark"><LotusMark size={56} ring /></span>
                    <span className="eyebrow">A moment of stillness</span>
                    <h1 className="threshold__title">Something went quiet.</h1>
                    <p className="threshold__lede">
                        The sanctuary stumbled. Your reflections and walks are safe on this device.
                    </p>
                    <button type="button" className="btn btn--gold btn--lg" onClick={() => window.location.reload()}>
                        Return to the sanctuary
                    </button>
                </section>
            </div>
        );
    }
}

export default ErrorBoundary;
