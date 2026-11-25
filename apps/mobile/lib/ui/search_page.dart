import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import 'profile_page.dart';

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

  Future<void> run() async {
    try {
      final data = await context.read<Session>().search(query.text.trim());
      if (!mounted) return;
      setState(() {
        users = data['users'] as List<dynamic>;
        posts = data['posts'] as List<dynamic>;
        error = null;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: query,
          decoration: InputDecoration(
            hintText: 'Search people and posts · খোঁজ',
            suffixIcon: IconButton(onPressed: run, icon: const Icon(Icons.search)),
          ),
          onSubmitted: (_) => run(),
        ),
        if (error != null) Text(error!),
        for (final user in users)
          ListTile(
            title: Text('${user['displayName']} @${user['username']}'),
            subtitle: Text(user['bio']?.toString() ?? ''),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProfilePage(username: user['username'] as String),
              ),
            ),
          ),
        for (final post in posts)
          ListTile(
            title: Text(post['body']?.toString() ?? ''),
            subtitle: Text('@${(post['author'] as Map)['username']}'),
          ),
      ],
    );
  }
}
