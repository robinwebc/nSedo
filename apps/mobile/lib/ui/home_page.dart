import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'post_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  List<dynamic> items = [];
  String? error;
  final body = TextEditingController();
  String? mediaUrl;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final feed = await context.read<Session>().feed();
      if (!mounted) return;
      setState(() {
        items = feed;
        error = null;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => error = err.message);
    }
  }

  Map<String, dynamic> postOf(dynamic item) {
    final map = Map<String, dynamic>.from(item as Map);
    if (map['post'] is Map) return Map<String, dynamic>.from(map['post'] as Map);
    return map;
  }

  Future<void> publish() async {
    try {
      await context.read<Session>().createPost(body.text.trim(), mediaUrl: mediaUrl);
      body.clear();
      mediaUrl = null;
      await load();
    } on ApiException catch (err) {
      if (mounted) setState(() => error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  TextField(
                    controller: body,
                    minLines: 2,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      hintText: "What's happening? কী হচ্ছে?",
                    ),
                  ),
                  if (mediaUrl != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(mediaUrl!, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  Row(
                    children: [
                      IconButton(
                        onPressed: () async {
                          final file = await ImagePicker().pickImage(source: ImageSource.gallery);
                          if (file == null || !mounted) return;
                          final url = await context.read<Session>().upload(File(file.path));
                          setState(() => mediaUrl = url);
                        },
                        icon: const Icon(Icons.image_outlined),
                      ),
                      const Spacer(),
                      FilledButton(onPressed: publish, child: const Text('Post · পোস্ট')),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (error != null) Text(error!, style: const TextStyle(color: ember)),
          for (final item in items)
            PostCard(
              post: postOf(item),
              repost: item is Map && item['repost'] is Map
                  ? Map<String, dynamic>.from(item['repost'] as Map)
                  : null,
              onChanged: load,
            ),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text('Home is quiet. Follow someone or write the first post.'),
            ),
        ],
      ),
    );
  }
}

class PostCard extends StatelessWidget {
  const PostCard({super.key, required this.post, this.repost, required this.onChanged});

  final Map<String, dynamic> post;
  final Map<String, dynamic>? repost;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final author = Map<String, dynamic>.from(post['author'] as Map);
    final session = context.read<Session>();
    return Card(
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => PostPage(postId: post['id'] as String)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (repost != null)
                Text(
                  'Reposted by @${(repost!['user'] as Map)['username']}'
                  '${repost!['quote'] != null ? ': ${repost!['quote']}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              Text(
                '${author['displayName']}${author['verifiedBadge'] == true ? ' ✓' : ''}  @${author['username']}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              if (post['body'] != null) Text(post['body'].toString()),
              if (post['mediaUrl'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Image.network(post['mediaUrl'].toString(), height: 180, fit: BoxFit.cover),
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  TextButton(
                    onPressed: () => session.like(post['id'] as String).then((_) => onChanged()),
                    child: Text('Like ${post['likeCount']}'),
                  ),
                  TextButton(
                    onPressed: () => session.repost(post['id'] as String).then((_) => onChanged()),
                    child: Text('Repost ${post['repostCount']}'),
                  ),
                  IconButton(
                    onPressed: () {
                      SharePlus.instance.share(ShareParams(text: post['shareUrl'].toString()));
                    },
                    icon: const Icon(Icons.ios_share),
                    tooltip: 'Share',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
