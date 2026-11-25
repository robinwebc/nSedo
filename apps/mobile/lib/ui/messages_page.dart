import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import '../upload.dart';
import 'call_page.dart';
import 'media_view.dart';
import 'widgets.dart';

class MessagesPage extends StatefulWidget {
  const MessagesPage({super.key});

  @override
  State<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends State<MessagesPage> {
  List<dynamic> rows = [];
  final username = TextEditingController();
  String? error;
  var loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final data = await context.read<Session>().conversations();
      if (!mounted) return;
      setState(() {
        rows = data;
        error = null;
        loading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        error = explainError(err);
        loading = false;
      });
    }
  }

  Future<void> openNamed() async {
    final name = username.text.trim();
    if (name.isEmpty) return;
    final chat = await context.read<Session>().openChat(name);
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ChatPage(conversation: chat)));
    await load();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: brandAccent(context),
      onRefresh: load,
      child: ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(space2),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: username,
                    decoration: const InputDecoration(hintText: 'Message a username'),
                    onSubmitted: (_) => openNamed(),
                  ),
                ),
                IconButton(onPressed: openNamed, icon: const Icon(Icons.send)),
              ],
            ),
          ),
          if (loading) const FeedSkeleton(),
          if (error != null) ErrorView(message: error!, onRetry: load),
          if (!loading && error == null && rows.isEmpty) const EmptyView(title: 'No messages'),
          for (final row in rows)
            ListTile(
              leading: UserAvatar(user: Map<String, dynamic>.from(row['peer'] as Map)),
              title: Text('@${(row['peer'] as Map)['username']}'),
              subtitle: Text(
                row['lastMessage'] == null ? 'No messages yet' : row['lastMessage']['body'].toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ChatPage(conversation: Map<String, dynamic>.from(row as Map)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.conversation});

  final Map<String, dynamic> conversation;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  List<dynamic> messages = [];
  final body = TextEditingController();
  String typing = '';
  sio.Socket? socket;
  double? progress;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = context.read<Session>().socket;
    if (next == socket) return;
    socket?.off('message:new', _onMessage);
    socket = next;
    socket?.on('message:new', _onMessage);
    socket?.on('typing', _onTyping);
    socket?.on('message:read', (_) => load());
  }

  void _onMessage(dynamic data) {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['conversationId'] == widget.conversation['id']) load();
  }

  void _onTyping(dynamic data) {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['conversationId'] == widget.conversation['id'] && mounted) {
      setState(() => typing = 'Typing');
    }
  }

  @override
  void dispose() {
    socket?.off('message:new', _onMessage);
    socket?.off('typing', _onTyping);
    body.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final rows = await context.read<Session>().messages(widget.conversation['id'] as String);
    if (!mounted) return;
    setState(() {
      messages = rows;
      typing = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final peer = Map<String, dynamic>.from(widget.conversation['peer'] as Map);
    final session = context.watch<Session>();
    final meId = session.me?['id'];
    return Scaffold(
      appBar: AppBar(
        title: Text('@${peer['username']}'),
        actions: [
          IconButton(
            tooltip: 'Audio call',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CallPage(peerName: peer['username'] as String, type: 'AUDIO', outgoing: true),
              ),
            ),
            icon: const Icon(Icons.call_outlined),
          ),
          IconButton(
            tooltip: 'Video call',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CallPage(peerName: peer['username'] as String, type: 'VIDEO', outgoing: true),
              ),
            ),
            icon: const Icon(Icons.videocam_outlined),
          ),
        ],
      ),
      body: Column(
        children: [
          if (typing.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(typing, style: Theme.of(context).textTheme.bodySmall),
            ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(space2),
              children: [
                for (final message in messages)
                  Align(
                    alignment: (message['sender'] as Map)['id'] == meId ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      constraints: const BoxConstraints(maxWidth: 280),
                      decoration: BoxDecoration(
                        color: (message['sender'] as Map)['id'] == meId
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: (message['sender'] as Map)['id'] == meId
                            ? null
                            : Border.all(color: Theme.of(context).dividerColor),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if ((message['mediaUrl']?.toString() ?? '').isNotEmpty)
                            GestureDetector(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => MediaViewerPage(
                                    items: [
                                      {
                                        'url': message['mediaUrl'],
                                        'kind': (message['mediaType']?.toString() ?? '').startsWith('video')
                                            ? 'VIDEO'
                                            : 'IMAGE',
                                      },
                                    ],
                                  ),
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: Image.network(message['mediaUrl'].toString(), height: 140, fit: BoxFit.cover),
                                ),
                              ),
                            ),
                          if ((message['body']?.toString() ?? '').isNotEmpty)
                            Text(
                              message['body'].toString(),
                              style: TextStyle(
                                color: (message['sender'] as Map)['id'] == meId
                                    ? Theme.of(context).colorScheme.onPrimary
                                    : null,
                                fontSize: 15,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Hairline(),
          if (progress != null) LinearProgressIndicator(value: progress == 0 ? null : progress, color: brandAccent(context)),
          Padding(
            padding: const EdgeInsets.fromLTRB(space2, 8, 4, space2),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Photo',
                  onPressed: () async {
                    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
                    if (file == null || !mounted) return;
                    setState(() => progress = 0);
                    try {
                      final bytes = await compressImage(file.path);
                      final saved = await MediaUpload(session.api).sendBytes(
                        bytes: bytes,
                        filename: 'message.jpg',
                        mime: 'image/jpeg',
                        scope: 'message',
                        onProgress: (value) {
                          if (mounted) setState(() => progress = value);
                        },
                      );
                      await session.sendMessage(
                        widget.conversation['id'] as String,
                        '',
                        mediaUrl: saved['key']?.toString() ?? saved['url']?.toString(),
                        mediaType: saved['mimeType']?.toString() ?? 'image/jpeg',
                      );
                      await load();
                    } catch (err) {
                      if (mounted) setState(() => typing = explainError(err));
                    } finally {
                      if (mounted) setState(() => progress = null);
                    }
                  },
                  icon: const Icon(Icons.image_outlined),
                ),
                Expanded(
                  child: TextField(
                    controller: body,
                    decoration: const InputDecoration(hintText: 'Message'),
                    onChanged: (_) {
                      session.socket?.emit('typing', {'conversationId': widget.conversation['id']});
                    },
                  ),
                ),
                IconButton(
                  onPressed: () async {
                    final text = body.text.trim();
                    if (text.isEmpty) return;
                    await session.sendMessage(widget.conversation['id'] as String, text);
                    body.clear();
                    await load();
                    await session.api.send('POST', '/conversations/${widget.conversation['id']}/read');
                  },
                  icon: const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
