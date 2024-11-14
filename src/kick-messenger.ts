import { Messenger } from "./messenger";

type KickMessengerSettings = {
  clusterID: string;
  version: string;
  roomID: string;
};

type KickEvent = {
  event: string;
  data: {
    id: string;
    chatroom_id: string;
    content: string;
    type: string;
    created_at: string;
    sender: {
      id: string;
      username: string;
      slug: string;
      identity: {
        color: string;
        badges: {
          type: string;
          text: string;
        }[];
      };
    };
  };
  channel: string;
};

export class KickMessenger extends Messenger {
  settings: KickMessengerSettings;
  static ChatMessageEvent = "App\\Events\\ChatMessageEvent";

  constructor(settings: KickMessengerSettings) {
    super();
    this.settings = settings;

    this.onmessage = this.onKickMessage;
  }

  public async connect() {
    const url = this.getURL();

    await super.connect(url, { timeout: 2000 });
  }

  onKickMessage = (event: any) => {
    try {
      const eventData = JSON.parse(event.data) as KickEvent;

      if (eventData.event == KickMessenger.ChatMessageEvent) {
        const message = eventData.data.content;
        const senderUsername = eventData.data.sender.slug;

        // parse the message

        const commands = this.parse(message);

        super.pushToQueue({
          text: message,
          username: senderUsername,
          commands,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  public parse(message: string) {
    message.trim();
    const tokens = message.split(" ");

    const groups: string[][] = [];

    let cmd: string | undefined;

    for (const token of tokens) {
      if (token.startsWith("!")) {
        groups.push([]);
      } else if (cmd) {
        const len = groups.length - 1;
        groups[len].push(token);
      }
    }

    return groups;
  }

  private getURL() {
    const { clusterID, version } = this.settings;

    return `wss://ws-us2.pusher.com/app/${clusterID}?protocol=7&client=js&version=${version}&flash=false`;
  }
}
