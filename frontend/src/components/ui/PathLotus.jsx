import React from 'react';
import { PATH_IDS } from '../../lib/person';

// The four paths, each with its own colour.
export const PATH_COLOURS = { karma: '200, 85, 58', jnana: '222, 138, 40', bhakti: '204, 102, 146', dhyana: '84, 106, 176' };

// A lotus of four petals; each grows with how much that path has helped.
function PathLotus({ paths = {}, size = 168, highlight = null }) {
    const values = PATH_IDS.map((id) => Math.max(0, Number(paths[id]) || 0));
    const top = Math.max(...values, 1);
    const angles = { karma: -90, jnana: 0, bhakti: 90, dhyana: 180 };
    const petal = (length) => `M0,0 C${length * 0.44},${-length * 0.26} ${length * 0.34},${-length * 0.86} 0,${-length} C${-length * 0.34},${-length * 0.86} ${-length * 0.44},${-length * 0.26} 0,0 Z`;
    return (
        <svg className="path-lotus" viewBox="-100 -100 200 200" width={size} height={size} aria-hidden="true">
            <circle r="92" className="path-lotus__halo" />
            {PATH_IDS.map((id, index) => {
                const length = 34 + 52 * (values[index] / top);
                const quiet = highlight && highlight !== id;
                return (
                    <path
                        key={id}
                        d={petal(length)}
                        transform={`rotate(${angles[id] + 90})`}
                        style={{ '--petal-rgb': PATH_COLOURS[id], opacity: quiet ? 0.45 : 1 }}
                        className="path-lotus__petal"
                    />
                );
            })}
            <circle r="9" className="path-lotus__heart" />
        </svg>
    );
}

export default PathLotus;
