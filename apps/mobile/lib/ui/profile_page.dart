import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'call_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, this.username});

  final String? username;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? profile;
  String? error;

  bool get mine => widget.username == null || widget.username == context.read<Session>().me?['username'];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final session = context.read<Session>();
    final name = widget.username ?? session.me?['username'] as String?;
    if (name == null) return;
    try {
      final data = name == session.me?['username']
          ? await session.api.send('GET', '/users/me').then((value) => Map<String, dynamic>.from(value as Map))
          : await session.profile(name);
      if (!mounted) return;
      setState(() => profile = data);
    } on ApiException catch (err) {
      if (mounted) setState(() => error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = profile;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile · প্রোফাইল'),
        actions: [
          if (widget.username == null)
            IconButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsPage())),
              icon: const Icon(Icons.settings_outlined),
            ),
        ],
      ),
      body: data == null
          ? Center(child: error == null ? const CircularProgressIndicator() : Text(error!))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const NsedoMark(size: 72),
                const SizedBox(height: 12),
                Text(
                  '${data['displayName']}${data['verifiedBadge'] == true ? ' ✓' : ''}',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text('@${data['username']} · ${data['userId']}'),
                const SizedBox(height: 8),
                Text(data['bio']?.toString().isNotEmpty == true ? data['bio'].toString() : 'No bio yet.'),
                Text('Privacy: ${data['privacy']}'),
                if (data['followerCount'] != null)
                  Text('${data['followerCount']} followers · ${data['followingCount']} following'),
                const SizedBox(height: 12),
                if (widget.username != null && widget.username != context.watch<Session>().me?['username']) ...[
                  FilledButton(
                    onPressed: () => context.read<Session>().follow(widget.username!).then((_) => load()),
                    child: const Text('Follow · ফলো'),
                  ),
                  OutlinedButton(
                    onPressed: () => context.read<Session>().friendRequest(widget.username!),
                    child: const Text('Friend request'),
                  ),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CallPage(peerName: widget.username!, type: 'VIDEO', outgoing: true),
                      ),
                    ),
                    child: const Text('Video call'),
                  ),
                  TextButton(
                    onPressed: () => context.read<Session>().api.send('POST', '/blocks/${widget.username}'),
                    child: const Text('Block'),
                  ),
                  TextButton(
                    onPressed: () => context.read<Session>().api.send('POST', '/mutes/${widget.username}'),
                    child: const Text('Mute'),
                  ),
                  TextButton(
                    onPressed: () => context.read<Session>().api.send(
                      'POST',
                      '/reports',
                      body: {
                        'targetType': 'USER',
                        'targetId': data['id'],
                        'reason': 'Reported from the profile screen',
                      },
                    ),
                    child: const Text('Report'),
                  ),
                ],
              ],
            ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final server = TextEditingController(text: context.read<Session>().apiUrl);
  final username = TextEditingController();
  final displayName = TextEditingController();
  final bio = TextEditingController();
  final password = TextEditingController();
  final nextPassword = TextEditingController();
  String? message;
  bool privateAccount = false;

  @override
  void initState() {
    super.initState();
    final me = context.read<Session>().me;
    displayName.text = me?['displayName']?.toString() ?? '';
    bio.text = me?['bio']?.toString() ?? '';
    privateAccount = me?['privacy'] == 'PRIVATE';
  }

  @override
  Widget build(BuildContext context) {
    final session = context.read<Session>();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings · সেটিংস')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: server, decoration: const InputDecoration(labelText: 'Server URL')),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () async {
              await session.setApiUrl(server.text);
              setState(() => message = 'Server saved');
            },
            child: const Text('Save server'),
          ),
          const Divider(),
          TextField(controller: displayName, decoration: const InputDecoration(labelText: 'Display name')),
          TextField(controller: bio, decoration: const InputDecoration(labelText: 'Bio')),
          SwitchListTile(
            value: privateAccount,
            title: const Text('Private account'),
            subtitle: const Text('Only approved followers see posts'),
            onChanged: (value) => setState(() => privateAccount = value),
          ),
          FilledButton(
            onPressed: () async {
              await session.updateMe({
                'displayName': displayName.text.trim(),
                'bio': bio.text.trim(),
                'privacy': privateAccount ? 'PRIVATE' : 'PUBLIC',
              });
              setState(() => message = 'Profile updated');
            },
            child: const Text('Save profile'),
          ),
          const Divider(),
          TextField(controller: username, decoration: const InputDecoration(labelText: 'New username')),
          OutlinedButton(
            onPressed: () async {
              try {
                await session.changeUsername(username.text.trim());
                setState(() => message = 'Username updated');
              } on ApiException catch (err) {
                setState(() => message = err.message);
              }
            },
            child: const Text('Change username (once / 30 days)'),
          ),
          const Divider(),
          TextField(controller: nextPassword, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
          OutlinedButton(
            onPressed: () async {
              await session.setPassword(nextPassword.text, current: password.text);
              setState(() => message = 'Password saved');
            },
            child: const Text('Set password'),
          ),
          const Divider(),
          OutlinedButton(
            onPressed: () async {
              final data = await session.exportData();
              if (!context.mounted) return;
              await SharePlus.instance.share(ShareParams(text: session.pretty(data)));
            },
            child: const Text('Download my data'),
          ),
          TextButton(
            onPressed: () async {
              await session.deleteAccount(password.text);
            },
            child: const Text('Delete my account'),
          ),
          TextButton(onPressed: session.logout, child: const Text('Log out')),
          if (message != null) Text(message!),
        ],
      ),
    );
  }
}
