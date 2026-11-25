import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nsedo/theme.dart';

void main() {
  testWidgets('nSedo mark shows the product name', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: NsedoMark(withWord: true))),
    );
    expect(find.text('nSedo'), findsOneWidget);
    expect(find.textContaining('Twitter'), findsNothing);
  });
}
