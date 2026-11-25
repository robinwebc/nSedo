import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';

class PostPage extends StatefulWidget {
  const PostPage({super.key, required this.postId});

  final String postId;

  @override
  State<PostPage> createState() => _PostPageState();
}

class _PostPageState extends State<PostPage> {
  final comment = TextEditingController();
  List<dynamic> comments = [];
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final rows = await context.read<Session>().api.send('GET', '/posts/${widget.postId}/comments');
      if (!mounted) return;
      setState(() => comments = rows as List<dynamic>);
    } on ApiException catch (err) {
      if (mounted) setState(() => error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Post · পোস্ট')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null) Text(error!),
          for (final row in comments)
            ListTile(
              title: Text('@${(row['user'] as Map)['username']}'),
              subtitle: Text(row['body'].toString()),
            ),
          TextField(
            controller: comment,
            decoration: const InputDecoration(labelText: 'Comment · মন্তব্য'),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () async {
              await context.read<Session>().comment(widget.postId, comment.text.trim());
              comment.clear();
              await load();
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }
}
