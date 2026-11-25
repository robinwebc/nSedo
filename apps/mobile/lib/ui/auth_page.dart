import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  var mode = 'password';
  final identifier = TextEditingController();
  final password = TextEditingController();
  final username = TextEditingController();
  final displayName = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final code = TextEditingController();
  final server = TextEditingController();
  String? availability;
  String? error;
  var busy = false;

  @override
  void initState() {
    super.initState();
    server.text = context.read<Session>().apiUrl;
  }

  Future<void> checkUsername(String value) async {
    if (value.length < 3) {
      setState(() => availability = null);
      return;
    }
    try {
      final result = await context.read<Session>().usernameAvailable(value);
      if (!mounted) return;
      setState(() {
        availability = result['available'] == true
            ? 'Available'
            : (result['reason']?.toString() ?? 'Taken');
      });
    } catch (_) {}
  }

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    final session = context.read<Session>();
    try {
      if (server.text.trim().isNotEmpty) await session.setApiUrl(server.text.trim());
      if (mode == 'register') {
        await session.register({
          'username': username.text.trim(),
          'displayName': displayName.text.trim(),
          'email': email.text.trim(),
          'phone': phone.text.trim(),
          'password': password.text,
        });
      } else if (mode == 'password') {
        await session.login(identifier.text.trim(), password.text);
      } else if (code.text.trim().isEmpty) {
        await session.requestOtp(mode == 'email' ? 'EMAIL' : 'SMS', identifier.text.trim());
        setState(() => error = 'Code sent. In dev it is printed by the API.');
      } else {
        await session.verifyOtp(
          channel: mode == 'email' ? 'EMAIL' : 'SMS',
          target: identifier.text.trim(),
          code: code.text.trim(),
          username: username.text.trim(),
          displayName: displayName.text.trim(),
        );
      }
    } on ApiException catch (err) {
      setState(() => error = err.message);
    } catch (err) {
      setState(() => error = err.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> google() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (server.text.trim().isNotEmpty) {
        await context.read<Session>().setApiUrl(server.text.trim());
      }
      final google = GoogleSignIn.instance;
      await google.initialize(
        serverClientId: googleServerClientId.isEmpty ? null : googleServerClientId,
      );
      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        throw ApiException(400, 'Google did not return an ID token. Set GOOGLE_SERVER_CLIENT_ID.');
      }
      await context.read<Session>().google(idToken);
    } catch (err) {
      setState(() => error = err.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 24),
            const NsedoMark(size: 64, withWord: true),
            const SizedBox(height: 8),
            Text('Say it. বলো।', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              children: [
                for (final item in ['password', 'register', 'email', 'phone'])
                  ChoiceChip(
                    label: Text(item == 'password'
                        ? 'Password'
                        : item == 'register'
                            ? 'Register'
                            : item == 'email'
                                ? 'Email code'
                                : 'Phone OTP'),
                    selected: mode == item,
                    onSelected: (_) => setState(() => mode = item),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: server,
              decoration: const InputDecoration(labelText: 'Server URL'),
            ),
            const SizedBox(height: 12),
            if (mode == 'password' || mode == 'email' || mode == 'phone')
              TextField(
                controller: identifier,
                decoration: InputDecoration(
                  labelText: mode == 'phone'
                      ? 'Phone · ফোন'
                      : mode == 'email'
                          ? 'Email'
                          : 'Email, phone, or username',
                ),
              ),
            if (mode == 'register' || mode == 'email' || mode == 'phone') ...[
              const SizedBox(height: 12),
              TextField(
                controller: username,
                decoration: InputDecoration(
                  labelText: 'Username',
                  helperText: availability,
                ),
                onChanged: checkUsername,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: displayName,
                decoration: const InputDecoration(labelText: 'Display name'),
              ),
            ],
            if (mode == 'register') ...[
              const SizedBox(height: 12),
              TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: 12),
              TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone')),
            ],
            if (mode == 'password' || mode == 'register') ...[
              const SizedBox(height: 12),
              TextField(
                controller: password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password'),
              ),
            ],
            if (mode == 'email' || mode == 'phone') ...[
              const SizedBox(height: 12),
              TextField(controller: code, decoration: const InputDecoration(labelText: 'Code')),
            ],
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, style: const TextStyle(color: ember)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: busy ? null : submit,
              child: Text(busy ? 'Please wait' : 'Continue · চলো'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: busy ? null : google,
              child: const Text('Continue with Google'),
            ),
          ],
        ),
      ),
    );
  }
}
