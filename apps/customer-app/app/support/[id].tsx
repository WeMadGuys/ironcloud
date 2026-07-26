import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  categoryLabel,
  getTicketWithMessages,
  isTicketOpen,
  sendMessage,
  type SupportTicket,
  type TicketMessage,
} from '../../src/features/support/services/support.service';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SupportThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listRef = useRef<FlatList<TicketMessage>>(null);

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');
        const result = await getTicketWithMessages(id);
        setTicket(result.ticket);
        setMessages(result.messages);
        setCurrentUserId(result.currentUserId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    if (!id || !draft.trim() || sending) return;
    try {
      setSending(true);
      const created = await sendMessage(id, draft.trim());
      setMessages((prev) => [...prev, created]);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const open = ticket ? isTicketOpen(ticket.status) : false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {ticket ? categoryLabel(ticket.category) : 'Support'}
            </Text>
            {ticket ? (
              <Text style={styles.headerSubtitle}>
                {open ? 'Open' : 'Resolved'}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : error && !ticket ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.thread}
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: false })
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => load(true)}
                  tintColor={colors.brand.primary}
                />
              }
              renderItem={({ item }) => {
                const mine = item.sender_id === currentUserId;
                return (
                  <View
                    style={[
                      styles.bubbleWrap,
                      mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          mine && styles.bubbleTextMine,
                        ]}
                      >
                        {item.message}
                      </Text>
                    </View>
                    <Text style={styles.bubbleTime}>
                      {mine ? 'You' : 'Support'} · {formatMessageTime(item.created_at)}
                    </Text>
                  </View>
                );
              }}
            />

            {error ? <Text style={styles.inlineError}>{error}</Text> : null}

            {open ? (
              <View style={styles.composer}>
                <TextInput
                  style={styles.composerInput}
                  placeholder="Write a reply..."
                  placeholderTextColor={colors.text.muted}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={1000}
                />
                <Pressable
                  style={[
                    styles.sendBtn,
                    (!draft.trim() || sending) && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!draft.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.brand.onPrimary} />
                  ) : (
                    <MaterialCommunityIcons
                      name="send"
                      size={18}
                      color={colors.brand.onPrimary}
                    />
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.resolvedBar}>
                <Text style={styles.resolvedText}>
                  This request is resolved. Open a new request if you need more help.
                </Text>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  headerSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  headerSpacer: {
    width: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.status.error.foreground,
    textAlign: 'center',
  },
  thread: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    flexGrow: 1,
  },
  bubbleWrap: {
    maxWidth: '82%',
  },
  bubbleWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: colors.brand.onPrimary,
  },
  bubbleTime: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    backgroundColor: colors.surface.background,
  },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  resolvedBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    backgroundColor: colors.surface.elevated,
  },
  resolvedText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  inlineError: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.status.error.foreground,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
});
