import 'package:flutter/material.dart';

const ember = Color(0xFFE4572E);
const ink = Color(0xFF14202B);
const seed = Color(0xFFF4C95D);
const mist = Color(0xFFF6F3EE);
const pine = Color(0xFF1F6F5B);

ThemeData nsedoTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: ember,
    brightness: brightness,
    primary: ember,
    surface: dark ? const Color(0xFF1A222B) : Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? ink : mist,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? ink : mist,
      foregroundColor: dark ? mist : ink,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF24303A) : Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: ember,
        foregroundColor: Colors.white,
        shape: const StadiumBorder(),
      ),
    ),
  );
}

class NsedoMark extends StatelessWidget {
  const NsedoMark({super.key, this.size = 36, this.withWord = false});

  final double size;
  final bool withWord;

  @override
  Widget build(BuildContext context) {
    final mark = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: ink,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Stack(
        children: [
          Center(
            child: Text(
              'n',
              style: TextStyle(
                color: ember,
                fontSize: size * 0.62,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
          ),
          Positioned(
            right: size * 0.12,
            top: size * 0.12,
            child: Container(
              width: size * 0.16,
              height: size * 0.16,
              decoration: const BoxDecoration(color: seed, shape: BoxShape.circle),
            ),
          ),
        ],
      ),
    );
    if (!withWord) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        const SizedBox(width: 8),
        Text('nSedo', style: Theme.of(context).textTheme.titleLarge),
      ],
    );
  }
}
