import 'package:flutter_test/flutter_test.dart';
import 'package:nsedo/api.dart';
import 'package:nsedo/server_check.dart';

void main() {
  test('blank saved server URL does not override the default', () {
    expect(resolveApiUrl(null), defaultApiUrl);
    expect(resolveApiUrl(''), defaultApiUrl);
    expect(resolveApiUrl('   '), defaultApiUrl);
  });

  test('health URL is the live host with a single /health path', () {
    expect(
      healthUri(defaultApiUrl).toString(),
      'https://nsedo-api.onrender.com/health',
    );
    expect(
      healthUri('https://nsedo-api.onrender.com/').toString(),
      'https://nsedo-api.onrender.com/health',
    );
    expect(
      healthUri('nsedo-api.onrender.com').toString(),
      'https://nsedo-api.onrender.com/health',
    );
  });

  test('health check succeeds against the live API', () async {
    final result = await checkHealth(defaultApiUrl);
    expect(result.ok, isTrue, reason: result.message);
  });
}
