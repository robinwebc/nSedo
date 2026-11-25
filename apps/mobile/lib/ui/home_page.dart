import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'post_page.dart';
import 'widgets.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  List<dynamic> items = [];
  String? error;
  var loading = true;
  final body = TextEditingController();
  String? mediaUrl;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final feed = await context.read<Session>().feed();
      if (!mounted) return;
      setState(() {
        items = feed;
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

  Map<String, dynamic> postOf(dynamic item) {
    final map = Map<String, dynamic>.from(item as Map);
    if (map['post'] is Map) return Map<String, dynamic>.from(map['post'] as Map);
    return map;
  }

  Future<void> publish() async {
    final session = context.read<Session>();
    try {
      await session.createPost(body.text.trim(), mediaUrl: mediaUrl);
      body.clear();
      setState(() => mediaUrl = null);
      await load();
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return RefreshIndicator(
      color: ember,
      onRefresh: load,
      child: ListView(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(space2, space2, space2, space1),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: body,
                  minLines: 2,
                  maxLines: 6,
                  maxLength: 500,
                  decoration: const InputDecoration(
                    hintText: 'Write a post',
                    counterText: '',
                  ),
                ),
                if (mediaUrl != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(mediaUrl!, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    IconButton(
                      tooltip: 'Image',
                      onPressed: () async {
                        final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 80);
                        if (file == null || !mounted) return;
                        final url = await context.read<Session>().upload(File(file.path));
                        if (mounted) setState(() => mediaUrl = url);
                      },
                      icon: const Icon(Icons.image_outlined),
                    ),
                    const Spacer(),
                    FilledButton(onPressed: publish, child: const Text('Post')),
                  ],
                ),
              ],
            ),
          ),
          const Hairline(),
          if (loading) const FeedSkeleton(),
          if (!loading && error != null) ErrorView(message: error!, onRetry: load),
          if (!loading && error == null && items.isEmpty)
            const EmptyView(title: 'No posts yet', detail: 'Posts from people you follow show up here.'),
          for (var i = 0; i < items.length; i++) ...[
            PostTile(
              post: postOf(items[i]),
              repost: items[i] is Map && (items[i] as Map)['repost'] is Map
                  ? Map<String, dynamic>.from((items[i] as Map)['repost'] as Map)
                  : null,
              session: session,
              onChanged: load,
              onOpen: () {
                final post = postOf(items[i]);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => PostPage(postId: post['id'] as String)),
                );
              },
            ),
            const Hairline(),
          ],
        ],
      ),
    );
  }
}
