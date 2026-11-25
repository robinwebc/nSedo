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
  var codeSent = false;

  @override
  void initState() {
    super.initState();
    server.text = context.read<Session>().apiUrl;
  }

  @override
  void dispose() {
    identifier.dispose();
    password.dispose();
    username.dispose();
    displayName.dispose();
    email.dispose();
    phone.dispose();
    code.dispose();
    server.dispose();
    super.dispose();
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
        availability = result['available'] == true ? 'Available' : (result['reason']?.toString() ?? 'Taken');
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
      } else if (!codeSent || code.text.trim().isEmpty) {
        await session.requestOtp(mode == 'email' ? 'EMAIL' : 'SMS', identifier.text.trim());
        if (mounted) setState(() => codeSent = true);
      } else {
        await session.verifyOtp(
          channel: mode == 'email' ? 'EMAIL' : 'SMS',
          target: identifier.text.trim(),
          code: code.text.trim(),
          username: username.text.trim(),
          displayName: displayName.text.trim(),
        );
      }
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
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
        throw ApiException(400, 'Google did not return an ID token.');
      }
      if (!mounted) return;
      await context.read<Session>().google(idToken);
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.62);
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(space3, space4, space3, space3),
          children: [
            const NsedoMark(size: 48, withWord: true),
            const SizedBox(height: space1),
            Text('পোস্ট, বার্তা, লাইভ', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: mutedColor)),
            const SizedBox(height: space3),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'password', label: Text('Sign in')),
                ButtonSegment(value: 'register', label: Text('Create')),
              ],
              selected: {mode == 'register' ? 'register' : 'password'},
              onSelectionChanged: (value) => setState(() {
                mode = value.first;
                error = null;
              }),
            ),
            const SizedBox(height: space2),
            Wrap(
              spacing: 8,
              children: [
                if (mode != 'register')
                  ChoiceChip(
                    label: const Text('Password'),
                    selected: mode == 'password',
                    onSelected: (_) => setState(() => mode = 'password'),
                  ),
                ChoiceChip(
                  label: const Text('Email code'),
                  selected: mode == 'email',
                  onSelected: (_) => setState(() {
                    mode = 'email';
                    codeSent = false;
                  }),
                ),
                ChoiceChip(
                  label: const Text('Phone code'),
                  selected: mode == 'phone',
                  onSelected: (_) => setState(() {
                    mode = 'phone';
                    codeSent = false;
                  }),
                ),
              ],
            ),
            const SizedBox(height: space2),
            if (mode == 'password' || mode == 'email' || mode == 'phone')
              TextField(
                controller: identifier,
                decoration: InputDecoration(
                  labelText: mode == 'phone' ? 'Phone' : mode == 'email' ? 'Email' : 'Email, phone, or username',
                ),
              ),
            if (mode == 'register' || mode == 'email' || mode == 'phone') ...[
              const SizedBox(height: space2),
              TextField(
                controller: username,
                decoration: InputDecoration(labelText: 'Username', helperText: availability),
                onChanged: checkUsername,
              ),
              const SizedBox(height: space2),
              TextField(controller: displayName, decoration: const InputDecoration(labelText: 'Display name')),
            ],
            if (mode == 'register') ...[
              const SizedBox(height: space2),
              TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: space2),
              TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            ],
            if (mode == 'password' || mode == 'register') ...[
              const SizedBox(height: space2),
              TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
            ],
            if ((mode == 'email' || mode == 'phone') && codeSent) ...[
              const SizedBox(height: space2),
              TextField(controller: code, decoration: const InputDecoration(labelText: 'Code')),
            ],
            if (error != null) ...[
              const SizedBox(height: space2),
              Text(error!, style: const TextStyle(color: Color(0xFFB42318), fontSize: 13)),
            ],
            const SizedBox(height: space3),
            FilledButton(
              onPressed: busy ? null : submit,
              child: Text(busy ? 'Please wait' : mode == 'register' ? 'Create account' : codeSent ? 'Continue' : mode == 'password' ? 'Sign in' : 'Send code'),
            ),
            const SizedBox(height: space1),
            OutlinedButton(onPressed: busy ? null : google, child: const Text('Continue with Google')),
            const SizedBox(height: space3),
            TextField(
              controller: server,
              decoration: const InputDecoration(labelText: 'Server address'),
              keyboardType: TextInputType.url,
            ),
          ],
        ),
      ),
    );
  }
}
