import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'profile_page.dart';
import 'widgets.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final query = TextEditingController();
  List<dynamic> users = [];
  List<dynamic> posts = [];
  String? error;
  var loading = false;
  var searched = false;

  Future<void> run() async {
    final text = query.text.trim();
    if (text.isEmpty) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<Session>().search(text);
      if (!mounted) return;
      setState(() {
        users = data['users'] as List<dynamic>? ?? [];
        posts = data['posts'] as List<dynamic>? ?? [];
        loading = false;
        searched = true;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        error = explainError(err);
        loading = false;
        searched = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return ListView(
      padding: const EdgeInsets.only(bottom: space2),
      children: [
        Padding(
          padding: const EdgeInsets.all(space2),
          child: TextField(
            controller: query,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              hintText: 'Search people and posts',
              prefixIcon: Icon(Icons.search),
            ),
            onSubmitted: (_) => run(),
          ),
        ),
        if (loading) const FeedSkeleton(),
        if (error != null) ErrorView(message: error!, onRetry: run),
        if (!loading && searched && error == null && users.isEmpty && posts.isEmpty)
          const EmptyView(title: 'No results'),
        for (final user in users)
          ListTile(
            leading: UserAvatar(user: Map<String, dynamic>.from(user as Map)),
            title: Text(user['displayName']?.toString() ?? ''),
            subtitle: Text('@${user['username']}'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => ProfilePage(username: user['username'] as String)),
            ),
          ),
        for (final post in posts)
          PostTile(
            post: Map<String, dynamic>.from(post as Map),
            session: session,
          ),
      ],
    );
  }
}
