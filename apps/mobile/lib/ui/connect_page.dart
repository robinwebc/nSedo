import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../server_check.dart';
import '../session.dart';
import '../theme.dart';

class ConnectPage extends StatefulWidget {
  const ConnectPage({super.key});

  @override
  State<ConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<ConnectPage> {
  final server = TextEditingController(text: defaultApiUrl);
  var _synced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_synced) return;
    _synced = true;
    server.text = resolveApiUrl(context.read<Session>().apiUrl);
  }

  @override
  void dispose() {
    server.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final waiting = session.link == ServerLink.checking && session.lastError == null;
    final failed = session.lastError != null;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(space3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const NsedoMark(size: 48, withWord: true),
              const SizedBox(height: space4),
              Text(
                failed ? 'Server unavailable' : 'Connecting to server',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: space1),
              Text(
                failed
                    ? session.lastError!
                    : 'The server is waking up. This can take about a minute.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: failed ? Theme.of(context).colorScheme.error : null,
                    ),
              ),
              const SizedBox(height: space3),
              TextField(
                key: const Key('server-address'),
                controller: server,
                enabled: true,
                decoration: const InputDecoration(
                  labelText: 'Server address',
                  floatingLabelBehavior: FloatingLabelBehavior.always,
                ),
                keyboardType: TextInputType.url,
                autocorrect: false,
              ),
              const SizedBox(height: space2),
              if (waiting) const LinearProgressIndicator(minHeight: 2, color: ember),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    await session.setApiUrl(server.text);
                    await session.boot();
                  },
                  child: Text(failed ? 'Try again' : 'Continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
