import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { QuestionThread as ThreadType, mockQuestionThreads } from '../../data/MessagesData';
import QuestionThread from './QuestionThread';
import { Button, Card, Label, Textarea, TextInput } from 'flowbite-react';

function PropertyContact() {
  const [threads, setThreads] = useState<ThreadType[]>(mockQuestionThreads);
  // State to track which thread's reply form is open
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  // State for the "Ask a New Question" form
  const [newQuestionEmail, setNewQuestionEmail] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');

  const handleNewQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting new question:', { email: newQuestionEmail, text: newQuestionText });
    // TODO: API call to create a new question thread
    // On success, you would refetch the threads or add the new one to the top of the list.
    setNewQuestionEmail('');
    setNewQuestionText('');
  };

  const handleReplySubmit = (threadId: string, replyText: string) => {
    console.log(`Submitting reply to thread ${threadId}:`, replyText);
    // TODO: API call to add a reply to a thread
    // On success, refetch or update the specific thread in the state.
    setReplyingToId(null); // Close the reply form
  };

  const handleReplyClick = (threadId: string) => {
    // If clicking the same reply button, close it. Otherwise, open the new one.
    setReplyingToId(prevId => (prevId === threadId ? null : threadId));
  };

  return (
    <Card className='p-3'>
      <h2 className="text-2xl font-bold text-gray-800">Questions & Answers</h2>

      {/* Form for asking a brand new question */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="mt-8 max-h-[600px] overflow-y-scroll">
            {threads.map(thread => (
              <QuestionThread
              key={thread.id}
              thread={thread}
              isReplying={replyingToId === thread.id}
              onReplyClick={() => handleReplyClick(thread.id)}
              onReplySubmit={handleReplySubmit}
              />
            ))}
          </div>

        {/* List of existing Q&A threads */}
          <form onSubmit={handleNewQuestionSubmit} className="mt-6 p-4">
            <h3 className="font-semibold text-gray-900 text-center">¿Tenés una pregunta para el propietario?</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 max-w-lg mx-auto">
              <div>
                <Label htmlFor="email">Tu correo</Label>
                <TextInput
                  type="email"
                  id="email"
                  value={newQuestionEmail}
                  onChange={(e) => setNewQuestionEmail(e.target.value)}
                  placeholder="correo@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="question">Tu pregunta</Label>
                <Textarea
                  id="question"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  rows={2}
                  placeholder="e.g., Is there air conditioning in every room?"
                  required
                />
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <Button type="submit" color="green">
                <Send className='mr-2' size={18} />
                <span>Ask Question</span>
              </Button>
            </div>
          </form>
        </div>

    </Card>
  );
}

export default PropertyContact;