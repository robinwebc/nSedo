import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'widgets.dart';

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
  var loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final rows = await context.read<Session>().api.send('GET', '/posts/${widget.postId}/comments');
      if (!mounted) return;
      setState(() {
        comments = rows as List<dynamic>;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Post')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              children: [
                if (loading) const FeedSkeleton(),
                if (error != null) ErrorView(message: error!, onRetry: load),
                if (!loading && error == null && comments.isEmpty) const EmptyView(title: 'No comments'),
                for (final row in comments)
                  ListTile(
                    leading: UserAvatar(user: Map<String, dynamic>.from(row['user'] as Map)),
                    title: Text('@${(row['user'] as Map)['username']}'),
                    subtitle: Text(row['body'].toString()),
                  ),
              ],
            ),
          ),
          const Hairline(),
          Padding(
            padding: const EdgeInsets.fromLTRB(space2, 8, space1, space2),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: comment,
                    decoration: const InputDecoration(hintText: 'Write a comment'),
                  ),
                ),
                IconButton(
                  onPressed: () async {
                    final text = comment.text.trim();
                    if (text.isEmpty) return;
                    await context.read<Session>().comment(widget.postId, text);
                    comment.clear();
                    await load();
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
