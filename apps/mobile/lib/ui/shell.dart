import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../session.dart';
import '../theme.dart';
import 'call_page.dart';
import 'home_page.dart';
import 'live_page.dart';
import 'messages_page.dart';
import 'notes_page.dart';
import 'profile_page.dart';
import 'search_page.dart';

class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  var index = 0;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final pages = const [
      HomePage(),
      SearchPage(),
      LivePage(),
      NotesPage(),
      MessagesPage(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const NsedoMark(withWord: true, size: 28),
        actions: [
          IconButton(
            tooltip: 'Profile',
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfilePage()));
            },
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: Column(
        children: [
          if (session.incomingCall != null)
            MaterialBanner(
              content: Text('Incoming ${'${session.incomingCall!['type']}'.toLowerCase()} call'),
              actions: [
                TextButton(
                  onPressed: () {
                    final call = session.incomingCall!;
                    session.clearIncoming();
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CallPage(
                          callId: call['callId'] as String,
                          peerId: (call['from'] as Map)['id'] as String,
                          peerName: (call['from'] as Map)['username'] as String,
                          type: call['type'] as String,
                          outgoing: false,
                        ),
                      ),
                    );
                  },
                  child: const Text('Answer'),
                ),
                TextButton(onPressed: session.clearIncoming, child: const Text('Dismiss')),
              ],
            ),
          Expanded(child: pages[index]),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: [
          for (final item in [
            (Icons.home_outlined, Icons.home, 'Home'),
            (Icons.search, Icons.search, 'Search'),
            (Icons.sensors, Icons.sensors, 'Live'),
            (Icons.notifications_none, Icons.notifications, 'Alerts'),
            (Icons.chat_bubble_outline, Icons.chat_bubble, 'Messages'),
          ])
            NavigationDestination(
              icon: Icon(item.$1),
              selectedIcon: Icon(item.$2),
              label: item.$3,
            ),
        ],
      ),
    );
  }
}
