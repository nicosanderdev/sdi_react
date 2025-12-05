-- Message Functions for Supabase PostgreSQL
-- These functions implement the messaging functionality previously handled by ASP.NET API

-- Helper function to generate snippet
CREATE OR REPLACE FUNCTION generate_message_snippet(text_body TEXT, max_length INTEGER DEFAULT 150)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF text_body IS NULL OR text_body = '' THEN
        RETURN '';
    END IF;

    IF LENGTH(text_body) <= max_length THEN
        RETURN text_body;
    ELSE
        RETURN SUBSTRING(text_body, 1, max_length) || '...';
    END IF;
END;
$$;

-- Send Message Function
-- Creates thread (if needed), message, and recipient entries in a transaction
CREATE OR REPLACE FUNCTION send_message(
    p_user_id UUID,
    p_subject TEXT,
    p_body TEXT,
    p_recipient_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_in_reply_to_message_id UUID DEFAULT NULL,
    p_thread_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_member_id UUID;
    v_recipient_id UUID := p_recipient_id;
    v_thread_id UUID := p_thread_id;
    v_message_id UUID;
    v_recipient_entry_id UUID;
    v_created_message JSONB;
BEGIN
    -- Get sender member ID
    SELECT "Id" INTO v_sender_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_sender_member_id IS NULL THEN
        RAISE EXCEPTION 'Sender member not found for user %', p_user_id;
    END IF;

    -- If recipient not provided, find it from property owner
    IF v_recipient_id IS NULL AND p_property_id IS NOT NULL THEN
        SELECT "OwnerId" INTO v_recipient_id
        FROM "EstateProperties"
        WHERE "Id" = p_property_id AND "IsDeleted" = false;

        IF v_recipient_id IS NULL THEN
            RAISE EXCEPTION 'Property owner not found for property %', p_property_id;
        END IF;
    END IF;

    IF v_recipient_id IS NULL THEN
        RAISE EXCEPTION 'Recipient ID must be provided or property ID must resolve to an owner';
    END IF;

    -- Validate property exists if provided
    IF p_property_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
            RAISE EXCEPTION 'Property not found: %', p_property_id;
        END IF;
    END IF;

    -- Determine thread
    IF v_thread_id IS NOT NULL THEN
        -- Use provided thread
        IF NOT EXISTS (SELECT 1 FROM "MessageThreads" WHERE "Id" = v_thread_id) THEN
            RAISE EXCEPTION 'Thread not found: %', v_thread_id;
        END IF;
    ELSIF p_in_reply_to_message_id IS NOT NULL THEN
        -- Reply to existing message
        SELECT "ThreadId" INTO v_thread_id
        FROM "Messages"
        WHERE "Id" = p_in_reply_to_message_id AND "IsDeleted" = false;

        IF v_thread_id IS NULL THEN
            RAISE EXCEPTION 'Message to reply to not found: %', p_in_reply_to_message_id;
        END IF;

        -- Mark the replied-to message as replied by recipient
        UPDATE "MessageRecipients"
        SET "HasBeenRepliedToByRecipient" = true
        WHERE "MessageId" = p_in_reply_to_message_id AND "RecipientId" = v_sender_member_id;

    ELSE
        -- Create new thread
        INSERT INTO "MessageThreads" ("Id", "Subject", "PropertyId", "CreatedAtUtc", "LastMessageAtUtc")
        VALUES (gen_random_uuid(), p_subject, p_property_id, NOW(), NOW())
        RETURNING "Id" INTO v_thread_id;
    END IF;

    -- Create message
    INSERT INTO "Messages" ("Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc", "InReplyToMessageId")
    VALUES (gen_random_uuid(), v_thread_id, v_sender_member_id, p_body, generate_message_snippet(p_body), NOW(), p_in_reply_to_message_id)
    RETURNING "Id" INTO v_message_id;

    -- Create message recipient entry
    INSERT INTO "MessageRecipients" ("Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient", "IsStarred", "IsArchived", "IsDeleted")
    VALUES (gen_random_uuid(), v_message_id, v_recipient_id, NOW(), false, false, false, false, false)
    RETURNING "Id" INTO v_recipient_entry_id;

    -- Update thread last message time
    UPDATE "MessageThreads"
    SET "LastMessageAtUtc" = NOW()
    WHERE "Id" = v_thread_id;

    -- Return created message details
    SELECT jsonb_build_object(
        'id', m."Id",
        'threadId', m."ThreadId",
        'senderId', m."SenderId",
        'recipientId', v_recipient_id,
        'propertyId', mt."PropertyId",
        'propertyTitle', ep."Title",
        'subject', mt."Subject",
        'snippet', m."Snippet",
        'createdAt', m."CreatedAtUtc",
        'isRead', false,
        'isReplied', false,
        'isStarred', false,
        'isArchived', false
    ) INTO v_created_message
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    WHERE m."Id" = v_message_id;

    RETURN v_created_message;
END;
$$;

-- Get Messages Function with pagination and filtering
CREATE OR REPLACE FUNCTION get_messages(
    p_user_id UUID,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 15,
    p_filter TEXT DEFAULT 'inbox',
    p_query TEXT DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'createdAt_desc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id UUID;
    v_total_count INTEGER;
    v_total_pages INTEGER;
    v_result JSONB;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'totalPages', 0);
    END IF;

    -- Calculate total count based on filter
    CASE LOWER(p_filter)
        WHEN 'inbox' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsArchived" = false AND mr."IsDeleted" = false;

        WHEN 'starred' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsStarred" = true AND mr."IsDeleted" = false;

        WHEN 'replied' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false;

        WHEN 'archived' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsArchived" = true AND mr."IsDeleted" = false;

        WHEN 'sent' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "Messages" m
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE m."SenderId" = v_member_id;

        WHEN 'trash' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsDeleted" = true;

        ELSE
            -- Default to inbox
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsArchived" = false AND mr."IsDeleted" = false;
    END CASE;

    -- Apply text search filter to total count if query provided
    IF p_query IS NOT NULL AND p_query != '' THEN
        CASE LOWER(p_filter)
            WHEN 'sent' THEN
                SELECT COUNT(*) INTO v_total_count
                FROM "Messages" m
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE m."SenderId" = v_member_id
                AND (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%');

            ELSE
                SELECT COUNT(*) INTO v_total_count
                FROM "MessageRecipients" mr
                JOIN "Messages" m ON m."Id" = mr."MessageId"
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE mr."RecipientId" = v_member_id
                AND (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%')
                AND CASE LOWER(p_filter)
                    WHEN 'inbox' THEN mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'starred' THEN mr."IsStarred" = true AND mr."IsDeleted" = false
                    WHEN 'replied' THEN mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'archived' THEN mr."IsArchived" = true AND mr."IsDeleted" = false
                    WHEN 'trash' THEN mr."IsDeleted" = true
                    ELSE mr."IsArchived" = false AND mr."IsDeleted" = false
                END;
        END CASE;
    END IF;

    -- Apply property filter to total count if provided
    IF p_property_id IS NOT NULL THEN
        CASE LOWER(p_filter)
            WHEN 'sent' THEN
                SELECT COUNT(*) INTO v_total_count
                FROM "Messages" m
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE m."SenderId" = v_member_id AND mt."PropertyId" = p_property_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'));

            ELSE
                SELECT COUNT(*) INTO v_total_count
                FROM "MessageRecipients" mr
                JOIN "Messages" m ON m."Id" = mr."MessageId"
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE mr."RecipientId" = v_member_id AND mt."PropertyId" = p_property_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'))
                AND CASE LOWER(p_filter)
                    WHEN 'inbox' THEN mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'starred' THEN mr."IsStarred" = true AND mr."IsDeleted" = false
                    WHEN 'replied' THEN mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'archived' THEN mr."IsArchived" = true AND mr."IsDeleted" = false
                    WHEN 'trash' THEN mr."IsDeleted" = true
                    ELSE mr."IsArchived" = false AND mr."IsDeleted" = false
                END;
        END CASE;
    END IF;

    -- Calculate total pages
    v_total_pages := CEIL(v_total_count::FLOAT / p_limit);

    -- Get paginated data
    CASE LOWER(p_filter)
        WHEN 'sent' THEN
            -- Handle sent messages
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', m."Id",
                    'threadId', m."ThreadId",
                    'senderId', m."SenderId",
                    'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
                    'recipientId', mr."RecipientId",
                    'propertyId', mt."PropertyId",
                    'propertyTitle', ep."Title",
                    'subject', mt."Subject",
                    'snippet', m."Snippet",
                    'createdAt', m."CreatedAtUtc",
                    'isRead', true,
                    'isReplied', false,
                    'isStarred', false,
                    'isArchived', false
                )
            ) INTO v_result
            FROM (
                SELECT m.*, ROW_NUMBER() OVER (
                    ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                             CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
                ) as rn
                FROM "Messages" m
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
                LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
                LEFT JOIN "Members" mem ON mem."Id" = mr."RecipientId"
                WHERE m."SenderId" = v_member_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'))
                AND (p_property_id IS NULL OR mt."PropertyId" = p_property_id)
            ) m
            LEFT JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
            LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
            LEFT JOIN "Members" mem ON mem."Id" = mr."RecipientId"
            WHERE m.rn > (p_page - 1) * p_limit AND m.rn <= p_page * p_limit;

        ELSE
            -- Handle received messages
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', m."Id",
                    'threadId', m."ThreadId",
                    'senderId', m."SenderId",
                    'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
                    'recipientId', mr."RecipientId",
                    'propertyId', mt."PropertyId",
                    'propertyTitle', ep."Title",
                    'subject', mt."Subject",
                    'snippet', m."Snippet",
                    'createdAt', m."CreatedAtUtc",
                    'isRead', mr."IsRead",
                    'isReplied', mr."HasBeenRepliedToByRecipient",
                    'isStarred', mr."IsStarred",
                    'isArchived', mr."IsArchived"
                )
            ) INTO v_result
            FROM (
                SELECT mr.*, m.*, ROW_NUMBER() OVER (
                    ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                             CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
                ) as rn
                FROM "MessageRecipients" mr
                JOIN "Messages" m ON m."Id" = mr."MessageId"
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
                LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
                WHERE mr."RecipientId" = v_member_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'))
                AND (p_property_id IS NULL OR mt."PropertyId" = p_property_id)
                AND CASE LOWER(p_filter)
                    WHEN 'inbox' THEN mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'starred' THEN mr."IsStarred" = true AND mr."IsDeleted" = false
                    WHEN 'replied' THEN mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'archived' THEN mr."IsArchived" = true AND mr."IsDeleted" = false
                    WHEN 'trash' THEN mr."IsDeleted" = true
                    ELSE mr."IsArchived" = false AND mr."IsDeleted" = false
                END
            ) mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
            LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
            WHERE mr.rn > (p_page - 1) * p_limit AND mr.rn <= p_page * p_limit;
    END CASE;

    -- Return empty array if no results
    IF v_result IS NULL THEN
        v_result := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'data', v_result,
        'total', v_total_count,
        'page', p_page,
        'totalPages', v_total_pages
    );
