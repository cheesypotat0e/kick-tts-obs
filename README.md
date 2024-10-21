# kick-tts-obs

This is a simple webpage that connects to the StreamElements chat and reads messages aloud using text-to-speech (TTS). It also allows you to play videos from Streamable and YouTube in your OBS browser source.

## Commands

- `!s`
  - Triggers the Text-to-Speech (TTS) feature.
  - You can optionally specify a voice for the TTS to use.
  - For example, to trigger TTS with the default voice, you would enter `!s This is a test message`.
  - To trigger TTS with a specific voice, you would enter `!s Brian: This is a test message`.

## Admin Only Commands

These commands can only be used by users specified as admins in the `admins` query parameter.

- `refreshTTS`
  - This is the default refresh token. When sent in chat, it will refresh the page, reconnecting to the chat and updating any settings.
- `!skip`
  - Skips the current TTS message.
- `!v`
  - Sets the volume of the TTS.
  - The volume must be a number between 0 and 1.
  - For example, to set the volume to 0.5, you would enter `!v 0.5`.
- `!st`
  - Plays a Streamable video.
  - You must include the full URL of the Streamable video in the command.
  - For example, to play a video, you would enter `!st https://streamable.com/j351dg`.
  - To clear all videos, you would enter `!st clear`.
- `!yt`
  - Plays a YouTube video.
  - You must include the full URL of the YouTube video in the command.
  - For example, to play a video, you would enter `!yt https://www.youtube.com/watch?v=dQw4w9WgXcQ`.
  - To clear all videos, you would enter `!yt clear`.
- `!config`
  - Configures the chatroom. Any `!config` command will trigger a reconnect.
  - The following subcommands are available:
    - `addadmin` - Adds a user as an admin. For example: `!config addadmin johndoe`.
    - `removeadmin` - Removes a user as an admin. For example: `!config removeadmin johndoe`.
    - `clusterID` - Sets the cluster ID. For example: `!config clusterID 1234567890`.
    - `version` - Sets the version. For example: `!config version 1.2.3`.
    - `refreshToken` - Sets the refresh token. For example: `!config refreshToken newToken`.
    - `ttsVoice` - Sets the TTS voice. For example: `!config ttsVoice Brian`.

## Example Link with Parameters

`cheesypotat0e.github.io/kick-tts-obs/?roomId=88774&version=8.4.0-rc2&clusterID=32cbd69e4b950bf97679&refreshToken=refreshTTS&ttsVoice=Brian&admins=cheesypotatoe`

## Query Parameters

| Parameter      | Description                                                         | Default Value          | Example                |
| :------------- | :------------------------------------------------------------------ | :--------------------- | :--------------------- |
| `roomId`       | The ID of the chatroom to connect to.                               | None (required)        | `88774`                |
| `version`      | The version of the StreamElements API to use.                       | `8.4.0-rc2`            | `8.4.0-rc2`            |
| `clusterID`    | The ID of the StreamElements cluster to use.                        | `32cbd69e4b950bf97679` | `32cbd69e4b950bf97679` |
| `refreshToken` | The token to use for refreshing the chatroom connection.            | `refreshTTS`           | `refreshTTS`           |
| `ttsVoice`     | The default voice to use for TTS.                                   | `Brian`                | `Amy`                  |
| `admins`       | A comma-separated list of usernames who are admins of the chatroom. | None                   | `cheesypotatoe`        |

## Important Notes

- The `roomId` parameter is required. All other parameters are optional.
- If you change any of the optional parameters, you will need to refresh the page for the changes to take effect.
- If you are testing withing a browser, interact with the page before sending a message to enable audio playback.
- The `refreshToken` parameter is used to refresh the the app page or OBS source to reset the config or to get the latest app version
