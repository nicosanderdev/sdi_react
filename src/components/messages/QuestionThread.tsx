import React, { useState } from 'react';
import { MessageSquare, CornerDownRight } from 'lucide-react';
import UserAvatar from './UserAvatar'; // Re-using the avatar from the previous design
import { Badge, Button, Textarea } from 'flowbite-react';
import { MessageSample, ThreadType } from '../../data/MessagesData';

// Helper component for displaying a single message (question or answer)
const MessageDisplay = ({ message }: { message: MessageSample }) => {
  const isOwner = message.sender === 'owner';
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex items-start space-x-4">
      <UserAvatar name={message.senderName} avatarUrl={message.avatarUrl} />
      <div className="flex-grow">
        <div className="flex items-center space-x-2">
          <p className="font-semibold">{message.senderName}</p>
          {isOwner && (
            <Badge 
              color='indigo'>
              Property Owner
            </Badge>
          )}
        </div>
        <p className="text-sm">
          {isOwner ? 'Answered' : 'Asked'} on {formatDate(message.timestamp)}
        </p>
        <p className="mt-2">{message.text}</p>
      </div>
    </div>
  );
};

interface Props {
  thread: ThreadType;
  // This prop will be controlled by a parent to decide if this thread's reply box is open
  isReplying: boolean; 
  onReplyClick: () => void;
  // We'll simulate submitting a reply
  onReplySubmit: (threadId: string, replyText: string) => void;
}

function QuestionThread({ thread, isReplying, onReplyClick, onReplySubmit }: Props) {
  const [replyText, setReplyText] = useState('');
  const question = thread.messages[0];
  const answer = thread.messages.find((msg : any) => msg.sender === 'owner');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyText.trim()) {
      onReplySubmit(thread.id, replyText);
      setReplyText('');
    }
  };

  return (
    <div className="border-b border-gray-200 p-6">
      {/* The original question */}
      <MessageDisplay message={question} />

      {/* The owner's answer */}
      {answer && (
        <div className="mt-4 pl-8 md:pl-16 relative">
          <CornerDownRight className="absolute left-2 md:left-6 top-3 h-5 w-5 text-gray-400" />
          <div className="bg-gray-50 p-4 rounded-lg">
            <MessageDisplay message={answer} />
          </div>
        </div>
      )}

      {/* Reply button or Reply Form */}
      {!answer && (
        <div className="mt-4 pl-8 md:pl-16">
          {!isReplying ? (
            <button
              onClick={onReplyClick}
              className="flex items-center space-x-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <MessageSquare size={16} />
              <span>Reply to this question</span>
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mt-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                required
              />
              <div className="flex justify-end space-x-2 mt-2">
                 <Button 
                  color="alternative"
                  onClick={onReplyClick}>
                   Cancel
                 </Button>
                 <Button 
                  type="submit"
                  color="green">
                   Submit Reply
                 </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default QuestionThread;