import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import 'api.dart';

const defaultApiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://nsedo-api.onrender.com',
);

enum ServerLink { checking, online, offline }
const googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

class Session extends ChangeNotifier {
  Session() {
    api = ApiClient(defaultApiUrl);
  }

  final _secure = const FlutterSecureStorage();
  late ApiClient api;
  String apiUrl = defaultApiUrl;
  String? accessToken;
  String? refreshToken;
  Map<String, dynamic>? me;
  sio.Socket? socket;
  Map<String, dynamic>? incomingCall;
  bool ready = false;
  ServerLink link = ServerLink.checking;

  bool get signedIn => accessToken != null && me != null;

  Future<void> boot() async {
    link = ServerLink.checking;
    ready = false;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    apiUrl = prefs.getString('apiUrl') ?? defaultApiUrl;
    api = ApiClient(apiUrl);
    final online = await api.ping();
    if (!online) {
      link = ServerLink.offline;
      ready = true;
      notifyListeners();
      return;
    }
    link = ServerLink.online;
    accessToken = await _secure.read(key: 'accessToken');
    refreshToken = await _secure.read(key: 'refreshToken');
    api.token = accessToken;
    if (accessToken != null) {
      try {
        me = await _map('/users/me');
        _connectSocket();
      } catch (_) {
        await logout(silent: true);
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> setApiUrl(String value) async {
    apiUrl = value.trim().replaceAll(RegExp(r'/+$'), '');
    api.baseUrl = apiUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('apiUrl', apiUrl);
    notifyListeners();
  }

  Future<void> _persist() async {
    api.token = accessToken;
    if (accessToken != null) {
      await _secure.write(key: 'accessToken', value: accessToken);
    }
    if (refreshToken != null) {
      await _secure.write(key: 'refreshToken', value: refreshToken);
    }
  }

  void _takeSession(dynamic data) {
    final map = Map<String, dynamic>.from(data as Map);
    accessToken = map['accessToken'] as String;
    refreshToken = map['refreshToken'] as String;
  }

  Future<Map<String, dynamic>> _map(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
    try {
      final data = await api.send(method, path, body: body);
      return Map<String, dynamic>.from(data as Map);
    } on ApiException catch (error) {
      if (error.status == 401 && refreshToken != null) {
        await _refresh();
        final data = await api.send(method, path, body: body);
        return Map<String, dynamic>.from(data as Map);
      }
      rethrow;
    }
  }

  Future<List<dynamic>> _list(String path) async {
    try {
      final data = await api.send('GET', path);
      return data as List<dynamic>;
    } on ApiException catch (error) {
      if (error.status == 401 && refreshToken != null) {
        await _refresh();
        return await api.send('GET', path) as List<dynamic>;
      }
      rethrow;
    }
  }

  Future<void> _refresh() async {
    final data = await api.send(
      'POST',
      '/auth/refresh',
      body: {'refreshToken': refreshToken},
      auth: false,
    );
    _takeSession(data);
    await _persist();
  }

  Future<void> register(Map<String, dynamic> body) async {
    await api.send('POST', '/auth/register', body: body, auth: false);
    await login(body['username'] as String, body['password'] as String);
  }

  Future<void> login(String identifier, String password) async {
    final data = await api.send(
      'POST',
      '/auth/login',
      body: {'identifier': identifier, 'password': password},
      auth: false,
    );
    _takeSession(data);
    await _persist();
    me = await _map('/users/me');
    _connectSocket();
    notifyListeners();
  }

  Future<void> requestOtp(String channel, String target) async {
    await api.send(
      'POST',
      '/auth/otp/request',
      body: {'channel': channel, 'target': target, 'purpose': 'LOGIN'},
      auth: false,
    );
  }

  Future<void> verifyOtp({
    required String channel,
    required String target,
    required String code,
    String? username,
    String? displayName,
  }) async {
    final data = await api.send(
      'POST',
      '/auth/otp/verify',
      auth: false,
      body: {
        'channel': channel,
        'target': target,
        'purpose': 'LOGIN',
        'code': code,
        if (username != null && username.isNotEmpty) 'username': username,
        if (displayName != null && displayName.isNotEmpty) 'displayName': displayName,
      },
    );
    _takeSession(data);
    await _persist();
    me = await _map('/users/me');
    _connectSocket();
    notifyListeners();
  }

  Future<void> google(String idToken) async {
    final data = await api.send(
      'POST',
      '/auth/google',
      auth: false,
      body: {'idToken': idToken},
    );
    _takeSession(data);
    await _persist();
    me = await _map('/users/me');
    _connectSocket();
    notifyListeners();
  }

  Future<void> logout({bool silent = false}) async {
    final refresh = refreshToken;
    accessToken = null;
    refreshToken = null;
    me = null;
    api.token = null;
    socket?.dispose();
    socket = null;
    await _secure.deleteAll();
    if (!silent && refresh != null) {
      try {
        await api.send('POST', '/auth/logout', body: {'refreshToken': refresh}, auth: false);
      } catch (_) {}
    }
    if (!silent) notifyListeners();
  }

  void _connectSocket() {
    socket?.dispose();
    socket = sio.io(
      apiUrl,
      sio.OptionBuilder()
          .setTransports(['websocket'])
          .enableForceNew()
          .setAuth({'token': accessToken})
          .build(),
    );
    socket!.on('call:invite', (data) {
      incomingCall = Map<String, dynamic>.from(data as Map);
      notifyListeners();
    });
  }

  void clearIncoming() {
    incomingCall = null;
    notifyListeners();
  }

  Future<List<dynamic>> feed() => _list('/posts/feed');
  Future<List<dynamic>> explore() => _list('/posts/explore');
  Future<List<dynamic>> notifications() async {
    final data = await _map('/notifications');
    return data['items'] as List<dynamic>;
  }

  Future<Map<String, dynamic>> createPost(String body, {String? mediaUrl}) =>
      _map('/posts', method: 'POST', body: {
        if (body.isNotEmpty) 'body': body,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
      });

  Future<void> like(String id) => _map('/posts/$id/like', method: 'POST');
  Future<void> comment(String id, String body) =>
      _map('/posts/$id/comments', method: 'POST', body: {'body': body});
  Future<void> repost(String id, {String? quote}) =>
      _map('/posts/$id/repost', method: 'POST', body: {if (quote != null && quote.isNotEmpty) 'quote': quote});
  Future<void> follow(String username) => _map('/follows/$username', method: 'POST');
  Future<void> friendRequest(String username) =>
      _map('/friends/requests', method: 'POST', body: {'username': username});
  Future<Map<String, dynamic>> search(String q) async {
    final data = await api.send('GET', '/search', query: {'q': q});
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> openChat(String username) =>
      _map('/conversations', method: 'POST', body: {'username': username});
  Future<List<dynamic>> conversations() => _list('/conversations');
  Future<List<dynamic>> messages(String id) => _list('/conversations/$id/messages');
  Future<Map<String, dynamic>> sendMessage(String id, String body) =>
      _map('/conversations/$id/messages', method: 'POST', body: {'body': body});
  Future<List<dynamic>> lives() => _list('/live');
  Future<Map<String, dynamic>> goLive(String title) =>
      _map('/live', method: 'POST', body: {'title': title});
  Future<Map<String, dynamic>> profile(String username) => _map('/users/$username');
  Future<Map<String, dynamic>> updateMe(Map<String, dynamic> body) async {
    me = await _map('/users/me', method: 'PATCH', body: body);
    notifyListeners();
    return me!;
  }

  Future<Map<String, dynamic>> usernameAvailable(String username) => api
      .send('GET', '/users/username-available', query: {'username': username}, auth: false)
      .then((data) => Map<String, dynamic>.from(data as Map));

  Future<void> changeUsername(String username) async {
    me = await _map('/users/me/username', method: 'PATCH', body: {'username': username});
    notifyListeners();
  }

  Future<String> upload(File file) {
    return api.uploadImage('/media/upload', file.readAsBytesSync(), file.uri.pathSegments.last);
  }

  Future<Map<String, dynamic>> exportData() => _map('/users/me/export');

  Future<void> deleteAccount(String password) async {
    await api.send('DELETE', '/users/me', body: {
      'confirmation': 'DELETE',
      if (password.isNotEmpty) 'password': password,
    });
    await logout();
  }

  Future<Map<String, dynamic>> startCall(String username, String type) =>
      _map('/calls', method: 'POST', body: {'username': username, 'type': type});

  Future<Map<String, dynamic>> ice() => _map('/calls/ice');

  Future<void> setPassword(String next, {String? current}) =>
      _map('/auth/password', method: 'POST', body: {
        'newPassword': next,
        if (current != null && current.isNotEmpty) 'currentPassword': current,
      });

  String pretty(Object? value) {
    try {
      return const JsonEncoder.withIndent('  ').convert(value);
    } catch (_) {
      return '$value';
    }
  }
}
