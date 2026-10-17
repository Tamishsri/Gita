// Puṣpa-vṛṣṭi — a shower of flowers. In the Mahābhārata the heavens rain
// petals at moments of grace; here they fall, briefly, when something is
// completed: a mala, an evening offering, a day of the walk, a verse learned.
//
// Any module can call celebrate(); <PetalShower /> draws it.

export const CELEBRATE_EVENT = 'lg:celebrate';

/** @param {'full' | 'gentle'} [intensity] */
export function celebrate(intensity = 'full') {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { intensity, id: Date.now() } }));
}
