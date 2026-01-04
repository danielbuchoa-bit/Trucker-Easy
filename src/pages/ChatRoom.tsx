import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, MoreVertical, Users, Flag } from 'lucide-react';

const ChatRoomScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock community data
  const community = {
    id,
    name: 'Truckers USA',
    members: 12453,
    icon: '🇺🇸',
  };

  // Mock messages
  const [messages] = useState([
    {
      id: '1',
      user: 'BigRigBob',
      text: 'Anyone knows if the I-40 weigh station is open?',
      time: '10:30 AM',
      isMe: false,
    },
    {
      id: '2',
      user: 'You',
      text: 'Just passed it, it was closed!',
      time: '10:32 AM',
      isMe: true,
    },
    {
      id: '3',
      user: 'HighwayQueen',
      text: 'Thanks for the heads up! 🙏',
      time: '10:33 AM',
      isMe: false,
    },
    {
      id: '4',
      user: 'OTRVeteran',
      text: 'Traffic is getting heavy on I-35 near Dallas. Heads up!',
      time: '10:45 AM',
      isMe: false,
    },
    {
      id: '5',
      user: 'LoneStarDriver',
      text: 'Yeah I noticed that too. Taking the back roads instead.',
      time: '10:47 AM',
      isMe: false,
    },
    {
      id: '6',
      user: 'You',
      text: 'Good call. Stay safe out there everyone!',
      time: '10:50 AM',
      isMe: true,
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      // Add message logic here
      setMessage('');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl">
                {community.icon}
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{community.name}</h1>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{community.members.toLocaleString()} members</span>
                </div>
              </div>
            </div>
          </div>
          <button className="w-10 h-10 flex items-center justify-center text-muted-foreground">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] ${
                msg.isMe
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                  : 'bg-card border border-border rounded-2xl rounded-bl-md'
              } p-3`}
            >
              {!msg.isMe && (
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-primary">{msg.user}</span>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Flag className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className={`text-sm ${msg.isMe ? 'text-primary-foreground' : 'text-foreground'}`}>
                {msg.text}
              </p>
              <p className={`text-xs mt-1 ${msg.isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-bottom">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.community.typeMessage}
            className="flex-1 h-12 px-4 bg-card border border-border rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoomScreen;
