// src/services/messageService.ts
import apiClient from './AxiosClient'; // Assuming AxiosClient is correctly set up

// --- Type Definitions ---
export interface Message {
  id: string;
  threadId?: string;
  senderId?: string;
  senderName: string;
  senderEmail?: string;
  
  recipientId?: string;

  propertyId?: string;
  propertyTitle?: string;
  
  subject: string;
  snippet: string;

  createdAt: string;

  isRead: boolean;
  isReplied: boolean;
  isStarred: boolean;
  isArchived: boolean;
  // isTrash?: boolean;
}

export interface MessageDetail extends Message {
  fullBody: string;
}

export interface GetMessagesParams {
  page?: number;
  limit?: number;
  filter?: 'inbox' | 'starred' | 'replied' | 'archived' | 'sent' | 'trash' | string;
  query?: string;
  propertyId?: string;
  sortBy?: string;
}

export interface SendMessageData {
  recipientId: string;
  propertyId?: string;
  subject: string;
  body: string;
  inReplyToMessageId?: string;
  threadId?: string;
}

export interface TabCounts {
  inbox?: number;
  starred?: number;
  replied?: number;
  archived?: number;
  sent?: number;
  trash?: number;
  [key: string]: number | undefined;
}

// --- API Endpoints ---
const ENDPOINTS = {
  MESSAGES: '/messages',
  MESSAGE_DETAIL: (id: string) => `/messages/${id}`,
  MARK_AS_READ: (id: string) => `/messages/${id}/read`,
  MARK_AS_UNREAD: (id: string) => `/messages/${id}/unread`,
  MARK_AS_REPLIED: (id: string) => `/messages/${id}/replied`,
  STAR: (id: string) => `/messages/${id}/star`,
  UNSTAR: (id: string) => `/messages/${id}/unstar`,
  ARCHIVE: (id: string) => `/messages/${id}/archive`,
  UNARCHIVE: (id: string) => `/messages/${id}/unarchive`,
  DELETE: (id: string) => `/messages/${id}`,
  MESSAGE_COUNTS: '/messages/counts',
};

// --- Service Functions ---

/**
 * Fetches a list of messages.
 * Assumes API returns: { data: Message[], total: number, page: number, limit: number, totalPages: number }
 */
const getMessages = async (
  params: GetMessagesParams
): Promise<{ data: Message[]; total: number; page: number; totalPages: number }> => {
  try {
    const response = await apiClient.get<{ data: Message[]; total: number; page: number; limit: number; totalPages?: number }>(
      ENDPOINTS.MESSAGES, { params }
    );
    return {
        data: response.data.map(m => ({...m, id: String(m.id)})), // Ensure IDs are strings
        total: response.total,
        page: response.page,
        totalPages: response.totalPages || (response.limit ? Math.ceil(response.total / response.limit) : 1),
    };
  } catch (error: any) {
    console.error('Error fetching messages:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Fetches the full detail of a single message.
 */
const getMessageById = async (id: string): Promise<MessageDetail> => {
  try {
    var response = await apiClient.get<MessageDetail>(ENDPOINTS.MESSAGE_DETAIL(id));
    return response;
  } catch (error: any) {
    console.error(`Error fetching message ${id}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Sends a new message or a reply.
 */
const sendMessage = async (messageData: SendMessageData): Promise<Message> => { // Returns the sent message
  try {
    const response = await apiClient.post<Message>(ENDPOINTS.MESSAGES, messageData);
    return {...response, id: String(response.id)};
  } catch (error: any) {
    console.error('Error sending message:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Marks a message as read.
 */
const markMessageAsRead = async (messageId: string): Promise<void> => {
  try {
    await apiClient.get(ENDPOINTS.MARK_AS_READ(messageId));
  } catch (error: any) {
    console.error(`Error marking message ${messageId} as read:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Marks a message as unread.
 */
const markMessageAsUnread = async (messageId: string): Promise<void> => {
  try {
    await apiClient.patch(ENDPOINTS.MARK_AS_UNREAD(messageId));
  } catch (error: any) {
    console.error(`Error marking message ${messageId} as unread:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Marks a message as replied. (Might be handled by backend automatically on sendMessage)
 */
const markMessageAsReplied = async (messageId: string): Promise<void> => {
    try {
      await apiClient.patch(ENDPOINTS.MARK_AS_REPLIED(messageId));
    } catch (error: any) {
      console.error(`Error marking message ${messageId} as replied:`, error.response?.data?.message || error.message);
      throw error;
    }
  };

/**
 * Stars a message.
 */
const starMessage = async (messageId: string): Promise<void> => {
  try {
    await apiClient.patch(ENDPOINTS.STAR(messageId));
  } catch (error: any) {
    console.error(`Error starring message ${messageId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Unstars a message.
 */
const unstarMessage = async (messageId: string): Promise<void> => {
  try {
    await apiClient.delete(ENDPOINTS.UNSTAR(messageId));
  } catch (error: any) {
    console.error(`Error unstarring message ${messageId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Archives a message.
 */
const archiveMessage = async (messageId: string): Promise<void> => {
  try {
    await apiClient.post(ENDPOINTS.ARCHIVE(messageId));
  } catch (error: any) {
    console.error(`Error archiving message ${messageId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Unarchives a message.
 */
const unarchiveMessage = async (messageId: string): Promise<void> => {
  try {
    await apiClient.patch(ENDPOINTS.UNARCHIVE(messageId)); // Or DELETE
  } catch (error: any) {
    console.error(`Error unarchiving message ${messageId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Deletes a message. (Soft or Hard delete based on backend)
 */
const deleteMessage = async (messageId: string): Promise<void> => {
  try {
    await apiClient.delete(ENDPOINTS.DELETE(messageId));
  } catch (error: any) {
    console.error(`Error deleting message ${messageId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Fetches counts for different message categories/tabs.
 */
const getMessageCounts = async (): Promise<TabCounts> => {
    try {
      return await apiClient.get<TabCounts>(ENDPOINTS.MESSAGE_COUNTS);
    } catch (error: any) {
      console.error('Error fetching message counts:', error.response?.data?.message || error.message);
      throw error;
    }
  };


const messageService = {
  getMessages,
  getMessageById,
  sendMessage,
  markMessageAsRead,
  markMessageAsUnread,
  markMessageAsReplied,
  starMessage,
  unstarMessage,
  archiveMessage,
  unarchiveMessage,
  deleteMessage,
  getMessageCounts,
};

export default messageService;