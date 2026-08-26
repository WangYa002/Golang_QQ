import { hoverHandlers } from '../styles/common';

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_GROUPS = [
  { label: '表情', emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '😏', '😒', '😤', '😢', '😭', '🥺', '😱', '🤗', '🤩', '😴', '🤮', '👍', '👎', '👏', '🙏', '💪', '❤️', '🔥', '⭐'] },
  { label: '手势', emojis: ['👋', '🤝', '✌️', '🤞', '👌', '✋', '🖐️', '👆', '👇', '👈', '👉', '🫶'] },
  { label: '物品', emojis: ['🎉', '🎊', '🎁', '🎂', '☕', '🍻', '🎵', '📱', '💻', '📚', '✈️', '🏠'] },
];

export default function EmojiPicker({ onSelect, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full right-0 mb-2 p-3 rounded-lg z-50 w-[320px]"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-0.5"
              style={{ color: 'var(--text-muted)' }}>
              {group.label}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onSelect(emoji); onClose(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-lg"
                  {...hoverHandlers()}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
