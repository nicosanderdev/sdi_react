// src/services/messageService.ts
import { supabase } from '../config/supabase';
import { getCurrentUserId, mapDbToMessage, mapDbToMessageDetail, mapDbToTabCounts } from './SupabaseHelpers';

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
  recipientId?: string;
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

// --- Supabase RPC Function Names ---
const RPC_FUNCTIONS = {
  SEND_MESSAGE: 'send_message',
  GET_MESSAGES: 'get_messages',
  GET_MESSAGE_BY_ID: 'get_message_by_id',
  GET_MESSAGE_COUNTS: 'get_message_counts',
  GET_MESSAGES_BY_PROPERTY_ID: 'get_messages_by_property_id',
  GET_MESSAGES_BY_THREAD_ID: 'get_messages_by_thread_id',
};

// --- Service Functions ---

/**
 * Fetches a list of messages.
 */
const getMessages = async (
  params: GetMessagesParams
): Promise<{ data: Message[]; total: number; page: number; totalPages: number }> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('get_messages', {
      p_user_id: userId,
      p_page: params.page || 1,
      p_limit: params.limit || 15,
      p_filter: params.filter || 'inbox',
      p_query: params.query || null,
      p_property_id: params.propertyId || null,
      p_sort_by: params.sortBy || 'createdAt_desc'
    });

    if (error) throw error;

    // Parse the JSON response
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      data: (result.data || []).map((msg: any) => ({
        ...msg,
        id: String(msg.id),
        threadId: String(msg.threadId),
        senderId: String(msg.senderId),
        recipientId: msg.recipientId ? String(msg.recipientId) : undefined,
        propertyId: msg.propertyId ? String(msg.propertyId) : undefined,
        createdAt: msg.createdAt,
        isRead: Boolean(msg.isRead),
        isReplied: Boolean(msg.isReplied),
        isStarred: Boolean(msg.isStarred),
        isArchived: Boolean(msg.isArchived)
      })),
      total: result.total || 0,
      page: result.page || 1,
      totalPages: result.totalPages || 0
    };
  } catch (error: any) {
    console.error('Error fetching messages:', error.message);
    throw error;
  }
};

/**
 * Fetches the full detail of a single message.
 */
const getMessageById = async (id: string): Promise<MessageDetail> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('get_message_by_id', {
      p_message_id: id,
      p_user_id: userId
    });

    if (error) throw error;

    // Parse the JSON response
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      ...result,
      id: String(result.id),
      threadId: String(result.threadId),
      senderId: String(result.senderId),
      recipientId: result.recipientId ? String(result.recipientId) : undefined,
      propertyId: result.propertyId ? String(result.propertyId) : undefined,
      createdAt: result.createdAt,
      isRead: Boolean(result.isRead),
      isReplied: Boolean(result.isReplied),
      isStarred: Boolean(result.isStarred),
      isArchived: Boolean(result.isArchived),
      fullBody: result.fullBody
    };
  } catch (error: any) {
    console.error(`Error fetching message ${id}:`, error.message);
    throw error;
  }
};

/**
 * Sends a new message or a reply.
 */
const sendMessage = async (messageData: SendMessageData): Promise<Message> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('send_message', {
      p_user_id: userId,
      p_recipient_id: messageData.recipientId || null,
      p_property_id: messageData.propertyId || null,
      p_subject: messageData.subject,
      p_body: messageData.body,
      p_in_reply_to_message_id: messageData.inReplyToMessageId || null,
      p_thread_id: messageData.threadId || null
    });

    if (error) throw error;

    // Parse the JSON response
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      ...result,
      id: String(result.id),
      threadId: String(result.threadId),
      senderId: String(result.senderId),
      recipientId: result.recipientId ? String(result.recipientId) : undefined,
      propertyId: result.propertyId ? String(result.propertyId) : undefined,
      createdAt: result.createdAt,
      isRead: Boolean(result.isRead),
      isReplied: Boolean(result.isReplied),
      isStarred: Boolean(result.isStarred),
      isArchived: Boolean(result.isArchived)
    };
  } catch (error: any) {
    console.error('Error sending message:', error.message);
    throw error;
  }
};

/**
 * Marks a message as read.
 */
const markMessageAsRead = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsRead: true })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error marking message ${messageId} as read:`, error.message);
    throw error;
  }
};

/**
 * Marks a message as unread.
 */
const markMessageAsUnread = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsRead: false })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error marking message ${messageId} as unread:`, error.message);
    throw error;
  }
};

