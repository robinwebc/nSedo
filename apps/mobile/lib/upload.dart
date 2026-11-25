import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import 'api.dart';

class MediaUpload {
  MediaUpload(this.api);
  final ApiClient api;
  HttpClient? _client;
  var cancelled = false;

  void cancel() {
    cancelled = true;
    _client?.close(force: true);
  }

  Future<Map<String, dynamic>> sendBytes({
    required List<int> bytes,
    required String filename,
    required String mime,
    String scope = 'message',
    String? postId,
    void Function(double progress)? onProgress,
  }) async {
    cancelled = false;
    final presign = Map<String, dynamic>.from(
      await api.send('POST', '/media/presign', body: {
        'mime': mime,
        'size': bytes.length,
        'filename': filename,
        'scope': scope,
        if (postId != null) 'postId': postId,
      }) as Map,
    );
    if (cancelled) throw ApiException(0, 'Upload cancelled');
    if (presign['mode'] == 's3') {
      await _put(presign['uploadUrl'] as String, bytes, mime, onProgress);
      final done = await api.send('POST', '/media/finalize', body: {'key': presign['key']});
      return Map<String, dynamic>.from(done as Map);
    }
    return _postLocal(bytes, filename, mime, scope, postId, onProgress);
  }

  Future<void> _put(String url, List<int> bytes, String mime, void Function(double progress)? onProgress) async {
    final client = HttpClient();
    _client = client;
    final request = await client.putUrl(Uri.parse(url));
    request.headers.set(HttpHeaders.contentTypeHeader, mime);
    request.contentLength = bytes.length;
    request.add(bytes);
    onProgress?.call(0.5);
    final response = await request.close();
    await response.drain<void>();
    client.close();
    if (response.statusCode >= 300) {
      throw ApiException(response.statusCode, 'Upload failed');
    }
    onProgress?.call(1);
  }

  Future<Map<String, dynamic>> _postLocal(
    List<int> bytes,
    String filename,
    String mime,
    String scope,
    String? postId,
    void Function(double progress)? onProgress,
  ) async {
    final request = http.MultipartRequest('POST', apiUri(api, '/media/upload'));
    if (api.token != null) request.headers['authorization'] = 'Bearer ${api.token}';
    request.fields['scope'] = scope;
    if (postId != null) request.fields['postId'] = postId;
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    onProgress?.call(0.4);
    final streamed = await request.send();
    final text = await streamed.stream.bytesToString();
    onProgress?.call(1);
    final decoded = text.isEmpty ? <String, dynamic>{} : Map<String, dynamic>.from((jsonDecode(text)) as Map);
    if (streamed.statusCode >= 400) {
      throw ApiException(streamed.statusCode, decoded['message']?.toString() ?? 'Upload failed');
    }
    return decoded;
  }
}

Uri apiUri(ApiClient api, String path) {
  final root = api.baseUrl.endsWith('/') ? api.baseUrl.substring(0, api.baseUrl.length - 1) : api.baseUrl;
  return Uri.parse('$root$path');
}

Future<String?> cropImageFile(String path, {required bool square}) {
  return ImageCropper()
      .cropImage(
        sourcePath: path,
        aspectRatio: CropAspectRatio(ratioX: square ? 1 : 3, ratioY: 1),
        uiSettings: [
          AndroidUiSettings(toolbarTitle: square ? 'Profile photo' : 'Cover photo', lockAspectRatio: true),
          IOSUiSettings(title: square ? 'Profile photo' : 'Cover photo', aspectRatioLockEnabled: true),
        ],
      )
      .then((file) => file?.path);
}

Future<List<int>> compressImage(String path) async {
  final bytes = await FlutterImageCompress.compressWithFile(
    path,
    quality: 80,
    minWidth: 1600,
    minHeight: 1600,
  );
  if (bytes != null) return bytes;
  return File(path).readAsBytes();
}

Future<XFile?> chooseImage(ImageSource source) {
  return ImagePicker().pickImage(source: source, imageQuality: 90);
}
