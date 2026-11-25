import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../session.dart';

class NotesPage extends StatefulWidget {
  const NotesPage({super.key});

  @override
  State<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<NotesPage> {
  List<dynamic> items = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final data = await context.read<Session>().notifications();
    if (!mounted) return;
    setState(() => items = data);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          for (final item in items)
            ListTile(
              title: Text('@${item['actor'] == null ? 'nSedo' : (item['actor'] as Map)['username']} ${item['body']}'),
              subtitle: Text(item['type'].toString()),
              onTap: () async {
                await context.read<Session>().api.send('POST', '/notifications/${item['id']}/read');
                await load();
              },
            ),
          if (items.isEmpty) const ListTile(title: Text('No notifications yet. খবর নেই।')),
        ],
      ),
    );
  }
}