/**
 * Marks a message as replied. (Might be handled by backend automatically on sendMessage)
 */
const markMessageAsReplied = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ HasBeenRepliedToByRecipient: true })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error marking message ${messageId} as replied:`, error.message);
    throw error;
  }
};

/**
 * Stars a message.
 */
const starMessage = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsStarred: true })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error starring message ${messageId}:`, error.message);
    throw error;
  }
};

/**
 * Unstars a message.
 */
const unstarMessage = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsStarred: false })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error unstarring message ${messageId}:`, error.message);
    throw error;
  }
};

/**
 * Archives a message.
 */
const archiveMessage = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsArchived: true })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error archiving message ${messageId}:`, error.message);
    throw error;
  }
};

/**
 * Unarchives a message.
 */
const unarchiveMessage = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Update the message recipient status
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsArchived: false })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error unarchiving message ${messageId}:`, error.message);
    throw error;
  }
};

/**
 * Deletes a message. (Soft delete - marks as deleted for the user)
 */
const deleteMessage = async (messageId: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get member ID
    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (memberError) throw memberError;

    // Soft delete - mark as deleted for this user
    const { error } = await supabase
      .from('MessageRecipients')
      .update({ IsDeleted: true })
      .eq('MessageId', messageId)
      .eq('RecipientId', member.Id);

    if (error) throw error;
  } catch (error: any) {
    console.error(`Error deleting message ${messageId}:`, error.message);
    throw error;
  }
};

/**
 * Fetches counts for different message categories/tabs.
 */
const getMessageCounts = async (): Promise<TabCounts> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('get_message_counts', {
      p_user_id: userId
    });

    if (error) throw error;

    // Parse the JSON response
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      inbox: result.inbox || 0,
      starred: result.starred || 0,
      replied: result.replied || 0,
      archived: result.archived || 0,
      sent: result.sent || 0,
      trash: result.trash || 0
    };
  } catch (error: any) {
    console.error('Error fetching message counts:', error.message);
    throw error;
  }
};

/**
 * Fetches messages for a specific property.
 */
const getMessagesByPropertyId = async (propertyId: string): Promise<Message[]> => {
  try {
    const { data, error } = await supabase.rpc('get_messages_by_property_id', {
      p_property_id: propertyId
    });

    if (error) throw error;

    // Parse the JSON response
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return (result || []).map((msg: any) => ({
      ...msg,
      id: String(msg.id),
      threadId: String(msg.threadId),
      senderId: String(msg.senderId),
      recipientId: msg.recipientId ? String(msg.recipientId) : undefined,
      propertyId: msg.propertyId ? String(msg.propertyId) : undefined,
      createdAt: msg.createdAt,
      isRead: Boolean(msg.isRead),
      isReplied: Boolean(msg.isReplied),
      isStarred: Boolean(msg.isStarred),
      isArchived: Boolean(msg.isArchived)
    }));
  } catch (error: any) {
    console.error(`Error fetching messages for property ${propertyId}:`, error.message);
    throw error;
  }
};

/**
 * Fetches all messages in a thread by threadId.
 */
const getMessagesByThreadId = async (threadId: string): Promise<MessageDetail[]> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('get_messages_by_thread_id', {
      p_thread_id: threadId,
      p_user_id: userId,
      p_page: 1,
      p_limit: 100,
      p_sort_by: 'createdAt_asc'
    });

    if (error) throw error;

    // Parse the JSON response
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return (result || []).map((msg: any) => ({
      ...msg,
      id: String(msg.id),
      threadId: String(msg.threadId),
      senderId: String(msg.senderId),
      recipientId: msg.recipientId ? String(msg.recipientId) : undefined,
      propertyId: msg.propertyId ? String(msg.propertyId) : undefined,
      createdAt: msg.createdAt,
      isRead: Boolean(msg.isRead),
      isReplied: Boolean(msg.isReplied),
      isStarred: Boolean(msg.isStarred),
      isArchived: Boolean(msg.isArchived),
      fullBody: msg.fullBody
    }));
  } catch (error: any) {
    console.error(`Error fetching messages for thread ${threadId}:`, error.message);
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
  getMessagesByPropertyId,
  getMessagesByThreadId,
};

export default messageService;