import { useEffect, useState } from "react";

interface EmojiReactionProps {
  emoji: string;
  onComplete: () => void;
}

export function EmojiReaction({ emoji, onComplete }: EmojiReactionProps) {
  const [position, setPosition] = useState({
    left: Math.random() * 80 + 10,
    bottom: 10,
  });

  useEffect(() => {
    const duration = 3000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        onComplete();
        return;
      }

      setPosition(prev => ({
        left: prev.left + (Math.random() - 0.5) * 2,
        bottom: 10 + progress * 80,
      }));

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [onComplete]);

  return (
    <div
      className="fixed text-6xl pointer-events-none transition-opacity duration-500"
      style={{
        left: `${position.left}%`,
        bottom: `${position.bottom}%`,
        opacity: 1 - (position.bottom - 10) / 80,
      }}
      data-testid="floating-emoji"
    >
      {emoji}
    </div>
  );
}

interface EmojiReactionsContainerProps {
  reactions: Array<{ id: string; emoji: string }>;
  onReactionComplete: (id: string) => void;
}

export function EmojiReactionsContainer({ reactions, onReactionComplete }: EmojiReactionsContainerProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {reactions.map(reaction => (
        <EmojiReaction
          key={reaction.id}
          emoji={reaction.emoji}
          onComplete={() => onReactionComplete(reaction.id)}
        />
      ))}
    </div>
  );
}
