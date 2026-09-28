import type { JSX } from 'preact';

type P = { size?: number; class?: string; style?: JSX.CSSProperties };

const S = (props: P, children: JSX.Element | JSX.Element[], fill = false) => (
  <svg
    class={'ico ' + (props.class ?? '')}
    style={props.style}
    width={props.size ?? 24}
    height={props.size ?? 24}
    viewBox="0 0 24 24"
    fill={fill ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Icon = {
  play: (p: P = {}) => S(p, <path d="M7 4.5v15l12-7.5z" fill="currentColor" />),
  bomb: (p: P = {}) =>
    S(p, [
      <circle cx="10.5" cy="14" r="6.5" fill="currentColor" stroke="none" />,
      <path d="M14.5 9.5l2.5-2.5" />,
      <path d="M17 5.5l1.2-1.2M19.5 7l1.5-.3M18 3l.3-1.5" />,
    ]),
  map: (p: P = {}) => S(p, [<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />, <path d="M9 4v14M15 6v14" />]),
  globe: (p: P = {}) => S(p, [<circle cx="12" cy="12" r="9" />, <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />]),
  pad: (p: P = {}) =>
    S(p, [
      <path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5.2 2L15 14H9l-1.8 2A3 3 0 012 14v-2a4 4 0 014-4z" />,
      <path d="M7 11v3M5.5 12.5h3" />,
      <circle cx="16" cy="11.5" r=".6" fill="currentColor" />,
      <circle cx="18" cy="13.5" r=".6" fill="currentColor" />,
    ]),
  trophy: (p: P = {}) => S(p, [<path d="M8 4h8v5a4 4 0 01-8 0z" />, <path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8M9.5 17h5" />]),
  gear: (p: P = {}) =>
    S(p, [
      <circle cx="12" cy="12" r="3" />,
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" />,
    ]),
  user: (p: P = {}) => S(p, [<circle cx="12" cy="8" r="4" />, <path d="M4 21a8 8 0 0116 0" />]),
  users: (p: P = {}) => S(p, [<circle cx="9" cy="8" r="3.5" />, <path d="M2.5 20a6.5 6.5 0 0113 0" />, <path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" />]),
  bag: (p: P = {}) => S(p, [<path d="M5 8h14l-1 13H6z" />, <path d="M9 8V6a3 3 0 016 0v2" />]),
  shirt: (p: P = {}) => S(p, <path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 01-8 0z" />),
  flag: (p: P = {}) => S(p, [<path d="M5 21V4" />, <path d="M5 4h12l-2.5 4L17 12H5" />]),
  star: (p: P = {}) => S(p, <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />, false),
  starFill: (p: P = {}) => S(p, <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" />),
  lock: (p: P = {}) => S(p, [<rect x="5" y="10" width="14" height="11" rx="2.5" />, <path d="M8 10V7a4 4 0 018 0v3" />]),
  back: (p: P = {}) => S(p, <path d="M15 5l-7 7 7 7" />),
  next: (p: P = {}) => S(p, <path d="M9 5l7 7-7 7" />),
  close: (p: P = {}) => S(p, <path d="M6 6l12 12M18 6L6 18" />),
  check: (p: P = {}) => S(p, <path d="M4.5 12.5l5 5L20 7" />),
  flame: (p: P = {}) => S(p, <path d="M12 21c-4 0-7-2.8-7-6.5 0-3.5 2.5-5 3.5-8 1.5 1.5 2 3 2 4.5C12 9 13 6 12.5 3c4 2.5 6.5 6.5 6.5 11 0 4-3 7-7 7z" />),
  crown: (p: P = {}) => S(p, [<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />]),
  clock: (p: P = {}) => S(p, [<circle cx="12" cy="12" r="9" />, <path d="M12 7v5l3 2" />]),
  coin: (p: P = {}) => S(p, [<circle cx="12" cy="12" r="9" />, <path d="M12 7.5l1.3 3.2 3.2 1.3-3.2 1.3L12 16.5l-1.3-3.2-3.2-1.3 3.2-1.3z" fill="currentColor" />]),
  sound: (p: P = {}) => S(p, [<path d="M4 9h4l5-4v14l-5-4H4z" />, <path d="M16.5 9a4 4 0 010 6M19 6.5a7.5 7.5 0 010 11" />]),
  mute: (p: P = {}) => S(p, [<path d="M4 9h4l5-4v14l-5-4H4z" />, <path d="M17 9l5 6M22 9l-5 6" />]),
  keyboard: (p: P = {}) => S(p, [<rect x="2.5" y="6" width="19" height="12" rx="2.5" />, <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" />]),
  touch: (p: P = {}) => S(p, [<path d="M9 11V5a2 2 0 014 0v6" />, <path d="M13 9a2 2 0 014 0v3M17 11a2 2 0 014 0v3.5A6.5 6.5 0 0114.5 21H13a6 6 0 01-4.6-2.2L4.5 14a2 2 0 013-2.6L9 13" />]),
  eye: (p: P = {}) => S(p, [<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />, <circle cx="12" cy="12" r="3" />]),
  shield: (p: P = {}) => S(p, <path d="M12 3l8 3v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z" />),
  info: (p: P = {}) => S(p, [<circle cx="12" cy="12" r="9" />, <path d="M12 11v6M12 7.5h.01" />]),
  copy: (p: P = {}) => S(p, [<rect x="8" y="8" width="12" height="12" rx="2.5" />, <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />]),
  share: (p: P = {}) => S(p, [<circle cx="6" cy="12" r="2.5" />, <circle cx="18" cy="6" r="2.5" />, <circle cx="18" cy="18" r="2.5" />, <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />]),
  refresh: (p: P = {}) => S(p, [<path d="M20 11a8 8 0 10-2.3 5.7" />, <path d="M20 4v7h-7" />]),
  chart: (p: P = {}) => S(p, [<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />]),
  medal: (p: P = {}) => S(p, [<circle cx="12" cy="15" r="6" />, <path d="M8 3l3 6M16 3l-3 6M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" />]),
  calendar: (p: P = {}) => S(p, [<rect x="3" y="5" width="18" height="16" rx="2.5" />, <path d="M3 10h18M8 3v4M16 3v4" />]),
  skull: (p: P = {}) => S(p, [<path d="M12 3a8 8 0 00-5 14.2V20h10v-2.8A8 8 0 0012 3z" />, <circle cx="9" cy="11" r="1.6" fill="currentColor" />, <circle cx="15" cy="11" r="1.6" fill="currentColor" />]),
  heart: (p: P = {}) => S(p, <path d="M12 20s-8-4.8-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6.2-8 11-8 11z" fill="currentColor" />),
  door: (p: P = {}) => S(p, [<path d="M14 3H6v18h8" />, <path d="M18 8l4 4-4 4M22 12H11" />]),
  plus: (p: P = {}) => S(p, <path d="M12 5v14M5 12h14" />),
  minus: (p: P = {}) => S(p, <path d="M5 12h14" />),
  pause: (p: P = {}) => S(p, <path d="M8 5v14M16 5v14" />),
  home: (p: P = {}) => S(p, [<path d="M3 11l9-7 9 7" />, <path d="M5.5 9.5V20h13V9.5" />]),
  target: (p: P = {}) => S(p, [<circle cx="12" cy="12" r="9" />, <circle cx="12" cy="12" r="5" />, <circle cx="12" cy="12" r="1" fill="currentColor" />]),
  bolt: (p: P = {}) => S(p, <path d="M13 2L4 14h7l-1 8 9-12h-7z" />),
  swords: (p: P = {}) => S(p, [<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4" />, <path d="M7 17l-3 3M17 17l3 3M9 14l-2 2 1 1M15 14l2 2-1 1" />]),
  link: (p: P = {}) => S(p, [<path d="M10 14a4 4 0 005.7 0l3-3A4 4 0 0013 5.3l-1 1" />, <path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" />]),
  send: (p: P = {}) => S(p, <path d="M3 11l18-8-8 18-2-8z" />),
  wifi: (p: P = {}) => S(p, [<path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0" />, <circle cx="12" cy="19.5" r="1" fill="currentColor" />]),
  wifiOff: (p: P = {}) => S(p, [<path d="M3 3l18 18M8.5 16a5 5 0 017 0M5 12.5a10 10 0 015-2.6M2 9a15 15 0 014.3-2.8M13.5 9.2a10 10 0 015.5 3.3M17 6.3A15 15 0 0122 9" />]),
  bell: (p: P = {}) => S(p, [<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" />, <path d="M10 21h4" />]),
  sparkle: (p: P = {}) => S(p, [<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />]),
  gift: (p: P = {}) => S(p, [<rect x="3.5" y="9" width="17" height="12" rx="1.5" />, <path d="M2.5 9h19M12 9v12M12 9c-2-4-6-4-6-1.5S10 9 12 9zM12 9c2-4 6-4 6-1.5S14 9 12 9z" />]),
  robot: (p: P = {}) => S(p, [<rect x="5" y="8" width="14" height="11" rx="3" />, <path d="M12 4v4M9 13h.01M15 13h.01M9 16.5h6" />, <circle cx="12" cy="3.5" r="1" fill="currentColor" />]),
  question: (p: P = {}) => S(p, [<circle cx="12" cy="12" r="9" />, <path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.3-1.5 2.5M12 17h.01" />]),
  list: (p: P = {}) => S(p, <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />),
  edit: (p: P = {}) => S(p, [<path d="M4 20h4L19 9l-4-4L4 16z" />, <path d="M13.5 6.5l4 4" />]),
};

export type IconName = keyof typeof Icon;
