import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../session.dart';
import '../theme.dart';

class ConnectPage extends StatefulWidget {
  const ConnectPage({super.key});

  @override
  State<ConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<ConnectPage> {
  final server = TextEditingController();

  @override
  void initState() {
    super.initState();
    server.text = context.read<Session>().apiUrl;
  }

  @override
  void dispose() {
    server.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final waiting = session.link == ServerLink.checking;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(space3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const NsedoMark(size: 48, withWord: true),
              const SizedBox(height: space4),
              Text('Connecting to server', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: space1),
              Text(
                'The server is waking up. This can take about a minute.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: space3),
              TextField(
                controller: server,
                enabled: !waiting,
                decoration: const InputDecoration(labelText: 'Server address'),
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: space2),
              if (waiting) const LinearProgressIndicator(minHeight: 2, color: ember),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: waiting
                      ? null
                      : () async {
                          await session.setApiUrl(server.text.trim());
                          await session.boot();
                        },
                  child: Text(waiting ? 'Connecting' : 'Try again'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
