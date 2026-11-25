import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import '../upload.dart';
import 'widgets.dart';

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({super.key, this.onboarding = false});

  final bool onboarding;

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  late final displayName = TextEditingController();
  late final username = TextEditingController();
  late final bio = TextEditingController();
  late final location = TextEditingController();
  late final website = TextEditingController();
  DateTime? birthday;
  String? avatarUrl;
  String? coverUrl;
  String? avatarKey;
  String? coverKey;
  String? availability;
  String? error;
  double? progress;
  var saving = false;

  @override
  void initState() {
    super.initState();
    final me = context.read<Session>().me ?? {};
    displayName.text = me['displayName']?.toString() ?? '';
    username.text = me['username']?.toString() ?? '';
    bio.text = me['bio']?.toString() ?? '';
    location.text = me['location']?.toString() ?? '';
    website.text = me['website']?.toString() ?? '';
    avatarUrl = me['avatarUrl']?.toString();
    coverUrl = me['coverUrl']?.toString();
    final rawBirthday = me['birthday']?.toString();
    birthday = rawBirthday == null ? null : DateTime.tryParse(rawBirthday);
  }

  Future<void> checkName(String value) async {
    if (value.trim() == context.read<Session>().me?['username']) {
      setState(() => availability = null);
      return;
    }
    if (value.trim().length < 3) return;
    final result = await context.read<Session>().usernameAvailable(value.trim());
    if (!mounted) return;
    setState(() {
      availability = result['available'] == true ? 'Available' : result['reason']?.toString();
    });
  }

  Future<void> pick(bool avatar) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;
    final file = await chooseImage(source);
    if (file == null || !mounted) return;
    final cropped = await cropImageFile(file.path, square: avatar);
    if (cropped == null || !mounted) return;
    setState(() => progress = 0);
    try {
      final bytes = await compressImage(cropped);
      final upload = MediaUpload(context.read<Session>().api);
      final saved = await upload.sendBytes(
        bytes: bytes,
        filename: avatar ? 'avatar.jpg' : 'cover.jpg',
        mime: 'image/jpeg',
        scope: avatar ? 'avatar' : 'cover',
        onProgress: (value) {
          if (mounted) setState(() => progress = value);
        },
      );
      if (!mounted) return;
      setState(() {
        progress = null;
        if (avatar) {
          avatarKey = saved['key']?.toString();
          avatarUrl = saved['url']?.toString();
        } else {
          coverKey = saved['key']?.toString();
          coverUrl = saved['url']?.toString();
        }
      });
    } catch (err) {
      if (mounted) {
        setState(() {
          progress = null;
          error = explainError(err);
        });
      }
    }
  }

  Future<void> save() async {
    setState(() {
      saving = true;
      error = null;
    });
    final session = context.read<Session>();
    try {
      if (username.text.trim() != session.me?['username']) {
        await session.changeUsername(username.text.trim());
      }
      await session.updateMe({
        'displayName': displayName.text.trim(),
        'bio': bio.text.trim(),
        'location': location.text.trim(),
        'website': website.text.trim(),
        'birthday': birthday == null ? null : birthday!.toIso8601String(),
        'avatarUrl': avatarKey ?? avatarUrl,
        'coverUrl': coverKey ?? coverUrl,
        'onboarded': true,
      });
      if (!mounted) return;
      if (widget.onboarding) {
        Navigator.of(context).pop();
      } else {
        Navigator.of(context).maybePop();
      }
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.onboarding ? 'Set up your profile' : 'Edit profile')),
      body: ListView(
        padding: const EdgeInsets.all(space2),
        children: [
          GestureDetector(
            onTap: () => pick(false),
            child: Container(
              height: 120,
              color: ink,
              alignment: Alignment.center,
              child: coverUrl == null
                  ? const Text('Add cover photo', style: TextStyle(color: mist))
                  : Image.network(coverUrl!, height: 120, width: double.infinity, fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: space2),
          Row(
            children: [
              UserAvatar(user: {'displayName': displayName.text, 'avatarUrl': avatarUrl}, radius: 28),
              const SizedBox(width: space2),
              OutlinedButton(onPressed: () => pick(true), child: const Text('Profile photo')),
            ],
          ),
          if (progress != null) ...[
            const SizedBox(height: space1),
            LinearProgressIndicator(value: progress == 0 ? null : progress, color: brandAccent(context)),
          ],
          const SizedBox(height: space2),
          TextField(controller: displayName, decoration: const InputDecoration(labelText: 'Display name')),
          const SizedBox(height: space2),
          TextField(
            controller: username,
            decoration: InputDecoration(labelText: 'Username', helperText: availability),
            onChanged: checkName,
          ),
          const SizedBox(height: space2),
          TextField(controller: bio, maxLength: 160, decoration: const InputDecoration(labelText: 'Bio')),
          const SizedBox(height: space2),
          TextField(controller: location, decoration: const InputDecoration(labelText: 'Location')),
          const SizedBox(height: space2),
          TextField(controller: website, decoration: const InputDecoration(labelText: 'Website')),
          const SizedBox(height: space2),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Birthday'),
            subtitle: Text(birthday == null ? 'Optional' : '${birthday!.year}-${birthday!.month}-${birthday!.day}'),
            trailing: const Icon(Icons.calendar_today_outlined),
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: birthday ?? DateTime(2000),
                firstDate: DateTime(1900),
                lastDate: DateTime.now(),
              );
              if (picked != null) setState(() => birthday = picked);
            },
          ),
          if (error != null) Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: space2),
          FilledButton(onPressed: saving ? null : save, child: Text(saving ? 'Saving' : 'Save')),
        ],
      ),
    );
  }
}
