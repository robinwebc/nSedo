import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nsedo/api.dart';
import 'package:nsedo/session.dart';
import 'package:nsedo/ui/connect_page.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets('server field is pre-filled and Continue stays enabled', (tester) async {
    final session = Session();
    session.apiUrl = defaultApiUrl;
    session.link = ServerLink.checking;
    session.ready = false;

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: session,
        child: const MaterialApp(home: ConnectPage()),
      ),
    );

    final field = tester.widget<TextField>(find.byKey(const Key('server-address')));
    expect(field.controller!.text, defaultApiUrl);
    expect(field.enabled, isTrue);
    expect(field.decoration?.hintText, isNull);
    expect(find.text('Server address'), findsOneWidget);

    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Continue'));
    expect(button.onPressed, isNotNull);
  });

  testWidgets('a failed check shows the error and an enabled retry button', (tester) async {
    final session = Session();
    session.apiUrl = defaultApiUrl;
    session.link = ServerLink.offline;
    session.ready = true;
    session.lastError = 'Could not reach the server.';

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: session,
        child: const MaterialApp(home: ConnectPage()),
      ),
    );

    expect(find.text('Could not reach the server.'), findsOneWidget);
    final field = tester.widget<TextField>(find.byKey(const Key('server-address')));
    expect(field.controller!.text, defaultApiUrl);
    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Try again'));
    expect(button.onPressed, isNotNull);
  });
}
