-- User-to-user chats should only show in the chat icon, not the notification bell.
-- Drop the trigger that turns every direct message into a bell notification.
DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON public.direct_messages;

-- Remove existing chat entries from the bell (chat history itself is untouched).
DELETE FROM public.notifications WHERE kind = 'direct_message';