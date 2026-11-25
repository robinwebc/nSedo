import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';
import 'package:video_player/video_player.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../theme.dart';

List<Map<String, dynamic>> mediaItems(Map<String, dynamic> post) {
  final raw = post['media'];
  if (raw is List && raw.isNotEmpty) {
    return [for (final item in raw) Map<String, dynamic>.from(item as Map)];
  }
  final url = post['mediaUrl']?.toString();
  if (url == null || url.isEmpty) return const [];
  final lower = url.toLowerCase();
  final video = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
  return [
    {'url': url, 'kind': video ? 'VIDEO' : 'IMAGE'},
  ];
}

String formatDuration(int milliseconds) {
  final total = (milliseconds / 1000).round();
  final minutes = total ~/ 60;
  final seconds = total % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

class PostMedia extends StatelessWidget {
  const PostMedia({super.key, required this.post});

  final Map<String, dynamic> post;

  @override
  Widget build(BuildContext context) {
    final items = mediaItems(post);
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: space1),
      child: _Grid(
        items: items,
        onOpen: (index) {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => MediaViewerPage(items: items, initial: index)),
          );
        },
      ),
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.items, required this.onOpen});

  final List<Map<String, dynamic>> items;
  final ValueChanged<int> onOpen;

  @override
  Widget build(BuildContext context) {
    if (items.length == 1) {
      return _cell(0, 220);
    }
    if (items.length == 2) {
      return SizedBox(
        height: 180,
        child: Row(
          children: [
            Expanded(child: _cell(0, 180)),
            const SizedBox(width: 4),
            Expanded(child: _cell(1, 180)),
          ],
        ),
      );
    }
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 4,
      crossAxisSpacing: 4,
      childAspectRatio: 1.15,
      children: [for (var i = 0; i < items.length; i++) _cell(i, 140)],
    );
  }

  Widget _cell(int index, double height) {
    final item = items[index];
    final video = item['kind'] == 'VIDEO';
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        height: items.length == 1 || items.length == 2 ? height : null,
        width: double.infinity,
        child: video
            ? InlineVideo(url: item['url'].toString(), durationMs: item['durationMs'] as int?)
            : _Still(item: item, onTap: () => onOpen(index)),
      ),
    );
  }
}

class _Still extends StatelessWidget {
  const _Still({required this.item, required this.onTap});

  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = item['url']?.toString() ?? '';
    final hash = item['blurhash']?.toString();
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (hash != null && hash.isNotEmpty) BlurHash(hash: hash),
          Image.network(
            url,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => const ColoredBox(color: Color(0xFF2C3842)),
          ),
        ],
      ),
    );
  }
}

class InlineVideo extends StatefulWidget {
  const InlineVideo({super.key, required this.url, this.durationMs});

  final String url;
  final int? durationMs;

  @override
  State<InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends State<InlineVideo> {
  VideoPlayerController? controller;
  var ready = false;
  var sound = false;

  @override
  void initState() {
    super.initState();
    final next = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    controller = next;
    next.initialize().then((_) async {
      await next.setLooping(true);
      await next.setVolume(0);
      if (mounted) setState(() => ready = true);
    }).catchError((_) {
      if (mounted) setState(() => ready = false);
    });
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final player = controller;
    return VisibilityDetector(
      key: Key(widget.url),
      onVisibilityChanged: (info) {
        if (!ready || player == null) return;
        if (info.visibleFraction > 0.6) {
          player.play();
        } else {
          player.pause();
        }
      },
      child: GestureDetector(
        onTap: () async {
          if (player == null || !ready) return;
          sound = !sound;
          await player.setVolume(sound ? 1 : 0);
          if (mounted) setState(() {});
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: ink),
            if (ready && player != null) FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: player.value.size.width,
                height: player.value.size.height,
                child: VideoPlayer(player),
              ),
            ),
            Positioned(
              left: 8,
              bottom: 8,
              child: DecoratedBox(
                decoration: BoxDecoration(color: ink.withValues(alpha: 0.72), borderRadius: BorderRadius.circular(6)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  child: Text(
                    widget.durationMs == null ? (sound ? 'Sound on' : 'Tap for sound') : formatDuration(widget.durationMs!),
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MediaViewerPage extends StatefulWidget {
  const MediaViewerPage({super.key, required this.items, this.initial = 0});

  final List<Map<String, dynamic>> items;
  final int initial;

  @override
  State<MediaViewerPage> createState() => _MediaViewerPageState();
}

class _MediaViewerPageState extends State<MediaViewerPage> {
  late final controller = PageController(initialPage: widget.initial);

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ink,
      appBar: AppBar(backgroundColor: ink, foregroundColor: mist),
      body: PageView.builder(
        controller: controller,
        itemCount: widget.items.length,
        itemBuilder: (context, index) {
          final item = widget.items[index];
          if (item['kind'] == 'VIDEO') {
            return InlineVideo(url: item['url'].toString(), durationMs: item['durationMs'] as int?);
          }
          return InteractiveViewer(
            child: Center(child: Image.network(item['url'].toString())),
          );
        },
      ),
    );
  }
}
