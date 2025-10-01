export interface MessageSample {
  id: string;
  sender: 'visitor' | 'owner'; 
  senderName: string; // We'll display this name
  avatarUrl?: string;
  text: string;
  timestamp: string;
}

export interface ThreadType {
  id: string;
  messages: MessageSample[];
}

export const mockQuestionThreads: ThreadType[] = [
  {
    id: 'q-1',
    messages: [
      {
        id: 'msg-q1-1',
        sender: 'visitor',
        senderName: 'Anna K.',
        text: 'Is there a dedicated laundry room with a washer and dryer included in the unit?',
        timestamp: '2023-10-25T11:30:00Z',
      },
      {
        id: 'msg-q1-2',
        sender: 'owner',
        senderName: 'John Realtor',
        avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
        text: 'Great question, Anna! Yes, there is a separate laundry room adjacent to the kitchen, and it comes equipped with a modern, high-efficiency washer and dryer.',
        timestamp: '2023-10-25T14:00:00Z',
      },
    ],
  },
  {
    id: 'q-2',
    messages: [
      {
        id: 'msg-q2-1',
        sender: 'visitor',
        senderName: 'Mark T.',
        text: 'What is the parking situation like? The listing mentions a garage, but are there guest spots available as well?',
        timestamp: '2023-10-24T09:00:00Z',
      },
      // This question has not been answered yet.
    ],
  },
  {
    id: 'q-3',
    messages: [
      {
        id: 'msg-q3-1',
        sender: 'visitor',
        senderName: 'Emily R.',
        text: 'Could you please clarify the monthly cost for common expenses? Thank you.',
        timestamp: '2023-10-22T18:45:00Z',
      },
      {
        id: 'msg-q3-2',
        sender: 'owner',
        senderName: 'John Realtor',
        avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
        text: 'Hi Emily, the common expenses are approximately $250 per month. This covers landscaping, pool maintenance, and security.',
        timestamp: '2023-10-23T10:15:00Z',
      },
    ]
  }
];