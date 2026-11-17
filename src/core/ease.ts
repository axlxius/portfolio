import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

/** The site's one curve, the same as --ease in base.css. */
export const EASE = CustomEase.create('site', '0.22,1,0.36,1');
/** Symmetric curve for moves that both start and stop on screen. */
export const EASE_IO = CustomEase.create('site-io', '0.65,0,0.35,1');
