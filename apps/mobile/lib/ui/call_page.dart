import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../session.dart';
import '../theme.dart';

class CallPage extends StatefulWidget {
  const CallPage({
    super.key,
    required this.peerName,
    required this.type,
    required this.outgoing,
    this.callId,
    this.peerId,
  });

  final String peerName;
  final String type;
  final bool outgoing;
  final String? callId;
  final String? peerId;

  @override
  State<CallPage> createState() => _CallPageState();
}

class _CallPageState extends State<CallPage> {
  final local = RTCVideoRenderer();
  final remote = RTCVideoRenderer();
  RTCPeerConnection? pc;
  String status = 'Connecting';
  String? callId;
  String? peerId;
  sio.Socket? socket;

  @override
  void initState() {
    super.initState();
    unawaited(start());
  }

  Future<void> start() async {
    await local.initialize();
    await remote.initialize();
    final session = context.read<Session>();
    socket = session.socket;
    try {
      final ice = await session.ice();
      if (widget.outgoing) {
        final created = await session.startCall(widget.peerName, widget.type);
        callId = created['id'] as String;
        peerId = (created['peer'] as Map)['id'] as String;
      } else {
        callId = widget.callId;
        peerId = widget.peerId;
      }
      pc = await createPeerConnection({'iceServers': ice['iceServers']});
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': widget.type == 'VIDEO',
      });
      local.srcObject = stream;
      for (final track in stream.getTracks()) {
        await pc!.addTrack(track, stream);
      }
      pc!.onTrack = (event) {
        if (event.streams.isNotEmpty) {
          remote.srcObject = event.streams.first;
          if (mounted) setState(() => status = 'Connected');
        }
      };
      pc!.onIceCandidate = (candidate) {
        socket?.emit('call:signal', {
          'callId': callId,
          'toUserId': peerId,
          'type': 'ice',
          'candidate': candidate.toMap(),
        });
      };
      socket?.on('call:signal', _onSignal);
      if (widget.outgoing) {
        final offer = await pc!.createOffer();
        await pc!.setLocalDescription(offer);
        socket?.emit('call:signal', {
          'callId': callId,
          'toUserId': peerId,
          'type': 'offer',
          'sdp': offer.toMap(),
        });
        setState(() => status = 'Ringing @${widget.peerName}');
      } else {
        setState(() => status = 'Waiting for offer');
      }
    } catch (error) {
      if (mounted) setState(() => status = error.toString());
    }
  }

  Future<void> _onSignal(dynamic data) async {
    final map = Map<String, dynamic>.from(data as Map);
    if (map['callId'] != callId || pc == null) return;
    final type = map['type'];
    if (type == 'offer') {
      await pc!.setRemoteDescription(RTCSessionDescription(map['sdp']['sdp'], map['sdp']['type']));
      final answer = await pc!.createAnswer();
      await pc!.setLocalDescription(answer);
      socket?.emit('call:signal', {
        'callId': callId,
        'toUserId': map['fromUserId'],
        'type': 'answer',
        'sdp': answer.toMap(),
      });
      if (mounted) setState(() => status = 'Answering');
    } else if (type == 'answer') {
      await pc!.setRemoteDescription(RTCSessionDescription(map['sdp']['sdp'], map['sdp']['type']));
    } else if (type == 'ice' && map['candidate'] != null) {
      final candidate = map['candidate'] as Map;
      await pc!.addCandidate(
        RTCIceCandidate(candidate['candidate'], candidate['sdpMid'], candidate['sdpMLineIndex']),
      );
    } else if (type == 'hangup') {
      if (mounted) setState(() => status = 'Call ended');
    }
  }

  @override
  void dispose() {
    socket?.emit('call:signal', {
      'callId': callId,
      'toUserId': peerId,
      'type': 'hangup',
    });
    socket?.off('call:signal');
    local.srcObject?.getTracks().forEach((track) => track.stop());
    local.dispose();
    remote.dispose();
    pc?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.type == 'VIDEO' ? 'Video call' : 'Audio call';
    return Scaffold(
      backgroundColor: ink,
      appBar: AppBar(
        backgroundColor: ink,
        foregroundColor: mist,
        title: Text(label),
      ),
      body: Column(
        children: [
          const SizedBox(height: 24),
          Text(
            status,
            style: const TextStyle(color: mist, fontSize: 16),
          ),
          Text(
            '@${widget.peerName}',
            style: const TextStyle(color: Color(0xFFB7C0C7), fontSize: 13),
          ),
          const SizedBox(height: 16),
          if (widget.type == 'VIDEO') ...[
            Expanded(child: RTCVideoView(remote)),
            SizedBox(height: 140, child: RTCVideoView(local, mirror: true)),
          ] else
            const Spacer(),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).maybePop(),
                child: const Text('Hang up'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
