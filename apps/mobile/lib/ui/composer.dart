import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import '../upload.dart';
import 'media_view.dart';

class Composer extends StatefulWidget {
  const Composer({super.key, required this.onPosted});

  final Future<void> Function() onPosted;

  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  final body = TextEditingController();
  final attachments = <Map<String, dynamic>>[];
  MediaUpload? upload;
  String? draftId;
  String? error;
  double? progress;
  var busy = false;
  var posted = false;
  Session? session;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    session ??= context.read<Session>();
  }

  @override
  void dispose() {
    body.dispose();
    final id = draftId;
    if (id != null && !posted) {
      session?.deletePost(id);
    }
    super.dispose();
  }

  bool get hasVideo => attachments.any((item) => item['kind'] == 'VIDEO');

  Future<String?> ensureDraft() async {
    if (draftId != null) return draftId;
    draftId = await context.read<Session>().draftPost();
    return draftId;
  }

  Future<void> addPhoto(ImageSource source) async {
    if (hasVideo || attachments.length >= 4) {
      setState(() => error = hasVideo ? 'A video post cannot include photos' : 'A post can include up to 4 photos');
      return;
    }
    final file = await chooseImage(source);
    if (file == null || !mounted) return;
    setState(() {
      error = null;
      progress = 0;
      busy = true;
    });
    try {
      final bytes = await compressImage(file.path);
      if (bytes.length > 10 * 1024 * 1024) {
        setState(() => error = 'Images must be 10 MB or smaller');
        return;
      }
      final postId = await ensureDraft();
      if (!mounted || postId == null) return;
      final saved = await send(bytes, 'photo.jpg', 'image/jpeg', postId);
      attachments.add({
        'key': saved['key'],
        'url': saved['url'],
        'mimeType': saved['mimeType'] ?? 'image/jpeg',
        'kind': 'IMAGE',
        'width': saved['width'],
        'height': saved['height'],
        'blurhash': saved['blurhash'],
        'preview': file.path,
      });
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
          progress = null;
        });
      }
    }
  }

  Future<void> addVideo(ImageSource source) async {
    if (attachments.isNotEmpty) {
      setState(() => error = 'A video post cannot include other files');
      return;
    }
    final file = await ImagePicker().pickVideo(source: source, maxDuration: const Duration(seconds: 60));
    if (file == null || !mounted) return;
    final length = await File(file.path).length();
    if (length > 50 * 1024 * 1024) {
      setState(() => error = 'Videos must be 50 MB or smaller');
      return;
    }
    final player = VideoPlayerController.file(File(file.path));
    try {
      await player.initialize();
      final ms = player.value.duration.inMilliseconds;
      final width = player.value.size.width.round();
      final height = player.value.size.height.round();
      if (ms > 60000) {
        setState(() => error = 'Videos must be 60 seconds or shorter');
        return;
      }
      if (!mounted) return;
      setState(() {
        error = null;
        progress = 0;
        busy = true;
      });
      final postId = await ensureDraft();
      if (!mounted || postId == null) return;
      final name = file.name.toLowerCase();
      final mime = name.endsWith('.webm')
          ? 'video/webm'
          : name.endsWith('.mov')
              ? 'video/quicktime'
              : 'video/mp4';
      final bytes = await File(file.path).readAsBytes();
      final saved = await send(bytes, file.name, mime, postId);
      attachments.add({
        'key': saved['key'],
        'url': saved['url'],
        'mimeType': mime,
        'kind': 'VIDEO',
        'width': width,
        'height': height,
        'durationMs': ms,
        'preview': file.path,
      });
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
    } finally {
      await player.dispose();
      if (mounted) {
        setState(() {
          busy = false;
          progress = null;
        });
      }
    }
  }

  Future<Map<String, dynamic>> send(List<int> bytes, String filename, String mime, String postId) {
    final next = MediaUpload(context.read<Session>().api);
    upload = next;
    return next.sendBytes(
      bytes: bytes,
      filename: filename,
      mime: mime,
      scope: 'post',
      postId: postId,
      onProgress: (value) {
        if (mounted) setState(() => progress = value);
      },
    );
  }

  Future<ImageSource?> askSource(String title) {
    return showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text('$title from gallery'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text('$title from camera'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> publish() async {
    final text = body.text.trim();
    if (text.isEmpty && attachments.isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    final session = context.read<Session>();
    try {
      if (attachments.isEmpty) {
        await session.createPost(text);
      } else {
        final id = await ensureDraft();
        if (id == null) return;
        await session.publishPost(
          id,
          text,
          [
            for (final item in attachments)
              {
                'url': item['key'] ?? item['url'],
                'mimeType': item['mimeType'],
                'kind': item['kind'],
                if (item['width'] != null) 'width': item['width'],
                if (item['height'] != null) 'height': item['height'],
                if (item['durationMs'] != null) 'durationMs': item['durationMs'],
                if (item['blurhash'] != null) 'blurhash': item['blurhash'],
              },
          ],
        );
        posted = true;
        draftId = null;
      }
      body.clear();
      attachments.clear();
      await widget.onPosted();
    } catch (err) {
      if (mounted) setState(() => error = explainError(err));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(space2, space2, space2, space1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: body,
            minLines: 2,
            maxLines: 6,
            maxLength: 500,
            decoration: const InputDecoration(hintText: 'Write a post', counterText: ''),
          ),
          if (attachments.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < attachments.length; i++)
                    _Chip(
                      item: attachments[i],
                      onRemove: busy
                          ? null
                          : () => setState(() => attachments.removeAt(i)),
                    ),
                ],
              ),
            ),
          if (progress != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  Expanded(child: LinearProgressIndicator(value: progress == 0 ? null : progress, color: brandAccent(context))),
                  TextButton(
                    onPressed: () => upload?.cancel(),
                    child: const Text('Cancel'),
                  ),
                ],
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              IconButton(
                tooltip: 'Photo',
                onPressed: busy || hasVideo || attachments.length >= 4
                    ? null
                    : () async {
                        final source = await askSource('Photo');
                        if (source != null) await addPhoto(source);
                      },
                icon: const Icon(Icons.image_outlined),
              ),
              IconButton(
                tooltip: 'Video',
                onPressed: busy || attachments.isNotEmpty
                    ? null
                    : () async {
                        final source = await askSource('Video');
                        if (source != null) await addVideo(source);
                      },
                icon: const Icon(Icons.videocam_outlined),
              ),
              const Spacer(),
              FilledButton(onPressed: busy ? null : publish, child: const Text('Post')),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.item, required this.onRemove});

  final Map<String, dynamic> item;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final preview = item['preview']?.toString();
    final video = item['kind'] == 'VIDEO';
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 72,
            height: 72,
            child: video
                ? ColoredBox(
                    color: ink,
                    child: Center(
                      child: Text(
                        formatDuration((item['durationMs'] as int?) ?? 0),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                  )
                : preview == null
                    ? const ColoredBox(color: Color(0xFF2C3842))
                    : Image.file(File(preview), fit: BoxFit.cover),
          ),
        ),
        Positioned(
          right: 0,
          top: 0,
          child: IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: onRemove,
            icon: const Icon(Icons.close, size: 16, color: Colors.white),
          ),
        ),
      ],
    );
  }
}
