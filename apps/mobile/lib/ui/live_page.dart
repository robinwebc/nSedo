import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';

class LivePage extends StatefulWidget {
  const LivePage({super.key});

  @override
  State<LivePage> createState() => _LivePageState();
}

class _LivePageState extends State<LivePage> {
  List<dynamic> rows = [];
  final title = TextEditingController(text: 'Live now');
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await context.read<Session>().lives();
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
        const Text('Live rooms use WebRTC through the nSedo signaling server.'),
        const SizedBox(height: 8),
        TextField(controller: title, decoration: const InputDecoration(labelText: 'Title · শিরোনাম')),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () async {
            try {
              await context.read<Session>().goLive(title.text.trim());
              await load();
            } on ApiException catch (err) {
              setState(() => error = err.message);
            }
          },
          child: const Text('Go live · লাইভ'),
        ),
        if (error != null) Text(error!),
        for (final row in rows)
          ListTile(
            title: Text(row['title'].toString()),
            subtitle: Text('@${(row['host'] as Map)['username']}'),
            trailing: TextButton(
              onPressed: () async {
                final comment = TextEditingController();
                await showDialog<void>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: Text(row['title'].toString()),
                    content: TextField(controller: comment, decoration: const InputDecoration(labelText: 'Comment')),
                    actions: [
                      TextButton(
                        onPressed: () async {
                          await this.context.read<Session>().api.send(
                                'POST',
                                '/live/${row['id']}/comments',
                                body: {'body': comment.text.trim()},
                              );
                          if (context.mounted) Navigator.pop(context);
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
        if (rows.isEmpty) const Text('Nobody is live right now.'),
      ],
    );
  }
}
