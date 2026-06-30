import React from 'react';
import { TAIWAN_PATHS } from '../constants/taiwanPaths';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
}

// ☰ Menu Icon
export const MenuIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

// ✕ Close Icon
export const CloseIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ☀️ Sun Icon
export const SunIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
  </svg>
);

// 🌙 Moon Icon
export const MoonIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
  </svg>
);

// ✓ Check Icon
export const CheckIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ✍️ Edit / Pencil Icon
export const EditIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// ✨ Sparkles Icon
export const SparklesIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3v1" />
    <path d="M12 20v1" />
    <path d="M19 12h-1" />
    <path d="M4 12H3" />
    <path d="M18.364 5.636l-.707.707" />
    <path d="M6.343 17.657l-.707.707" />
    <path d="M5.636 5.636l.707.707" />
    <path d="M17.657 17.657l.707.707" />
  </svg>
);

// ⚾ Baseball Icon
export const BaseballIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M6 12a6 6 0 0 1 12 0" />
    <path d="M6 12a6 6 0 0 0 12 0" />
  </svg>
);

// ⚠️ Warning Icon
export const WarningIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// 🔓 Lock Open Icon
export const LockOpenIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

// 🫵 / ⬅️ Back Arrow Icon
export const ArrowLeftIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// ➔ Arrow Right Icon
export const ArrowRightIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ❤️ Heart Filled Icon
export const HeartFilledIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// 🤍 Heart Outline Icon
export const HeartOutlineIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// 🟢 Green Dot Icon
export const GreenDotIcon: React.FC<IconProps> = ({ size = '0.7em', ...props }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }} {...props}>
    <circle cx="8" cy="8" r="6" />
  </svg>
);

// ⚪ Gray Dot Icon
export const GrayDotIcon: React.FC<IconProps> = ({ size = '0.7em', ...props }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }} {...props}>
    <circle cx="8" cy="8" r="6" />
  </svg>
);

// ⛅ CloudSun Icon (Weather)
export const CloudSunIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.9 11.5A5.5 5.5 0 0 0 9.5 5.6H9a5 5 0 0 0 0 10h8.5a3.5 3.5 0 0 0 .4-6.9z" />
  </svg>
);

// ☁️ Cloud Icon (Weather)
export const CloudIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58" />
  </svg>
);

// ❄️ Snowflake Icon (Weather)
export const SnowflakeIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
  </svg>
);

// ⛈️ Cloud Lightning Icon (Weather)
export const CloudLightningIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58" />
    <polyline points="13 11 9 17 12 17 9 23" />
  </svg>
);

// ☔ Umbrella / Rain Icon (Weather)
export const UmbrellaIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 12a11.02 11.02 0 0 0-22 0zm-11 0v9a2 2 0 0 0 4 0" />
  </svg>
);

// 📋 Clipboard Icon
export const ClipboardIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

// 🗺️ Map Icon
export const MapIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);

// 📅 Calendar Icon
export const CalendarIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// 💬 Message Icon
export const MessageIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// 👤 User Icon
export const UserIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// 🎵 Music Icon
export const MusicIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

// 🔍 Search Icon
export const SearchIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// 📷 Camera Icon
export const CameraIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// 📍 Pin Icon
export const PinIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// ▶ Play Icon
export const PlayIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// 🎫 Ticket Icon
export const TicketIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2zm7 0v6m6-6v6" />
  </svg>
);

// ⭐ Star Icon
export const StarIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// 🗑️ Trash Icon
export const TrashIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// 💵 Dollar Icon
export const DollarIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

// 🔑 Key Icon
export const KeyIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

// 👋 Logout / Log Out Icon
export const LogoutIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

// 📧 Mail / Envelope Icon
export const MailIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

// 🎤 Microphone / Mic Icon
export const MicIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
  </svg>
);

// 🔥 Flame / Fire Icon
export const FlameIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

// 🏰 Building / Venue Icon
export const BuildingIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="9" y1="22" x2="9" y2="16" />
    <line x1="15" y1="22" x2="15" y2="16" />
    <line x1="9" y1="16" x2="15" y2="16" />
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M12 6h.01M12 10h.01" />
  </svg>
);

// 🐾 Activity / Footprint Icon
export const ActivityIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

// 📢 Megaphone Icon
export const MegaphoneIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

// 🔗 Link Icon
export const LinkIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// 💾 Save / Download Icon
export const DownloadIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

// 🚇 / 🚄 Train / Metro / Rail Icon
export const TrainIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="3" width="16" height="16" rx="2" />
    <path d="M4 11h16M12 3v8M8 19l-3 3M16 19l3 3M18 15h.01M6 15h.01" />
  </svg>
);

// 🚌 Bus / Transit Icon
export const BusIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="3" width="16" height="16" rx="2" />
    <path d="M4 11h16M8 3v8M16 3v8M6 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM14 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0z" />
  </svg>
);

// 🔄 Refresh / Rotate Icon
export const RefreshIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

// 🧭 Compass / Navigation Icon
export const CompassIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

// 🌡️ Thermometer Icon
export const ThermometerIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

// ＋ Plus / Add Icon
export const PlusIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// 🇹🇼 Taiwan Shape Icon (Merged paths of Taiwan map)
export const TaiwanIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg 
    viewBox="180 150 550 700" 
    width={size} 
    height={size} 
    fill="currentColor" 
    stroke="currentColor"
    strokeWidth="10"
    strokeLinejoin="round"
    strokeLinecap="round"
    {...props}
  >
    {Object.entries(TAIWAN_PATHS)
      .sort(([a], [b]) => (a === 'Taipei' ? 1 : b === 'Taipei' ? -1 : 0))
      .map(([countyName, pathD]) => (
      <path key={countyName} d={pathD} />
    ))}
  </svg>
);

// ﹀ Chevron Down Icon
export const ChevronDownIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// 〉 Chevron Right Icon
export const ChevronRightIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// 〈 Chevron Left Icon
export const ChevronLeftIcon: React.FC<IconProps> = ({ size = '1em', ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

