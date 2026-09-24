// Entry point for the project write-ups under /work/. They share the home
// page's type, palette and theme toggle, but not the WebGL scene: a write-up
// is for reading, and the scene is the home page's navigation device.
import './styles/base.css';
import './styles/case.css';

import { createReveals } from './ui/reveal.js';
import { createTheme } from './ui/theme.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

createTheme({});
createReveals({ reducedMotion });
