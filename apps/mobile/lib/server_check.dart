import 'dart:async';
import 'dart:io';

import 'api.dart';

const healthTimeout = Duration(seconds: 70);
const connectTimeout = Duration(seconds: 12);

String resolveApiUrl(String? saved, {String fallback = defaultApiUrl}) {
  final trimmed = saved?.trim() ?? '';
  if (trimmed.isEmpty) return _strip(fallback);
  return _strip(trimmed.contains('://') ? trimmed : 'https://$trimmed');
}

String _strip(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return defaultApiUrl;
  return trimmed.replaceAll(RegExp(r'/+$'), '');
}

Uri healthUri(String baseUrl) {
  return Uri.parse('${resolveApiUrl(baseUrl)}/health');
}

class HealthResult {
  const HealthResult({required this.ok, this.message});

  final bool ok;
  final String? message;
}

Future<HealthResult> checkHealth(
  String baseUrl, {
  Duration timeout = healthTimeout,
}) {
  final uri = healthUri(baseUrl);
  return _get(uri).timeout(
    timeout,
    onTimeout: () {
      return const HealthResult(
        ok: false,
        message: 'The server did not respond in time.',
      );
    },
  );
}

Future<HealthResult> _get(Uri uri) async {
  final client = HttpClient()..connectionTimeout = connectTimeout;
  try {
    final request = await client.getUrl(uri);
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    final response = await request.close();
    await response.drain<void>();
    if (response.statusCode == 200) {
      return const HealthResult(ok: true);
    }
    return HealthResult(
      ok: false,
      message: 'Server returned ${response.statusCode}.',
    );
  } on TimeoutException {
    return const HealthResult(
      ok: false,
      message: 'The server did not respond in time.',
    );
  } catch (error) {
    return HealthResult(ok: false, message: explainError(error));
  } finally {
    client.close(force: true);
  }
}
