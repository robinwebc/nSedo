import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'session.dart';
import 'theme.dart';
import 'ui/auth_page.dart';
import 'ui/connect_page.dart';
import 'ui/shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NsedoApp());
}

class NsedoApp extends StatefulWidget {
  const NsedoApp({super.key});

  @override
  State<NsedoApp> createState() => _NsedoAppState();
}

class _NsedoAppState extends State<NsedoApp> {
  final session = Session();

  @override
  void initState() {
    super.initState();
    session.boot();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: session,
      child: MaterialApp(
        title: 'nSedo',
        theme: nsedoTheme(Brightness.light),
        darkTheme: nsedoTheme(Brightness.dark),
        home: const _Gate(),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (!session.ready || session.link != ServerLink.online) {
      return const ConnectPage();
    }
    if (!session.signedIn) return const AuthPage();
    return const Shell();
  }
}
