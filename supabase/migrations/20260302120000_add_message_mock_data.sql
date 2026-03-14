-- ============================================================================
-- MIGRATION: Add mock message data for member 7c2259d0-aa67-40b4-9c3a-f3f13294093f
-- ============================================================================
-- Creates MessageThreads, Messages, and MessageRecipients for testing.
--
-- Participants (from task-04.txt user data):
--   - 7c2259d0-aa67-40b4-9c3a-f3f13294093f (target member)
--   - 1258a50d-a9fa-42df-b444-bec362ad3c4e (User, test@example.com)
--   - 1a4bbe77-5145-4e24-a180-433fba7f4559 (admin@testcompany.com)
--   - 697ebb69-c65c-45c4-967f-9af8c580826d (User Gonzalves, valentinaigc@outlook.com)
--
-- PREREQUISITE: Member 7c2259d0-aa67-40b4-9c3a-f3f13294093f must exist in Members.
-- ============================================================================

-- MessageThread 1: Conversation with User (test@example.com)
INSERT INTO public."MessageThreads" (
  "Id", "Subject", "PropertyId", "CreatedAtUtc", "LastMessageAtUtc",
  "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'a1b2c3d4-1111-4111-8111-111111111111'::uuid,
  'Question about property availability',
  NULL,
  '2026-02-15 10:00:00+00',
  '2026-02-16 14:30:00+00',
  false,
  '2026-02-15 10:00:00+00',
  NULL,
  '2026-02-16 14:30:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- MessageThread 2: Conversation with admin
INSERT INTO public."MessageThreads" (
  "Id", "Subject", "PropertyId", "CreatedAtUtc", "LastMessageAtUtc",
  "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'a1b2c3d4-2222-4222-8222-222222222222'::uuid,
  'Welcome to the platform',
  NULL,
  '2026-02-10 09:00:00+00',
  '2026-02-10 09:15:00+00',
  false,
  '2026-02-10 09:00:00+00',
  NULL,
  '2026-02-10 09:15:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- MessageThread 3: Conversation with User Gonzalves
INSERT INTO public."MessageThreads" (
  "Id", "Subject", "PropertyId", "CreatedAtUtc", "LastMessageAtUtc",
  "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'a1b2c3d4-3333-4333-8333-333333333333'::uuid,
  'Follow up on previous inquiry',
  NULL,
  '2026-02-20 11:00:00+00',
  '2026-02-21 16:45:00+00',
  false,
  '2026-02-20 11:00:00+00',
  NULL,
  '2026-02-21 16:45:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================================
-- Messages
-- ============================================================================

-- Thread 1, Message 1: User (1258a50d) asks target member
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-1111-4111-8111-111111111111'::uuid,
  'a1b2c3d4-1111-4111-8111-111111111111'::uuid,
  '1258a50d-a9fa-42df-b444-bec362ad3c4e'::uuid,
  'Hi, I''m interested in the property you have listed. Is it still available for the first week of March? I''d like to schedule a viewing if possible.',
  'Hi, I''m interested in the property you have listed. Is it still available for the first week of March? I''d like to schedule a viewing if possible.',
  '2026-02-15 10:00:00+00',
  NULL,
  false,
  '2026-02-15 10:00:00+00',
  NULL,
  '2026-02-15 10:00:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 1, Message 2: Target member (7c2259d0) replies
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-1112-4112-8112-111111111112'::uuid,
  'a1b2c3d4-1111-4111-8111-111111111111'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  'Yes, the property is still available! I can arrange a viewing for Tuesday March 3rd or Wednesday March 4th. Which day works better for you?',
  'Yes, the property is still available! I can arrange a viewing for Tuesday March 3rd or Wednesday March 4th. Which day works better for you?',
  '2026-02-15 16:30:00+00',
  'b1c2d3e4-1111-4111-8111-111111111111'::uuid,
  false,
  '2026-02-15 16:30:00+00',
  NULL,
  '2026-02-15 16:30:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 1, Message 3: User replies
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-1113-4113-8113-111111111113'::uuid,
  'a1b2c3d4-1111-4111-8111-111111111111'::uuid,
  '1258a50d-a9fa-42df-b444-bec362ad3c4e'::uuid,
  'Tuesday March 3rd would be perfect. What time would work for you? I''m flexible in the afternoon.',
  'Tuesday March 3rd would be perfect. What time would work for you? I''m flexible in the afternoon.',
  '2026-02-16 14:30:00+00',
  'b1c2d3e4-1112-4112-8112-111111111112'::uuid,
  false,
  '2026-02-16 14:30:00+00',
  NULL,
  '2026-02-16 14:30:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 2, Message 1: Admin welcomes target member
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-2221-4221-8221-222222222221'::uuid,
  'a1b2c3d4-2222-4222-8222-222222222222'::uuid,
  '1a4bbe77-5145-4e24-a180-433fba7f4559'::uuid,
  'Welcome to our platform! We''re excited to have you. If you have any questions about listing your property or managing bookings, feel free to reach out.',
  'Welcome to our platform! We''re excited to have you. If you have any questions about listing your property or managing bookings, feel free to reach out.',
  '2026-02-10 09:00:00+00',
  NULL,
  false,
  '2026-02-10 09:00:00+00',
  NULL,
  '2026-02-10 09:00:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 2, Message 2: Target member thanks admin
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-2222-4222-8222-222222222222'::uuid,
  'a1b2c3d4-2222-4222-8222-222222222222'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  'Thank you! I''ll definitely reach out if I need any help getting started.',
  'Thank you! I''ll definitely reach out if I need any help getting started.',
  '2026-02-10 09:15:00+00',
  'b1c2d3e4-2221-4221-8221-222222222221'::uuid,
  false,
  '2026-02-10 09:15:00+00',
  NULL,
  '2026-02-10 09:15:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 3, Message 1: Target member initiates with User Gonzalves
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-3331-4331-8331-333333333331'::uuid,
  'a1b2c3d4-3333-4333-8333-333333333333'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  'Hi, I wanted to follow up on the inquiry you sent last week. Are you still interested in the property? I have some updated availability to share.',
  'Hi, I wanted to follow up on the inquiry you sent last week. Are you still interested in the property? I have some updated availability to share.',
  '2026-02-20 11:00:00+00',
  NULL,
  false,
  '2026-02-20 11:00:00+00',
  NULL,
  '2026-02-20 11:00:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 3, Message 2: User Gonzalves replies
INSERT INTO public."Messages" (
  "Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc",
  "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'b1c2d3e4-3332-4332-8332-333333333332'::uuid,
  'a1b2c3d4-3333-4333-8333-333333333333'::uuid,
  '697ebb69-c65c-45c4-967f-9af8c580826d'::uuid,
  'Yes, I''m still very interested! Please send me the updated availability. I''m looking to book for mid-March if that works.',
  'Yes, I''m still very interested! Please send me the updated availability. I''m looking to book for mid-March if that works.',
  '2026-02-21 16:45:00+00',
  'b1c2d3e4-3331-4331-8331-333333333331'::uuid,
  false,
  '2026-02-21 16:45:00+00',
  NULL,
  '2026-02-21 16:45:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================================
-- MessageRecipients
-- ============================================================================

-- Thread 1, Msg 1: Recipient = target member (7c2259d0)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-1111-4111-8111-111111111111'::uuid,
  'b1c2d3e4-1111-4111-8111-111111111111'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  '2026-02-15 10:00:00+00',
  true,
  true,
  false,
  false,
  false,
  '2026-02-15 10:00:00+00',
  NULL,
  '2026-02-15 10:00:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 1, Msg 2: Recipient = User (1258a50d)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-1112-4112-8112-111111111112'::uuid,
  'b1c2d3e4-1112-4112-8112-111111111112'::uuid,
  '1258a50d-a9fa-42df-b444-bec362ad3c4e'::uuid,
  '2026-02-15 16:30:00+00',
  true,
  true,
  false,
  false,
  false,
  '2026-02-15 16:30:00+00',
  NULL,
  '2026-02-15 16:30:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 1, Msg 3: Recipient = target member (7c2259d0)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-1113-4113-8113-111111111113'::uuid,
  'b1c2d3e4-1113-4113-8113-111111111113'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  '2026-02-16 14:30:00+00',
  false,
  false,
  true,
  false,
  false,
  '2026-02-16 14:30:00+00',
  NULL,
  '2026-02-16 14:30:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 2, Msg 1: Recipient = target member (7c2259d0)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-2221-4221-8221-222222222221'::uuid,
  'b1c2d3e4-2221-4221-8221-222222222221'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  '2026-02-10 09:00:00+00',
  true,
  true,
  false,
  true,
  false,
  '2026-02-10 09:00:00+00',
  NULL,
  '2026-02-10 09:00:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 2, Msg 2: Recipient = admin (1a4bbe77)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-2222-4222-8222-222222222222'::uuid,
  'b1c2d3e4-2222-4222-8222-222222222222'::uuid,
  '1a4bbe77-5145-4e24-a180-433fba7f4559'::uuid,
  '2026-02-10 09:15:00+00',
  true,
  false,
  false,
  false,
  false,
  '2026-02-10 09:15:00+00',
  NULL,
  '2026-02-10 09:15:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 3, Msg 1: Recipient = User Gonzalves (697ebb69)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-3331-4331-8331-333333333331'::uuid,
  'b1c2d3e4-3331-4331-8331-333333333331'::uuid,
  '697ebb69-c65c-45c4-967f-9af8c580826d'::uuid,
  '2026-02-20 11:00:00+00',
  true,
  true,
  false,
  false,
  false,
  '2026-02-20 11:00:00+00',
  NULL,
  '2026-02-20 11:00:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;

-- Thread 3, Msg 2: Recipient = target member (7c2259d0)
INSERT INTO public."MessageRecipients" (
  "Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient",
  "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy"
) VALUES (
  'c1d2e3f4-3332-4332-8332-333333333332'::uuid,
  'b1c2d3e4-3332-4332-8332-333333333332'::uuid,
  '7c2259d0-aa67-40b4-9c3a-f3f13294093f'::uuid,
  '2026-02-21 16:45:00+00',
  true,
  false,
  false,
  false,
  false,
  '2026-02-21 16:45:00+00',
  NULL,
  '2026-02-21 16:45:00+00',
  NULL
)
ON CONFLICT ("Id") DO NOTHING;
