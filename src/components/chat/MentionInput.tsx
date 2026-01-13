import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AtSign } from 'lucide-react';

interface Member {
  user_id: string;
  nickname: string | null;
  full_name?: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  placeholder: string;
  members: Member[];
  disabled?: boolean;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder,
  members,
  disabled
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter members based on search
  const filteredMembers = members.filter(member => {
    const displayName = member.nickname || member.full_name || 'Motorista';
    return displayName.toLowerCase().includes(mentionSearch.toLowerCase());
  }).slice(0, 5);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);

    // Check for @ symbol to trigger mention
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex >= 0) {
      // Check if @ is at start or after a space
      const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
      if (lastAtIndex === 0 || charBeforeAt === ' ') {
        const searchText = textBeforeCursor.slice(lastAtIndex + 1);
        // Only show if no space after @
        if (!searchText.includes(' ')) {
          setMentionSearch(searchText);
          setMentionStart(lastAtIndex);
          setShowSuggestions(true);
          return;
        }
      }
    }
    
    setShowSuggestions(false);
    setMentionStart(null);
    setMentionSearch('');
  };

  const insertMention = useCallback((member: Member) => {
    if (mentionStart === null) return;
    
    const displayName = member.nickname || member.full_name || 'Motorista';
    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(mentionStart + mentionSearch.length + 1);
    
    const newValue = `${beforeMention}@${displayName} ${afterMention}`;
    onChange(newValue);
    
    setShowSuggestions(false);
    setMentionStart(null);
    setMentionSearch('');
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [mentionStart, mentionSearch, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }
  };

  const handleKeyPressWrapper = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) return;
    onKeyPress?.(e);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPressWrapper}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-12 px-4 bg-card border border-border rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
      
      {/* Mention suggestions dropdown */}
      {showSuggestions && filteredMembers.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
        >
          <div className="px-3 py-2 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AtSign className="w-3 h-3" />
              <span>Mencionar motorista</span>
            </div>
          </div>
          {filteredMembers.map((member, index) => {
            const displayName = member.nickname || member.full_name || 'Motorista';
            return (
              <button
                key={member.user_id}
                onClick={() => insertMention(member)}
                className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                  index === selectedIndex 
                    ? 'bg-primary/10 text-foreground' 
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">
                    {displayName}
                  </span>
                  {member.nickname && member.full_name && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {member.full_name}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
