import { useSession } from './session';

export function reportError(
  error: unknown,
  source: 'renderer' | 'boundary' = 'renderer',
) {
  const message = error instanceof Error ? error.message : String(error);
  useSession
    .getState()
    .setNotice(
      'Something went wrong. Please retry or restart the application.',
    );
  void window.desktop
    ?.logError({ source, message: message.slice(0, 1000) || 'Unknown error' })
    .then((result) => {
      if (!result.recorded)
        useSession
          .getState()
          .setNotice(
            'An error occurred and the diagnostic could not be written. Please restart the application.',
          );
    })
    .catch(() => {
      useSession
        .getState()
        .setNotice(
          'The desktop connection is unavailable. Please restart the application.',
        );
    });
}
