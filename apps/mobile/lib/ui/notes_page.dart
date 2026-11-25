import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'widgets.dart';

class NotesPage extends StatefulWidget {
  const NotesPage({super.key});

  @override
  State<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<NotesPage> {
  List<dynamic> items = [];
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
      final data = await context.read<Session>().notifications();
      if (!mounted) return;
      setState(() {
        items = data;
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

  IconData _icon(String type) {
    switch (type) {
      case 'LIKE':
        return Icons.favorite_border;
      case 'COMMENT':
        return Icons.chat_bubble_outline;
      case 'FOLLOW':
        return Icons.person_add_alt;
      case 'FRIEND_REQUEST':
        return Icons.group_outlined;
      case 'MESSAGE':
        return Icons.chat_bubble_outline;
      case 'REPOST':
        return Icons.repeat;
      default:
        return Icons.notifications_none;
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: brandAccent(context),
      onRefresh: load,
      child: ListView(
        children: [
          if (loading) const FeedSkeleton(),
          if (error != null) ErrorView(message: error!, onRetry: load),
          if (!loading && error == null && items.isEmpty) const EmptyView(title: 'No alerts'),
          for (final item in items)
            ListTile(
              leading: Icon(_icon(item['type']?.toString() ?? '')),
              title: Text(
                '@${item['actor'] == null ? 'nSedo' : (item['actor'] as Map)['username']} ${item['body'] ?? ''}',
              ),
              subtitle: Text(shortTime(item['createdAt'])),
              onTap: () async {
                await context.read<Session>().api.send('POST', '/notifications/${item['id']}/read');
                await load();
              },
            ),
        ],
      ),
    );
  }
}