END;
$$;

-- Get Message Counts Function
CREATE OR REPLACE FUNCTION get_message_counts(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id UUID;
    v_inbox_count INTEGER := 0;
    v_starred_count INTEGER := 0;
    v_replied_count INTEGER := 0;
    v_archived_count INTEGER := 0;
    v_sent_count INTEGER := 0;
    v_trash_count INTEGER := 0;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object(
            'inbox', 0, 'starred', 0, 'replied', 0, 'archived', 0, 'sent', 0, 'trash', 0
        );
    END IF;

    -- Count inbox (unread messages that are not archived and not deleted)
    SELECT COUNT(*) INTO v_inbox_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsArchived" = false
    AND mr."IsDeleted" = false
    AND mr."IsRead" = false;

    -- Count starred messages
    SELECT COUNT(*) INTO v_starred_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsStarred" = true
    AND mr."IsDeleted" = false;

    -- Count replied messages
    SELECT COUNT(*) INTO v_replied_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."HasBeenRepliedToByRecipient" = true
    AND mr."IsArchived" = false
    AND mr."IsDeleted" = false;

    -- Count archived messages
    SELECT COUNT(*) INTO v_archived_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsArchived" = true
    AND mr."IsDeleted" = false;

    -- Count sent messages
    SELECT COUNT(*) INTO v_sent_count
    FROM "Messages" m
    WHERE m."SenderId" = v_member_id;

    -- Count trash messages
    SELECT COUNT(*) INTO v_trash_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsDeleted" = true;

    RETURN jsonb_build_object(
        'inbox', v_inbox_count,
        'starred', v_starred_count,
        'replied', v_replied_count,
        'archived', v_archived_count,
        'sent', v_sent_count,
        'trash', v_trash_count
    );
END;
$$;

-- Get Message By ID Function
CREATE OR REPLACE FUNCTION get_message_by_id(p_message_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message with access control (user must be sender or recipient)
    SELECT jsonb_build_object(
        'id', m."Id",
        'threadId', m."ThreadId",
        'senderId', m."SenderId",
        'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
        'recipientId', mr."RecipientId",
        'propertyId', mt."PropertyId",
        'propertyTitle', ep."Title",
        'subject', mt."Subject",
        'snippet', m."Snippet",
        'fullBody', m."Body",
        'createdAt', m."CreatedAtUtc",
        'isRead', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsRead" ELSE true END,
        'isReplied', CASE WHEN mr."RecipientId" = v_member_id THEN mr."HasBeenRepliedToByRecipient" ELSE false END,
        'isStarred', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsStarred" ELSE false END,
        'isArchived', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsArchived" ELSE false END
    ) INTO v_result
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE m."Id" = p_message_id
    AND (m."SenderId" = v_member_id OR mr."RecipientId" = v_member_id);

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Message not found or access denied';
    END IF;

    RETURN v_result;
END;
$$;

-- Get Messages By Property ID Function
CREATE OR REPLACE FUNCTION get_messages_by_property_id(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Validate property exists
    IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Get all messages for this property
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m."Id",
            'threadId', m."ThreadId",
            'senderId', m."SenderId",
            'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
            'recipientId', mr."RecipientId",
            'propertyId', mt."PropertyId",
            'propertyTitle', ep."Title",
            'subject', mt."Subject",
            'snippet', m."Snippet",
            'createdAt', m."CreatedAtUtc",
            'isRead', mr."IsRead",
            'isReplied', mr."HasBeenRepliedToByRecipient",
            'isStarred', mr."IsStarred",
            'isArchived', mr."IsArchived"
        )
    ) INTO v_result
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE mt."PropertyId" = p_property_id
    ORDER BY m."CreatedAtUtc" DESC;

    IF v_result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN v_result;
END;
$$;

-- Get Messages By Thread ID Function
CREATE OR REPLACE FUNCTION get_messages_by_thread_id(
    p_thread_id UUID,
    p_user_id UUID,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 100,
    p_sort_by TEXT DEFAULT 'createdAt_asc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
    v_has_access BOOLEAN := false;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Check if user has access to this thread (sender or recipient of any message)
    SELECT EXISTS(
        SELECT 1 FROM "Messages" m
        LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
        WHERE m."ThreadId" = p_thread_id
        AND (m."SenderId" = v_member_id OR mr."RecipientId" = v_member_id)
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied to thread';
    END IF;

    -- Get messages in thread with pagination
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m."Id",
            'threadId', m."ThreadId",
            'senderId', m."SenderId",
            'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
            'recipientId', mr."RecipientId",
            'propertyId', mt."PropertyId",
            'propertyTitle', ep."Title",
            'subject', mt."Subject",
            'snippet', m."Snippet",
            'fullBody', m."Body",
            'createdAt', m."CreatedAtUtc",
            'isRead', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsRead" ELSE true END,
            'isReplied', CASE WHEN mr."RecipientId" = v_member_id THEN mr."HasBeenRepliedToByRecipient" ELSE false END,
            'isStarred', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsStarred" ELSE false END,
            'isArchived', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsArchived" ELSE false END
        )
    ) INTO v_result
    FROM (
        SELECT m.*, ROW_NUMBER() OVER (
            ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                     CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
        ) as rn
        FROM "Messages" m
        WHERE m."ThreadId" = p_thread_id
    ) m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE m.rn > (p_page - 1) * p_limit AND m.rn <= p_page * p_limit;

    IF v_result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN v_result;
END;
$$;
