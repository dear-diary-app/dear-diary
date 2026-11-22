import React from 'react';

interface IconProps { size?: number; sw?: number; }

function make(paths: string[], filled = false) {
    return function Icon({ size = 20, sw = 1.8 }: IconProps) {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
                stroke={filled ? 'none' : 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true" focusable="false">
                {paths.map((d, i) => <path key={i} d={d} />)}
            </svg>
        );
    };
}

export const ArrowLeft = make(['M19 12H5', 'M12 19l-7-7 7-7']);
export const ChevronLeft = make(['M15 18l-6-6 6-6']);
export const ChevronRight = make(['M9 18l6-6-6-6']);
export const KeyRound = make(['M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4Z', 'M16.5 7.5h.01']);
export const Lock = make(['M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z', 'M8 11V7a4 4 0 0 1 8 0v4']);
export const CalendarDays = make(['M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M16 2v4', 'M8 2v4', 'M3 10h18', 'M8 15h.01', 'M12 15h.01', 'M16 15h.01']);
export const Gear = make(['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z']);
export const MessageCircle = make(['M7.9 20A9 9 0 1 0 4 16.1L2 22Z']);
export const Bell = make(['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0']);
export const PenLine = make(['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z']);
export const BookOpen = make(['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z']);
export const Search = make(['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3']);
export const XIcon = make(['M18 6 6 18', 'M6 6l12 12']);
export const Check = make(['M20 6 9 17l-5-5']);
export const ImagePlus = make(['M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7', 'M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21', 'M16 5h6', 'M19 2v6']);
export const Trash = make(['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6']);
export const Clock = make(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2']);
export const Heart = make(['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'], true);
export const Moon = make(['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z']);
export const Sun = make(['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M6.34 17.66l-1.41 1.41', 'M19.07 4.93l-1.41 1.41']);
export const Sparkles = make(['M12 3l1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8-5.8-1.9 5.8-1.9Z', 'M19 3v4', 'M21 5h-4']);
export const Erase = make(['M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z', 'M18 9l-6 6', 'M12 9l6 6']);
export const Eye = make(['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0']);
export const EyeOff = make(['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M3 3l18 18']);
export const Users = make(['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']);
export const HomeIcon = make(['M3 10l9-7 9 7', 'M5 9v12h14V9', 'M9 21v-8h6v8']);
