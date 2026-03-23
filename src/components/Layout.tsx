11:05:11.955 Running build in Washington, D.C., USA (East) – iad1
11:05:11.956 Build machine configuration: 2 cores, 8 GB
11:05:12.771 Cloning github.com/ph2oconsult-pixeldiffboho/antiquehunter (Branch: main, Commit: 77dffef)
11:05:13.302 Cloning completed: 531.000ms
11:05:13.465 Restored build cache from previous deployment (5SGx5sXrYpw87Egx6z3pkaUb33A2)
11:05:14.035 Running "vercel build"
11:05:14.654 Vercel CLI 50.35.0
11:05:15.156 Installing dependencies...
11:05:18.848 
11:05:18.849 up to date in 3s
11:05:18.849 
11:05:18.850 108 packages are looking for funding
11:05:18.850   run `npm fund` for details
11:05:18.884 Running "npm run build"
11:05:18.981 
11:05:18.981 > react-example@0.0.0 build
11:05:18.982 > npm run clean && vite build
11:05:18.982 
11:05:19.080 
11:05:19.081 > react-example@0.0.0 clean
11:05:19.081 > rm -rf dist
11:05:19.081 
11:05:19.508 [36mvite v6.4.1 [32mbuilding for production...[36m[39m
11:05:19.588 transforming...
11:05:31.341 [32m✓[39m 2149 modules transformed.
11:05:31.343 [31m✗[39m Build failed in 11.79s
11:05:31.344 [31merror during build:
11:05:31.344 [31msrc/App.tsx (4:9): "Layout" is not exported by "src/components/Layout.tsx", imported by "src/App.tsx".[31m
11:05:31.344 file: [36m/vercel/path0/src/App.tsx:4:9[31m
11:05:31.346 [33m
11:05:31.346 2: import { motion, AnimatePresence } from 'motion/react';
11:05:31.346 3: import { useTranslation } from 'react-i18next';
11:05:31.346 4: import { Layout } from './components/Layout';
11:05:31.346             ^
11:05:31.346 5: import { Home } from './components/Home';
11:05:31.347 6: import { Collection } from './components/Collection';
11:05:31.347 [31m
11:05:31.347     at getRollupError (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:402:41)
11:05:31.347     at error (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:398:42)
11:05:31.347     at Module.error (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:17040:16)
11:05:31.347     at Module.traceVariable (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:17452:29)
11:05:31.348     at ModuleScope.findVariable (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:15070:39)
11:05:31.348     at FunctionScope.findVariable (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:5673:38)
11:05:31.348     at FunctionBodyScope.findVariable (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:5673:38)
11:05:31.348     at Identifier.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:5447:40)
11:05:31.348     at CallExpression.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:2825:28)
11:05:31.348     at CallExpression.bind (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:12179:15)[39m
11:05:31.390 Error: Command "npm run build" exited with 1
