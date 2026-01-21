export const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_COLORS = [
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-rose-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
];

export const getAvatarColor = (id: string) => {
    if (!id) return 'bg-gray-400';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};

export const stripHtml = (html: string) => {
    if (!html) return '';
    let text = html.replace(/<[^>]*>?/gm, ' '); // Strip tags
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&amp;/g, '&');
    return text.replace(/\s+/g, ' ').trim(); // Collapse whitespace
};

export const getNoteExcerpt = (content: string, maxLength = 150) => {
    if (!content) return '';

    // Handle Call Minute JSON
    if (content.startsWith('{') && content.includes('"template"')) {
        try {
            const data = JSON.parse(content);
            if (data.template === 'call-minute' && data.segments) {
                const topics = data.segments.map((s: any) => s.topic).filter(Boolean).join(', ');
                return `[Call Minute] ${topics}`;
            }
        } catch (e) { }
    }

    const clean = stripHtml(content);
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength - 3) + '...';
};
