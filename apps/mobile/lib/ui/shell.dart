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
    final pages = [
      const HomePage(),
      const SearchPage(),
      const LivePage(),
      const NotesPage(),
      const MessagesPage(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const NsedoMark(withWord: true, size: 28),
        actions: [
          IconButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ProfilePage()),
              );
            },
            icon: const Icon(Icons.person_outline),
            tooltip: 'Profile · প্রোফাইল',
          ),
        ],
      ),
      body: Column(
        children: [
          if (session.incomingCall != null)
            MaterialBanner(
              content: Text('Incoming ${session.incomingCall!['type']} call'),
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
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home · হোম'),
          NavigationDestination(icon: Icon(Icons.search), label: 'Search · খোঁজ'),
          NavigationDestination(icon: Icon(Icons.podcasts_outlined), label: 'Live · লাইভ'),
          NavigationDestination(icon: Icon(Icons.notifications_none), label: 'Alerts · খবর'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Chat · বার্তা'),
        ],
      ),
    );
  }
}
