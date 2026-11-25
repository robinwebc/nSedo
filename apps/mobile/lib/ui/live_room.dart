import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../session.dart';
import '../theme.dart';

class LiveRoomPage extends StatefulWidget {
  const LiveRoomPage({
    super.key,
    this.streamId,
    this.title,
    this.hosting = false,
  });

  final String? streamId;
  final String? title;
  final bool hosting;

  @override
  State<LiveRoomPage> createState() => _LiveRoomPageState();
}

class _LiveRoomPageState extends State<LiveRoomPage> {
  final local = RTCVideoRenderer();
  final remote = RTCVideoRenderer();
  final comment = TextEditingController();
  final peers = <String, RTCPeerConnection>{};
  final pendingIce = <String, List<RTCIceCandidate>>{};
  final remoteReady = <String, bool>{};
  final comments = <Map<String, dynamic>>[];
  final waitingViewers = <String>[];
  RTCPeerConnection? viewerPc;
  sio.Socket? socket;
  Session? session;
  List<dynamic> iceServers = const [];
  String? streamId;
  String? hostId;
  String status = 'Connecting';
  int viewers = 0;
  var mediaReady = false;
  var ended = false;
  var closing = false;

  @override
  void initState() {
    super.initState();
    unawaited(start());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    session ??= context.read<Session>();
  }

  Future<void> start() async {
    await local.initialize();
    await remote.initialize();
    final current = session ?? context.read<Session>();
    session = current;
    socket = current.socket;
    streamId = widget.streamId;
    socket?.on('live:viewer-joined', onViewer);
    socket?.on('live:signal', onSignal);
    socket?.on('live:comment', onComment);
    socket?.on('live:viewers', onViewers);
    socket?.on('live:ended', onEnded);
    try {
      final ice = await current.ice();
      iceServers = ice['iceServers'] as List<dynamic>? ?? [];
      if (widget.hosting) {
        final stream = await navigator.mediaDevices.getUserMedia({'audio': true, 'video': true});
        local.srcObject = stream;
        mediaReady = true;
        for (final id in waitingViewers) {
          await connectViewer(id);
        }
        waitingViewers.clear();
        final created = await current.goLive(widget.title?.trim().isNotEmpty == true ? widget.title!.trim() : 'Live');
        streamId = created['id'] as String;
        hostId = current.me?['id'] as String?;
        if (mounted) setState(() => status = 'Live');
      }
      final joined = await ack('live:join', {'streamId': streamId});
      if (joined['ok'] != true) {
        if (mounted) setState(() => status = joined['error']?.toString() ?? 'Unable to join');
        return;
      }
      hostId ??= joined['hostId']?.toString();
      viewers = (joined['viewerCount'] as num?)?.toInt() ?? viewers;
      if (!widget.hosting && mounted) setState(() => status = 'Watching');
    } catch (error) {
      if (mounted) setState(() => status = error.toString());
    }
  }

  Future<Map<String, dynamic>> ack(String event, Map<String, dynamic> data) async {
    final value = await socket?.emitWithAckAsync(event, data).timeout(const Duration(seconds: 20));
    if (value is Map) return Map<String, dynamic>.from(value);
    if (value is List && value.isNotEmpty && value.first is Map) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    return {};
  }

