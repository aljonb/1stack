import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pocketbase.es.mjs',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pocketbase.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // UMD build (for browsers)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pocketbase.umd.js',
      format: 'umd',
      name: 'PocketBase',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/pocketbase.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
  // Svelte ES Module build
  {
    input: 'src/svelte/index.ts',
    output: {
      file: 'dist/pocketbase-svelte.es.mjs',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Svelte type definitions
  {
    input: 'src/svelte/index.ts',
    output: {
      file: 'dist/pocketbase-svelte.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
