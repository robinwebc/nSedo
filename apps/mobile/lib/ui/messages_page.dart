import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../api.dart';
import '../session.dart';
import 'call_page.dart';

class MessagesPage extends StatefulWidget {
  const MessagesPage({super.key});

  @override
  State<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends State<MessagesPage> {
  List<dynamic> rows = [];
  final username = TextEditingController();
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await context.read<Session>().conversations();
      if (!mounted) return;
      setState(() => rows = data);
    } on ApiException catch (err) {
      if (mounted) setState(() => error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: username,
                decoration: const InputDecoration(labelText: 'Message @username'),
              ),
            ),
            IconButton(
              onPressed: () async {
                final chat = await context.read<Session>().openChat(username.text.trim());
                if (!context.mounted) return;
                await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => ChatPage(conversation: chat)),
                );
                await load();
              },
              icon: const Icon(Icons.send),
            ),
          ],
        ),
        if (error != null) Text(error!),
        for (final row in rows)
          ListTile(
            title: Text('@${(row['peer'] as Map)['username']}'),
            subtitle: Text(row['lastMessage'] == null ? 'No messages yet' : row['lastMessage']['body'].toString()),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChatPage(conversation: Map<String, dynamic>.from(row as Map)),
              ),
            ),
          ),
      ],
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
      setState(() => typing = 'typing…');
    }
  }

  @override
  void dispose() {
    socket?.off('message:new', _onMessage);
    socket?.off('typing', _onTyping);
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
    final session = context.read<Session>();
    return Scaffold(
      appBar: AppBar(
        title: Text('@${peer['username']}'),
        actions: [
          IconButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CallPage(
                  peerName: peer['username'] as String,
                  type: 'AUDIO',
                  outgoing: true,
                ),
              ),
            ),
            icon: const Icon(Icons.call),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CallPage(
                  peerName: peer['username'] as String,
                  type: 'VIDEO',
                  outgoing: true,
                ),
              ),
            ),
            icon: const Icon(Icons.videocam_outlined),
          ),
        ],
      ),
      body: Column(
        children: [
          if (typing.isNotEmpty) Text(typing),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                for (final message in messages)
                  Align(
                    alignment: (message['sender'] as Map)['id'] == session.me?['id']
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Card(child: Padding(padding: const EdgeInsets.all(10), child: Text(message['body'].toString()))),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Expanded(child: TextField(controller: body, decoration: const InputDecoration(hintText: 'Message · বার্তা'))),
                IconButton(
                  onPressed: () async {
                    final text = body.text.trim();
                    if (text.isEmpty) return;
                    session.socket?.emit('typing', {'conversationId': widget.conversation['id']});
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
