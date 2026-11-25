import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import 'call_page.dart';
import 'edit_profile_page.dart';
import 'live_room.dart';
import 'widgets.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, this.username});

  final String? username;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? profile;
  Map<String, dynamic>? live;
  String? error;
  var loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final session = context.read<Session>();
    final name = widget.username ?? session.me?['username'] as String?;
    if (name == null) return;
    setState(() => loading = true);
    try {
      final data = name == session.me?['username']
          ? Map<String, dynamic>.from(await session.api.send('GET', '/users/me') as Map)
          : await session.profile(name);
      final streams = await session.lives();
      Map<String, dynamic>? current;
      for (final row in streams) {
        final host = Map<String, dynamic>.from(row['host'] as Map);
        if (host['username'] == data['username']) current = Map<String, dynamic>.from(row as Map);
      }
      if (!mounted) return;
      setState(() {
        profile = data;
        live = current;
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
    final data = profile;
    final mine = widget.username == null || widget.username == context.watch<Session>().me?['username'];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          if (mine)
            IconButton(
              tooltip: 'Settings',
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsPage())),
              icon: const Icon(Icons.settings_outlined),
            ),
        ],
      ),
      body: loading
          ? const FeedSkeleton()
          : data == null
              ? ErrorView(message: error ?? 'Profile unavailable', onRetry: load)
              : ListView(
                  children: [
                    if ((data['coverUrl']?.toString() ?? '').isNotEmpty)
                      Image.network(data['coverUrl'].toString(), height: 120, width: double.infinity, fit: BoxFit.cover)
                    else
                      Container(height: 96, color: ink),
                    Transform.translate(
                      offset: const Offset(space2, -28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          UserAvatar(user: data, radius: 32),
                          const SizedBox(height: space1),
                          Text(
                            '${data['displayName'] ?? ''}',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          Text('@${data['username']}  ${data['userId'] ?? ''}', style: Theme.of(context).textTheme.bodySmall),
                          const SizedBox(height: space1),
                          Text((data['bio']?.toString().isNotEmpty ?? false) ? data['bio'].toString() : 'No bio'),
                          if ((data['location']?.toString() ?? '').isNotEmpty)
                            Text(data['location'].toString(), style: Theme.of(context).textTheme.bodySmall),
                          if ((data['website']?.toString() ?? '').isNotEmpty)
                            Text(data['website'].toString(), style: Theme.of(context).textTheme.bodySmall),
                          if (live != null)
                            Padding(
                              padding: const EdgeInsets.only(top: space1),
                              child: FilledButton(
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => LiveRoomPage(
                                      streamId: live!['id'] as String,
                                      title: live!['title'].toString(),
                                    ),
                                  ),
                                ),
                                child: const Text('Watch live'),
                              ),
                            ),
                          const SizedBox(height: 4),
                          Text(
                            '${data['privacy'] == 'PRIVATE' ? 'Private' : 'Public'} account',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (data['followerCount'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: space1),
                              child: Text('${data['followerCount']} followers   ${data['followingCount']} following'),
                            ),
                        ],
                      ),
                    ),
                    if (!mine)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: space2),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            FilledButton(
                              onPressed: () => context.read<Session>().follow(widget.username!).then((_) => load()),
                              child: const Text('Follow'),
                            ),
                            OutlinedButton(
                              onPressed: () => context.read<Session>().friendRequest(widget.username!),
                              child: const Text('Add friend'),
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
                                  'reason': 'Reported from profile',
                                },
                              ),
                              child: const Text('Report'),
                            ),
                          ],
                        ),
                      ),
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
  final server = TextEditingController();
  final username = TextEditingController();
  final password = TextEditingController();
  final nextPassword = TextEditingController();
  String? message;
  bool privateAccount = false;

  @override
  void initState() {
    super.initState();
    final me = context.read<Session>().me;
    server.text = context.read<Session>().apiUrl;
    privateAccount = me?['privacy'] == 'PRIVATE';
  }

  @override
  Widget build(BuildContext context) {
    final session = context.read<Session>();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const _Heading('Account'),
          ListTile(
            title: const Text('Edit profile'),
            subtitle: const Text('Name, photo, bio, location'),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EditProfilePage())),
          ),
          SwitchListTile(
            value: privateAccount,
            title: const Text('Private account'),
            subtitle: const Text('Only approved followers can see posts'),
            onChanged: (value) => setState(() => privateAccount = value),
          ),
          ListTile(
            title: const Text('Save profile'),
            onTap: () async {
              await session.updateMe({
                'privacy': privateAccount ? 'PRIVATE' : 'PUBLIC',
              });
              setState(() => message = 'Profile saved');
            },
          ),
          const _Heading('Username'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: space2),
            child: TextField(controller: username, decoration: const InputDecoration(labelText: 'New username')),
          ),
          ListTile(
            title: const Text('Change username'),
            subtitle: const Text('Once every 30 days'),
            onTap: () async {
              try {
                await session.changeUsername(username.text.trim());
                setState(() => message = 'Username updated');
              } catch (err) {
                setState(() => message = explainError(err));
              }
            },
          ),
          const _Heading('Password'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: space2),
            child: Column(
              children: [
                TextField(controller: nextPassword, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
                const SizedBox(height: space2),
                TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
              ],
            ),
          ),
          ListTile(
            title: const Text('Save password'),
            onTap: () async {
              await session.setPassword(nextPassword.text, current: password.text);
              setState(() => message = 'Password saved');
            },
          ),
          const _Heading('Server'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: space2),
            child: TextField(controller: server, decoration: const InputDecoration(labelText: 'Server address')),
          ),
          ListTile(
            title: const Text('Save server'),
            onTap: () async {
              await session.setApiUrl(server.text);
              setState(() => message = 'Server saved');
            },
          ),
          const _Heading('Data'),
          ListTile(
            title: const Text('Download my data'),
            onTap: () async {
              final data = await session.exportData();
              if (!context.mounted) return;
              await SharePlus.instance.share(ShareParams(text: session.pretty(data)));
            },
          ),
          ListTile(
            title: const Text('Delete account'),
            onTap: () => session.deleteAccount(password.text),
          ),
          ListTile(title: const Text('Log out'), onTap: session.logout),
          if (message != null)
            Padding(
              padding: const EdgeInsets.all(space2),
              child: Text(message!),
            ),
        ],
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(space2, space3, space2, space1),
      child: Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: brandAccent(context))),
    );
  }
}