  Future<void> onViewer(dynamic data) async {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['streamId'] != streamId || !widget.hosting) return;
    final viewerId = map['viewerId']?.toString();
    if (viewerId == null) return;
    if (!mediaReady) {
      waitingViewers.add(viewerId);
      return;
    }
    await connectViewer(viewerId);
  }

  Future<void> connectViewer(String viewerId) async {
    if (peers.containsKey(viewerId)) return;
    final pc = await createPeerConnection({'iceServers': iceServers});
    peers[viewerId] = pc;
    final stream = local.srcObject;
    if (stream != null) {
      for (final track in stream.getTracks()) {
        await pc.addTrack(track, stream);
      }
    }
    pc.onIceCandidate = (candidate) {
      socket?.emit('live:signal', {
        'streamId': streamId,
        'toUserId': viewerId,
        'type': 'ice',
        'candidate': candidate.toMap(),
      });
    };
    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit('live:signal', {
      'streamId': streamId,
      'toUserId': viewerId,
      'type': 'offer',
      'sdp': offer.toMap(),
    });
    final queued = pendingIce.remove(viewerId) ?? [];
    for (final candidate in queued) {
      await pc.addCandidate(candidate);
    }
  }

  Future<void> onSignal(dynamic data) async {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['streamId'] != streamId) return;
    final from = map['fromUserId']?.toString();
    if (from == null) return;
    final type = map['type'];
    if (widget.hosting) {
      final pc = peers[from];
      if (pc == null) return;
      if (type == 'answer') {
        await pc.setRemoteDescription(RTCSessionDescription(map['sdp']['sdp'], map['sdp']['type']));
        remoteReady[from] = true;
      } else if (type == 'ice') {
        await addIce(pc, from, map['candidate']);
      }
      return;
    }
    viewerPc ??= await createPeerConnection({'iceServers': iceServers});
    final pc = viewerPc!;
    pc.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        remote.srcObject = event.streams.first;
        if (mounted) setState(() => status = 'Connected');
      }
    };
    pc.onIceCandidate = (candidate) {
      socket?.emit('live:signal', {
        'streamId': streamId,
        'toUserId': from,
        'type': 'ice',
        'candidate': candidate.toMap(),
      });
    };
    if (type == 'offer') {
      await pc.setRemoteDescription(RTCSessionDescription(map['sdp']['sdp'], map['sdp']['type']));
      remoteReady[from] = true;
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('live:signal', {
        'streamId': streamId,
        'toUserId': from,
        'type': 'answer',
        'sdp': answer.toMap(),
      });
      final queued = pendingIce.remove(from) ?? [];
      for (final candidate in queued) {
        await pc.addCandidate(candidate);
      }
    } else if (type == 'ice') {
      await addIce(pc, from, map['candidate']);
    }
  }

  Future<void> addIce(RTCPeerConnection pc, String from, dynamic raw) async {
    if (raw is! Map) return;
    final candidate = RTCIceCandidate(raw['candidate'], raw['sdpMid'], raw['sdpMLineIndex']);
    if (remoteReady[from] != true) {
      pendingIce.putIfAbsent(from, () => []).add(candidate);
      return;
    }
    await pc.addCandidate(candidate);
  }

  void onComment(dynamic data) {
    final map = Map<String, dynamic>.from(data as Map);
    if (!mounted) return;
    setState(() => comments.add(map));
  }

  void onViewers(dynamic data) {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['streamId'] != streamId || !mounted) return;
    setState(() => viewers = (map['count'] as num?)?.toInt() ?? viewers);
  }

  void onEnded(dynamic data) {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['streamId'] != streamId) return;
    ended = true;
    if (mounted) setState(() => status = 'Live ended');
  }

  Future<void> sendComment() async {
    final text = comment.text.trim();
    if (text.isEmpty || streamId == null) return;
    socket?.emit('live:comment', {'streamId': streamId, 'body': text});
    comment.clear();
  }

  Future<void> finish() async {
    if (closing || !widget.hosting || streamId == null || ended) return;
    closing = true;
    ended = true;
    try {
      await session?.api.send('POST', '/live/$streamId/end');
    } catch (_) {}
  }

  @override
  void dispose() {
    unawaited(finish());
    socket?.off('live:viewer-joined');
    socket?.off('live:signal');
    socket?.off('live:comment');
    socket?.off('live:viewers');
    socket?.off('live:ended');
    local.srcObject?.getTracks().forEach((track) => track.stop());
    local.dispose();
    remote.dispose();
    for (final pc in peers.values) {
      pc.close();
    }
    viewerPc?.close();
    comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final renderer = widget.hosting ? local : remote;
    return Scaffold(
      backgroundColor: ink,
      appBar: AppBar(
        backgroundColor: ink,
        foregroundColor: mist,
        title: Text(widget.hosting ? 'You are live' : (widget.title ?? 'Live')),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Text('$viewers watching', style: const TextStyle(color: mist, fontSize: 13)),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                RTCVideoView(renderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
                Positioned(
                  left: 16,
                  top: 16,
                  child: Text(status, style: const TextStyle(color: Colors.white)),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 120,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                for (final item in comments)
                  Text(
                    '@${(item['user'] as Map?)?['username'] ?? ''}  ${item['body']}',
                    style: const TextStyle(color: mist, fontSize: 14),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 8, 16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: comment,
                    style: const TextStyle(color: mist),
                    decoration: const InputDecoration(hintText: 'Say something'),
                  ),
                ),
                IconButton(onPressed: sendComment, icon: const Icon(Icons.send, color: cobaltBright)),
                if (widget.hosting)
                  TextButton(
                    onPressed: () async {
                      final navigator = Navigator.of(context);
                      await finish();
                      if (mounted) navigator.pop();
                    },
                    child: const Text('End'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
