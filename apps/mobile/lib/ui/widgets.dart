import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../session.dart';
import '../theme.dart';

class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.user, this.radius = 20});

  final Map<String, dynamic>? user;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final name = (user?['displayName'] ?? user?['username'] ?? '?').toString();
    final letter = name.isEmpty ? '?' : name.characters.first.toUpperCase();
    final photo = user?['avatarUrl']?.toString();
    return CircleAvatar(
      radius: radius,
      backgroundColor: ink,
      foregroundColor: mist,
      backgroundImage: photo != null && photo.isNotEmpty ? NetworkImage(photo) : null,
      child: photo == null || photo.isEmpty
          ? Text(letter, style: TextStyle(fontSize: radius * 0.8, fontWeight: FontWeight.w600))
          : null,
    );
  }
}

class Hairline extends StatelessWidget {
  const Hairline({super.key});

  @override
  Widget build(BuildContext context) {
    return Divider(height: 1, thickness: 1, color: Theme.of(context).dividerColor);
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.title, this.detail});

  final String title;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.62);
    return Padding(
      padding: const EdgeInsets.all(space4),
      child: Column(
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          if (detail != null) ...[
            const SizedBox(height: space1),
            Text(detail!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: mutedColor)),
          ],
        ],
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(space3),
      child: Column(
        children: [
          Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: space2),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, required this.height, this.width, this.radius = 4});

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class FeedSkeleton extends StatelessWidget {
  const FeedSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(4, (index) {
        return const Padding(
          padding: EdgeInsets.fromLTRB(space2, space2, space2, space2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(height: 40, width: 40, radius: 20),
              SizedBox(width: space2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(height: 12, width: 160),
                    SizedBox(height: space1),
                    SkeletonBox(height: 12),
                    SizedBox(height: 6),
                    SkeletonBox(height: 12, width: 220),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

class PostTile extends StatelessWidget {
  const PostTile({
    super.key,
    required this.post,
    required this.session,
    this.repost,
    this.onOpen,
    this.onChanged,
  });

  final Map<String, dynamic> post;
  final Map<String, dynamic>? repost;
  final Session session;
  final VoidCallback? onOpen;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final author = Map<String, dynamic>.from(post['author'] as Map? ?? {});
    final mutedColor = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.62);
    final media = post['mediaUrl']?.toString();
    return InkWell(
      onTap: onOpen,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(space2, 12, space2, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            UserAvatar(user: author),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (repost != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        'Reposted by @${(repost!['user'] as Map)['username']}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: mutedColor),
                      ),
                    ),
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${author['displayName'] ?? ''}${author['verifiedBadge'] == true ? ' ✓' : ''}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        TextSpan(
                          text: '  @${author['username'] ?? ''}  ${shortTime(post['createdAt'])}',
                          style: TextStyle(color: mutedColor, fontSize: 13, fontWeight: FontWeight.w400),
                        ),
                      ],
                    ),
                  ),
                  if (repost?['quote'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(repost!['quote'].toString(), style: Theme.of(context).textTheme.bodyMedium),
                    ),
                  if ((post['body']?.toString() ?? '').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(post['body'].toString(), style: Theme.of(context).textTheme.bodyMedium),
                    ),
                  if (media != null && media.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: space1),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(media, height: 180, width: double.infinity, fit: BoxFit.cover),
                      ),
                    ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _Count(icon: Icons.chat_bubble_outline, count: post['commentCount'], onTap: onOpen),
                      _Count(
                        icon: Icons.repeat,
                        count: post['repostCount'],
                        onTap: () async {
                          await session.repost(post['id'] as String);
                          onChanged?.call();
                        },
                      ),
                      _Count(
                        icon: post['likedByMe'] == true ? Icons.favorite : Icons.favorite_border,
                        count: post['likeCount'],
                        color: post['likedByMe'] == true ? ember : null,
                        onTap: () async {
                          await session.like(post['id'] as String);
                          onChanged?.call();
                        },
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        onPressed: () {
                          final url = post['shareUrl']?.toString();
                          if (url != null && url.isNotEmpty) {
                            SharePlus.instance.share(ShareParams(text: url));
                          }
                        },
                        icon: Icon(Icons.ios_share, size: 18, color: mutedColor),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.icon, required this.count, this.onTap, this.color});

  final IconData icon;
  final dynamic count;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.62);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          children: [
            Icon(icon, size: 18, color: tint),
            const SizedBox(width: 4),
            Text('${count ?? 0}', style: TextStyle(fontSize: 12, color: tint)),
          ],
        ),
      ),
    );
  }
}
