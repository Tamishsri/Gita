import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const apiProxy = {
    '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
    }
};

function listFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}

// Emits /sw.js from src/pwa/sw.js with the hashed build files injected as the
// precache list, and a version derived from their names and the public files'
// contents — so every deploy that changes anything gets a fresh shell cache.
function livingGitaServiceWorker() {
    return {
        name: 'living-gita-sw',
        apply: 'build',
        generateBundle(_, bundle) {
            const publicDir = resolve(root, 'public');
            const publicFiles = listFiles(publicDir)
                .map((file) => `/${relative(publicDir, file).split('\\').join('/')}`)
                .filter((file) => !file.endsWith('.map'));

            const built = Object.keys(bundle)
                .filter((file) => !file.endsWith('.map'))
                .map((file) => `/${file}`);

            const precache = [...new Set(['/', ...built, ...publicFiles])].sort();
            const template = readFileSync(resolve(root, 'src/pwa/sw.js'), 'utf8');
            // The same engine the API runs, so offline answers match online ones.
            const engine = readFileSync(resolve(root, '../shared/wisdom-engine.js'), 'utf8');

            const hash = createHash('sha256');
            hash.update(template);
            hash.update(engine);
            hash.update(precache.join('|'));
            listFiles(publicDir).forEach((file) => hash.update(readFileSync(file)));
            Object.values(bundle).forEach((item) => hash.update(item.type === 'chunk' ? item.code : item.source));
            const version = hash.digest('hex').slice(0, 12);

            const source = template
                .replace('/*__WISDOM_ENGINE__*/', () => engine)
                .replace('__BUILD_VERSION__', version)
                .replace('__PRECACHE_MANIFEST__', JSON.stringify(precache, null, 4));

            this.emitFile({ type: 'asset', fileName: 'sw.js', source });
        }
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), livingGitaServiceWorker()],
    server: {
        port: 5173,
        proxy: apiProxy
    },
    preview: {
        port: 4173,
        proxy: apiProxy,
        headers: {
            // The worker must always be revalidated so updates reach people.
            'Service-Worker-Allowed': '/'
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom'],
                    motion: ['framer-motion']
                }
            }
        }
    }
});
