import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'composer.dart';
import 'live_room.dart';
import 'post_page.dart';
import 'widgets.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  List<dynamic> items = [];
  List<dynamic> lives = [];
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
      final session = context.read<Session>();
      final feed = await session.feed();
      final live = await session.lives();
      if (!mounted) return;
      setState(() {
        items = feed;
        lives = live;
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

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return RefreshIndicator(
      color: brandAccent(context),
      onRefresh: load,
      child: ListView(
        children: [
          Composer(onPosted: load),
          for (final row in lives)
            ListTile(
              leading: const Icon(Icons.sensors, color: cobalt),
              title: Text(row['title'].toString()),
              subtitle: Text('Live · @${(row['host'] as Map)['username']}'),
              trailing: const Text('Watch'),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => LiveRoomPage(
                    streamId: row['id'] as String,
                    title: row['title'].toString(),
                  ),
                ),
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
