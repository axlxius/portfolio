import type Scene from '../scene/Scene.ts';

/**
 * The scene loads after first paint and may never load at all, so everything
 * that talks to it goes through this holder and tolerates `current` being null.
 */
export const sceneRef: { current: Scene | null } = { current: null };
