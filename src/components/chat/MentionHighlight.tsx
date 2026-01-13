import React from 'react';

interface MentionHighlightProps {
  content: string;
  currentUserName?: string;
  isOwnMessage?: boolean;
}

const MentionHighlight: React.FC<MentionHighlightProps> = ({
  content,
  currentUserName,
  isOwnMessage
}) => {
  // Regex to match @mentions (word after @)
  const mentionRegex = /@(\S+)/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }

    const mentionName = match[1];
    const isMentioningMe = currentUserName && 
      mentionName.toLowerCase() === currentUserName.toLowerCase();

    // Add the mention with highlight
    parts.push(
      <span
        key={`mention-${keyIndex++}`}
        className={`font-semibold ${
          isMentioningMe 
            ? isOwnMessage
              ? 'text-primary-foreground bg-white/20 px-1 rounded'
              : 'text-primary bg-primary/10 px-1 rounded' 
            : isOwnMessage
              ? 'text-primary-foreground/90'
              : 'text-primary'
        }`}
      >
        @{mentionName}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${keyIndex++}`}>
        {content.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts.length > 0 ? parts : content}</>;
};

export default MentionHighlight;

// Utility function to extract mentions from a message
export const extractMentions = (content: string): string[] => {
  const mentionRegex = /@(\S+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
};

// Utility function to check if a user is mentioned
export const isUserMentioned = (content: string, userName: string): boolean => {
  const mentions = extractMentions(content);
  return mentions.some(
    mention => mention.toLowerCase() === userName.toLowerCase()
  );
};
