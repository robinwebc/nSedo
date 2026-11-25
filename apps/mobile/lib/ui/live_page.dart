import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'live_room.dart';
import 'widgets.dart';

class LivePage extends StatefulWidget {
  const LivePage({super.key});

  @override
  State<LivePage> createState() => _LivePageState();
}

class _LivePageState extends State<LivePage> {
  List<dynamic> rows = [];
  final title = TextEditingController();
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
      final data = await context.read<Session>().lives();
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

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: brandAccent(context),
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(space2),
        children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Live title')),
          const SizedBox(height: space1),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: () async {
                final name = title.text.trim();
                if (name.isEmpty) return;
                title.clear();
                await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => LiveRoomPage(hosting: true, title: name)),
                );
                await load();
              },
              child: const Text('Go live'),
            ),
          ),
          const SizedBox(height: space2),
          if (loading) const FeedSkeleton(),
          if (error != null) ErrorView(message: error!, onRetry: load),
          if (!loading && error == null && rows.isEmpty) const EmptyView(title: 'No one is live'),
          for (final row in rows)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: UserAvatar(user: Map<String, dynamic>.from(row['host'] as Map)),
              title: Text(row['title'].toString()),
              subtitle: Text('@${(row['host'] as Map)['username']}'),
              trailing: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => LiveRoomPage(streamId: row['id'] as String, title: row['title'].toString()),
                  ),
                ),
                child: const Text('Join'),
              ),
            ),
        ],
      ),
    );
  }
}
