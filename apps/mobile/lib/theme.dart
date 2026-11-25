import 'package:flutter/material.dart';

/// Light-surface cobalt. White on `#2457E6` is 5.86:1.
const cobalt = Color(0xFF2457E6);

/// Dark-surface cobalt. `#6E96FF` on ink `#14202B` is 5.88:1.
const cobaltBright = Color(0xFF6E96FF);
const ink = Color(0xFF14202B);
const seed = Color(0xFFF4C95D);
const mist = Color(0xFFF6F3EE);
const pine = Color(0xFF1F6F5B);
const line = Color(0xFFE4DED4);
const muted = Color(0xFF5C6770);

const space1 = 8.0;
const space2 = 16.0;
const space3 = 24.0;
const space4 = 32.0;
const space5 = 40.0;
const space6 = 48.0;

ThemeData nsedoTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final surface = dark ? const Color(0xFF1B242C) : Colors.white;
  final background = dark ? ink : mist;
  final onSurface = dark ? mist : ink;
  final accent = dark ? cobaltBright : cobalt;
  final onAccent = dark ? ink : Colors.white;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: accent,
    onPrimary: onAccent,
    secondary: pine,
    onSecondary: Colors.white,
    error: const Color(0xFFB42318),
    onError: Colors.white,
    surface: surface,
    onSurface: onSurface,
  );
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: background,
    dividerColor: dark ? const Color(0xFF2C3842) : line,
    splashFactory: InkRipple.splashFactory,
  );
  return base.copyWith(
    textTheme: _type(base.textTheme, onSurface),
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: onSurface,
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      labelStyle: TextStyle(color: dark ? const Color(0xFFB7C0C7) : muted, fontSize: 13),
      hintStyle: TextStyle(color: dark ? const Color(0xFF8E99A1) : const Color(0xFF7A848C)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: dark ? const Color(0xFF2C3842) : line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: dark ? const Color(0xFF2C3842) : line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: accent, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: onAccent,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: onSurface,
        minimumSize: const Size(0, 44),
        side: BorderSide(color: dark ? const Color(0xFF2C3842) : line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 64,
      backgroundColor: surface,
      indicatorColor: accent.withValues(alpha: 0.16),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 11,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          color: selected ? accent : (dark ? const Color(0xFFB7C0C7) : muted),
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          size: 22,
          color: selected ? accent : (dark ? const Color(0xFFB7C0C7) : muted),
        );
      }),
    ),
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16),
      minVerticalPadding: 8,
    ),
  );
}

TextTheme _type(TextTheme base, Color color) {
  return base.copyWith(
    headlineMedium: TextStyle(fontSize: 28, height: 1.2, fontWeight: FontWeight.w700, color: color, letterSpacing: -0.4),
    titleLarge: TextStyle(fontSize: 20, height: 1.25, fontWeight: FontWeight.w700, color: color, letterSpacing: -0.2),
    titleMedium: TextStyle(fontSize: 16, height: 1.3, fontWeight: FontWeight.w600, color: color),
    bodyLarge: TextStyle(fontSize: 16, height: 1.4, fontWeight: FontWeight.w400, color: color),
    bodyMedium: TextStyle(fontSize: 15, height: 1.4, fontWeight: FontWeight.w400, color: color),
    bodySmall: TextStyle(fontSize: 13, height: 1.35, fontWeight: FontWeight.w400, color: color),
    labelLarge: TextStyle(fontSize: 13, height: 1.2, fontWeight: FontWeight.w600, color: color),
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
        borderRadius: BorderRadius.circular(size * 0.22),
        border: Border.all(color: mist.withValues(alpha: 0.18)),
      ),
      alignment: Alignment.center,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Text(
            'n',
            style: TextStyle(
              color: cobaltBright,
              fontSize: size * 0.58,
              fontWeight: FontWeight.w800,
              height: 1,
            ),
          ),
          Positioned(
            right: size * 0.14,
            top: size * 0.14,
            child: Container(
              width: size * 0.14,
              height: size * 0.14,
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
        SizedBox(width: size * 0.28),
        Text('nSedo', style: Theme.of(context).textTheme.titleLarge),
      ],
    );
  }
}

Color brandAccent(BuildContext context) {
  return Theme.of(context).brightness == Brightness.dark ? cobaltBright : cobalt;
}

String shortTime(dynamic value) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return '';
  final delta = DateTime.now().difference(parsed.toLocal());
  if (delta.inMinutes < 1) return 'now';
  if (delta.inHours < 1) return '${delta.inMinutes}m';
  if (delta.inDays < 1) return '${delta.inHours}h';
  if (delta.inDays < 7) return '${delta.inDays}d';
  final local = parsed.toLocal();
  return '${local.month}/${local.day}';
}
