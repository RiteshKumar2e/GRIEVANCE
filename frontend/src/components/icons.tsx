/** Minimal stroke icon set (24px grid, 1.75 stroke). Used only where an icon clarifies an action. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const IconMenu = (p: P) => <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconClose = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconBell = (p: P) => <svg {...base} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
export const IconSignOut = (p: P) => <svg {...base} {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></svg>;
export const IconEye = (p: P) => <svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const IconEyeOff = (p: P) => <svg {...base} {...p}><path d="M4 4l16 16" /><path d="M9.9 6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.4 7.5A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4.2-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
export const IconMic = (p: P) => <svg {...base} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>;
export const IconStop = (p: P) => <svg {...base} {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="1" /></svg>;
export const IconSearch = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>;
export const IconChevron = (p: P) => <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>;
export const IconSend = (p: P) => <svg {...base} {...p}><path d="M4 12l16-7-6 16-3-7-7-2z" /></svg>;
export const IconSpeaker = (p: P) => <svg {...base} {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
export const IconCopy = (p: P) => <svg {...base} {...p}><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>;
export const IconExternal = (p: P) => <svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></svg>;
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p} fill={filled ? "currentColor" : "none"}><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" /></svg>
);
export const IconSpinner = (p: P) => (
  <svg {...base} {...p} className={`animate-spin motion-reduce:animate-none ${p.className ?? ""}`}><path d="M12 3a9 9 0 1 0 9 9" /></svg>
);
