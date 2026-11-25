import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this.baseUrl, {this.token});

  String baseUrl;
  String? token;

  Uri _uri(String path, [Map<String, String>? query]) {
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$root$path').replace(queryParameters: query);
  }

  Future<dynamic> send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = true,
  }) async {
    final response = http.Request(method, _uri(path, query))
      ..headers['content-type'] = 'application/json'
      ..headers['accept'] = 'application/json';
    if (auth && token != null) {
      response.headers['authorization'] = 'Bearer $token';
    }
    if (body != null) response.body = jsonEncode(body);
    final streamed = await response.send();
    final text = await streamed.stream.bytesToString();
    dynamic decoded;
    if (text.isNotEmpty) {
      try {
        decoded = jsonDecode(text);
      } catch (_) {
        decoded = text;
      }
    }
    if (streamed.statusCode >= 400) {
      final raw = decoded is Map ? decoded['message'] : null;
      final message = raw is List ? raw.join(', ') : (raw?.toString() ?? 'Request failed');
      throw ApiException(streamed.statusCode, message);
    }
    return decoded;
  }

  Future<String> uploadImage(String path, List<int> bytes, String filename) async {
    final request = http.MultipartRequest('POST', _uri('/media/upload'));
    if (token != null) request.headers['authorization'] = 'Bearer $token';
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final streamed = await request.send();
    final text = await streamed.stream.bytesToString();
    final decoded = jsonDecode(text);
    if (streamed.statusCode >= 400) {
      throw ApiException(streamed.statusCode, decoded['message']?.toString() ?? 'Upload failed');
    }
    return decoded['url'] as String;
  }
}
