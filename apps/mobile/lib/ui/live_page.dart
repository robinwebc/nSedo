import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'widgets.dart';

class LivePage extends StatefulWidget {
  const LivePage({super.key});

  @override
  State<LivePage> createState() => _LivePageState();
}

class _LivePageState extends State<LivePage> {
  List<dynamic> rows = [];
  final title = TextEditingController();
  final comment = TextEditingController();
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
      color: ember,
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
                try {
                  await context.read<Session>().goLive(title.text.trim());
                  title.clear();
                  await load();
                } catch (err) {
                  if (mounted) setState(() => error = explainError(err));
                }
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
                onPressed: () async {
                  comment.clear();
                  await showDialog<void>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: Text(row['title'].toString()),
                      content: TextField(controller: comment, decoration: const InputDecoration(labelText: 'Comment')),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Close')),
                        TextButton(
                          onPressed: () async {
                            await context.read<Session>().api.send(
                                  'POST',
                                  '/live/${row['id']}/comments',
                                  body: {'body': comment.text.trim()},
                                );
                            if (dialogContext.mounted) Navigator.pop(dialogContext);
                          },
                          child: const Text('Send'),
                        ),
                      ],
                    ),
                  );
                },
                child: const Text('Join'),
              ),
            ),
        ],
      ),
    );
  }
}
