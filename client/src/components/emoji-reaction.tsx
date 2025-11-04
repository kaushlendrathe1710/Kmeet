interface EmojiReactionProps {
  emoji: string;
  onComplete: () => void;
  startPosition: number;
}

export function EmojiReaction({ emoji, onComplete, startPosition }: EmojiReactionProps) {
  return (
    <div
      className="fixed text-6xl pointer-events-none animate-float-up"
      style={{
        left: `${startPosition}%`,
        bottom: '10%',
        animation: 'floatUp 3s ease-out forwards',
      }}
      onAnimationEnd={onComplete}
      data-testid="floating-emoji"
    >
      {emoji}
      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-70vh) translateX(${(Math.random() - 0.5) * 100}px);
          }
        }
        .animate-float-up {
          animation: floatUp 3s ease-out forwards;
        }
      `}</style>
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
      {reactions.map((reaction, index) => (
        <EmojiReaction
          key={reaction.id}
          emoji={reaction.emoji}
          startPosition={(index * 15 + Math.random() * 20 + 20) % 80}
          onComplete={() => onReactionComplete(reaction.id)}
        />
      ))}
    </div>
  );
}
